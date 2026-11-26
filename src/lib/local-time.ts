// Local wall-clock helpers for scheduling emails in the recipient's morning.

/** Milliseconds `timeZone` is ahead of UTC at instant `at` (negative west of Greenwich). */
function offsetAt(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    }).formatToParts(new Date(at)).map((p) => [p.type, Number(p.value)]),
  );
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(at / 1000) * 1000;
}

/** The first instant after `after` when clocks in `timeZone` show `hour`:00. DST-safe. */
export function nextLocalHour(after: number, timeZone: string, hour: number): number {
  const today = new Date(after + offsetAt(after, timeZone));
  for (let day = 0; day < 3; day++) {
    const wall = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + day, hour);
    // The second pass uses the offset at the target instant, which differs across a DST change.
    const at = wall - offsetAt(wall - offsetAt(wall, timeZone), timeZone);
    if (at > after) return at;
  }
  throw new Error(`No ${hour}:00 found in ${timeZone}`);
}

export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// GitHub "location" is free text. Only unambiguous places map to a zone; anything else returns null
// so the caller falls back to an explicit default or a manual override.
const ZONES: [RegExp, string][] = [
  [/t[uü]rk|istanbul|ankara|[iİ]zmir|antalya|bursa|eski[sş]ehir/i, "Europe/Istanbul"],
  [/china|beijing|shanghai|shenzhen|hangzhou|guangzhou|chengdu|中国/i, "Asia/Shanghai"],
  [/hong kong/i, "Asia/Hong_Kong"],
  [/taiwan|taipei/i, "Asia/Taipei"],
  [/japan|tokyo|osaka/i, "Asia/Tokyo"],
  [/korea|seoul/i, "Asia/Seoul"],
  [/singapore/i, "Asia/Singapore"],
  [/\bindia\b|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai/i, "Asia/Kolkata"],
  [/indonesia|jakarta/i, "Asia/Jakarta"],
  [/vietnam|hanoi|ho chi minh/i, "Asia/Ho_Chi_Minh"],
  [/france|paris|lyon/i, "Europe/Paris"],
  [/germany|deutschland|berlin|munich|münchen|hamburg/i, "Europe/Berlin"],
  [/netherlands|amsterdam/i, "Europe/Amsterdam"],
  [/spain|madrid|barcelona/i, "Europe/Madrid"],
  [/italy|rome|milan/i, "Europe/Rome"],
  [/poland|warsaw/i, "Europe/Warsaw"],
  [/ukraine|kyiv|kiev/i, "Europe/Kyiv"],
  [/united kingdom|\buk\b|england|london/i, "Europe/London"],
  [/brazil|brasil|s[aã]o paulo/i, "America/Sao_Paulo"],
  [/san francisco|bay area|seattle|los angeles|california|vancouver/i, "America/Los_Angeles"],
  [/new york|boston|toronto|miami|atlanta/i, "America/New_York"],
];

export function timeZoneFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  return ZONES.find(([pattern]) => pattern.test(location))?.[1] ?? null;
}
