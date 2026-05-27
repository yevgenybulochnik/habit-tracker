import { describe, it, expect } from "vitest";
import { reorderById } from "./reorder";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("reorderById", () => {
  it("moves an item down (before a later item)", () => {
    expect(reorderById(items, "a", "c").map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("moves an item up (before an earlier item)", () => {
    expect(reorderById(items, "d", "b").map((i) => i.id)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("is a no-op when active and over are the same", () => {
    const out = reorderById(items, "b", "b");
    expect(out.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("is a no-op when an id is not found", () => {
    expect(reorderById(items, "z", "b").map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(reorderById(items, "a", "z").map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("returns a new array (does not mutate the input)", () => {
    const out = reorderById(items, "a", "c");
    expect(out).not.toBe(items);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});
