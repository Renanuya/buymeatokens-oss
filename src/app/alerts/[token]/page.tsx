import type { Metadata } from "next";
import { StreamAlerts } from "@/components/stream-alert";
import { parseAlertOptions } from "@/lib/stream-alerts";

// The URL is the secret: keep it out of search results and referrers.
export const metadata: Metadata = { title: "Stream alerts", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The browser source for OBS and Streamlabs (docs/stream-alerts.md): a transparent page that shows support as it is confirmed. */
export default async function AlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <StreamAlerts token={token} options={parseAlertOptions(search)} />
    </>
  );
}
