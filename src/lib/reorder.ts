/**
 * Move the item with `activeId` to the position of `overId`, returning a new
 * array. No-op (returns a shallow copy) if either id is missing or they match.
 * Pure and framework-agnostic — the drag library only supplies the two ids.
 */
export function reorderById<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): T[] {
  const from = items.findIndex((i) => i.id === activeId);
  const to = items.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1 || from === to) return items.slice();
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
