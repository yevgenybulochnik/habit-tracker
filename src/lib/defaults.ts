import type { AppConfig, Unit } from "../types";

export const STORAGE_KEY = "habit-tracker-v3";

export const BUILTIN_UNITS: Unit[] = [
  {
    id: "min",
    label: "Minutes",
    quickAdd: [15, 30, 60],
    thresholds: [15, 30, 60],
  },
  {
    id: "reps",
    label: "Reps",
    quickAdd: [5, 10, 25],
    thresholds: [10, 25, 50],
  },
  { id: "count", label: "Count", quickAdd: [1, 5, 10], thresholds: [1, 3, 5] },
];

export const DEFAULT_CONFIG: AppConfig = {
  numMonths: 4,
  monthGap: 5,
  theme: "dark",
  dashView: "quick",
};

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const WK_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
