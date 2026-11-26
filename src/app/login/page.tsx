import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homePathFor, signupsGated } from "@/lib/access";
import { AppHeader } from "@/components/app-header";
import { ArrowUpRight, GitHubIcon } from "@/components/icons";
import { LegalFooter } from "@/components/legal-footer";
import { SignedInHint } from "@/components/signed-in";
import { devLoginEnabled, githubConfigured } from "@/lib/config";
import { first } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  oauth: "GitHub login didn't go through. Please try again.",
  github_not_configured: "GitHub login isn't configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));

  const query = await searchParams;
  const error = ERRORS[first(query.error) ?? ""];
  const deleted = first(query.deleted) === "1";
  const github = githubConfigured();
  const dev = devLoginEnabled();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <SignedInHint signedIn={false} />
      <main className="wrap grid flex-1 grid-cols-1 items-center gap-12 py-16 md:grid-cols-2 md:gap-10 lg:grid-cols-[1fr_400px] lg:gap-20">
        <div>
          <p className="eyebrow">Early access</p>
          <h1 className="display mt-6 text-[clamp(3rem,7vw,6.5rem)]">
            Welcome
            <br />
            back.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/75">
            Sign in to your page, payments and README badge.{" "}
            {signupsGated() ? (
              <>
                New here?{" "}
                <Link href="/apply" className="font-semibold text-ink underline decoration-line underline-offset-4">
                  Apply for early access
                </Link>
                .
              </>
            ) : (
              "New here? Just continue with GitHub, you'll pick your page name next."
            )}
          </p>
        </div>

        <div className="space-y-3">
          {deleted && (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
              Your account and your page were deleted.
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>
          )}

          {github ? (
            <div className="space-y-3">
              <a href="/api/auth/github" className="btn-dark w-full justify-between py-4 pl-6 pr-5">
                <span className="inline-flex items-center gap-3">
                  <GitHubIcon />
                  Continue with GitHub
                </span>
                <ArrowUpRight />
              </a>
              <p className="text-xs leading-relaxed text-muted">
                We collect your verified GitHub email to contact you about your account and buymeatokens updates.
              </p>
            </div>
          ) : (
            <p className="card px-4 py-3.5 text-sm text-muted">
              GitHub login isn&apos;t configured. Add <code className="font-mono text-ink">GITHUB_CLIENT_ID</code> and{" "}
              <code className="font-mono text-ink">GITHUB_CLIENT_SECRET</code> to{" "}
              <code className="font-mono text-ink">.env.local</code>.
            </p>
          )}

          {dev && (
            <form action="/api/auth/dev" method="post" className="space-y-3 rounded-2xl border border-dashed border-ink/20 p-4">
              <p className="eyebrow">Development login</p>
              <input name="name" placeholder="any-name" defaultValue="demo" className="field font-mono" />
              <button type="submit" className="btn-line w-full">
                Continue without GitHub
              </button>
            </form>
          )}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
