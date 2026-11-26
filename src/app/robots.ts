import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";

// Everything public stays crawlable; signed-in areas and endpoints are not worth a crawler's time.
const PRIVATE = ["/api/", "/admin", "/dashboard", "/onboarding"];

// AI search and assistant crawlers are welcomed by name. A crawler that matches its own group ignores
// the "*" group, so each group repeats the private paths.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
