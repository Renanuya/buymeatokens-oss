// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver...) which public URLs are new or changed.
// Bing's index also feeds several AI assistants, so this gets new posts in front of them sooner.
//
//   npx tsx scripts/indexnow.ts                      dry run: lists every URL in the live sitemap
//   npx tsx scripts/indexnow.ts --apply              submits them all
//   npx tsx scripts/indexnow.ts --apply /blog/x      submits only the given paths
//
// The key is public by design: it is served at /<key>.txt to prove the site owns the submission.
// Touches: no database. Reads the live sitemap; with --apply, posts the URLs to api.indexnow.org.
// Run it after a deploy that adds or changes public pages, such as a new blog post.

const KEY = "f653acee25874b48c4033b2c29d214c5";
const SITE = (process.env.INDEXNOW_SITE || "https://buymeatokens.com").replace(/\/+$/, "");

async function sitemapUrls(): Promise<string[]> {
  const res = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function main() {
  const apply = process.argv.includes("--apply");
  const paths = process.argv.slice(2).filter((arg) => arg.startsWith("/"));
  const urls = paths.length > 0 ? paths.map((path) => `${SITE}${path}`) : await sitemapUrls();
  if (urls.length === 0) throw new Error("No URLs to submit");

  const keyCheck = await fetch(`${SITE}/${KEY}.txt`, { signal: AbortSignal.timeout(15000) });
  if (!keyCheck.ok || (await keyCheck.text()).trim() !== KEY) {
    throw new Error(`${SITE}/${KEY}.txt must serve the key before submitting. Deploy first.`);
  }

  console.log(`${urls.length} URL(s) for ${SITE}`);
  if (!apply) {
    for (const url of urls) console.log(`  ${url}`);
    console.log("Dry run. Add --apply to submit.");
    return;
  }

  const host = new URL(SITE).host;
  for (let i = 0; i < urls.length; i += 10000) {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(i, i + 10000) }),
      signal: AbortSignal.timeout(30000),
    });
    // 200 = accepted, 202 = accepted, key validation pending. Anything else is an error worth seeing.
    console.log(`IndexNow: ${res.status} ${res.statusText} ${await res.text()}`.trim());
    if (res.status !== 200 && res.status !== 202) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
