import { vi } from "vitest";

export type DownloadedFile = { name: string; type: string; text: string };

function readText(blob: Blob): Promise<string> {
  // jsdom's Blob has no text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/**
 * Stand in for the browser's file-download plumbing, which jsdom lacks, and
 * record each file a test downloads. Call it in `beforeEach`; the click spy is
 * undone by `vi.restoreAllMocks()`.
 */
export function captureDownloads() {
  const blobs = new Map<string, Blob>();
  const clicked: { url: string; name: string }[] = [];
  const url = URL as unknown as {
    createObjectURL: (b: Blob) => string;
    revokeObjectURL: (u: string) => void;
  };
  url.createObjectURL = vi.fn((b: Blob) => {
    const u = `blob:mock-${blobs.size + 1}`;
    blobs.set(u, b);
    return u;
  });
  url.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ url: this.href, name: this.download });
  });

  return {
    /** The files downloaded so far, oldest first. */
    async files(): Promise<DownloadedFile[]> {
      return Promise.all(
        clicked.map(async ({ url, name }) => {
          const blob = blobs.get(url)!;
          return { name, type: blob.type, text: await readText(blob) };
        }),
      );
    },
  };
}
