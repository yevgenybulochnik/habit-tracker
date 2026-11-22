import { useState, useMemo, useRef, useId } from "react";
import { BUILTIN_UNITS } from "../lib/defaults";
import { todayK } from "../lib/dates";
import { normalizeState, SCHEMA_VERSION } from "../lib/normalize";
import { unitFields } from "../lib/units";
import { downloadJson } from "../download";
import ModalShell, { type RequestClose } from "./ModalShell";
import UnitForm from "./UnitForm";
import type {
  AppConfig,
  Group,
  Habit,
  Logs,
  PersistedState,
  Routine,
  Unit,
} from "../types";
import modal from "./modalForm.module.css";
import styles from "./SettingsModal.module.css";

type Props = {
  units: Unit[];
  habits: Habit[];
  logs: Logs;
  groups: Group[];
  routines: Routine[];
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
  groups,
  routines,
  onUpdateUnit,
  onDeleteUnit,
  onAddUnit,
  appConfig: cfg,
  onUpdateConfig,
  onImportState,
  onClose,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [importErr, setImportErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addTitleId = useId();

  const usedUnits = useMemo(() => {
    const s = new Set<string>();
    habits.forEach((h) => h.metrics.forEach((m) => s.add(m.unit)));
    return s;
  }, [habits]);
  const builtinIds = new Set(BUILTIN_UNITS.map((u) => u.id));
  const unitIds = units.map((u) => u.id);

  const doExport = () => {
    const state: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      habits,
      logs,
      units,
      config: cfg,
      groups,
      routines,
    };
    downloadJson(`habit-tracker-backup-${todayK()}.json`, state);
  };
  /** Import a backup file, closing the modal once it's in. */
  const doImport = (file: File, requestClose: RequestClose) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        parsed = undefined; // not JSON: rejected below like any other non-backup
      }
      const result = normalizeState(parsed);
      if (!result.ok) {
        setImportErr(
          "Could not import — that doesn't look like a valid backup file.",
        );
        return;
      }
      setImportErr("");
      onImportState(result.state);
      requestClose();
    };
    reader.onerror = () => setImportErr("Could not read that file.");
    reader.readAsText(file);
  };

  return (
    <ModalShell onClose={onClose} width={520}>
      {(requestClose) => (
        <>
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
                  const active = cfg.theme === t;
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
                  role={isEditing ? "group" : undefined}
                  aria-label={isEditing ? `Edit ${u.label}` : undefined}
                >
                  {isEditing ? (
                    <UnitForm
                      initial={unitFields(u)}
                      editing
                      takenIds={unitIds.filter((id) => id !== u.id)}
                      submitLabel="Save"
                      onSubmit={({ id, ...changes }) => {
                        onUpdateUnit(id, changes);
                        setEditId(null);
                      }}
                      onCancel={() => setEditId(null)}
                    />
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
                          onClick={() => setEditId(u.id)}
                          className={styles.editIcon}
                          title="Edit"
                          aria-label={`Edit ${u.label}`}
                        >
                          ✎
                        </button>
                        {!isBuiltin && !inUse && (
                          <button
                            onClick={() => onDeleteUnit(u.id)}
                            className={styles.delIcon}
                            title="Delete"
                            aria-label={`Delete ${u.label}`}
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
          <section className={styles.addPanel} aria-labelledby={addTitleId}>
            <div id={addTitleId} className={styles.hdrMuted}>
              Add New Unit
            </div>
            <UnitForm
              takenIds={unitIds}
              submitLabel="Add Unit"
              onSubmit={onAddUnit}
            />
          </section>

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
                      if (f) doImport(f, requestClose);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              {importErr && <div className={styles.importErr}>{importErr}</div>}
            </div>
          </div>

          <div className={modal.footer}>
            <button onClick={() => requestClose()} className={modal.cancelBtn}>
              Done
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
