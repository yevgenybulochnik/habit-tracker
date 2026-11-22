// A page slid over the habits (see `slide`): a header with the way back and
// the page's title, then what the page holds. The habit forms and the
// Routines page are pages like this, rather than dialogs.
import type { ReactNode } from "react";
import Icon from "./Icon";
import styles from "./PageShell.module.css";

/** Close a page, sliding back, running `then` (if given) as it changes. */
export type ClosePage = (then?: () => void) => void;

type HeaderProps = {
  title: string;
  subtitle?: string;
  /** Where the back button goes, for its title: "Back to habits". */
  backTo?: string;
  onBack: () => void;
  /** An action at the header's end, such as New Routine. */
  children?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  backTo = "habits",
  onBack,
  children,
}: HeaderProps) {
  return (
    <div className={styles.header}>
      <button
        onClick={onBack}
        title={`Back to ${backTo}`}
        className={styles.back}
      >
        <Icon name="left" size={18} />
      </button>
      <div className={styles.headText}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

type Props = Omit<HeaderProps, "children"> & { children: ReactNode };

/** A page: its header, then its content in a panel. */
export default function PageShell({ children, ...header }: Props) {
  return (
    <div>
      <PageHeader {...header} />
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
