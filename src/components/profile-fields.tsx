"use client";

// Page detail inputs shared by the guided setup and the settings page. Each field keeps its own state
// (so React's form reset after a failed action never wipes what was typed) and reports changes through
// `onValueChange` for callers that need the value as it changes.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { draftWithAiAction, type DraftResult } from "@/app/draft-actions";
import { Glyph, Spinner, type GlyphName } from "@/components/glyph";
import { CheckDot, TokenTile } from "@/components/icons";
import { ProfileMarkdown } from "@/components/profile-markdown";
import { SocialIcon } from "@/components/social-icons";
import type { DraftField } from "@/lib/ai-draft";
import { formatTokens, formatUsd } from "@/lib/format";
import type { RepoSuggestion } from "@/lib/github";
import {
  BIO_MAX_LENGTH,
  GOAL_MAX_UNITS,
  GOAL_PERIODS,
  GOAL_PRESETS,
  type GoalPeriod,
  PRICE_MAX_USD,
  PRICE_MIN_USD,
  PRICE_PRESETS_USD,
  PROJECT_NAME_MAX_LENGTH,
  THANK_YOU_MAX_LENGTH,
  TOKEN_USE_MAX_LENGTH,
  normalizeProjectUrl,
  parseGoalUnits,
  parsePriceUsd,
  projectNameFromUrl,
} from "@/lib/profile";
import { SOCIAL_NETWORKS, normalizeSocial, socialInputValue, type SocialKey, type Socials } from "@/lib/socials";

/** One of a row of equal options (prices, goals): lilac-soft with an iris edge when picked. */
const tile = (active: boolean) =>
  `grid h-12 min-w-0 place-items-center rounded-xl border text-[15px] font-semibold tabular-nums transition duration-200 ${
    active
      ? "border-iris bg-lilac-soft text-ink ring-4 ring-iris/10"
      : "border-line bg-white text-ink/65 hover:border-ink/30 hover:text-ink"
  }`;

/** A text input with something fixed in front of it (an icon, a "$", a domain). */
const group = (invalid = false) =>
  `flex items-center rounded-xl border bg-white transition focus-within:ring-4 ${
    invalid ? "border-red-300 focus-within:ring-red-100" : "border-line focus-within:border-iris focus-within:ring-iris/15"
  }`;

function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  return (
    <p id={id} className={`shrink-0 tabular-nums ${length >= max ? "font-semibold text-iris" : ""}`}>
      {length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
    </p>
  );
}

/** A light strip that explains a choice; not a control. */
function Hint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink/75">
      {icon}
      <p className="min-w-0">{children}</p>
    </div>
  );
}

/**
 * The last tile in a row of options: type your own number. Shows "Other" until something is typed, then the
 * number with its unit, centered like the preset tiles beside it.
 */
function CustomTile({
  active,
  value,
  onChange,
  maxLength,
  before,
  after,
  label,
}: {
  active: boolean;
  value: string;
  onChange: (digits: string) => void;
  maxLength: number;
  before?: string;
  after?: string;
  label: string;
}) {
  return (
    <label className={`${tile(active)} cursor-text`}>
      <span className="flex items-baseline justify-center">
        {value && before}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxLength}
          autoComplete="off"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="Other"
          style={{ width: value ? `${value.length + 0.15}ch` : "5ch" }}
          className="min-w-0 bg-transparent text-center text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink/65"
        />
        {value && after}
      </span>
    </label>
  );
}

/** Where "Write with AI" reads from. Leave it out to hide the button (AI drafts off). `projectUrl` can be empty or not GitHub: the server then writes from the saved project details. */
export type AiDraftSource = { projectUrl: string };

type DraftStatus = "idle" | "reading" | "writing";

/**
 * "Write with AI" for one text field: asks the server for a draft, then types it into the field. Remembers what
 * the field held before, so the creator can put it back until they start editing the draft.
 */
function useAiDraft(field: DraftField, source: AiDraftSource | undefined, current: string, apply: (text: string) => void) {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState<{ repo: string; previous: string | null } | null>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const run = async () => {
    if (!source || status !== "idle") return;
    setError(null);
    setStatus("reading");
    let result: DraftResult;
    try {
      result = await draftWithAiAction(field, source.projectUrl);
    } catch {
      result = { error: "Something went wrong. Check your connection and try again." };
    }
    if ("error" in result) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    const { text } = result;
    setDrafted({ repo: result.repo, previous: current });
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      apply(text);
      setStatus("idle");
      return;
    }
    // Types the draft in, quick at first and settling at the end.
    setStatus("writing");
    const start = performance.now();
    const duration = Math.min(1400, 350 + text.length * 2);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      apply(text.slice(0, Math.round(text.length * (1 - (1 - t) ** 2))));
      if (t < 1) frame.current = requestAnimationFrame(step);
      else setStatus("idle");
    };
    frame.current = requestAnimationFrame(step);
  };

  return {
    status,
    busy: status !== "idle",
    error,
    drafted,
    run,
    undo: () => {
      if (drafted?.previous == null) return;
      apply(drafted.previous);
      setDrafted(null);
    },
    /** The creator typed: the draft is theirs now, so there is nothing to undo to. */
    edited: () => {
      setError(null);
      setDrafted((d) => (d && d.previous !== null ? { ...d, previous: null } : d));
    },
  };
}

type AiDraft = ReturnType<typeof useAiDraft>;

function AiDraftButton({ ai, onStart }: { ai: AiDraft; onStart?: () => void }) {
  return (
    <button
      type="button"
      disabled={ai.busy}
      onClick={() => {
        onStart?.();
        void ai.run();
      }}
      title="Drafts this from your repo's README, or from your project details"
      className="group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-lilac-soft px-2.5 text-xs font-semibold text-iris transition duration-200 hover:bg-lilac/70 hover:text-ink disabled:cursor-default disabled:hover:bg-lilac-soft disabled:hover:text-iris"
    >
      {ai.status === "reading" ? (
        <Spinner className="size-3.5" />
      ) : (
        <Glyph
          name="sparkles"
          strokeWidth={2}
          className={`size-3.5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 ${ai.status === "writing" ? "animate-pulse" : ""}`}
        />
      )}
      <span aria-live="polite">{ai.status === "reading" ? "Reading your project…" : ai.status === "writing" ? "Writing…" : "Write with AI"}</span>
    </button>
  );
}

/** The line under a field after a draft: where it came from, and a way back. Or why there is no draft. */
function AiDraftNote({ ai }: { ai: AiDraft }) {
  if (ai.error) {
    return (
      <span role="alert" className="text-red-700">
        {ai.error}
      </span>
    );
  }
  if (!ai.drafted) return null;
  return (
    <>
      Drafted by AI from {ai.drafted.repo}. Check it before you save.
      {ai.drafted.previous !== null && !ai.busy && (
        <>
          {" "}
          <button
            type="button"
            onClick={ai.undo}
            className="font-semibold text-ink underline decoration-ink/25 underline-offset-2 hover:decoration-ink"
          >
            Undo
          </button>
        </>
      )}
    </>
  );
}

export const BUNDLE_SIZES = [1, 3, 5];

export function PriceField({
  defaultValue,
  onValueChange,
}: {
  defaultValue: number;
  onValueChange?: (usd: number | null) => void;
}) {
  const isPreset = (PRICE_PRESETS_USD as readonly number[]).includes(defaultValue);
  const [preset, setPreset] = useState<number | null>(isPreset ? defaultValue : null);
  const [custom, setCustom] = useState(isPreset ? "" : String(defaultValue));
  const text = preset !== null ? String(preset) : custom;
  const price = parsePriceUsd(text);

  const pick = (usd: number) => {
    setPreset(usd);
    setCustom("");
    onValueChange?.(usd);
  };
  const type = (digits: string) => {
    setCustom(digits);
    setPreset(null);
    onValueChange?.(parsePriceUsd(digits));
  };

  return (
    <div className="space-y-5">
      <input type="hidden" name="price" value={text} />
      <div>
        <p id="price-label" className="label">
          Price of 1M AI tokens
        </p>
        <div role="group" aria-labelledby="price-label" className="grid grid-cols-4 gap-2">
          {PRICE_PRESETS_USD.map((usd) => (
            <button key={usd} type="button" aria-pressed={preset === usd} onClick={() => pick(usd)} className={tile(preset === usd)}>
              ${usd}
            </button>
          ))}
          <CustomTile
            active={preset === null}
            value={custom}
            onChange={type}
            maxLength={3}
            before="$"
            label="Custom price in dollars"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Whole dollars from ${PRICE_MIN_USD} to ${PRICE_MAX_USD}. Most creators pick $3 to $5.
        </p>
      </div>
      <Hint icon={<TokenTile className="size-8 shrink-0 rounded-lg" />}>
        {price ? (
          <>
            Supporters pay{" "}
            {BUNDLE_SIZES.map((units, i) => (
              <span key={units}>
                {i > 0 && (i === BUNDLE_SIZES.length - 1 ? " or " : ", ")}
                <span className="font-semibold text-ink">{formatUsd(price * 100 * units)}</span> for {units}M
              </span>
            ))}{" "}
            AI tokens.
          </>
        ) : (
          "Pick a price to see what supporters pay."
        )}
      </Hint>
    </div>
  );
}

export type ProjectValue = { url: string; name: string };

export function ProjectFields({
  defaultUrl,
  defaultName,
  repos,
  onValueChange,
}: {
  defaultUrl: string;
  defaultName: string;
  repos: RepoSuggestion[];
  onValueChange?: (value: ProjectValue) => void;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [name, setName] = useState(defaultName);
  // Until the creator types a name, the name follows the link (repo name or site host).
  const [nameTouched, setNameTouched] = useState(Boolean(defaultName));

  const autoName = (value: string) => {
    const normalized = normalizeProjectUrl(value);
    return "url" in normalized && normalized.url ? projectNameFromUrl(normalized.url) : "";
  };
  const update = (next: ProjectValue) => {
    setUrl(next.url);
    setName(next.name);
    onValueChange?.(next);
  };
  const picked = (() => {
    const normalized = normalizeProjectUrl(url);
    return "url" in normalized ? normalized.url : null;
  })();
  const shown = repos.slice(0, 3);

  return (
    <div className="space-y-5">
      {shown.length > 0 && (
        <div>
          <p id="repos-label" className="label">
            Pick one of your repos
          </p>
          <div role="radiogroup" aria-labelledby="repos-label" className="space-y-2">
            {shown.map((r) => {
              const active = picked?.toLowerCase() === r.url.toLowerCase();
              return (
                <button
                  key={r.url}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ url: r.url, name: nameTouched && name ? name : r.name })}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition duration-200 ${
                    active ? "border-iris bg-lilac-soft ring-4 ring-iris/10" : "border-line bg-white hover:border-ink/30"
                  }`}
                >
                  <SocialIcon network="github" className="size-4 shrink-0 text-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.description || r.url.replace("https://", "")}</span>
                  </span>
                  {r.stars > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-muted">
                      <Glyph name="star" className="size-3.5" />
                      {r.stars.toLocaleString("en-US")}
                    </span>
                  )}
                  <CheckDot on={active} className="size-[18px]" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-3">
        <div>
          <label htmlFor="projectUrl" className="label">
            {shown.length > 0 ? "Or paste a link" : "Project link"}
          </label>
          <div className={group()}>
            <Glyph name="link" className="ml-3.5 size-4 shrink-0 text-muted" />
            <input
              id="projectUrl"
              name="projectUrl"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              maxLength={300}
              value={url}
              onChange={(e) => update({ url: e.target.value, name: nameTouched ? name : autoName(e.target.value) })}
              placeholder="github.com/you/project"
              className="w-full min-w-0 bg-transparent px-2.5 py-2.5 text-sm text-ink outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>
        <div>
          <label htmlFor="projectName" className="label">
            Name
          </label>
          <input
            id="projectName"
            name="projectName"
            maxLength={PROJECT_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              update({ url, name: e.target.value });
            }}
            placeholder="tiny-llm"
            className="field"
          />
        </div>
      </div>
    </div>
  );
}

export function DescriptionField({
  defaultValue,
  onValueChange,
  label = "What are you building?",
  rows = 6,
  note,
  placeholder = "Maintainer of tiny-llm, a 2 MB inference engine for edge devices. Used by 3,000+ developers.",
  ai: aiSource,
}: {
  defaultValue: string;
  onValueChange?: (bio: string) => void;
  label?: string;
  rows?: number;
  /** Where a prefilled description came from. */
  note?: string | null;
  placeholder?: string;
  ai?: AiDraftSource;
}) {
  const [description, setDescription] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const set = (value: string) => {
    setDescription(value);
    onValueChange?.(value);
  };
  const ai = useAiDraft("bio", aiSource, description, set);

  /** Wraps the selection (or a sample word) in Markdown, or prefixes the selected lines for lists. */
  const format = (tool: MarkdownTool) => {
    const el = textarea.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    let next: string;
    let from: number;
    let to: number;
    if (tool.line) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end) || tool.sample;
      const lines = block.split("\n").map((line, i) => `${tool.line === "numbered" ? `${i + 1}.` : "-"} ${line}`);
      const inserted = lines.join("\n");
      next = value.slice(0, lineStart) + inserted + value.slice(end);
      from = lineStart;
      to = lineStart + inserted.length;
    } else {
      const text = value.slice(start, end) || tool.sample;
      next = value.slice(0, start) + tool.before + text + tool.after + value.slice(end);
      from = start + tool.before.length;
      to = from + text.length;
    }
    if (next.length > BIO_MAX_LENGTH) return;
    set(next);
    ai.edited();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(from, to);
    });
  };

  return (
    <div>
      <label htmlFor="bio" className="label">
        {label}
      </label>
      <div className="overflow-hidden rounded-xl border border-line bg-white transition focus-within:border-iris focus-within:ring-4 focus-within:ring-iris/15">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line bg-paper/60 px-1.5 py-1">
          <div role="toolbar" aria-label="Formatting" className={`flex items-center ${preview ? "invisible" : ""}`}>
            {MARKDOWN_TOOLS.map((tool, i) => (
              <span key={tool.name} className="flex items-center">
                {(i === 2 || i === 3) && <span aria-hidden className="mx-1 h-4 w-px bg-line" />}
                <button
                  type="button"
                  title={tool.shortcut ? `${tool.name} (Ctrl+${tool.shortcut.toUpperCase()})` : tool.name}
                  aria-label={tool.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format(tool)}
                  className="grid size-8 place-items-center rounded-lg text-ink/60 transition hover:bg-white hover:text-ink hover:shadow-[0_1px_3px_rgba(28,28,30,0.12)]"
                >
                  <Glyph name={tool.icon} strokeWidth={2} className="size-4" />
                </button>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {aiSource && <AiDraftButton ai={ai} onStart={() => setPreview(false)} />}
            <div role="group" aria-label="Description mode" className="flex rounded-lg bg-ink/[0.05] p-0.5 text-xs font-semibold">
              {[{ label: "Write", value: false }, { label: "Preview", value: true }].map((mode) => (
                <button
                  key={mode.label}
                  type="button"
                  aria-pressed={preview === mode.value}
                  aria-controls={mode.value ? "bio-preview" : "bio"}
                  onClick={() => setPreview(mode.value)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    preview === mode.value ? "bg-white text-ink shadow-[0_1px_3px_rgba(28,28,30,0.12)]" : "text-muted hover:text-ink"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <textarea
          ref={textarea}
          id="bio"
          name="bio"
          rows={rows}
          maxLength={BIO_MAX_LENGTH}
          value={description}
          readOnly={ai.busy}
          aria-busy={ai.busy || undefined}
          onChange={(event) => {
            set(event.target.value);
            ai.edited();
          }}
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const tool = MARKDOWN_TOOLS.find((t) => t.shortcut === event.key.toLowerCase());
            if (tool) {
              event.preventDefault();
              format(tool);
            }
          }}
          hidden={preview}
          aria-describedby="bio-help bio-count"
          placeholder={placeholder}
          className={`block w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-zinc-400 ${
            ai.status === "reading" ? "ai-sheen" : ""
          }`}
        />
        {preview && (
          <div
            id="bio-preview"
            role="region"
            aria-label="Description preview"
            className="overflow-y-auto px-3.5 py-3 text-sm leading-relaxed"
            style={{ height: `${rows * 1.625 + 1.5}rem` }}
          >
            {description.trim() ? (
              <ProfileMarkdown>{description}</ProfileMarkdown>
            ) : (
              <p className="text-muted">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-start justify-between gap-4 text-xs text-muted">
        <p id="bio-help">
          {ai.error || ai.drafted ? (
            <AiDraftNote ai={ai} />
          ) : (
            (note ?? "Markdown works. Select text and use the buttons, or Ctrl+B, I and K.")
          )}
        </p>
        <Counter id="bio-count" length={description.length} max={BIO_MAX_LENGTH} />
      </div>
    </div>
  );
}

type MarkdownTool = {
  name: string;
  icon: GlyphName;
  before: string;
  after: string;
  sample: string;
  shortcut?: string;
  line?: "bullet" | "numbered";
};

const MARKDOWN_TOOLS: MarkdownTool[] = [
  { name: "Bold", icon: "bold", before: "**", after: "**", sample: "bold text", shortcut: "b" },
  { name: "Italic", icon: "italic", before: "_", after: "_", sample: "italic text", shortcut: "i" },
  { name: "Link", icon: "link", before: "[", after: "](https://)", sample: "link text", shortcut: "k" },
  { name: "Bulleted list", icon: "list", before: "", after: "", sample: "List item", line: "bullet" },
  { name: "Numbered list", icon: "list-ordered", before: "", after: "", sample: "First item", line: "numbered" },
  { name: "Code", icon: "code", before: "`", after: "`", sample: "code" },
];

const TOKEN_IDEAS = [
  "Claude Code for refactors",
  "Cursor for new features",
  "Running evals and benchmarks",
  "Reviewing pull requests",
  "Writing docs and examples",
  "Answering issues faster",
];

export function ThankYouField({ defaultValue }: { defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  return (
    <div>
      <label htmlFor="thankYou" className="label">
        Thank-you note <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="thankYou"
        name="thankYou"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-describedby="thankYou-count"
        placeholder="Thank you for fueling this. Every token goes straight into the project."
        className="field resize-none py-3 leading-relaxed"
      />
      <div className="mt-2 flex items-start justify-between gap-4 text-xs text-muted">
        <p>Plain text, shown above your supporters.</p>
        {/* Counted the way the server counts (an emoji is one character), so the counter and the save agree. */}
        <Counter id="thankYou-count" length={Array.from(text).length} max={THANK_YOU_MAX_LENGTH} />
      </div>
    </div>
  );
}

export function TokenUseField({
  defaultValue,
  onValueChange,
}: {
  defaultValue: string;
  onValueChange?: (text: string) => void;
}) {
  const [text, setText] = useState(defaultValue);
  const set = (value: string) => {
    const clipped = value.slice(0, TOKEN_USE_MAX_LENGTH);
    setText(clipped);
    onValueChange?.(clipped);
  };
  const has = (idea: string) => text.toLowerCase().includes(idea.toLowerCase());

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="tokenUse" className="label">
          What will the tokens pay for?
        </label>
        <textarea
          id="tokenUse"
          name="tokenUse"
          rows={4}
          maxLength={TOKEN_USE_MAX_LENGTH}
          value={text}
          onChange={(e) => set(e.target.value)}
          aria-describedby="tokenUse-count"
          placeholder="Claude Code for the v2 refactor, plus running evals before every release."
          className="field resize-none py-3 leading-relaxed"
        />
        <div className="mt-2 flex items-start justify-between gap-4 text-xs text-muted">
          <p>Each line shows as its own line on your page.</p>
          <Counter id="tokenUse-count" length={text.length} max={TOKEN_USE_MAX_LENGTH} />
        </div>
      </div>
      <div>
        <p className="mb-2.5 text-xs font-medium text-muted">Need ideas? Tap to add one.</p>
        <div className="flex flex-wrap gap-2">
          {TOKEN_IDEAS.map((idea) => {
            const added = has(idea);
            return (
              <button
                key={idea}
                type="button"
                disabled={added}
                onClick={() => set(text.trim() ? `${text.replace(/\s+$/, "")}\n${idea}` : idea)}
                className={`inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-2 pr-3 text-xs font-medium transition duration-200 ${
                  added
                    ? "cursor-default border-iris bg-lilac-soft text-ink"
                    : "border-line bg-white text-ink/70 hover:border-ink/30 hover:text-ink"
                }`}
              >
                <span className={`grid size-4 place-items-center rounded-full ${added ? "bg-iris text-white" : "bg-paper text-ink"}`}>
                  <Glyph name={added ? "check" : "plus"} strokeWidth={3} className="size-2.5" />
                </span>
                {idea}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GoalField({
  defaultValue,
  defaultPeriod = "one-time",
  priceUsd,
  onValueChange,
}: {
  defaultValue: number | null;
  defaultPeriod?: GoalPeriod;
  priceUsd: number;
  onValueChange?: (units: number | null) => void;
}) {
  const presets = GOAL_PRESETS as readonly number[];
  // Which tile is picked. Typing a preset's number in the custom tile keeps the custom tile picked.
  const [mode, setMode] = useState<"none" | "preset" | "custom">(
    defaultValue === null ? "none" : presets.includes(defaultValue) ? "preset" : "custom",
  );
  const [text, setText] = useState(defaultValue === null ? "" : String(defaultValue));
  const [period, setPeriod] = useState<GoalPeriod>(defaultPeriod);
  const enabled = mode !== "none" && text !== "";
  const parsed = parseGoalUnits(text);
  const units = enabled && "units" in parsed ? parsed.units : null;
  const isCustom = mode === "custom";

  const choose = (next: "none" | "preset" | "custom", value: string) => {
    setMode(next);
    setText(value);
    const result = parseGoalUnits(value);
    onValueChange?.(next !== "none" && value !== "" && "units" in result ? result.units : null);
  };

  return (
    <div className="space-y-5">
      <input type="hidden" name="goal" value={enabled ? text : ""} />
      <input type="hidden" name="goalPeriod" value={period} />
      <div>
        <p id="goal-label" className="label">
          Tokens to raise
        </p>
        <div role="group" aria-labelledby="goal-label" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <button type="button" aria-pressed={mode === "none"} onClick={() => choose("none", "")} className={tile(mode === "none")}>
            None
          </button>
          {presets.map((preset) => {
            const active = mode === "preset" && units === preset;
            return (
              <button key={preset} type="button" aria-pressed={active} onClick={() => choose("preset", String(preset))} className={tile(active)}>
                {formatTokens(preset)}
              </button>
            );
          })}
          <CustomTile
            active={isCustom}
            value={isCustom ? text : ""}
            onChange={(digits) => choose("custom", digits)}
            maxLength={String(GOAL_MAX_UNITS).length}
            after="M"
            label="Custom goal in millions of tokens"
          />
        </div>
        {enabled && "error" in parsed && text !== "" ? (
          <p className="mt-2 text-xs text-red-700">{parsed.error}</p>
        ) : (
          <p className="mt-2 text-xs text-muted">In millions of tokens. Pick one or type your own.</p>
        )}
      </div>
      {enabled && (
        <div>
          <p id="goal-period-label" className="label">
            Resets
          </p>
          <div role="group" aria-labelledby="goal-period-label" className="grid grid-cols-2 gap-2">
            {GOAL_PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={tile(period === p)}>
                {p === "monthly" ? "Monthly" : "Never"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            {period === "monthly"
              ? "Counts support confirmed this calendar month (UTC), then starts over on the 1st."
              : "Counts all support from the day you set it."}
          </p>
        </div>
      )}
      <Hint icon={<TokenTile className="size-8 shrink-0 rounded-lg" />}>
        {units ? (
          <>
            <span className="font-semibold text-ink">{formatTokens(units)} tokens</span> is about{" "}
            <span className="font-semibold text-ink">{formatUsd(units * priceUsd * 100)}</span> at your price of ${priceUsd}{" "}
            per 1M.
          </>
        ) : (
          "A goal adds a progress bar to your page."
        )}
      </Hint>
    </div>
  );
}

/** Raw text per network, as typed. */
export type SocialDraft = Partial<Record<SocialKey, string>>;

export function socialsFromDraft(draft: SocialDraft): Socials {
  const socials: Socials = {};
  for (const n of SOCIAL_NETWORKS) {
    const result = normalizeSocial(n.key, draft[n.key] ?? "");
    if ("url" in result && result.url) socials[n.key] = result.url;
  }
  return socials;
}

export function SocialFields({
  defaultValue,
  onValueChange,
}: {
  defaultValue: Socials;
  onValueChange?: (socials: Socials) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<SocialDraft>(() =>
    Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.key, socialInputValue(n.key, defaultValue[n.key])])),
  );
  const [checked, setChecked] = useState<Partial<Record<SocialKey, boolean>>>({});

  return (
    // One row per network: the logo in a fixed slot, the fixed part of the address, then what the creator types.
    // The logo names the network; the label is there for screen readers.
    <div className="space-y-2">
      {SOCIAL_NETWORKS.map((n) => {
        const value = draft[n.key] ?? "";
        const result = normalizeSocial(n.key, value);
        const error = checked[n.key] && "error" in result ? result.error : null;
        const filled = value.trim() !== "" && !error;
        const inputId = `${id}-${n.key}`;
        return (
          <div key={n.key}>
            <label htmlFor={inputId} className="sr-only">
              {n.label}
            </label>
            <div title={n.label} className={`${group(Boolean(error))} overflow-hidden`}>
              <span
                className={`grid w-11 shrink-0 place-items-center self-stretch border-r transition max-[360px]:w-9 ${
                  filled ? "border-iris/25 bg-lilac-soft text-ink" : "border-line bg-paper/70 text-ink/55"
                }`}
              >
                <SocialIcon network={n.key} className="size-4" />
              </span>
              {n.prefix && (
                <span className="select-none whitespace-nowrap pl-3 text-sm text-muted max-[360px]:pl-2 max-[360px]:text-xs">
                  {n.prefix}
                </span>
              )}
              <input
                id={inputId}
                name={`social_${n.key}`}
                value={value}
                maxLength={200}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={n.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                onChange={(e) => {
                  const next = { ...draft, [n.key]: e.target.value };
                  setDraft(next);
                  onValueChange?.(socialsFromDraft(next));
                }}
                onBlur={() => setChecked((c) => ({ ...c, [n.key]: true }))}
                className={`w-full min-w-0 bg-transparent py-2.5 pr-3.5 text-sm text-ink outline-none placeholder:text-zinc-400 max-[360px]:pr-1.5 ${n.prefix ? "" : "pl-3"}`}
              />
            </div>
            {error && (
              <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
