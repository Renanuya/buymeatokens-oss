import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { appUrl } from "@/lib/config";
import { listIndexableCreators } from "@/lib/seo";

// Rebuilt hourly so new creator pages show up without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const posts = getAllPosts();
  const newestPost = posts.reduce((latest, post) => (post.updated > latest ? post.updated : latest), "");
  // A database hiccup must never take the whole sitemap down; the static part is still worth serving.
  const creators = await listIndexableCreators().catch(() => []);
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, lastModified: newestPost || undefined, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/roadmap`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/leaderboard`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/apply`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/faq/taxes`, changeFrequency: "yearly", priority: 0.3 },
    ...posts.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: post.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...creators.map((creator) => ({
      url: `${base}/${creator.username}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
