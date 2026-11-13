import { MONTHS } from "./defaults";
import { dk, parseKey } from "./dates";

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
