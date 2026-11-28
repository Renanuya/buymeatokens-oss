import { markWelcomeSent, type ApplicationWithUser } from "./applications";
import { appUrl } from "./config";
import { sendEmail } from "./email";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The "you're in" email that goes out when an application is approved. */
export function welcomeEmail(a: ApplicationWithUser) {
  const name = a.displayName.split(" ")[0] || a.login || "there";
  const account = a.login ? ` as @${a.login}` : "";
  const url = `${appUrl()}/login`;
  const subject = "You're in: buymeatokens early access";
  const text = [
    `Hi ${name},`,
    "",
    "You're in! Your buymeatokens page is ready to claim.",
    "",
    `Log in with GitHub${account}: ${url}`,
    "",
    "It takes about a minute: pick your page name and add PayPal, USDC or Stripe so people can start buying you tokens.",
    "",
    `Thanks for building ${a.projectName}.`,
    "",
    "buymeatokens",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f0;padding:32px 16px;font-family:Inter,Helvetica,Arial,sans-serif;color:#1c1c1e">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4dc;border-radius:16px;padding:32px">
<p style="margin:0 0 8px;font-size:14px;line-height:20px;font-weight:500;color:#71717a">Early access</p>
<h1 style="margin:0 0 20px;font-size:32px;line-height:1.05;letter-spacing:-0.04em">You're in.</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${esc(name)}, your buymeatokens page is ready to claim.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6">It takes about a minute: pick your page name and add PayPal, USDC or Stripe so people can start buying you tokens.</p>
<a href="${url}" style="display:inline-block;background:#1c1c1e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 22px;border-radius:999px">Log in with GitHub${esc(account)} &#8599;</a>
<p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#71717a">Thanks for building ${esc(a.projectName)}.<br>buymeatokens</p>
</div></body></html>`;
  return { subject, text, html };
}

/** Sends the welcome email and records it. Returns false when email isn't configured or sending failed. */
export async function sendWelcomeEmail(a: ApplicationWithUser): Promise<boolean> {
  if (!a.email) return false;
  const sent = await sendEmail({ to: a.email, ...welcomeEmail(a), idempotencyKey: `welcome-${a.id}` });
  if (sent) await markWelcomeSent(a.id);
  return sent;
}
