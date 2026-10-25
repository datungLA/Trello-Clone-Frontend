import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const originalFetch = globalThis.fetch;
let moduleId = 0;
const freshClient = () => import(`../src/api.js?test=${moduleId++}`);
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const unauthorized = () =>
  response({ error: { code: "TOKEN_EXPIRED", message: "Expired token" } }, 401);

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("anonymous bootstrap skips renewal when no refresh cookie exists", async () => {
  const client = await freshClient();
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return response({ csrfToken: "csrf", hasSession: false });
  };
  await assert.rejects(client.renew(), error => error.code === "TOKEN_INVALID");
  assert.deepEqual(requests, ["/api/auth/csrf"]);
});

test("logout sends the JWT and CSRF token without exposing refresh cookies", async () => {
  const client = await freshClient();
  client.setAccessToken("access-before-logout");
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return url.endsWith("/csrf")
      ? response({ csrfToken: "csrf-123" })
      : response({ success: true });
  };

  await client.logout();
  assert.equal(requests[1].url, "/api/auth/logout");
  assert.equal(
    requests[1].options.headers.Authorization,
    "Bearer access-before-logout",
  );
  assert.equal(requests[1].options.headers["X-CSRF-Token"], "csrf-123");
  assert.equal(requests[1].options.credentials, "include");
  await client.api("/health");
  assert.equal(requests[2].options.headers.Authorization, undefined);
});

test("concurrent expired requests share one refresh and retry with the new JWT", async () => {
  const client = await freshClient();
  client.setAccessToken("expired");
  let refreshes = 0;
  let csrfRequests = 0;
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  const resourceHeaders = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) {
      csrfRequests++;
      return response({ csrfToken: "csrf" });
    }
    if (url.endsWith("/renew")) {
      refreshes++;
      await refreshGate;
      return response({ user: { id: "user-1" }, accessToken: "renewed" });
    }
    resourceHeaders.push(options.headers.Authorization);
    return options.headers.Authorization === "Bearer renewed"
      ? response({ url })
      : unauthorized();
  };

  const requests = [client.api("/workspaces"), client.api("/boards/board-1")];
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshes, 1);
  releaseRefresh();
  const results = await Promise.all(requests);
  assert.deepEqual(results, [
    { url: "/api/workspaces" },
    { url: "/api/boards/board-1" },
  ]);
  assert.equal(csrfRequests, 1);
  assert.deepEqual(
    resourceHeaders.sort(),
    [
      "Bearer expired",
      "Bearer expired",
      "Bearer renewed",
      "Bearer renewed",
    ].sort(),
  );
});

test("a 401 retries a write once and preserves its body and idempotency ID", async () => {
  const client = await freshClient();
  client.setAccessToken("old");
  const writes = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return response({ csrfToken: "csrf" });
    if (url.endsWith("/renew"))
      return response({ accessToken: "new", user: { id: "user" } });
    writes.push(options);
    return writes.length === 1
      ? unauthorized()
      : response({ id: "stable-id", title: "A task" });
  };

  const result = await client.api("/lists/list-1/cards", {
    method: "POST",
    body: { id: "stable-id", title: "A task" },
  });
  assert.equal(result.id, "stable-id");
  assert.equal(writes.length, 2);
  assert.equal(writes[0].body, writes[1].body);
  assert.equal(writes[1].method, "POST");
  assert.equal(writes[1].headers.Authorization, "Bearer new");
});

test("failed refresh clears the JWT, signals expiry, and does not retry the resource", async () => {
  const client = await freshClient();
  client.setAccessToken("invalid");
  let expired = 0;
  let resources = 0;
  let probeHeaders;
  client.setExpiredHandler(() => {
    expired++;
  });
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return response({ csrfToken: "csrf" });
    if (url.endsWith("/renew"))
      return response(
        { error: { code: "INVALID_TOKEN", message: "Refresh revoked" } },
        401,
      );
    if (url.endsWith("/health")) {
      probeHeaders = options.headers;
      return response({ status: "ok" });
    }
    resources++;
    return unauthorized();
  };

  await assert.rejects(
    client.api("/workspaces"),
    (error) => error.code === "INVALID_TOKEN",
  );
  assert.equal(expired, 1);
  assert.equal(resources, 1);
  await client.api("/health");
  assert.equal(probeHeaders.Authorization, undefined);
});

test("refresh grace conflicts retry renewal instead of expiring the session", async () => {
  const client = await freshClient();
  let renewals = 0;
  let expired = false;
  client.setExpiredHandler(() => {
    expired = true;
  });
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf"))
      return response({ csrfToken: `csrf-${renewals}` });
    renewals++;
    if (renewals === 1)
      return response(
        {
          error: { code: "RENEW_IN_PROGRESS", message: "Refresh in progress" },
        },
        409,
      );
    return response({
      accessToken: "renewed-after-conflict",
      user: { id: "user" },
    });
  };

  const result = await client.renew();
  assert.equal(result.accessToken, "renewed-after-conflict");
  assert.equal(renewals, 2);
  assert.equal(expired, false);
});

test("a second unauthorized response stops retrying rather than looping", async () => {
  const client = await freshClient();
  let resources = 0;
  let renewals = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf")) return response({ csrfToken: "csrf" });
    if (url.endsWith("/renew")) {
      renewals++;
      return response({ accessToken: "still-invalid" });
    }
    resources++;
    return unauthorized();
  };
  await assert.rejects(
    client.api("/workspaces"),
    (error) => error.status === 401,
  );
  assert.equal(resources, 2);
  assert.equal(renewals, 1);
});


test("session management renews expired access before retrying protected auth requests", async () => {
  const client = await freshClient();
  client.setAccessToken("expired");
  const headers = [];
  let renewals = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return response({ csrfToken: "csrf" });
    if (url.endsWith("/renew")) {
      renewals++;
      return response({ accessToken: "renewed" });
    }
    headers.push(options.headers.Authorization);
    return options.headers.Authorization === "Bearer renewed"
      ? response([{ id: "session-family", current: true }])
      : unauthorized();
  };
  assert.deepEqual(await client.api("/auth/sessions"), [{ id: "session-family", current: true }]);
  assert.equal(renewals, 1);
  assert.deepEqual(headers, ["Bearer expired", "Bearer renewed"]);
});


test("administrator permission denial preserves the ordinary user session", async () => {
  const client = await freshClient();
  client.setAccessToken("ordinary-user");
  let expired = false;
  client.setExpiredHandler(() => { expired = true; });
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, authorization: options.headers.Authorization });
    return url === "/api/admin/overview"
      ? response({ error: { code: "FORBIDDEN", message: "Administrator access required." } }, 403)
      : response([]);
  };
  await assert.rejects(client.api("/admin/overview"), error => error.status === 403);
  await client.api("/workspaces");
  assert.equal(expired, false);
  assert.deepEqual(requests, [
    { url: "/api/admin/overview", authorization: "Bearer ordinary-user" },
    { url: "/api/workspaces", authorization: "Bearer ordinary-user" },
  ]);
});

test("password change includes CSRF, confirms current credentials, and clears access after success", async () => {
  const client = await freshClient();
  client.setAccessToken("signed-in");
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return url.endsWith("/csrf") ? response({ csrfToken: "csrf-security" }) : response({ message: "Password changed." });
  };
  await client.changePassword("current-password", "new-long-password");
  const mutation = requests[1];
  assert.equal(mutation.url, "/api/auth/change-password");
  assert.deepEqual(JSON.parse(mutation.options.body), { currentPassword: "current-password", newPassword: "new-long-password" });
  assert.equal(mutation.options.headers.Authorization, "Bearer signed-in");
  assert.equal(mutation.options.headers["X-CSRF-Token"], "csrf-security");
  await client.api("/health");
  assert.equal(requests[2].options.headers.Authorization, undefined);
});

test("global signout renews expired access and clears the replacement token", async () => {
  const client = await freshClient();
  client.setAccessToken("expired");
  const signouts = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return response({ csrfToken: "csrf" });
    if (url.endsWith("/renew")) return response({ accessToken: "renewed" });
    if (url.endsWith("/logout-all")) {
      signouts.push(options);
      return options.headers.Authorization === "Bearer renewed" ? response({ success: true }) : unauthorized();
    }
    assert.equal(options.headers.Authorization, undefined);
    return response({ status: "ok" });
  };
  await client.logoutAll();
  assert.equal(signouts.length, 2);
  assert.deepEqual(JSON.parse(signouts[1].body), { confirm: true });
  assert.equal(signouts[1].headers["X-CSRF-Token"], "csrf");
  await client.api("/health");
});

test("rejected password change keeps the current session and does not retry credentials", async () => {
  const client = await freshClient();
  client.setAccessToken("current-session");
  let mutations = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/csrf")) return response({ csrfToken: "csrf" });
    if (url.endsWith("/change-password")) {
      mutations++;
      return response({ error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect." } }, 403);
    }
    assert.equal(options.headers.Authorization, "Bearer current-session");
    return response({ status: "ok" });
  };
  await assert.rejects(client.changePassword("incorrect", "new-long-password"), error => error.code === "INVALID_CREDENTIALS");
  assert.equal(mutations, 1);
  await client.api("/health");
});

test("closed setup status remains a 404 without session renewal or credential persistence", async () => {
  const client = await freshClient();
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return response({ error: { code: "NOT_FOUND", message: "Not found." } }, 404);
  };
  await assert.rejects(client.api("/auth/bootstrap/status"), error => error.status === 404);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/auth/bootstrap/status");
  assert.equal(requests[0].options.body, undefined);
});
