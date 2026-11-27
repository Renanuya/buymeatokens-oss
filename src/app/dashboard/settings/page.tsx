import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { aiDraftEnabled } from "@/lib/ai-draft";
import { loadCreatorPage } from "@/lib/creator-page-data";
import { topRepos } from "@/lib/github";
import { requireCreator } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export default async function SettingsPage() {
  const user = await requireCreator();
  const [repos, page] = await Promise.all([user.login ? topRepos(user.login) : Promise.resolve([]), loadCreatorPage(user)]);

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Your page" title="Make it yours.">
        What supporters see at /{user.username}.
      </PageTitle>
      <ProfileForm
        repos={repos}
        page={page}
        aiDrafts={aiDraftEnabled()}
        defaults={{
          displayName: user.displayName,
          bio: user.bio,
          priceUsd: Math.round(user.unitPriceCents / 100),
          projectUrl: user.projectUrl ?? "",
          projectName: user.projectName ?? "",
          tokenUse: user.tokenUse,
          thankYou: user.thankYou,
          goalUnits: user.goalUnits,
          socials: user.socials,
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
        <p className="text-muted">Download your payment history, or delete your account and your page.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/dashboard/account" className="font-semibold text-ink underline underline-offset-4">
            Account &amp; data
          </Link>
          <Link href="/dashboard/account#delete-account" className="font-semibold text-red-700 underline underline-offset-4">
            Delete my account
          </Link>
        </div>
      </div>
    </div>
  );
}
