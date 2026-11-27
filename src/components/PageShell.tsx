// A page slid over the habits (see `slide`): a header with the page's title,
// then what the page holds. The habit forms and the Routines page are pages
// like this, rather than dialogs. The way back is the pearl's: a page's
// header gives it to the pearl, through PageBackContext.
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import styles from "./PageShell.module.css";

/** Close a page, sliding back, running `then` (if given) as it changes. */
export type ClosePage = (then?: () => void) => void;

/**
 * Where a page's header gives its way back, for the pearl, which goes back
 * the way of the latest given (the page on top: a routine's editor over the
 * routines). Returns the way to take it away again.
 */
export const PageBackContext = createContext<(back: () => void) => () => void>(
  () => () => {},
);

type HeaderProps = {
  title: string;
  subtitle?: string;
  /** The way back, which the pearl takes. */
  onBack: () => void;
  /** An action at the header's end, such as New Routine. */
  children?: ReactNode;
};

export function PageHeader({ title, subtitle, onBack, children }: HeaderProps) {
  const giveBack = useContext(PageBackContext);
  // The latest onBack, without giving the way back again for each render
  const backRef = useRef(onBack);
  useLayoutEffect(() => {
    backRef.current = onBack;
  });
  useEffect(() => giveBack(() => backRef.current()), [giveBack]);

  return (
    <div className={styles.header}>
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
