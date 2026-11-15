import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLongPress, type LongPressHandlers } from "./useLongPress";

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(options?: Parameters<typeof useLongPress>[1]) {
  const onLongPress = vi.fn();
  const hook = renderHook(({ cb, opts }) => useLongPress(cb, opts), {
    initialProps: { cb: onLongPress, opts: options },
  });
  const fire = (name: keyof LongPressHandlers) =>
    act(() => hook.result.current.handlers[name]());
  return { onLongPress, hook, fire };
}

describe("useLongPress", () => {
  it.each(["onMouseDown", "onTouchStart"] as const)(
    "fires after holding for 500ms from %s",
    (start) => {
      const { onLongPress, hook, fire } = setup();
      fire(start);
      expect(hook.result.current.pressing).toBe(true);

      advance(499);
      expect(onLongPress).not.toHaveBeenCalled();

      advance(1);
      expect(onLongPress).toHaveBeenCalledOnce();
      expect(hook.result.current.pressing).toBe(false);
    },
  );

  it.each([
    "onMouseUp",
    "onMouseLeave",
    "onTouchEnd",
    "onTouchCancel",
  ] as const)("is cancelled by %s before the delay", (end) => {
    const { onLongPress, hook, fire } = setup();
    fire("onMouseDown");
    advance(300);
    fire(end);
    expect(hook.result.current.pressing).toBe(false);

    advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("takes a custom delay", () => {
    const { onLongPress, fire } = setup({ delay: 200 });
    fire("onMouseDown");
    advance(200);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const { onLongPress, hook, fire } = setup({ disabled: true });
    fire("onMouseDown");
    expect(hook.result.current.pressing).toBe(false);
    advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("restarts the wait when pressed again without a release", () => {
    const { onLongPress, fire } = setup();
    fire("onTouchStart");
    advance(300);
    fire("onMouseDown");
    advance(300);
    expect(onLongPress).not.toHaveBeenCalled();
    advance(200);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("calls the latest callback", () => {
    const { onLongPress, hook, fire } = setup();
    const latest = vi.fn();
    fire("onMouseDown");
    hook.rerender({ cb: latest, opts: undefined });
    advance(500);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it("clears its timer when unmounted", () => {
    const { onLongPress, hook, fire } = setup();
    fire("onMouseDown");
    expect(vi.getTimerCount()).toBe(1);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
