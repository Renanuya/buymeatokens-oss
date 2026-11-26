"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/logo";
import { DARK_MEDIA } from "@/lib/email-layout";

function Toggle<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-paper p-1" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${value === option ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function EmailDesignPreview({ html, from, subject, preheader }: {
  html: string; from: string; subject: string; preheader: string;
}) {
  const [size, setSize] = useState<"desktop" | "mobile">("desktop");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const preview = useRef<HTMLIFrameElement>(null);
  // Pin the theme instead of following this computer's setting: Apple Mail and iOS Mail apply the
  // dark rules for readers who use dark mode; most other clients always show the light version.
  const srcDoc = useMemo(() => html.replace(DARK_MEDIA, theme === "dark" ? "@media all" : "@media not all"), [html, theme]);

  useEffect(() => {
    const frame = preview.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      const body = frame.contentDocument?.body;
      if (!body) return;
      const resize = () => { frame.style.height = `${Math.ceil(body.getBoundingClientRect().height)}px`; };
      observer = new ResizeObserver(resize);
      observer.observe(body);
      resize();
    };
    // srcDoc can finish loading before React hydrates the server-rendered iframe.
    frame.addEventListener("load", observe);
    observe();
    return () => { frame.removeEventListener("load", observe); observer?.disconnect(); };
  }, [srcDoc]);

  return (
    <section aria-label="Email design preview" className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">Preview</p>
        <div className="flex flex-wrap gap-2">
          <Toggle label="Preview size" value={size} onChange={setSize} options={[["desktop", "Desktop"], ["mobile", "Mobile"]] as const} />
          <Toggle label="Preview theme" value={theme} onChange={setTheme} options={[["light", "Light"], ["dark", "Dark"]] as const} />
        </div>
      </div>
      <div className="flex gap-3 border-b border-line px-4 py-4" aria-label="Inbox preview">
        <LogoMark className="mt-0.5 size-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold">{from}</p>
            <p className="shrink-0 text-xs text-muted">now</p>
          </div>
          <p className="truncate text-sm font-medium">{subject}</p>
          <p className="truncate text-sm text-muted">{preheader}</p>
        </div>
      </div>
      <div className={theme === "dark" ? "bg-[#1a1b1e]" : "bg-paper"}>
        <iframe
          title={`${subject} (email preview)`}
          ref={preview}
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          referrerPolicy="no-referrer"
          className={`mx-auto block w-full border-0 ${size === "mobile" ? "max-w-[375px]" : ""}`}
          style={{ height: 1000 }}
        />
      </div>
    </section>
  );
}
