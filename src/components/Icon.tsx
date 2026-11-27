// The app's own icons (a habit's or group's are HabitIcon's), drawn rather
// than typed so they don't depend on the font having ⏮ ⏸ ⏭ (JetBrains Mono
// doesn't), or come out as a phone's emoji.
const PATHS = {
  down: <path d="M6 9l6 6 6-6" fill="none" />,
  left: <path d="M15 5l-7 7 7 7" fill="none" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" fill="none" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" fill="none" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" />,
  close: <path d="M6 6l12 12M18 6L6 18" fill="none" />,
  // Four dots: the pearl's menu
  menu: (
    <g stroke="none">
      {[7, 17].map((x) =>
        [7, 17].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" />),
      )}
    </g>
  ),
  // The habits' views: Compact, its cards down to their headers, and Calendar
  list: <path d="M5 7h14M5 12h14M5 17h14" fill="none" />,
  calendar: (
    <g fill="none">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </g>
  ),
  grip: (
    <g stroke="none">
      {[6, 12, 18].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.6" />
          <circle cx="15" cy={y} r="1.6" />
        </g>
      ))}
    </g>
  ),
  stopwatch: (
    <g fill="none">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5" />
    </g>
  ),
  back: <path d="M7 6v12M18 6l-8 6 8 6z" />,
  play: <path d="M8 5l11 7-11 7z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" />,
  pause: <path d="M7 5h3v14H7zM14 5h3v14h-3z" />,
  skip: <path d="M6 6l8 6-8 6zM17 6v12" />,
  stop: <path stroke="none" d="M6 6h12v12H6z" />,
  edit: (
    <path d="M4 20l1.2-4.6L15.5 5.1a2.1 2.1 0 0 1 3 3L8.2 18.4z" fill="none" />
  ),
  dot: <circle cx="12" cy="12" r="6" stroke="none" />,
  ring: <circle cx="12" cy="12" r="5.5" fill="none" />,
  // Filled, from Material Design Icons (Pictogrammers, Apache License 2.0)
  settings: (
    <path
      stroke="none"
      d="M12 8a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2a2 2 0 0 0 2 2a2 2 0 0 0 2-2a2 2 0 0 0-2-2m-2 12c-.25 0-.46-.18-.5-.42l-.37-2.65c-.63-.25-1.17-.59-1.69-.99l-2.49 1.01c-.22.08-.49 0-.61-.22l-2-3.46a.493.493 0 0 1 .12-.64l2.11-1.66L4.5 12l.07-1l-2.11-1.63a.493.493 0 0 1-.12-.64l2-3.46c.12-.22.39-.31.61-.22l2.49 1c.52-.39 1.06-.73 1.69-.98l.37-2.65c.04-.24.25-.42.5-.42h4c.25 0 .46.18.5.42l.37 2.65c.63.25 1.17.59 1.69.98l2.49-1c.22-.09.49 0 .61.22l2 3.46c.13.22.07.49-.12.64L19.43 11l.07 1l-.07 1l2.11 1.63c.19.15.25.42.12.64l-2 3.46c-.12.22-.39.31-.61.22l-2.49-1c-.52.39-1.06.73-1.69.98l-.37 2.65c-.04.24-.25.42-.5.42zm1.25-18l-.37 2.61c-1.2.25-2.26.89-3.03 1.78L5.44 7.35l-.75 1.3L6.8 10.2a5.55 5.55 0 0 0 0 3.6l-2.12 1.56l.75 1.3l2.43-1.04c.77.88 1.82 1.52 3.01 1.76l.37 2.62h1.52l.37-2.61c1.19-.25 2.24-.89 3.01-1.77l2.43 1.04l.75-1.3l-2.12-1.55c.4-1.17.4-2.44 0-3.61l2.11-1.55l-.75-1.3l-2.41 1.04a5.42 5.42 0 0 0-3.03-1.77L12.75 4z"
    />
  ),
  chart: (
    <path
      stroke="none"
      d="M9 17H7v-7h2zm4 0h-2V7h2zm4 0h-2v-4h2zm2 2H5V5h14v14.1M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2"
    />
  ),
  party: (
    <path
      stroke="none"
      d="m14.53 1.45l-1.08 1.08l1.6 1.6q.33.375.33.87c0 .495-.11.64-.33.86L11.5 9.47l1 1.08l3.63-3.61c.53-.59.79-1.24.79-1.94s-.26-1.36-.79-1.95zm-3.98 2.02L9.47 4.55l.61.56c.22.22.33.52.33.89s-.11.67-.33.89l-.61.56l1.08 1.08l.56-.61c.53-.59.8-1.23.8-1.92c0-.72-.27-1.37-.8-1.97zM21 5.06c-.69 0-1.33.27-1.92.8l-5.63 5.64l1.08 1l5.58-5.56c.25-.25.55-.38.89-.38s.64.13.89.38l.61.61l1.03-1.08l-.56-.61c-.59-.53-1.25-.8-1.97-.8M7 8L2 22l14-5zm12 3.06c-.7 0-1.34.27-1.94.8l-1.59 1.59l1.08 1.08l1.59-1.59c.25-.25.53-.38.86-.38s.63.13.88.38l1.62 1.59l1.05-1.03l-1.6-1.64c-.59-.53-1.25-.8-1.95-.8"
    />
  ),
  hourglass: (
    <path
      stroke="none"
      d="M6 2h12v6l-4 4l4 4v6H6v-6l4-4l-4-4zm10 14.5l-4-4l-4 4V20h8zm-4-5l4-4V4H8v3.5zM10 6h4v.75l-2 2l-2-2z"
    />
  ),
  unknown: (
    <path
      stroke="none"
      d="M11 18h2v-2h-2zm1-16A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8m0-14a4 4 0 0 0-4 4h2a2 2 0 0 1 2-2a2 2 0 0 1 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4"
    />
  ),
};

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", margin: "auto" }}
    >
      {PATHS[name]}
    </svg>
  );
}
