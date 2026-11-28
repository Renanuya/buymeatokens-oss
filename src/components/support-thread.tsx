"use client";

import { useEffect, useState, useTransition } from "react";
import { likeSupportAction, replyToSupportAction } from "@/app/dashboard/support-actions";
import { SolidGlyph, Spinner } from "@/components/glyph";
import { timeAgo } from "@/lib/format";

const REPLY_MAX = 500;

export type ThreadCreator = { name: string; avatarUrl: string | null };

const action = "inline-flex min-h-8 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";

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

  // Fresh server data (after a save or a refresh) wins over local state.
  useEffect(() => setLiked(savedLiked), [savedLiked]);
  useEffect(() => {
    setReply(savedReply);
    setRepliedAt(savedRepliedAt);
  }, [savedReply, savedRepliedAt]);

  if (!owner && !reply) return null;

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
      <div className="support-thread-lead flow-root">
        {owner ? (
          <div className="-ml-3 mt-2 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={toggleLike}
              aria-pressed={liked}
              disabled={pending}
              className={`${action} ${liked ? "text-iris hover:bg-lilac-soft" : "text-muted hover:bg-paper hover:text-ink"}`}
            >
              <span key={String(liked)} className={liked ? "setup-pop" : ""}>
                <SolidGlyph name="heart" className="size-4" />
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
                <SolidGlyph name="reply" className="size-4" />
                Reply
              </button>
            )}
          </div>
        ) : null}

        {editing && (
          <form
            className="mt-3"
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
              <span className="mr-auto text-xs tabular-nums text-muted">
                {draft.length}/{REPLY_MAX}
                <span className="pointer-coarse:hidden"> · Ctrl+Enter to send</span>
              </span>
              {/* Kept together, so on a narrow screen Cancel and Reply move to the next line as a pair. */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditing(false)} className={`${action} text-muted hover:bg-paper hover:text-ink`}>
                  Cancel
                </button>
                <button type="submit" disabled={pending || !draft.trim()} className="btn-dark min-h-8 gap-2 px-4 py-1.5 text-sm">
                  {pending && <Spinner className="size-3" />}
                  {reply ? "Save" : "Reply"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {reply && !editing && (
        <div data-support-reply role="group" aria-label={`Reply from ${creator.name} to ${supporterName || "supporter"}`} className="support-reply rise-in mt-3 min-w-0 pl-5">
          <p className="support-reply-meta flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-5">
            <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{creator.name}</span>
            {repliedAt && <span className="text-xs text-muted" suppressHydrationWarning>{timeAgo(repliedAt)}</span>}
          </p>
          <p className="support-reply-message mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
            {reply}
          </p>
          {owner && (
            <div className="-ml-3 mt-1 flex flex-wrap items-center gap-1">
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
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
