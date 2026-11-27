// The pearl: a square button in the bottom-right corner, within reach of a
// thumb. A tap opens it out into its panel: the habits' view and Reorder,
// the places to jump to, and the way to a new habit, the routines and the
// settings. It stays in the panel's corner as the key that shuts it again.
// While reordering it's Done, and on a page it's the way back.
import { useEffect, useId, useRef, useState } from "react";
import { resolvePalette } from "../theme";
import type { Jump } from "../lib/jumps";
import type { DashView, ThemeName } from "../types";
import HabitIcon from "./HabitIcon";
import Icon from "./Icon";
import styles from "./Pearl.module.css";

type Props = {
  /** Today's progress, on its face: how many habits are done, of how many. */
  done: number;
  total: number;
  /** Where the panel jumps to (lib/jumps). */
  jumps: Jump[];
  onJump: (j: Jump) => void;
  /** The habits' view, and switching it. */
  view: DashView;
  onView: (v: DashView) => void;
  /** Reorder is offered when there's more than one habit or group. */
  canReorder: boolean;
  /** Reordering: the pearl is Done. */
  reordering: boolean;
  /** Starts reordering, and ends it. */
  onReorder: () => void;
  onNewHabit: () => void;
  onRoutines: () => void;
  onSettings: () => void;
  /** A page is up: the pearl is its way back. */
  onPage: boolean;
  onBack: () => void;
  /** For the habits' colours, in the list of places. */
  theme: ThemeName;
};

/** Long enough for the panel to shrink back into the pearl (morphOut),
 *  should its animationend not come (as under test). */
const CLOSE_MS = 600;

/** Its progress round its edge: a rounded square from the top's middle. */
const RING =
  "M28 4H40A12 12 0 0 1 52 16V40A12 12 0 0 1 40 52H16A12 12 0 0 1 4 40V16A12 12 0 0 1 16 4Z";

export default function Pearl({
  done,
  total,
  jumps,
  onJump,
  view,
  onView,
  canReorder,
  reordering: reorderOn,
  onReorder,
  onNewHabit,
  onRoutines,
  onSettings,
  onPage,
  onBack,
  theme,
}: Props) {
  const [open, setOpen] = useState(false);
  // The panel shrinking back into the pearl, once shut.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(0);
  const pearlRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const reordering = reorderOn && !onPage;

  // At once: for a page sliding in over it.
  const shut = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    setClosing(false);
  };
  // The panel shrinks back into the pearl.
  const close = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => setClosing(false), CLOSE_MS);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // (shut and close only set state and the timer, so the effects below can
  // call the ones from an earlier render.)

  // A page coming up shuts it.
  useEffect(() => {
    if (onPage) shut();
  }, [onPage]);

  // Escape shuts it, back to the pearl.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      pearlRef.current?.focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  const actions = [
    {
      label: "New habit",
      icon: <Icon name="plus" size={18} />,
      go: onNewHabit,
    },
    {
      label: "Routines",
      icon: <Icon name="stopwatch" size={18} />,
      go: onRoutines,
    },
    {
      label: "Settings",
      icon: <Icon name="settings" size={18} />,
      go: onSettings,
    },
  ];

  const tap = () => {
    if (onPage) onBack();
    else if (reordering) onReorder();
    else if (open) close();
    else {
      window.clearTimeout(closeTimer.current);
      setClosing(false);
      setOpen(true);
    }
  };

  const label = onPage
    ? "Back"
    : reordering
      ? "Done"
      : open
        ? "Close menu"
        : "Menu";
  const showCount = !onPage && !reordering && !open && total > 0;

  return (
    <>
      <button
        ref={pearlRef}
        type="button"
        aria-label={label}
        aria-expanded={onPage || reordering ? undefined : open}
        aria-controls={open ? panelId : undefined}
        onClick={tap}
        onContextMenu={(e) => e.preventDefault()}
        className={`${styles.pearl}${open || closing ? ` ${styles.lifted}` : ""}${open ? ` ${styles.docked}` : ""}`}
      >
        {showCount && (
          <svg viewBox="0 0 56 56" className={styles.ring} aria-hidden="true">
            <path d={RING} className={styles.ringTrack} />
            <path
              d={RING}
              pathLength={100}
              strokeDasharray={`${(done / total) * 100} 100`}
              className={styles.ringFill}
            />
          </svg>
        )}
        <span className={styles.face}>
          {onPage ? (
            <Icon name="arrowLeft" size={22} />
          ) : reordering ? (
            <Icon name="check" size={24} />
          ) : open ? (
            <Icon name="close" size={20} />
          ) : showCount ? (
            <span className={styles.count}>
              {done}/{total}
            </span>
          ) : (
            <Icon name="menu" size={18} />
          )}
        </span>
      </button>

      {/* Reordering: how, above the pearl that ends it. Not in the page, so
          nothing moves as reordering starts and stops. */}
      {reordering && (
        <div className={styles.hint}>
          Drag the <Icon name="grip" size={14} /> handles ·{" "}
          <Icon name="check" size={13} /> when done
        </div>
      )}

      {(open || closing) && (
        <>
          <div
            className={`${styles.scrim}${closing ? ` ${styles.out}` : ""}`}
            onClick={close}
          />
          <div
            id={panelId}
            role="group"
            aria-label="Menu"
            className={`${styles.panel}${closing ? ` ${styles.out}` : ""}`}
            onAnimationEnd={(e) => {
              if (closing && e.target === e.currentTarget) shut();
            }}
            {...(closing ? { inert: "", "aria-hidden": true } : {})}
          >
            <div className={styles.top}>
              <div className={styles.views} role="group" aria-label="View">
                {(["compact", "calendar"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => onView(v)}
                    className={`${styles.view}${view === v ? ` ${styles.on}` : ""}`}
                  >
                    <Icon
                      name={v === "compact" ? "list" : "calendar"}
                      size={16}
                    />
                    {v === "compact" ? "Compact" : "Calendar"}
                  </button>
                ))}
              </div>
              {canReorder && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onReorder();
                  }}
                  className={styles.reorder}
                >
                  <Icon name="grip" size={14} />
                  Reorder
                </button>
              )}
            </div>

            {jumps.length > 1 && (
              <>
                <div className={styles.label} aria-hidden="true">
                  Jump to
                </div>
                <div className={styles.list}>
                  {jumps.map((j) => (
                    <button
                      key={
                        j.kind === "top"
                          ? "top"
                          : j.kind === "group"
                            ? j.group.id
                            : j.habit.id
                      }
                      type="button"
                      aria-label={jumpName(j)}
                      onClick={() => {
                        close();
                        onJump(j);
                      }}
                      className={styles.row}
                    >
                      <JumpRow j={j} theme={theme} />
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className={styles.actions}>
              {actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    shut();
                    a.go();
                  }}
                  className={styles.action}
                >
                  <span className={styles.actionIcon}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
              {/* Where the pearl sits, to shut the panel */}
              <span aria-hidden="true" />
            </div>
            {/* The pearl's colour, fading as the panel opens out of it */}
            <div className={styles.tint} aria-hidden="true" />
          </div>
        </>
      )}
    </>
  );
}

/** A place to jump to, as it's said: "Fitness, 1 of 3 done". */
function jumpName(j: Jump): string {
  if (j.kind === "top") return "Top";
  if (j.kind === "group")
    return `${j.group.name || "Untitled"}, ${j.done} of ${j.total} done`;
  return `${j.habit.name || "Untitled"}${j.done ? ", done" : ""}`;
}

/** A place to jump to, as it's shown: its icon, its name, and how it's
 *  doing. */
function JumpRow({ j, theme }: { j: Jump; theme: ThemeName }) {
  if (j.kind === "top")
    return (
      <>
        <span className={styles.rowIcon}>
          <Icon name="up" size={16} />
        </span>
        <span className={styles.rowName}>Top</span>
      </>
    );
  if (j.kind === "group") {
    const full = j.total > 0 && j.done === j.total;
    return (
      <>
        <span className={styles.rowIcon} aria-hidden="true">
          <HabitIcon icon={j.group.icon} size={16} />
        </span>
        <span className={styles.rowName}>{j.group.name || "Untitled"}</span>
        <span className={`${styles.rowNote}${full ? ` ${styles.full}` : ""}`}>
          {j.done}/{j.total}
        </span>
      </>
    );
  }
  const color = resolvePalette(j.habit.color, theme).shades[4];
  return (
    <>
      <span className={styles.rowIcon} style={{ color }} aria-hidden="true">
        <HabitIcon icon={j.habit.icon} size={16} />
      </span>
      <span className={styles.rowName}>{j.habit.name || "Untitled"}</span>
      {j.done && (
        <span className={`${styles.rowNote} ${styles.full}`}>
          <Icon name="check" size={14} />
        </span>
      )}
    </>
  );
}
