import { useState, useEffect, useRef, Fragment } from "react";
import type { CSSProperties } from "react";
import { fmtSets } from "../lib/format";
import type { Palette, SetEntry, SetsMetric } from "../types";
import styles from "./SetInput.module.css";

type Props = {
  metric: SetsMetric;
  sets: SetEntry[] | undefined;
  pal: Palette;
  onAddSet: (metricId: string, set: SetEntry) => void;
  onRemoveSet: (metricId: string, idx: number) => void;
  /** Most recent set logged for this metric — seeds carry-over fields (weight, BPM…). */
  lastSet: SetEntry | null;
};

export default function SetInput({
  metric,
  sets,
  pal,
  onAddSet,
  onRemoveSet,
  lastSet,
}: Props) {
  const fields = metric.setFields;
  const useVol = metric.setValue === "volume";
  // "sum" fields reset each set (reps, minutes); others carry over (weight, BPM, …).
  const carries = (agg: string) => agg !== "sum";
  const unitOf = (f: { unit?: string; label: string }) =>
    f.unit || f.label.toLowerCase();
  const hasSets = Array.isArray(sets) && sets.length > 0;

  // Per-field text inputs, keyed by field id.
  const seed = () => {
    const src = hasSets ? sets![sets!.length - 1] : lastSet;
    const v: Record<string, string> = {};
    for (const f of fields)
      v[f.id] = carries(f.agg) && src && src[f.id] ? String(src[f.id]) : "";
    return v;
  };
  const [vals, setVals] = useState<Record<string, string>>(seed);

  // After a set is added, re-seed carry fields with that set's values, clear the rest.
  const prevLen = useRef(0);
  useEffect(() => {
    if (
      Array.isArray(sets) &&
      sets.length > prevLen.current &&
      sets.length > 0
    ) {
      const last = sets[sets.length - 1];
      setVals((p) => {
        const n = { ...p };
        for (const f of fields)
          n[f.id] = carries(f.agg) ? String(last[f.id] ?? "") : "";
        return n;
      });
    }
    prevLen.current = Array.isArray(sets) ? sets.length : 0;
  }, [sets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed carry fields from history if nothing typed yet and no sets logged today.
  useEffect(() => {
    if (!hasSets && lastSet) {
      setVals((p) => {
        const n = { ...p };
        for (const f of fields)
          if (carries(f.agg) && !n[f.id] && lastSet[f.id])
            n[f.id] = String(lastSet[f.id]);
        return n;
      });
    }
  }, [lastSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (id: string, raw: string) =>
    setVals((p) => ({ ...p, [id]: raw.replace(/[^0-9]/g, "") }));
  const add = () => {
    const entry: SetEntry = {};
    for (const f of fields) {
      const n = parseInt(vals[f.id], 10);
      if (!(n > 0)) return; // every field must be a positive number
      entry[f.id] = n;
    }
    onAddSet(metric.id, entry);
  };
  const product = (s: SetEntry) =>
    fields.reduce((p, f) => p * (s[f.id] || 0), 1);

  // Per-habit palette → CSS vars (set on the root so rows inherit them).
  const palVars = {
    "--set-bg": `${pal.shades[1]}33`,
    "--set-accent": pal.shades[4],
    "--set-a3": pal.shades[3],
    "--set-a4": pal.shades[4],
  } as CSSProperties;

  return (
    <div style={palVars}>
      {/* Existing sets */}
      {hasSets && (
        <div style={{ marginBottom: 6 }}>
          {sets!.map((s, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.idx}>#{i + 1}</span>
              {fields.map((f, fi) => (
                <Fragment key={f.id}>
                  {fi > 0 && <span className={styles.times}>×</span>}
                  <span
                    className={`${styles.val}${fi === 0 && useVol ? ` ${styles.valPrimary}` : ""}`}
                  >
                    {s[f.id]} {unitOf(f)}
                  </span>
                </Fragment>
              ))}
              {useVol && fields.length > 1 && (
                <span className={styles.product}>
                  {product(s).toLocaleString()}
                </span>
              )}
              <button
                onClick={() => onRemoveSet(metric.id, i)}
                className={`${styles.del}${useVol && fields.length > 1 ? "" : ` ${styles.delPush}`}`}
              >
                ×
              </button>
            </div>
          ))}
          <div className={styles.total}>{fmtSets(sets, metric)}</div>
        </div>
      )}
      {/* Add set form: one input per field */}
      <div className={styles.addRow}>
        {fields.map((f, fi) => (
          <Fragment key={f.id}>
            {fi > 0 && <span className={styles.times}>×</span>}
            <div className={styles.field}>
              <input
                type="text"
                inputMode="numeric"
                value={vals[f.id] ?? ""}
                onChange={(e) => setField(f.id, e.target.value)}
                placeholder={f.label}
                onKeyDown={(e) => e.key === "Enter" && add()}
                className={`${styles.fieldInput}${f.unit ? ` ${styles.fieldInputUnit}` : ""}`}
              />
              {f.unit && <span className={styles.unitSuffix}>{f.unit}</span>}
            </div>
          </Fragment>
        ))}
        <button onClick={add} className={styles.addBtn}>
          + Set
        </button>
      </div>
    </div>
  );
}
