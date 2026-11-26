import { MONTHS } from "./defaults";
import { dk, parseKey } from "./dates";
import type { CalendarView } from "./calendarNav";

export type Cell = {
  key: string;
  date: Date;
  x: number;
  y: number;
  w: number;
  h: number;
  future: boolean;
};
export type MLabel = {
  key: string;
  label: string;
  x: number;
  y: number;
  anchor?: string;
};
export type Layout = { cells: Cell[]; mLabels: MLabel[] };

/**
 * Every day of the `numMonths` whole months ending with the month of `today`
 * (a date key), shifted by `monthOffset` months (negative = further back).
 */
export function getRecentDays(
  numMonths: number,
  monthOffset: number,
  today: string,
): Date[] {
  const now = parseKey(today),
    off = monthOffset || 0;
  const endMonth = new Date(now.getFullYear(), now.getMonth() + off + 1, 0);
  const startMonth = new Date(
    endMonth.getFullYear(),
    endMonth.getMonth() - (numMonths - 1),
    1,
  );
  const days: Date[] = [];
  let d = new Date(startMonth);
  while (d <= endMonth) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function countHeatCols(days: Date[], mg: number): number {
  let cols = 1,
    curM = -1;
  const continuous = mg === 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i],
      m = day.getMonth();
    let dow = day.getDay();
    dow = dow === 0 ? 6 : dow - 1;
    if (!continuous && m !== curM) {
      if (curM !== -1) cols++;
      curM = m;
    } else if (continuous) curM = m;
    const next = days[i + 1];
    if (next) {
      let nd = next.getDay();
      nd = nd === 0 ? 6 : nd - 1;
      const sameBlock = continuous || next.getMonth() === curM;
      if (sameBlock && nd <= dow) cols++;
    }
  }
  return cols;
}

export function countMonthBlocks(days: Date[]): number {
  let c = 0,
    pm = -1;
  for (const d of days) {
    const m = d.getMonth();
    if (m !== pm) {
      c++;
      pm = m;
    }
  }
  return c;
}

export function fitCellSize(
  days: Date[],
  cw: number,
  view: string,
  cg: number,
  lp: number,
  mg: number,
): number {
  const avail = cw - 2 * lp;
  if (view === "heatmap") {
    const cols = countHeatCols(days, mg);
    const nGaps = mg > 0 ? countMonthBlocks(days) - 1 : 0;
    const usable = avail - nGaps * mg - (cols - 1) * cg;
    return Math.max(6, Math.min(20, usable / cols));
  } else {
    const nM = countMonthBlocks(days);
    const usable = avail - (nM - 1) * mg - nM * 6 * cg;
    return Math.max(6, Math.min(20, usable / (7 * nM)));
  }
}

export function compactHeatLayout(
  days: Date[],
  cs: number,
  cg: number,
  lp: number,
  tp: number,
  monthGap: number,
  today: string,
): Layout {
  const cells: Cell[] = [],
    mLabels: MLabel[] = [];
  const continuous = monthGap === 0;
  let curX = lp,
    curM = -1;
  for (let i = 0; i < days.length; i++) {
    const day = days[i],
      key = dk(day),
      m = day.getMonth(),
      y = day.getFullYear();
    let dow = day.getDay();
    dow = dow === 0 ? 6 : dow - 1;
    if (m !== curM) {
      if (curM !== -1 && !continuous) curX += cs + cg + monthGap;
      mLabels.push({
        key: `hm-${m}-${y}`,
        label: MONTHS[m],
        x: curX,
        y: tp - 10,
      });
      curM = m;
    }
    const future = key > today;
    cells.push({
      key,
      date: day,
      x: curX,
      y: tp + dow * (cs + cg),
      w: cs,
      h: cs,
      future,
    });
    const next = days[i + 1];
    if (next) {
      let nd = next.getDay();
      nd = nd === 0 ? 6 : nd - 1;
      const sameBlock = continuous || next.getMonth() === curM;
      if (sameBlock && nd <= dow) curX += cs + cg;
    }
  }
  return { cells, mLabels };
}

export function compactCalLayout(
  days: Date[],
  cs: number,
  cg: number,
  lp: number,
  tp: number,
  monthGap: number,
  today: string,
): Layout {
  const cells: Cell[] = [],
    mLabels: MLabel[] = [];
  const months: { month: number; year: number; days: Date[] }[] = [];
  let curM2 = -1,
    curG: { month: number; year: number; days: Date[] } | null = null;
  for (const day of days) {
    const m = day.getMonth();
    if (m !== curM2) {
      curG = { month: m, year: day.getFullYear(), days: [] };
      months.push(curG);
      curM2 = m;
    }
    curG!.days.push(day);
  }
  let bx = lp;
  for (const mo of months) {
    const first = mo.days[0];
    let sd = first.getDay();
    sd = sd === 0 ? 6 : sd - 1;
    const bw = 7 * (cs + cg) - cg;
    mLabels.push({
      key: `hm-${mo.month}-${mo.year}`,
      label: MONTHS[mo.month],
      x: bx + bw / 2,
      y: tp - 10,
      anchor: "middle",
    });
    for (const day of mo.days) {
      const key = dk(day);
      let dow = day.getDay();
      dow = dow === 0 ? 6 : dow - 1;
      const dom = day.getDate(),
        wk = Math.floor((sd + dom - 1) / 7);
      const future = key > today;
      cells.push({
        key,
        date: day,
        x: bx + dow * (cs + cg),
        y: tp + wk * (cs + cg),
        w: cs,
        h: cs,
        future,
      });
    }
    bx += bw + monthGap;
  }
  return { cells, mLabels };
}

/**
 * One drawn piece of a block of days (what a log covers): its cells that sit
 * next to each other. A block the week or the month cuts is drawn in more
 * than one, open on the sides where it carries on.
 */
export type Piece = {
  /** The block's id and the piece's place in it: `${block}#${n}`. */
  key: string;
  block: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Carries on from the piece before / into the next one. */
  openStart: boolean;
  openEnd: boolean;
  /** Every day in it is still to come. */
  future: boolean;
};

/**
 * The cells (in day order) of each block, grouped into pieces of cells next
 * to each other: down a heatmap column or along a calendar row, `gap` apart.
 * `blockOf` names a day's block, or null for a day in none.
 */
export function blockPieces(
  cells: Cell[],
  blockOf: (key: string) => string | null,
  gap: number,
): Piece[] {
  const pieces: Piece[] = [];
  let last: Cell | null = null; // the cell before, when it was in a block
  const count = new Map<string, number>(); // pieces so far per block
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const nextTo = (a: Cell, b: Cell) =>
    (near(a.x, b.x) && b.y > a.y && b.y - (a.y + a.h) <= gap + 0.01) ||
    (near(a.y, b.y) && b.x > a.x && b.x - (a.x + a.w) <= gap + 0.01);
  for (const c of cells) {
    const block = blockOf(c.key);
    const cur = last ? pieces[pieces.length - 1] : undefined;
    if (block === null) {
      last = null;
      continue;
    }
    if (cur && last && cur.block === block && nextTo(last, c)) {
      cur.w = Math.max(cur.x + cur.w, c.x + c.w) - cur.x;
      cur.h = Math.max(cur.y + cur.h, c.y + c.h) - cur.y;
      cur.future = cur.future && c.future;
      last = c;
      continue;
    }
    const goesOn = cur?.block === block;
    if (cur && goesOn) cur.openEnd = true;
    const n = count.get(block) ?? 0;
    count.set(block, n + 1);
    pieces.push({
      key: `${block}#${n}`,
      block,
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      openStart: goesOn,
      openEnd: false,
      future: c.future,
    });
    last = c;
  }
  return pieces;
}

/**
 * A piece's outline (an SVG path): rounded by `r`, but square on a side
 * where its block carries on, the bottom or top in the heatmap (whose days
 * run down a column) and the right or left in the calendar (along a row).
 */
export function piecePath(p: Piece, r: number, view: CalendarView): string {
  const { x, y, w, h } = p;
  const R = Math.min(r, w / 2, h / 2);
  const s = p.openStart ? 0 : R,
    e = p.openEnd ? 0 : R;
  const [tl, tr, br, bl] = view === "heatmap" ? [s, s, e, e] : [s, e, e, s];
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    `A${tr},${tr} 0 0 1 ${x + w},${y + tr}`,
    `V${y + h - br}`,
    `A${br},${br} 0 0 1 ${x + w - br},${y + h}`,
    `H${x + bl}`,
    `A${bl},${bl} 0 0 1 ${x},${y + h - bl}`,
    `V${y + tl}`,
    `A${tl},${tl} 0 0 1 ${x + tl},${y}`,
    "Z",
  ].join(" ");
}
