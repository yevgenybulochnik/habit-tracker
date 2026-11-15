import { describe, it, expect, vi, afterEach } from "vitest";
import { newId } from "./ids";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newId", () => {
  it("is a random UUID after the prefix", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "0b9c4f3e-1d2a-4b5c-8d6e-7f8091a2b3c4",
    });
    expect(newId("h")).toBe("h_0b9c4f3e-1d2a-4b5c-8d6e-7f8091a2b3c4");
  });

  // randomUUID exists only in secure contexts, so not on plain-HTTP devbox.lan
  it("falls back to random hex where randomUUID is missing", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: real.getRandomValues.bind(real),
    });
    const a = newId("m");
    const b = newId("m");
    expect(a).toMatch(/^m_[0-9a-f]{32}$/);
    expect(b).toMatch(/^m_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
