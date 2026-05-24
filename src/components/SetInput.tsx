import { useState, useEffect, useRef } from "react";
import { C, F, inpS } from "../constants";
import { setsVolume } from "../lib/metrics";
import type { Metric, Palette, SetEntry } from "../types";

type Props = {
  metric: Metric;
  sets: SetEntry[] | undefined;
  pal: Palette;
  onAddSet: (metricId: string, set: SetEntry) => void;
  onRemoveSet: (metricId: string, idx: number) => void;
  lastWeight: number | null;
};

export default function SetInput({ metric, sets, pal, onAddSet, onRemoveSet, lastWeight }: Props) {
  const hasSets = Array.isArray(sets) && sets.length > 0;
  // Default weight: last set in current session > lastWeight from history > empty
  const defaultW = hasSets ? String(sets![sets!.length - 1].w) : lastWeight ? String(lastWeight) : "";
  const [w, setW] = useState(defaultW);
  const [r, setR] = useState("");
  const wUnit = metric.weightUnit || "lbs";
  // Update default when sets change (after adding a set, pre-fill with that weight)
  const prevSetLen = useRef(0);
  useEffect(() => {
    if (Array.isArray(sets) && sets.length > prevSetLen.current && sets.length > 0) {
      setW(String(sets[sets.length - 1].w));
      setR("");
    }
    prevSetLen.current = Array.isArray(sets) ? sets.length : 0;
  }, [sets]);
  // Also seed from lastWeight if nothing typed yet and no current sets
  useEffect(() => { if (!hasSets && !w && lastWeight) setW(String(lastWeight)); }, [hasSets, lastWeight, w]);
  const add = () => {
    const wn = parseInt(w, 10), rn = parseInt(r, 10);
    if (wn > 0 && rn > 0) onAddSet(metric.id, { w: wn, r: rn });
  };
  const vol = setsVolume(sets);
  return (
    <div>
      {/* Existing sets */}
      {hasSets && (
        <div style={{ marginBottom: 6 }}>
          {sets!.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 4, background: `${pal.shades[1]}33`, marginBottom: 3, animation: "fadeIn .2s ease" }}>
              <span style={{ fontSize: 9, color: C.dim, fontFamily: F, width: 16 }}>#{i + 1}</span>
              <span style={{ fontSize: 11, color: pal.shades[4], fontFamily: F, fontWeight: 600 }}>{s.w} {wUnit}</span>
              <span style={{ fontSize: 9, color: C.muted, fontFamily: F }}>×</span>
              <span style={{ fontSize: 11, color: C.text, fontFamily: F, fontWeight: 600 }}>{s.r} reps</span>
              <span style={{ fontSize: 9, color: C.dim, fontFamily: F, marginLeft: "auto" }}>{(s.w * s.r).toLocaleString()}</span>
              <button
                onClick={() => onRemoveSet(metric.id, i)}
                style={{ width: 16, height: 16, borderRadius: 3, border: "none", background: "transparent", color: C.dim, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", transition: "color .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)}
              >×</button>
            </div>
          ))}
          <div style={{ fontSize: 9, color: pal.shades[4], fontFamily: F, fontWeight: 600, textAlign: "right", marginTop: 2 }}>
            {sets!.length} set{sets!.length !== 1 ? "s" : ""} · {vol.toLocaleString()} {wUnit} total volume
          </div>
        </div>
      )}
      {/* Add set form */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input type="text" inputMode="numeric" value={w} onChange={(e) => setW(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Weight" onKeyDown={(e) => e.key === "Enter" && add()} style={{ ...inpS, fontSize: 12, paddingRight: 28, padding: "6px 28px 6px 8px" }} />
          <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: C.dim, fontFamily: F, pointerEvents: "none" }}>{wUnit}</span>
        </div>
        <span style={{ fontSize: 10, color: C.dim, fontFamily: F }}>×</span>
        <div style={{ position: "relative", flex: 1 }}>
          <input type="text" inputMode="numeric" value={r} onChange={(e) => setR(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Reps" onKeyDown={(e) => e.key === "Enter" && add()} style={{ ...inpS, fontSize: 12, padding: "6px 8px" }} />
        </div>
        <button
          onClick={add}
          style={{ padding: "6px 10px", borderRadius: 5, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, cursor: "pointer", fontSize: 10, fontFamily: F, fontWeight: 600, whiteSpace: "nowrap", transition: "all .15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = pal.shades[3]; e.currentTarget.style.color = pal.shades[4]; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
        >+ Set</button>
      </div>
    </div>
  );
}
