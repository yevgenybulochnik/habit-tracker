import { get, set } from "idb-keyval";
import type { PersistedState } from "../types";
import { dk } from "./dates";

const LAST_BACKUP_KEY = "habit-tracker-last-backup"; // ISO timestamp string

export function serializeBackup(state: PersistedState): string {
  return JSON.stringify(state, null, 2);
}

export function backupFilename(d: Date = new Date()): string {
  return `habit-tracker-backup-${dk(d)}.json`;
}

/** Due if there has never been a backup, or the last one was on an earlier day. */
export function isBackupDue(lastBackupAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastBackupAt) return true;
  const last = new Date(lastBackupAt);
  if (isNaN(last.getTime())) return true;
  return dk(last) !== dk(now); // once per calendar day
}

export async function getLastBackup(): Promise<string | null> {
  return (await get<string>(LAST_BACKUP_KEY)) ?? null;
}

export async function setLastBackup(iso: string): Promise<void> {
  await set(LAST_BACKUP_KEY, iso);
}

/** Trigger a browser download of the state as a JSON backup file. */
export function downloadBackup(state: PersistedState): void {
  const blob = new Blob([serializeBackup(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
