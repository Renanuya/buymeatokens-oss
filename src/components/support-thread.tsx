"use client";

import { useEffect, useState, useTransition } from "react";
import { likeSupportAction, replyToSupportAction } from "@/app/dashboard/support-actions";
import { Avatar } from "@/components/avatar";
import { Glyph, Spinner } from "@/components/glyph";
import { shortName, timeAgo } from "@/lib/format";

const REPLY_MAX = 500;

export type ThreadCreator = { name: string; avatarUrl: string | null };

function Heart({ filled, className = "size-3.5" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    </svg>
  );
}

const action = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition";

/**
 * The creator's like and reply under a supporter's message. Visitors see them; the creator (`owner`) also gets the
 * buttons to like, reply, edit and remove, saved straight away.
 */
export function SupportThread({
  donationId,
  supporterName,
  reply: savedReply,
  repliedAt: savedRepliedAt,
  liked: savedLiked,
  creator,
  owner,
}: {
  donationId: string;
  supporterName: string;
  reply: string | null;
  repliedAt: number | null;
  liked: boolean;
  creator: ThreadCreator;
  owner: boolean;
}) {
  const [liked, setLiked] = useState(savedLiked);
  const [reply, setReply] = useState(savedReply);
  const [repliedAt, setRepliedAt] = useState(savedRepliedAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const creatorFirst = shortName(creator.name) || creator.name;

  // Fresh server data (after a save or a refresh) wins over local state.
  useEffect(() => setLiked(savedLiked), [savedLiked]);
  useEffect(() => {
    setReply(savedReply);
    setRepliedAt(savedRepliedAt);
  }, [savedReply, savedRepliedAt]);

  if (!owner && !liked && !reply) return null;

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setError(null);
    startTransition(async () => {
      const result = await likeSupportAction(donationId, next);
      if (!result.ok) {
        setLiked(!next);
        setError(result.error);
      }
    });
  };

  const save = (text: string) => {
    setError(null);
    startTransition(async () => {
      const result = await replyToSupportAction(donationId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReply(text.trim() || null);
      setRepliedAt(text.trim() ? Date.now() : null);
      setEditing(false);
    });
  };

  return (
    <div>
      {owner ? (
        <div className="-ml-2.5 mt-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={`${action} ${liked ? "text-iris hover:bg-lilac-soft" : "text-muted hover:bg-paper hover:text-ink"}`}
          >
            <span key={String(liked)} className={liked ? "setup-pop" : ""}>
              <Heart filled={liked} />
            </span>
            {liked ? "Liked" : "Like"}
          </button>
          {!reply && !editing && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
              className={`${action} text-muted hover:bg-paper hover:text-ink`}
            >
              <Glyph name="message" strokeWidth={2} className="size-3.5" />
              Reply
            </button>
          )}
        </div>
      ) : (
        liked && (
          <p className="mt-2 inline-flex max-w-full items-center gap-2 text-xs font-medium text-muted">
            <span className="relative">
              <Avatar name={creator.name} url={creator.avatarUrl} className="size-5 rounded-full! text-[8px]" />
              <span className="absolute -bottom-1 -right-1 grid size-3 place-items-center rounded-full bg-white text-iris">
                <Heart filled className="size-2.5" />
              </span>
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]">Liked by {creatorFirst}</span>
          </p>
        )
      )}

      {editing && (
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) save(draft);
          }}
        >
          <textarea
            autoFocus
            rows={2}
            maxLength={REPLY_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && draft.trim()) save(draft);
            }}
            placeholder={`Reply to ${supporterName || "your supporter"}…`}
            aria-label="Your reply"
            className="field resize-none text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11px] tabular-nums text-muted">
              {draft.length}/{REPLY_MAX}
              <span className="pointer-coarse:hidden"> · Ctrl+Enter to send</span>
            </span>
            {/* Kept together, so on a narrow screen Cancel and Reply move to the next line as a pair. */}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditing(false)} className={`${action} text-muted hover:bg-paper hover:text-ink`}>
                Cancel
              </button>
              <button type="submit" disabled={pending || !draft.trim()} className="btn-dark gap-2 px-4 py-2 text-xs">
                {pending && <Spinner className="size-3" />}
                {reply ? "Save" : "Reply"}
              </button>
            </div>
          </div>
        </form>
      )}

      {reply && !editing && (
        <div className="rise-in mt-3 flex items-start gap-2.5 border-l-2 border-lilac pl-3.5">
          <Avatar name={creator.name} url={creator.avatarUrl} className="size-7 rounded-lg! text-[10px]" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-5">
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{creator.name}</span>
              <span className="rounded-full bg-ink px-1.5 py-px text-[10px] font-semibold text-white">Creator</span>
              {repliedAt && (
                <span className="text-xs text-muted" suppressHydrationWarning>
                  · {timeAgo(repliedAt)}
                </span>
              )}
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
              {reply}
            </p>
            {owner && (
              <div className="-ml-2.5 mt-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(reply);
                    setEditing(true);
                  }}
                  className={`${action} text-muted hover:bg-paper hover:text-ink`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save("")}
                  className={`${action} text-muted hover:bg-red-50 hover:text-red-700`}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
