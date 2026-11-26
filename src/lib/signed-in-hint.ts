// Marketing pages are static, so they can't read the session cookie: it's HttpOnly, and reading it on the server would
// make every page dynamic. Instead a hint cookie that holds nothing but "1" says "this browser is signed in". The
// script below runs in <head> before the first paint and sets <html data-auth="in">, and CSS in globals.css shows the
// matching variant of every <SignedInSwitch>, so the wrong button never flashes. The hint only decides which link to
// show; the pages behind those links still check the real session.

export const SIGNED_IN_HINT = "bmt_signed_in";
/** The session's lifetime, so the hint doesn't outlive it by much. */
export const SIGNED_IN_HINT_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export const SIGNED_IN_PATTERN = new RegExp(`(?:^|;\\s*)${SIGNED_IN_HINT}=1(?:;|$)`);

/** The inline script for <head>. */
export const SIGNED_IN_SCRIPT = `try{if(${SIGNED_IN_PATTERN}.test(document.cookie))document.documentElement.dataset.auth="in"}catch(e){}`;
