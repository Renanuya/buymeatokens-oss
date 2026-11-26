import { exportFileName, listExportRows, paymentsCsv } from "@/lib/payment-export";
import { getCurrentUser } from "@/lib/session";
import { normalizeUsername } from "@/lib/validation";

const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * The signed-in creator's payment history as CSV. The file is only ever built for the creator who asks for it:
 * any other username returns 404, whether or not that page exists.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to download your payment history.", { status: 401, headers: PRIVATE });

  const requested = normalizeUsername((await params).username);
  if (!user.username || requested !== user.username) return new Response("Not found", { status: 404, headers: PRIVATE });

  const csv = paymentsCsv(await listExportRows(user.id));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(user.username)}"`,
      "X-Content-Type-Options": "nosniff",
      ...PRIVATE,
    },
  });
}
