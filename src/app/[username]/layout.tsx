import type { Metadata } from "next";
import type { ReactNode } from "react";
import { jsonLdScript, creatorJsonLd } from "@/lib/seo";
import { getUserByUsername } from "@/lib/users";
import { normalizeUsername } from "@/lib/validation";

// Search-facing extras for creator pages, kept out of the page itself: one canonical URL per creator
// (/Ada and /ada are the same page) and ProfilePage structured data linking the creator to GitHub.

type Props = { children: ReactNode; params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const username = normalizeUsername((await params).username);
  return { alternates: { canonical: `/${username}` } };
}

export default async function CreatorLayout({ children, params }: Props) {
  const creator = await getUserByUsername((await params).username).catch(() => null);
  return (
    <>
      {creator?.username && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              creatorJsonLd({
                username: creator.username,
                displayName: creator.displayName,
                bio: creator.bio,
                avatarUrl: creator.avatarUrl,
                login: creator.login,
                createdAt: creator.createdAt,
              }),
            ),
          }}
        />
      )}
      {children}
    </>
  );
}
