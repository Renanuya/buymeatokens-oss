import type { ReactNode } from "react";

export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display mt-4 text-[clamp(2.5rem,5vw,4rem)]">{title}</h1>
      {children && <div className="mt-4 max-w-2xl leading-relaxed text-ink/75">{children}</div>}
    </div>
  );
}
