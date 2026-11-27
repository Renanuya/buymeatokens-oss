import type { ReactNode } from "react";

// Line icons from Lucide (ISC) and brand marks from Simple Icons (CC0), drawn in the current text color.
// Every stroke has pathLength=1 so `.glyph-draw` (globals.css) can draw it in like the landing preloader.

const LINE = {
  "at-sign": (
    <>
      <circle cx="12" cy="12" r="4" pathLength={1} />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" pathLength={1} />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" pathLength={1} />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" pathLength={1} />
    </>
  ),
  tag: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" pathLength={1} />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" pathLength={1} />
    </>
  ),
  "folder-git": (
    <>
      <path d="M18 19a5 5 0 0 1-5-5v8" pathLength={1} />
      <path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5" pathLength={1} />
      <circle cx="13" cy="12" r="2" pathLength={1} />
      <circle cx="20" cy="19" r="2" pathLength={1} />
    </>
  ),
  "pen-line": (
    <>
      <path d="M13 21h8" pathLength={1} />
      <path d="m15 5 4 4" pathLength={1} />
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" pathLength={1} />
    </>
  ),
  sparkles: (
    <>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" pathLength={1} />
      <path d="M20 2v4" pathLength={1} />
      <path d="M22 4h-4" pathLength={1} />
      <circle cx="4" cy="20" r="2" pathLength={1} />
    </>
  ),
  goal: (
    <>
      <path d="M12 13V2l8 4-8 4" pathLength={1} />
      <path d="M20.561 10.222a9 9 0 1 1-12.55-5.29" pathLength={1} />
      <path d="M8.002 9.997a5 5 0 1 0 8.9 2.02" pathLength={1} />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" pathLength={1} />
      <circle cx="6" cy="12" r="3" pathLength={1} />
      <circle cx="18" cy="19" r="3" pathLength={1} />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" pathLength={1} />
    </>
  ),
  "arrow-left": (
    <>
      <path d="m12 19-7-7 7-7" pathLength={1} />
      <path d="M19 12H5" pathLength={1} />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" pathLength={1} />
      <path d="m12 5 7 7-7 7" pathLength={1} />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 7h10v10" pathLength={1} />
      <path d="M7 17 17 7" pathLength={1} />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" pathLength={1} />,
  x: <path d="M18 6 6 18M6 6l12 12" pathLength={1} />,
  plus: <path d="M5 12h14M12 5v14" pathLength={1} />,
  "chevron-down": <path d="m6 9 6 6 6-6" pathLength={1} />,
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" pathLength={1} />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" pathLength={1} />
    </>
  ),
  link: (
    <>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" pathLength={1} />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" pathLength={1} />
      <path d="M8 12h8" pathLength={1} />
    </>
  ),
  lock: (
    <>
      <circle cx="12" cy="16" r="1" pathLength={1} />
      <rect x="3" y="10" width="18" height="12" rx="2" pathLength={1} />
      <path d="M7 10V7a5 5 0 0 1 10 0v3" pathLength={1} />
    </>
  ),
  gift: (
    <>
      <path d="M12 7v14" pathLength={1} />
      <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" pathLength={1} />
      <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" pathLength={1} />
      <rect x="3" y="7" width="18" height="4" rx="1" pathLength={1} />
    </>
  ),
  coins: (
    <>
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" pathLength={1} />
      <path d="M15 6h1v4" pathLength={1} />
      <path d="m6.134 14.768.866-.5 2 3.464" pathLength={1} />
      <circle cx="16" cy="8" r="6" pathLength={1} />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" pathLength={1} />
      <path d="M12 16v-4M12 8h.01" pathLength={1} />
    </>
  ),
  star: (
    <path
      d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
      pathLength={1}
    />
  ),
  // Markdown toolbar.
  bold: <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" pathLength={1} />,
  italic: <path d="M19 4h-9M14 20H5M15 4 9 20" pathLength={1} />,
  list: <path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13" pathLength={1} />,
  "list-ordered": (
    <>
      <path d="M11 5h10M11 12h10M11 19h10M4 4h1v5M4 9h2" pathLength={1} />
      <path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" pathLength={1} />
    </>
  ),
  code: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" pathLength={1} />,
  // Repo stats, dashboard and creator page.
  fork: (
    <>
      <circle cx="12" cy="18" r="3" pathLength={1} />
      <circle cx="6" cy="6" r="3" pathLength={1} />
      <circle cx="18" cy="6" r="3" pathLength={1} />
      <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9M12 12v3" pathLength={1} />
    </>
  ),
  issue: (
    <>
      <circle cx="12" cy="12" r="1" fill="currentColor" pathLength={1} />
      <circle cx="12" cy="12" r="10" pathLength={1} />
    </>
  ),
  "pull-request": (
    <>
      <circle cx="18" cy="18" r="3" pathLength={1} />
      <circle cx="6" cy="6" r="3" pathLength={1} />
      <path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12" pathLength={1} />
    </>
  ),
  card: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" pathLength={1} />
      <path d="M2 10h20M6 14h2" pathLength={1} />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" pathLength={1} />
      <path d="M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87" pathLength={1} />
      <circle cx="9" cy="7" r="4" pathLength={1} />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" pathLength={1} />
      <circle cx="12" cy="7" r="4" pathLength={1} />
    </>
  ),
  "log-out": (
    <>
      <path d="m16 17 5-5-5-5M21 12H9" pathLength={1} />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" pathLength={1} />
    </>
  ),
  sliders: (
    <>
      <path d="M14 17H5M19 7h-9" pathLength={1} />
      <circle cx="17" cy="17" r="3" pathLength={1} />
      <circle cx="7" cy="7" r="3" pathLength={1} />
    </>
  ),
  message: (
    <path
      d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"
      pathLength={1}
    />
  ),
  heart: (
    <path
      d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
      pathLength={1}
    />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" pathLength={1} />
      <path d="M12 6v6l4 2" pathLength={1} />
    </>
  ),
  trending: <path d="M16 7h6v6M22 7l-8.5 8.5-5-5L2 17" pathLength={1} />,
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" pathLength={1} />
      <circle cx="12" cy="12" r="3" pathLength={1} />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" pathLength={1} />
      <path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" pathLength={1} />
    </>
  ),
  moon: <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" pathLength={1} />,
  "external-link": (
    <>
      <path d="M15 3h6v6M10 14 21 3" pathLength={1} />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" pathLength={1} />
    </>
  ),
  layout: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" pathLength={1} />
      <rect width="7" height="5" x="14" y="3" rx="1" pathLength={1} />
      <rect width="7" height="9" x="14" y="12" rx="1" pathLength={1} />
      <rect width="7" height="5" x="3" y="16" rx="1" pathLength={1} />
    </>
  ),
  // Roadmap.
  scale: (
    <>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" pathLength={1} />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" pathLength={1} />
      <path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" pathLength={1} />
    </>
  ),
  "badge-check": (
    <>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" pathLength={1} />
      <path d="m9 12 2 2 4-4" pathLength={1} />
    </>
  ),
  trophy: (
    <>
      <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" pathLength={1} />
      <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" pathLength={1} />
      <path d="M18 9h1.5a1 1 0 0 0 0-5H18M4 22h16" pathLength={1} />
      <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" pathLength={1} />
      <path d="M6 9H4.5a1 1 0 0 1 0-5H6" pathLength={1} />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" pathLength={1} />
      <path d="M18 17V9M13 17V5M8 17v-3" pathLength={1} />
    </>
  ),
  search: (
    <>
      <path d="m21 21-4.34-4.34" pathLength={1} />
      <circle cx="11" cy="11" r="8" pathLength={1} />
    </>
  ),
  layers: (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" pathLength={1} />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" pathLength={1} />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" pathLength={1} />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14" pathLength={1} />
      <path d="m7 22-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" pathLength={1} />
    </>
  ),
  bell: (
    <>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" pathLength={1} />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" pathLength={1} />
    </>
  ),
  webhook: (
    <>
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" pathLength={1} />
      <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" pathLength={1} />
      <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" pathLength={1} />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" pathLength={1} />
      <path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" pathLength={1} />
    </>
  ),
  lightbulb: (
    <>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" pathLength={1} />
      <path d="M9 18h6M10 22h4" pathLength={1} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof LINE;

/** Whether `value` names one of the icons, for names that come from outside the code (e.g. roadmap issues). */
export function isGlyphName(value: unknown): value is GlyphName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LINE, value);
}

/** A 24px-grid line icon. `draw` traces the strokes in once, on mount. */
export function Glyph({
  name,
  className = "size-4",
  strokeWidth = 1.75,
  draw = false,
}: {
  name: GlyphName;
  className?: string;
  strokeWidth?: number;
  draw?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${draw ? "glyph-draw " : ""}${className}`}
    >
      {LINE[name]}
    </svg>
  );
}

/** A spinning ring for buttons that are waiting on the server. */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 ${className}`} />;
}

const BRAND: Record<"paypal" | "stripe", string> = {
  paypal:
    "M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z",
  stripe:
    "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
};

/** Payment method marks: PayPal and Stripe logos, and a USDC coin (Lucide's circle-dollar-sign). */
export function PaymentMark({ method, className = "size-5" }: { method: "paypal" | "stripe" | "usdc"; className?: string }) {
  if (method === "usdc") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d={BRAND[method]} />
    </svg>
  );
}
