import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { clear } from "idb-keyval";
import {
  isBackupDue, serializeBackup, backupFilename, getLastBackup, setLastBackup,
} from "./backup";
import { dk } from "./dates";
import type { PersistedState } from "../types";

const sample: PersistedState = {
  habits: [], logs: {}, units: [], config: { numMonths: 4, monthGap: 5 },
};

beforeEach(async () => { await clear(); });

describe("isBackupDue", () => {
  it("is due when never backed up", () => {
    expect(isBackupDue(null)).toBe(true);
    expect(isBackupDue(undefined)).toBe(true);
  });
  it("is not due when last backup was today", () => {
    expect(isBackupDue(new Date().toISOString())).toBe(false);
  });
  it("is due when last backup was a previous day", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isBackupDue(yesterday.toISOString())).toBe(true);
  });
  it("treats an unparseable timestamp as due", () => {
    expect(isBackupDue("not-a-date")).toBe(true);
  });
});

describe("serializeBackup / backupFilename", () => {
  it("serializes to parseable JSON", () => {
    expect(JSON.parse(serializeBackup(sample))).toEqual(sample);
  });
  it("names the file with the date key", () => {
    const d = new Date(2026, 4, 24);
    expect(backupFilename(d)).toBe(`habit-tracker-backup-${dk(d)}.json`);
  });
});

describe("getLastBackup / setLastBackup", () => {
  it("round-trips and returns null when unset", async () => {
    expect(await getLastBackup()).toBeNull();
    const iso = new Date().toISOString();
    await setLastBackup(iso);
    expect(await getLastBackup()).toBe(iso);
  });
});
