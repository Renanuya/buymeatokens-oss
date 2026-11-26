// Shared shell for account emails. Tables and inline styles only: no images, web fonts, scripts or
// tracking, and exactly one link (the call to action). Light by default; Apple Mail, iOS Mail and
// other clients that honour prefers-color-scheme also get a matching dark theme.

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The admin preview swaps this exact query for `all` / `not all` to show either theme. */
export const DARK_MEDIA = "@media (prefers-color-scheme:dark)";

// System fonts that sit close to the site's Inter / Inter Tight. Installed copies of Inter win.
const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = `'Inter Tight',${SANS}`;
const MONO = "'JetBrains Mono',SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

const INK = "#1c1c1e";
const BODY = "#404046";
const MUTED = "#6b6b70";
const FAINT = "#8e8e93";
const LINE = "#e3e2dc";
const PAPER = "#f6f6f1";
const LILAC = "#cdd2fb";
const IRIS = "#5b6cf2";
const WHITE = "#ffffff";

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

// No global border-collapse: collapsed cells ignore border-radius, which squared off every outlined
// shape. cellspacing="0" already removes the gaps.
const STYLES = `
table{mso-table-lspace:0pt;mso-table-rspace:0pt}
body,td,a,p{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media only screen and (max-width:520px){
.outer{padding:20px 12px 32px!important}
.card{padding:30px 22px 26px!important}
.h1{font-size:27px!important;line-height:32px!important;letter-spacing:-.6px!important}
.cta-table{width:100%!important}
.cta-a{display:block!important;text-align:center!important}
}
${DARK_MEDIA}{
.bg-page{background-color:#1a1b1e!important}
.bg-card{background-color:#242427!important;border-color:#36363c!important}
.bg-panel{background-color:#1d1e21!important;border-color:#36363c!important}
.b-line{border-color:#36363c!important}
.t-ink{color:#f4f4ef!important}
.t-body{color:#cacacf!important}
.t-muted{color:#9d9da3!important}
.t-accent{color:#aeb8fa!important}
.mark{background-color:#cdd2fb!important;color:#1c1c1e!important}
.cta-td{background-color:#cdd2fb!important}
.cta-a{color:#1c1c1e!important;border-color:#cdd2fb!important}
.dot-done{background-color:#f4f4ef!important;color:#1c1c1e!important}
.dot-now{background-color:#aeb8fa!important;color:#1c1c1e!important}
.dot-next{border-color:#4a4a52!important;color:#8a8a90!important}
.chip{background-color:#1d1e21!important;border-color:#3a3a40!important;color:#f4f4ef!important}
.badge{border-color:#4a4a52!important}
}`;

/** Vertical spacing that Outlook respects (it ignores margins on tables). */
function block(html: string, top: number, bottom: number) {
  return `<table ${TABLE} width="100%"><tr><td style="padding:${top}px 0 ${bottom}px">${html}</td></tr></table>`;
}

export type Step = { title: string; detail: string; state: "done" | "now" | "next" };

/** Numbered setup checklist: done steps get a check, the current one is highlighted. */
export function stepList(steps: Step[]) {
  const dot = (step: Step, n: number) => {
    const base = `align="center" valign="middle" style="border-radius:999px;font-family:${SANS};font-size:12px;font-weight:700;mso-line-height-rule:exactly;`;
    if (step.state === "done") {
      return `<td class="dot-done" width="24" height="24" bgcolor="${INK}" ${base}width:24px;height:24px;line-height:24px;background-color:${INK};color:${WHITE}">&#10003;</td>`;
    }
    if (step.state === "now") {
      return `<td class="dot-now" width="24" height="24" bgcolor="${IRIS}" ${base}width:24px;height:24px;line-height:24px;background-color:${IRIS};color:${WHITE}">${n}</td>`;
    }
    return `<td class="dot-next" width="22" height="22" ${base}width:22px;height:22px;line-height:22px;border:1px solid #cfcec8;color:${FAINT}">${n}</td>`;
  };
  const rows = steps.map((step, i) => `<tr><td class="b-line" style="padding:14px 0;${i ? "border-top:1px solid #e6e5df;" : ""}">
<table ${TABLE} width="100%"><tr>
<td width="24" valign="top" style="width:24px"><table ${TABLE}><tr>${dot(step, i + 1)}</tr></table></td>
<td style="padding-left:14px;font-family:${SANS}">
<p class="${step.state === "next" ? "t-muted" : "t-ink"}" style="margin:0;font-size:15px;line-height:22px;font-weight:600;color:${step.state === "next" ? MUTED : INK}">${esc(step.title)}</p>
<p class="t-muted" style="margin:2px 0 0;font-size:13px;line-height:19px;color:${MUTED}">${esc(step.detail)}</p>
</td></tr></table>
</td></tr>`).join("");
  return block(`<table ${TABLE} width="100%" class="bg-panel" bgcolor="${PAPER}" style="background-color:${PAPER};border-radius:14px">
<tr><td style="padding:4px 20px"><table ${TABLE} width="100%">${rows}</table></td></tr></table>`, 20, 30);
}

/** A labelled panel of small outlined chips. Chips are inline blocks, so they wrap on narrow phones. */
export function chipPanel(label: string, chips: string[], caption: string) {
  const chip = (text: string) => `<span class="chip" style="display:inline-block;margin:0 6px 8px 0;padding:6px 13px;border:1px solid ${LINE};border-radius:999px;background-color:${WHITE};font-size:13px;line-height:18px;font-weight:600;color:${INK};white-space:nowrap">${esc(text)}</span>`;
  return block(`<table ${TABLE} width="100%" class="bg-panel" bgcolor="${PAPER}" style="background-color:${PAPER};border-radius:14px">
<tr><td style="padding:18px 20px 16px;font-family:${SANS}">
<p class="t-muted" style="margin:0 0 12px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED}">${esc(label)}</p>
<div style="font-size:0;line-height:0">${chips.map(chip).join("")}</div>
<p class="t-muted" style="margin:4px 0 0;font-size:13px;line-height:20px;color:${MUTED}">${esc(caption)}</p>
</td></tr></table>`, 20, 30);
}

/** The README button badge as it renders on GitHub, inside a small README frame. Not a link. */
export function readmePreview() {
  const badge = `<table ${TABLE}><tr><td class="badge" bgcolor="${INK}" style="padding:5px 14px 5px 5px;border:1px solid ${INK};border-radius:999px;background-color:${INK}">
<table ${TABLE}><tr>
<td width="24" height="24" align="center" valign="middle" bgcolor="${LILAC}" style="width:24px;height:24px;border-radius:999px;background-color:${LILAC};font-family:${MONO};font-size:9px;line-height:24px;font-weight:700;letter-spacing:-.4px;color:${INK};mso-line-height-rule:exactly">&lt;/&gt;</td>
<td style="padding-left:9px;font-family:${DISPLAY};font-size:14px;line-height:24px;font-weight:600;color:${WHITE};white-space:nowrap">Buy me AI tokens&nbsp;&#8599;</td>
</tr></table></td></tr></table>`;
  return block(`<table ${TABLE} width="100%" class="bg-card" bgcolor="${WHITE}" style="border:1px solid ${LINE};border-radius:14px;background-color:${WHITE}">
<tr><td class="bg-panel b-line" bgcolor="${PAPER}" style="padding:9px 16px;border-bottom:1px solid ${LINE};border-radius:13px 13px 0 0;background-color:${PAPER};font-family:${MONO};font-size:12px;line-height:18px;color:${MUTED}"><span class="t-muted">README.md</span></td></tr>
<tr><td style="padding:20px 20px 22px;font-family:${SANS}">
<p class="t-ink" style="margin:0 0 4px;font-family:${DISPLAY};font-size:20px;line-height:26px;font-weight:700;letter-spacing:-.4px;color:${INK}">your-project</p>
<p class="t-muted" style="margin:0 0 16px;font-size:14px;line-height:21px;color:${MUTED}">If this project helps you, you can buy me some AI tokens.</p>
${badge}
</td></tr></table>`, 20, 30);
}

export type EmailLayout = {
  title: string;
  /** Inbox preview text shown after the subject. */
  preheader: string;
  eyebrow: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  /** Trusted HTML from stepList / chipRow / readmePreview. */
  visual?: string;
  button: { label: string; url: string };
  /** Why the recipient got this email. */
  footer: string;
};

/** Keeps the last two words together so a heading never ends on a lone word. */
const noOrphan = (text: string) => esc(text).replace(/ (\S+)$/, "&nbsp;$1");

export function renderEmail(e: EmailLayout): string {
  const paragraph = (text: string, last: boolean) =>
    `<p class="t-body" style="margin:0 0 ${last ? 0 : 14}px;font-family:${SANS};font-size:16px;line-height:26px;color:${BODY}">${esc(text)}</p>`;
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(e.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,p,a,h1,span{font-family:'Segoe UI',Arial,sans-serif!important}</style><![endif]-->
<style>${STYLES}</style></head>
<body class="bg-page" style="margin:0;padding:0;width:100%;background-color:${PAPER}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAPER}">${esc(e.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table ${TABLE} width="100%" class="bg-page" bgcolor="${PAPER}" style="background-color:${PAPER}"><tr><td class="outer" align="center" style="padding:40px 16px 48px">
<!--[if mso]><table ${TABLE} width="560"><tr><td><![endif]-->
<table ${TABLE} width="100%" style="max-width:560px;table-layout:fixed">
<tr><td style="padding:0 2px 22px">
<table ${TABLE}><tr>
<td class="mark" width="30" height="30" align="center" valign="middle" bgcolor="${INK}" style="width:30px;height:30px;border-radius:9px;background-color:${INK};font-family:${MONO};font-size:12px;line-height:30px;font-weight:700;letter-spacing:-.5px;color:${WHITE};mso-line-height-rule:exactly">&lt;/&gt;</td>
<td class="t-ink" style="padding-left:10px;font-family:${DISPLAY};font-size:18px;line-height:30px;font-weight:700;letter-spacing:-.6px;color:${INK}">buymeatokens</td>
</tr></table>
</td></tr>
<tr><td class="card bg-card" bgcolor="${WHITE}" style="padding:40px 40px 34px;border:1px solid ${LINE};border-radius:20px;background-color:${WHITE};word-wrap:break-word">
<p class="t-accent" style="margin:0 0 14px;font-family:${SANS};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${IRIS}">${esc(e.eyebrow)}</p>
<h1 class="h1 t-ink" style="margin:0 0 22px;font-family:${DISPLAY};font-size:32px;line-height:37px;font-weight:700;letter-spacing:-.9px;color:${INK}">${noOrphan(e.heading)}</h1>
<p class="t-ink" style="margin:0 0 10px;font-family:${SANS};font-size:16px;line-height:26px;color:${INK}">${esc(e.greeting)}</p>
${e.paragraphs.map((p, i) => paragraph(p, i === e.paragraphs.length - 1)).join("\n")}
${e.visual ?? block("", 0, 26)}
<table ${TABLE} class="cta-table"><tr><td class="cta-td" align="center" bgcolor="${INK}" style="border-radius:999px;background-color:${INK};mso-padding-alt:15px 28px">
<a class="cta-a" href="${esc(e.button.url)}" target="_blank" style="display:inline-block;padding:15px 28px;border:1px solid ${INK};border-radius:999px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:${WHITE};text-decoration:none;mso-padding-alt:0;mso-border-alt:none">${esc(e.button.label)}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>
<p class="t-muted" style="margin:30px 0 20px;font-family:${SANS};font-size:14px;line-height:22px;color:${MUTED}">Stuck on anything? Just reply to this email.</p>
<table ${TABLE}><tr>
<td width="38" height="38" align="center" valign="middle" bgcolor="${LILAC}" style="width:38px;height:38px;border-radius:999px;background-color:${LILAC};font-family:${DISPLAY};font-size:15px;line-height:38px;font-weight:700;color:${INK};mso-line-height-rule:exactly">R</td>
<td style="padding-left:12px;font-family:${SANS}">
<p class="t-ink" style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${INK}">Renan</p>
<p class="t-muted" style="margin:0;font-size:13px;line-height:19px;color:${MUTED}">Founder, buymeatokens</p>
</td></tr></table>
</td></tr>
<tr><td class="t-muted" style="padding:22px 4px 0;font-family:${SANS};font-size:12px;line-height:19px;color:#737378">
${esc(e.footer)}<br>buymeatokens &middot; Coffee is nice. AI tokens ship&nbsp;code.
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}
