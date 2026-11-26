// Social links on a creator's page. Creators type a handle or paste a link; we store one canonical https URL
// per network and build every link ourselves, so a stored value can never point somewhere unexpected.

export const SOCIAL_NETWORKS = [
  { key: "github", label: "GitHub", prefix: "github.com/", placeholder: "octocat" },
  { key: "x", label: "X", prefix: "x.com/", placeholder: "handle" },
  { key: "bluesky", label: "Bluesky", prefix: "@", placeholder: "you.bsky.social" },
  { key: "linkedin", label: "LinkedIn", prefix: "linkedin.com/", placeholder: "in/your-name" },
  { key: "youtube", label: "YouTube", prefix: "youtube.com/", placeholder: "@channel" },
  { key: "discord", label: "Discord", prefix: "discord.gg/", placeholder: "invite-code" },
  { key: "website", label: "Website", prefix: "", placeholder: "https://your-site.dev" },
] as const;

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]["key"];
export type Socials = Partial<Record<SocialKey, string>>;

const KEYS = new Set<string>(SOCIAL_NETWORKS.map((n) => n.key));
export const isSocialKey = (key: string): key is SocialKey => KEYS.has(key);

/** Drops a leading scheme, "www." and the given hosts, plus anything after the first ?, # or (optionally) /. */
function stripHost(input: string, hosts: string[]): string {
  let value = input.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  for (const host of hosts) {
    if (value.toLowerCase().startsWith(`${host}/`)) {
      value = value.slice(host.length + 1);
      break;
    }
  }
  return value.replace(/[?#].*$/, "").replace(/\/+$/, "");
}

function websiteUrl(input: string): string | null {
  let value = input.trim();
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || !/^[a-z\d-]+(\.[a-z\d-]+)+$/i.test(url.hostname)) return null;
  const text = url.toString();
  return text.length <= 200 ? text : null;
}

const ERRORS: Record<SocialKey, string> = {
  github: "That GitHub username doesn't look right.",
  x: "X handles are up to 15 letters, numbers or underscores.",
  bluesky: "Use your Bluesky handle, like you.bsky.social.",
  linkedin: "Paste your LinkedIn profile link, like linkedin.com/in/your-name.",
  youtube: "Use your channel handle, like @channel.",
  discord: "Paste a Discord invite link, like discord.gg/abc123.",
  website: "Add a full website address, like https://your-site.dev.",
};

/**
 * Turns whatever the creator typed into the canonical link, or `{ error }`.
 * Empty input returns `{ url: null }`, which removes the link.
 */
export function normalizeSocial(key: SocialKey, input: string): { url: string | null } | { error: string } {
  const raw = input.trim();
  if (!raw) return { url: null };
  const fail = { error: ERRORS[key] };

  switch (key) {
    case "github": {
      const login = stripHost(raw, ["github.com"]).replace(/^@/, "").split("/")[0];
      return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login) ? { url: `https://github.com/${login}` } : fail;
    }
    case "x": {
      const handle = stripHost(raw, ["x.com", "twitter.com", "mobile.twitter.com"]).replace(/^@/, "").split("/")[0];
      return /^\w{1,15}$/.test(handle) ? { url: `https://x.com/${handle}` } : fail;
    }
    case "bluesky": {
      const handle = stripHost(raw, ["bsky.app"]).replace(/^profile\//i, "").replace(/^@/, "").split("/")[0].toLowerCase();
      const domain = /^(?=.{3,253}$)[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/;
      return domain.test(handle) || /^did:plc:[a-z2-7]{24}$/.test(handle) ? { url: `https://bsky.app/profile/${handle}` } : fail;
    }
    case "linkedin": {
      const path = stripHost(raw, ["linkedin.com", "uk.linkedin.com", "tr.linkedin.com"]);
      const m = /^(?:(in|company)\/)?([\w%-]{2,100})$/i.exec(path);
      return m ? { url: `https://www.linkedin.com/${(m[1] ?? "in").toLowerCase()}/${m[2]}` } : fail;
    }
    case "youtube": {
      const path = stripHost(raw, ["youtube.com", "m.youtube.com"]);
      const channel = /^channel\/(UC[\w-]{22})$/.exec(path);
      if (channel) return { url: `https://www.youtube.com/channel/${channel[1]}` };
      const handle = path.replace(/^@/, "");
      return /^[\w.-]{3,30}$/.test(handle) ? { url: `https://www.youtube.com/@${handle}` } : fail;
    }
    case "discord": {
      const code = stripHost(raw, ["discord.gg", "discord.com", "discordapp.com"]).replace(/^invite\//i, "");
      return /^[\w-]{2,32}$/.test(code) ? { url: `https://discord.gg/${code}` } : fail;
    }
    case "website": {
      const url = websiteUrl(raw);
      return url ? { url } : fail;
    }
  }
}

/** Reads the stored JSON. Every value is normalized again, so bad or legacy data is simply dropped. */
export function parseSocials(stored: unknown): Socials {
  let data: unknown = stored;
  if (typeof stored === "string") {
    try {
      data = JSON.parse(stored);
    } catch {
      return {};
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const socials: Socials = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isSocialKey(key) || typeof value !== "string") continue;
    const result = normalizeSocial(key, value);
    if ("url" in result && result.url) socials[key] = result.url;
  }
  return socials;
}

/** What goes in the input next to its prefix, e.g. "octocat" for https://github.com/octocat. */
export function socialInputValue(key: SocialKey, url: string | undefined): string {
  if (!url) return "";
  switch (key) {
    case "github":
    case "x":
    case "discord":
      return url.replace(/^https:\/\/[^/]+\//, "");
    case "bluesky":
      return url.replace("https://bsky.app/profile/", "");
    case "linkedin":
      return url.replace("https://www.linkedin.com/", "");
    case "youtube":
      return url.replace("https://www.youtube.com/", "");
    case "website":
      return url;
  }
}

/** Short text for a link on the page, e.g. "@octocat" or "your-site.dev". */
export function socialDetail(key: SocialKey, url: string): string | null {
  const value = socialInputValue(key, url);
  switch (key) {
    case "github":
    case "x":
      return `@${value}`;
    case "bluesky":
      return value.startsWith("did:") ? null : `@${value}`;
    case "youtube":
      return value.startsWith("@") ? value : null;
    case "website":
      return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    default:
      return null;
  }
}

/** Socials in display order. */
export function socialEntries(socials: Socials): { key: SocialKey; label: string; url: string; detail: string | null }[] {
  return SOCIAL_NETWORKS.flatMap((n) => {
    const url = socials[n.key];
    return url ? [{ key: n.key, label: n.label, url, detail: socialDetail(n.key, url) }] : [];
  });
}

/** Reads `social_<network>` form fields. Returns the first problem, labelled with its network. */
export function socialsFromForm(formData: FormData): { socials: Socials } | { error: string } {
  const socials: Socials = {};
  for (const network of SOCIAL_NETWORKS) {
    const result = normalizeSocial(network.key, String(formData.get(`social_${network.key}`) ?? "").slice(0, 300));
    if ("error" in result) return { error: `${network.label}: ${result.error}` };
    if (result.url) socials[network.key] = result.url;
  }
  return { socials };
}
