import type { ReactNode } from "react";

const STG = 100;

type Props = { children: ReactNode; keyProp?: string | number };

export default function StaggeredList({ children, keyProp }: Props) {
  return (
    <div key={keyProp}>
      {Array.isArray(children) ? (
        children.map((ch, i) => (
          <div
            key={(ch as { key?: string })?.key || i}
            className="stagger-child"
            style={{ animationDelay: `${i * STG}ms` }}
          >
            {ch}
          </div>
        ))
      ) : (
        <div className="stagger-child">{children}</div>
      )}
    </div>
  );
}
