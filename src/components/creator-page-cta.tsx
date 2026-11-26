import Link from "next/link";
import { homePathFor } from "@/lib/access";
import type { User } from "@/lib/users";
import { ArrowUpRight } from "./icons";

const LINK = "link-arrow whitespace-nowrap";

/**
 * The link in a creator page's header, for whoever is looking at it: the owner edits it, another creator goes to
 * their own page, someone still in setup finishes theirs, and a visitor who isn't signed in is invited to get one.
 */
export function CreatorPageCta({ viewer, creatorId }: { viewer: User | null; creatorId: string }) {
  if (viewer?.username && viewer.id === creatorId) {
    return (
      <Link href="/dashboard/settings" className={LINK}>
        Edit <span className="hidden sm:inline">your</span> page <ArrowUpRight className="size-3" />
      </Link>
    );
  }
  if (viewer?.username) {
    return (
      <Link href={`/${viewer.username}`} className={LINK}>
        <span className="sm:hidden">My page</span>
        <span className="hidden sm:inline">View your page</span> <ArrowUpRight className="size-3" />
      </Link>
    );
  }
  if (viewer) {
    return (
      <Link href={homePathFor(viewer)} className={LINK}>
        Finish <span className="hidden sm:inline">your</span> page <ArrowUpRight className="size-3" />
      </Link>
    );
  }
  return (
    <Link href="/apply" className={LINK}>
      <span className="sm:hidden">Get yours</span>
      <span className="hidden sm:inline">Get your own page</span> <ArrowUpRight className="size-3" />
    </Link>
  );
}
