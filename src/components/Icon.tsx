// Icons for the routines, drawn rather than typed so they don't
// depend on the font having ⏮ ⏸ ⏭ (JetBrains Mono doesn't).
const PATHS = {
  down: <path d="M6 9l6 6 6-6" fill="none" />,
  left: <path d="M15 5l-7 7 7 7" fill="none" />,
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
};

export default function Icon({
  name,
  size = 20,
}: {
  name: keyof typeof PATHS;
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
