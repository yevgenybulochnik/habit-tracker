import { useState, useEffect, useRef, Fragment } from "react";
import { C, F, inpS } from "../constants";
import { setFieldsOf } from "../lib/metrics";
import { fmtSets } from "../lib/format";
import type { Metric, Palette, SetEntry } from "../types";

type Props = {
  metric: Metric;
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
  const fields = setFieldsOf(metric);
  const useVol = (metric.setValue ?? "volume") === "volume";
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

  return (
    <div>
      {/* Existing sets */}
      {hasSets && (
        <div style={{ marginBottom: 6 }}>
          {sets!.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 4,
                background: `${pal.shades[1]}33`,
                marginBottom: 3,
                animation: "fadeIn .2s ease",
              }}
            >
              <span
                style={{ fontSize: 9, color: C.dim, fontFamily: F, width: 16 }}
              >
                #{i + 1}
              </span>
              {fields.map((f, fi) => (
                <Fragment key={f.id}>
                  {fi > 0 && (
                    <span
                      style={{ fontSize: 9, color: C.muted, fontFamily: F }}
                    >
                      ×
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: fi === 0 && useVol ? pal.shades[4] : C.text,
                      fontFamily: F,
                      fontWeight: 600,
                    }}
                  >
                    {s[f.id]} {unitOf(f)}
                  </span>
                </Fragment>
              ))}
              {useVol && fields.length > 1 && (
                <span
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    fontFamily: F,
                    marginLeft: "auto",
                  }}
                >
                  {product(s).toLocaleString()}
                </span>
              )}
              <button
                onClick={() => onRemoveSet(metric.id, i)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: "none",
                  background: "transparent",
                  color: C.dim,
                  cursor: "pointer",
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "color .15s",
                  marginLeft: useVol && fields.length > 1 ? 0 : "auto",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
              >
                ×
              </button>
            </div>
          ))}
          <div
            style={{
              fontSize: 9,
              color: pal.shades[4],
              fontFamily: F,
              fontWeight: 600,
              textAlign: "right",
              marginTop: 2,
            }}
          >
            {fmtSets(sets, metric)}
          </div>
        </div>
      )}
      {/* Add set form: one input per field */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {fields.map((f, fi) => (
          <Fragment key={f.id}>
            {fi > 0 && (
              <span style={{ fontSize: 10, color: C.dim, fontFamily: F }}>
                ×
              </span>
            )}
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                inputMode="numeric"
                value={vals[f.id] ?? ""}
                onChange={(e) => setField(f.id, e.target.value)}
                placeholder={f.label}
                onKeyDown={(e) => e.key === "Enter" && add()}
                style={{
                  ...inpS,
                  fontSize: 12,
                  padding: f.unit ? "6px 28px 6px 8px" : "6px 8px",
                }}
              />
              {f.unit && (
                <span
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 9,
                    color: C.dim,
                    fontFamily: F,
                    pointerEvents: "none",
                  }}
                >
                  {f.unit}
                </span>
              )}
            </div>
          </Fragment>
        ))}
        <button
          onClick={add}
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            border: `1px solid ${C.border}`,
            background: C.bg,
            color: C.muted,
            cursor: "pointer",
            fontSize: 10,
            fontFamily: F,
            fontWeight: 600,
            whiteSpace: "nowrap",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = pal.shades[3];
            e.currentTarget.style.color = pal.shades[4];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.color = C.muted;
          }}
        >
          + Set
        </button>
      </div>
    </div>
  );
}
