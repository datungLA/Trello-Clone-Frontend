export const backupTabs = ["connection", "configuration", "history", "guide"];
export const backupDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const activeBackup = run => ["pending", "running"].includes(run?.status);
export function backupTab(search) {
  const value = new URLSearchParams(search).get("tab");
  return backupTabs.includes(value) ? value : "connection";
}
export function scheduleDescription(schedule) {
  if (!schedule) return "Schedule not configured";
  const time = `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
  return `${schedule.frequency === "weekly" ? `Every ${backupDays[schedule.dayOfWeek]}` : "Every day"} at ${time}`;
}
export function backupSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "Not recorded";
  const size = Number(bytes);
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
export function backupSettingsBody(draft) {
  const [hour, minute] = draft.time.split(":").map(Number);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error("Choose a valid backup time.");
  const retentionCount = Number(draft.retentionCount);
  if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 30) throw new Error("Keep between 1 and 30 backups.");
  try { new Intl.DateTimeFormat("en", { timeZone: draft.timezone }).format(); } catch { throw new Error("Enter a valid IANA timezone, such as America/Los_Angeles."); }
  if (!draft.scopeDb && !draft.scopeConfigs) throw new Error("Choose at least one backup scope.");
  return { enabled: draft.enabled, schedule: { frequency: draft.frequency, hour, minute, dayOfWeek: Number(draft.dayOfWeek), timezone: draft.timezone }, retentionCount, scopeDb: draft.scopeDb, scopeConfigs: draft.scopeConfigs, remoteFolder: draft.remoteFolder };
}
export function settingsDraft(settings) {
  const schedule = settings.schedule;
  return { enabled: settings.enabled, frequency: schedule.frequency, time: `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`, dayOfWeek: String(schedule.dayOfWeek), timezone: schedule.timezone, retentionCount: String(settings.retentionCount), scopeDb: settings.scopeDb, scopeConfigs: settings.scopeConfigs, remoteFolder: settings.remoteFolder };
}
