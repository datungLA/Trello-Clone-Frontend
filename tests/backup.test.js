import assert from "node:assert/strict";
import { test } from "node:test";
import { activeBackup, backupSettingsBody, backupTab, scheduleDescription, settingsDraft } from "../src/backup-data.js";

const settings = { enabled: false, schedule: { frequency: "weekly", hour: 2, minute: 5, dayOfWeek: 1, timezone: "America/Los_Angeles" }, retentionCount: 7, scopeDb: true, scopeConfigs: false, remoteFolder: "Trello Clone Dev Backups" };
test("backup deep links ignore unknown tabs and identify only unfinished jobs as active", () => {
  assert.equal(backupTab("?tab=history&backupConnection=connected"), "history");
  assert.equal(backupTab("?tab=__proto__"), "connection");
  assert.equal(activeBackup({ status: "running" }), true);
  assert.equal(activeBackup({ status: "success" }), false);
  assert.equal(activeBackup(null), false);
});
test("backup configuration retains timezone, day, leading-zero time and selected scopes", () => {
  const draft = settingsDraft(settings);
  assert.equal(draft.time, "02:05");
  assert.equal(scheduleDescription(settings.schedule), "Every Monday at 02:05");
  assert.deepEqual(backupSettingsBody(draft), settings);
});
test("invalid backup settings fail before saving rather than scheduling an unintended backup", () => {
  const draft = settingsDraft(settings);
  for (const changed of [{ time: "25:00" }, { retentionCount: "0" }, { retentionCount: "31" }, { timezone: "Not/A_Zone" }, { scopeDb: false, scopeConfigs: false }]) {
    assert.throws(() => backupSettingsBody({ ...draft, ...changed }));
  }
});
