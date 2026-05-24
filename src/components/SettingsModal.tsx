import { useState, useMemo, useRef } from "react";
import { C, F, inpS, BUILTIN_UNITS, DEFAULT_CONFIG } from "../constants";
import { todayK } from "../lib/dates";
import ModalShell from "./ModalShell";
import type { AppConfig, Habit, Logs, PersistedState, Unit } from "../types";

type Props = {
  units: Unit[];
  habits: Habit[];
  logs: Logs;
  onUpdateUnit: (id: string, updates: Partial<Unit>) => void;
  onDeleteUnit: (id: string) => void;
  onAddUnit: (u: Unit) => void;
  appConfig: AppConfig;
  onUpdateConfig: (c: AppConfig) => void;
  onImportState: (s: PersistedState) => void;
  onClose: () => void;
};

export default function SettingsModal({ units, habits, logs, onUpdateUnit, onDeleteUnit, onAddUnit, appConfig, onUpdateConfig, onImportState, onClose }: Props) {
  const cfg = appConfig || DEFAULT_CONFIG;
  const [closing, setClosing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [eLabel, setELabel] = useState("");
  const [eQA, setEQA] = useState("");
  const [eThr, setEThr] = useState("");
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newQA, setNewQA] = useState("1, 5, 10");
  const [newThr, setNewThr] = useState("1, 3, 5");
  const [importErr, setImportErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const hClose = () => { setClosing(true); setTimeout(onClose, 350); };
  const parseNums = (s: string) => s.split(",").map((v) => parseInt(v.trim(), 10)).filter((v) => !isNaN(v) && v > 0);

  const usedUnits = useMemo(() => { const s = new Set<string>(); habits.forEach((h) => (h.metrics || []).forEach((m) => s.add(m.unit))); return s; }, [habits]);
  const builtinIds = new Set(BUILTIN_UNITS.map((u) => u.id));

  const startEdit = (u: Unit) => { setEditId(u.id); setELabel(u.label); setEQA(u.quickAdd.join(", ")); setEThr(u.thresholds.join(", ")); };
  const saveEdit = () => { const qa = parseNums(eQA), thr = parseNums(eThr); if (eLabel.trim() && qa.length && thr.length) { onUpdateUnit(editId!, { label: eLabel.trim(), quickAdd: qa.slice(0, 3), thresholds: thr.slice(0, 3) }); setEditId(null); } };
  const addNew = () => { const id = newId.trim().toLowerCase().replace(/\s+/g, "_"); if (id && newLabel.trim() && !units.find((u) => u.id === id)) { const qa = parseNums(newQA), thr = parseNums(newThr); if (qa.length && thr.length) { onAddUnit({ id, label: newLabel.trim(), quickAdd: qa.slice(0, 3), thresholds: thr.slice(0, 3) }); setNewId(""); setNewLabel(""); setNewQA("1, 5, 10"); setNewThr("1, 3, 5"); } } };

  const doExport = () => {
    const state: PersistedState = { habits, logs, units, config: cfg };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habit-tracker-backup-${todayK()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.habits) || typeof parsed.logs !== "object" || parsed.logs === null || !Array.isArray(parsed.units) || typeof parsed.config !== "object" || parsed.config === null) {
          throw new Error("invalid shape");
        }
        setImportErr("");
        onImportState(parsed as PersistedState);
        hClose();
      } catch {
        setImportErr("Could not import — that doesn't look like a valid backup file.");
      }
    };
    reader.onerror = () => setImportErr("Could not read that file.");
    reader.readAsText(file);
  };

  return (
    <ModalShell onClose={hClose} closing={closing} width={520}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, color: C.text, fontFamily: F }}>Settings</h2>

      {/* ── Appearance ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: F, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Appearance</div>
        <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F }}>Theme</div>
            <div style={{ fontSize: 9, color: C.dim, fontFamily: F, marginTop: 2 }}>Light or dark appearance</div>
          </div>
          <div style={{ display: "flex", background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, padding: 2, gap: 2 }}>
            {(["dark", "light"] as const).map((t) => {
              const active = (cfg.theme || "dark") === t;
              return (
                <button key={t} onClick={() => onUpdateConfig({ ...cfg, theme: t })} style={{ padding: "5px 14px", borderRadius: 4, border: "none", background: active ? C.accentDim : "transparent", color: active ? C.accent : C.muted, cursor: "pointer", fontSize: 11, fontFamily: F, fontWeight: active ? 600 : 400, transition: "all .15s" }}>
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Calendar Display ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: F, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Calendar Display</div>
        <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F }}>Months to display</div>
              <div style={{ fontSize: 9, color: C.dim, fontFamily: F, marginTop: 2 }}>Number of months shown in the heatmap view</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => { const v = Math.max(2, cfg.numMonths - 1); onUpdateConfig({ ...cfg, numMonths: v }); }} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, transition: "all .15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>-</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F, minWidth: 24, textAlign: "center" }}>{cfg.numMonths}</span>
              <button onClick={() => { const v = Math.min(12, cfg.numMonths + 1); onUpdateConfig({ ...cfg, numMonths: v }); }} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, transition: "all .15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>+</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: F }}>Month spacing</div>
              <div style={{ fontSize: 9, color: C.dim, fontFamily: F, marginTop: 2 }}>Gap between month blocks in heatmap (px)</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[0, 3, 5, 8, 12].map((v) => (
                <button key={v} onClick={() => onUpdateConfig({ ...cfg, monthGap: v })} style={{ padding: "4px 8px", borderRadius: 4, fontSize: 10, fontFamily: F, fontWeight: 600, cursor: "pointer", border: `1px solid ${cfg.monthGap === v ? C.accent : C.border}`, background: cfg.monthGap === v ? C.accentDim : C.surface, color: cfg.monthGap === v ? C.accent : C.muted, transition: "all .15s" }}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Units ── */}
      <div style={{ fontSize: 11, color: C.accent, fontFamily: F, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Units</div>
      <div style={{ marginBottom: 20 }}>
        {units.map((u) => {
          const inUse = usedUnits.has(u.id); const isBuiltin = builtinIds.has(u.id); const isEditing = editId === u.id;
          return (
            <div key={u.id} style={{ marginBottom: 6, borderRadius: 8, border: `1px solid ${isEditing ? C.accent : C.border}`, background: isEditing ? C.accentDim : C.bg, padding: "10px 14px", transition: "all .2s" }}>
              {isEditing ? (
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>Label</div><input value={eLabel} onChange={(e) => setELabel(e.target.value)} style={{ ...inpS, fontSize: 12 }} /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>Quick-add</div><input value={eQA} onChange={(e) => setEQA(e.target.value)} style={{ ...inpS, fontSize: 12 }} /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>Thresholds</div><input value={eThr} onChange={(e) => setEThr(e.target.value)} style={{ ...inpS, fontSize: 12 }} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setEditId(null)} style={{ padding: "5px 12px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, fontFamily: F }}>Cancel</button>
                    <button onClick={saveEdit} style={{ padding: "5px 12px", borderRadius: 4, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: F }}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F, minWidth: 80 }}>{u.label}</span>
                  <span style={{ fontSize: 10, color: C.dim, fontFamily: F, background: C.surface, padding: "2px 8px", borderRadius: 3 }}>{u.id}</span>
                  <span style={{ fontSize: 10, color: C.dim, fontFamily: F }}>+{u.quickAdd.join("/")}</span>
                  <span style={{ fontSize: 10, color: C.dim, fontFamily: F }}>thr: {u.thresholds.join("/")}</span>
                  {inUse && <span style={{ fontSize: 9, color: C.success, fontFamily: F, marginLeft: "auto" }}>in use</span>}
                  <div style={{ marginLeft: inUse ? "0" : "auto", display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(u)} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }} title="Edit">✎</button>
                    {!isBuiltin && !inUse && <button onClick={() => onDeleteUnit(u.id)} style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid transparent`, background: "transparent", color: C.dim, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)} onMouseLeave={(e) => (e.currentTarget.style.color = C.dim)} title="Delete">×</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new unit */}
      <div style={{ padding: "14px 16px", borderRadius: 8, border: `1px dashed ${C.border}`, background: C.bg }}>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: F, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Add New Unit</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>ID</div><input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="lbs" style={{ ...inpS, fontSize: 12 }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>Label</div><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Pounds" style={{ ...inpS, fontSize: 12 }} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>Quick-add</div><input value={newQA} onChange={(e) => setNewQA(e.target.value)} style={{ ...inpS, fontSize: 12 }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: C.muted, fontFamily: F, marginBottom: 3 }}>Thresholds</div><input value={newThr} onChange={(e) => setNewThr(e.target.value)} style={{ ...inpS, fontSize: 12 }} /></div>
        </div>
        <button onClick={addNew} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: F }}>Add Unit</button>
      </div>

      {/* ── Data (backup) ── */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, color: C.accent, fontFamily: F, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Data</div>
        <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: F }}>Back up or restore all habits, logs, units and settings.</div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={doExport} style={{ padding: "7px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: F }}>Export</button>
              <button onClick={() => fileRef.current?.click()} style={{ padding: "7px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: F }}>Import</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                aria-label="Import backup file"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }}
              />
            </div>
          </div>
          {importErr && <div style={{ fontSize: 11, color: C.danger, fontFamily: F, marginTop: 10 }}>{importErr}</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={hClose} style={{ padding: "8px 18px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13, fontFamily: F }}>Done</button>
      </div>
    </ModalShell>
  );
}
