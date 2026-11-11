import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadJson } from "./download";
import { captureDownloads } from "./test/downloads";

let downloads: ReturnType<typeof captureDownloads>;

beforeEach(() => {
  downloads = captureDownloads();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadJson", () => {
  it("downloads the data as a formatted JSON file", async () => {
    const data = { habits: [], logs: {} };
    downloadJson("backup.json", data);
    expect(await downloads.files()).toEqual([
      {
        name: "backup.json",
        type: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ]);
  });

  it("writes a string as it is", async () => {
    downloadJson("raw.json", '{"habits":"none"}');
    expect((await downloads.files())[0].text).toBe('{"habits":"none"}');
  });

  it("still writes something for data JSON can't represent", async () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    downloadJson("raw.json", loop);
    expect((await downloads.files())[0].text).toBe("[object Object]");
  });

  it("removes its link and releases the object URL afterwards", () => {
    downloadJson("backup.json", {});
    expect(document.querySelector("a")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
  });
});
