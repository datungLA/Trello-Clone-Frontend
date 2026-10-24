let accessToken = null;
let renewal = null;
let onExpired = () => {};
export function setExpiredHandler(handler) {
  onExpired = handler;
}
export function setAccessToken(value) {
  accessToken = value;
}
async function parse(response) {
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      body.error?.message || `Request failed (${response.status}).`,
    );
    error.status = response.status;
    error.code = body.error?.code;
    throw error;
  }
  return body;
}
async function authMutation(path, data) {
  const csrf = await parse(
    await fetch("/api/auth/csrf", { credentials: "include" }),
  );
  if (path === "renew" && csrf.hasSession === false) {
    accessToken = null;
    throw Object.assign(new Error("Sign in to continue."), {
      status: 401,
      code: "TOKEN_INVALID",
    });
  }
  return parse(
    await fetch(`/api/auth/${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf.csrfToken,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(data || {}),
    }),
  );
}
export async function renew() {
  if (!renewal)
    renewal = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const data = await authMutation("renew");
          accessToken = data.accessToken;
          return data;
        } catch (error) {
          if (error.code !== "RENEW_IN_PROGRESS" || attempt === 2) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 300 * (attempt + 1)),
          );
        }
      }
    })().finally(() => {
      renewal = null;
    });
  return renewal;
}
export async function logout() {
  try {
    await authMutation("logout");
  } catch (error) {
    if (error.status !== 401) throw error;
    await renew();
    await authMutation("logout");
  }
  accessToken = null;
}
export async function api(path, options = {}, retry = true) {
  const { body, ...rest } = options;
  const response = await fetch(`/api${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const protectedAuthPath = path === "/auth/me" || path === "/auth/sessions" || path.startsWith("/auth/sessions/");
  if (response.status === 401 && retry && (!path.startsWith("/auth/") || protectedAuthPath)) {
    try {
      await renew();
    } catch (error) {
      accessToken = null;
      onExpired();
      throw error;
    }
    return api(path, options, false);
  }
  return parse(response);
}
