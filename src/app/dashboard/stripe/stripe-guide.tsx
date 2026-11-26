import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { ArrowUpRight } from "@/components/icons";
import { appUrl } from "@/lib/config";

const KEY_NAME = "buymeatokens";

// Mirrors the "How will you be using this key?" choice Stripe shows after "Create restricted key".
const KEY_USES = [
  { label: "Powering an integration you built", pick: false },
  { label: "Providing this key to a third-party application", pick: true },
  { label: "Authorizing an AI agent", pick: false },
];

export function Strong({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink">{children}</span>;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    // On the narrowest phones the copy button drops below, so a short value like the key name isn't cut in two.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-paper px-3.5 py-2.5">
      <div className="min-w-[12ch] flex-1">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="break-all font-mono text-[13px] text-ink">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

/** How to create a restricted Stripe key, step by step. Used on the Payments page and in the guided setup. */
export function StripeGuide() {
  const steps: { title: ReactNode; body?: ReactNode }[] = [
    {
      title: "Open your Stripe API keys page.",
      body: (
        <div className="space-y-3">
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noreferrer"
            className="btn-line gap-2 px-4 py-2 text-xs"
          >
            Open Stripe API keys <ArrowUpRight className="size-3" />
          </a>
          <p>
            Want to try it without real money first? Switch to a <Strong>sandbox</Strong> (test mode) in Stripe before
            creating the key. You can swap in a live key later.
          </p>
        </div>
      ),
    },
    {
      title: (
        <>
          Click <Strong>Create restricted key</Strong>.
        </>
      ),
      body: "Not \"Create secret key\". A restricted key only gets the access you give it.",
    },
    {
      title: (
        <>
          Stripe asks <Strong>&ldquo;How will you be using this key?&rdquo;</Strong> Pick the third-party option.
        </>
      ),
      body: (
        <ul className="space-y-2">
          {KEY_USES.map((use) => (
            <li
              key={use.label}
              className={`flex flex-col gap-1 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                use.pick ? "border-iris bg-lilac-soft text-ink" : "border-line text-muted/70 line-through decoration-line"
              }`}
            >
              <span className={use.pick ? "font-semibold" : ""}>{use.label}</span>
              {use.pick && <span className="shrink-0 text-xs font-semibold text-iris">Choose this</span>}
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Fill in the name, and the website if Stripe asks for one.",
      body: (
        <div className="space-y-2">
          <CopyRow label="Name" value={KEY_NAME} />
          <CopyRow label="Website" value={appUrl()} />
        </div>
      ),
    },
    {
      title: (
        <>
          Set <Strong>Checkout Sessions</Strong> to <Strong>Write</Strong>.
        </>
      ),
      body: (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-line text-[13px]">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-lilac-soft px-3.5 py-2.5">
              <span className="font-semibold text-ink">Checkout Sessions</span>
              <span className="rounded-full bg-iris px-2.5 py-0.5 text-xs font-semibold text-white">Write</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span>Everything else</span>
              <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold">None</span>
            </div>
          </div>
          <p>
            It&apos;s in the permissions list under <Strong>Checkout</Strong>. Use the search box there if the list is
            long.
          </p>
        </div>
      ),
    },
    {
      title: (
        <>
          Click <Strong>Create key</Strong>, copy it and paste it below.
        </>
      ),
      body: (
        <>
          It starts with <span className="font-mono text-ink">rk_live_</span> (or{" "}
          <span className="font-mono text-ink">rk_test_</span> in a sandbox). Stripe shows a live key only once, so
          copy it before closing the window.
        </>
      ),
    },
  ];

  return (
    <ol className="space-y-8">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 sm:gap-5">
          <span className="w-6 shrink-0 pt-0.5 font-mono text-xs font-semibold text-muted">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-[15px] font-semibold leading-snug">{step.title}</p>
            {step.body && <div className="text-sm leading-relaxed text-muted">{step.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
