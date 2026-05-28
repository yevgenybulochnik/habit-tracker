import { useState, useMemo, useRef } from "react";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "../constants";
import { todayK } from "../lib/dates";
import ModalShell from "./ModalShell";
import type { AppConfig, Habit, Logs, PersistedState, Unit } from "../types";
import modal from "./modalForm.module.css";
import styles from "./SettingsModal.module.css";

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

export default function SettingsModal({
  units,
  habits,
  logs,
  onUpdateUnit,
  onDeleteUnit,
  onAddUnit,
  appConfig,
  onUpdateConfig,
  onImportState,
  onClose,
}: Props) {
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

  const hClose = () => {
    setClosing(true);
    setTimeout(onClose, 350);
  };
  const parseNums = (s: string) =>
    s
      .split(",")
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);

  const usedUnits = useMemo(() => {
    const s = new Set<string>();
    habits.forEach((h) => (h.metrics || []).forEach((m) => s.add(m.unit)));
    return s;
  }, [habits]);
  const builtinIds = new Set(BUILTIN_UNITS.map((u) => u.id));

  const startEdit = (u: Unit) => {
    setEditId(u.id);
    setELabel(u.label);
    setEQA(u.quickAdd.join(", "));
    setEThr(u.thresholds.join(", "));
  };
  const saveEdit = () => {
    const qa = parseNums(eQA),
      thr = parseNums(eThr);
    if (eLabel.trim() && qa.length && thr.length) {
      onUpdateUnit(editId!, {
        label: eLabel.trim(),
        quickAdd: qa.slice(0, 3),
        thresholds: thr.slice(0, 3),
      });
      setEditId(null);
    }
  };
  const addNew = () => {
    const id = newId.trim().toLowerCase().replace(/\s+/g, "_");
    if (id && newLabel.trim() && !units.find((u) => u.id === id)) {
      const qa = parseNums(newQA),
        thr = parseNums(newThr);
      if (qa.length && thr.length) {
        onAddUnit({
          id,
          label: newLabel.trim(),
          quickAdd: qa.slice(0, 3),
          thresholds: thr.slice(0, 3),
        });
        setNewId("");
        setNewLabel("");
        setNewQA("1, 5, 10");
        setNewThr("1, 3, 5");
      }
    }
  };

  const doExport = () => {
    const state: PersistedState = { habits, logs, units, config: cfg };
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
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
        if (
          !parsed ||
          !Array.isArray(parsed.habits) ||
          typeof parsed.logs !== "object" ||
          parsed.logs === null ||
          !Array.isArray(parsed.units) ||
          typeof parsed.config !== "object" ||
          parsed.config === null
        ) {
          throw new Error("invalid shape");
        }
        setImportErr("");
        onImportState(parsed as PersistedState);
        hClose();
      } catch {
        setImportErr(
          "Could not import — that doesn't look like a valid backup file.",
        );
      }
    };
    reader.onerror = () => setImportErr("Could not read that file.");
    reader.readAsText(file);
  };

  return (
    <ModalShell onClose={hClose} closing={closing} width={520}>
      <h2 className={modal.title}>Settings</h2>

      {/* ── Appearance ── */}
      <div className={styles.section}>
        <div className={styles.hdr}>Appearance</div>
        <div className={styles.panelRow}>
          <div>
            <div className={styles.rowTitle}>Theme</div>
            <div className={styles.rowDesc}>Light or dark appearance</div>
          </div>
          <div className={styles.seg}>
            {(["dark", "light"] as const).map((t) => {
              const active = (cfg.theme || "dark") === t;
              return (
                <button
                  key={t}
                  onClick={() => onUpdateConfig({ ...cfg, theme: t })}
                  className={`${styles.segBtn}${active ? ` ${styles.on}` : ""}`}
                >
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Calendar Display ── */}
      <div className={styles.section}>
        <div className={styles.hdr}>Calendar Display</div>
        <div className={styles.panel}>
          <div className={`${styles.calRow} ${styles.calRowGap}`}>
            <div>
              <div className={styles.rowTitle}>Months to display</div>
              <div className={styles.rowDesc}>
                Number of months shown in the heatmap view
              </div>
            </div>
            <div className={styles.stepGroup}>
              <button
                onClick={() =>
                  onUpdateConfig({
                    ...cfg,
                    numMonths: Math.max(2, cfg.numMonths - 1),
                  })
                }
                className={styles.stepBtn}
              >
                -
              </button>
              <span className={styles.stepVal}>{cfg.numMonths}</span>
              <button
                onClick={() =>
                  onUpdateConfig({
                    ...cfg,
                    numMonths: Math.min(12, cfg.numMonths + 1),
                  })
                }
                className={styles.stepBtn}
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.calRow}>
            <div>
              <div className={styles.rowTitle}>Month spacing</div>
              <div className={styles.rowDesc}>
                Gap between month blocks in heatmap (px)
              </div>
            </div>
            <div className={styles.gapGroup}>
              {[0, 3, 5, 8, 12].map((v) => (
                <button
                  key={v}
                  onClick={() => onUpdateConfig({ ...cfg, monthGap: v })}
                  className={`${styles.gapBtn}${cfg.monthGap === v ? ` ${styles.on}` : ""}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Units ── */}
      <div className={styles.hdr}>Units</div>
      <div className={styles.block}>
        {units.map((u) => {
          const inUse = usedUnits.has(u.id);
          const isBuiltin = builtinIds.has(u.id);
          const isEditing = editId === u.id;
          return (
            <div
              key={u.id}
              className={`${styles.unit}${isEditing ? ` ${styles.unitEditing}` : ""}`}
            >
              {isEditing ? (
                <div>
                  <div className={styles.editGrid}>
                    <div>
                      <div className={styles.fieldLbl}>Label</div>
                      <input
                        value={eLabel}
                        onChange={(e) => setELabel(e.target.value)}
                        className={styles.smInput}
                      />
                    </div>
                    <div>
                      <div className={styles.fieldLbl}>Quick-add</div>
                      <input
                        value={eQA}
                        onChange={(e) => setEQA(e.target.value)}
                        className={styles.smInput}
                      />
                    </div>
                    <div>
                      <div className={styles.fieldLbl}>Thresholds</div>
                      <input
                        value={eThr}
                        onChange={(e) => setEThr(e.target.value)}
                        className={styles.smInput}
                      />
                    </div>
                  </div>
                  <div className={styles.editActions}>
                    <button
                      onClick={() => setEditId(null)}
                      className={styles.pillCancel}
                    >
                      Cancel
                    </button>
                    <button onClick={saveEdit} className={styles.pillSave}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.unitDisplay}>
                  <span className={styles.unitLabel}>{u.label}</span>
                  <span className={styles.unitId}>{u.id}</span>
                  <span className={styles.unitMeta}>
                    +{u.quickAdd.join("/")}
                  </span>
                  <span className={styles.unitMeta}>
                    thr: {u.thresholds.join("/")}
                  </span>
                  {inUse && <span className={styles.inUse}>in use</span>}
                  <div
                    className={`${styles.iconActions}${inUse ? "" : ` ${styles.iconActionsPush}`}`}
                  >
                    <button
                      onClick={() => startEdit(u)}
                      className={styles.editIcon}
                      title="Edit"
                    >
                      ✎
                    </button>
                    {!isBuiltin && !inUse && (
                      <button
                        onClick={() => onDeleteUnit(u.id)}
                        className={styles.delIcon}
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new unit */}
      <div className={styles.addPanel}>
        <div className={styles.hdrMuted}>Add New Unit</div>
        <div className={styles.addGrid}>
          <div>
            <div className={styles.fieldLbl}>ID</div>
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="lbs"
              className={styles.smInput}
            />
          </div>
          <div>
            <div className={styles.fieldLbl}>Label</div>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Pounds"
              className={styles.smInput}
            />
          </div>
        </div>
        <div className={`${styles.addGrid} ${styles.addGridLast}`}>
          <div>
            <div className={styles.fieldLbl}>Quick-add</div>
            <input
              value={newQA}
              onChange={(e) => setNewQA(e.target.value)}
              className={styles.smInput}
            />
          </div>
          <div>
            <div className={styles.fieldLbl}>Thresholds</div>
            <input
              value={newThr}
              onChange={(e) => setNewThr(e.target.value)}
              className={styles.smInput}
            />
          </div>
        </div>
        <button onClick={addNew} className={styles.addUnitBtn}>
          Add Unit
        </button>
      </div>

      {/* ── Data (backup) ── */}
      <div className={styles.dataTop}>
        <div className={styles.hdr}>Data</div>
        <div className={styles.panel}>
          <div className={styles.dataRow}>
            <div className={styles.dataDesc}>
              Back up or restore all habits, logs, units and settings.
            </div>
            <div className={styles.dataBtns}>
              <button onClick={doExport} className={styles.dataBtn}>
                Export
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className={styles.dataBtn}
              >
                Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                aria-label="Import backup file"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doImport(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {importErr && <div className={styles.importErr}>{importErr}</div>}
        </div>
      </div>

      <div className={modal.footer}>
        <button onClick={hClose} className={modal.cancelBtn}>
          Done
        </button>
      </div>
    </ModalShell>
  );
}
