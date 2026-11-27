"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getSponsorStatus } from "@/app/dashboard/sponsor-actions";
import { CopyButton } from "@/components/copy-field";
import { Glyph } from "@/components/glyph";
import { ArrowUpRight, CheckDot, GitHubIcon } from "@/components/icons";
import {
  dotGithubRepoUrl,
  editFileUrl,
  fundingLine,
  fundingYml,
  newFileUrl,
  npmFundingField,
  npmLink,
  sponsorLink,
  type SponsorStatus,
  type SponsorTarget,
} from "@/lib/sponsor";

const COPY = "size-8 rounded-lg border border-line bg-white hover:border-ink/30";

function Row({ icon, title, detail, children }: { icon: ReactNode; title: ReactNode; detail: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-white">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-5">{title}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      {children && <span className="flex shrink-0 items-center gap-2">{children}</span>}
    </li>
  );
}

function GitHubLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-iris transition hover:text-ink"
    >
      {children} <ArrowUpRight className="size-3" />
    </a>
  );
}

/** What to show for one repository: a line about its state, and the action that gets the button there. */
function targetParts(t: SponsorTarget, link: string, dir: string): { detail: string; action: ReactNode } {
  const branch = t.branch ?? "main";
  const path = dir ? `${dir}/FUNDING.yml` : "FUNDING.yml";
  if (t.state === "on") return { detail: "Sponsor button is on", action: <CheckDot on className="size-[18px]" /> };
  if (t.exists === false) {
    return dir
      ? { detail: "Not on GitHub, or not public", action: <CopyButton value={fundingYml(link)} label="Copy FUNDING.yml" className={COPY} /> }
      : { detail: "Needs a public .github repository", action: <GitHubLink href={dotGithubRepoUrl}>Create</GitHubLink> };
  }
  if (t.state === "other") {
    return {
      detail: "FUNDING.yml doesn’t link to you yet",
      action: (
        <>
          <CopyButton value={fundingLine(link)} label="Copy the line to add" className={COPY} />
          <GitHubLink href={editFileUrl(t.repo, branch, path)}>Edit</GitHubLink>
        </>
      ),
    };
  }
  return {
    detail: t.state === "unknown" ? "Couldn’t check GitHub" : "No Sponsor button yet",
    action: <GitHubLink href={newFileUrl(t.repo, branch, dir, "FUNDING.yml", fundingYml(link))}>Add on GitHub</GitHubLink>,
  };
}

/**
 * GitHub's Sponsor button for the creator's repository and, through their `.github` repository, all of them; plus
 * the npm funding field. "Add on GitHub" opens GitHub with FUNDING.yml filled in. The states are checked again when
 * the creator comes back to the tab, so a committed file shows as on.
 */
export function SponsorSetup({ username, base }: { username: string; base: string }) {
  const link = sponsorLink(base, username);
  const [status, setStatus] = useState<SponsorStatus | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const lastCheck = useRef(0);

  const check = useCallback(async (repo: string | null) => {
    lastCheck.current = Date.now();
    setChecking(true);
    try {
      setStatus(await getSponsorStatus(repo));
    } catch {
      // Keep what's shown; the links work without a status.
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(pick);
  }, [check, pick]);

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck.current > 4000) void check(pick);
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [check, pick]);

  const project = status?.project ?? null;
  const repos = status?.repos ?? [];
  const projectParts = project ? targetParts(project, link, ".github") : null;
  const accountParts = status?.account ? targetParts(status.account, link, "") : null;

  return (
    <div className="flex flex-1 flex-col">
      <ul className="space-y-2" aria-busy={checking}>
        <Row
          icon={<GitHubIcon className="size-4" />}
          title={
            project && repos.length > 1 ? (
              <select
                aria-label="Repository"
                value={project.repo}
                onChange={(e) => setPick(e.target.value)}
                className="-ml-1 max-w-full cursor-pointer truncate rounded-md bg-transparent px-1 text-sm font-semibold leading-5 outline-none transition hover:bg-paper focus-visible:ring-2 focus-visible:ring-iris"
              >
                {repos.map((r) => (
                  <option key={r} value={r} title={r}>
                    {r.split("/")[1]}
                  </option>
                ))}
              </select>
            ) : project ? (
              <span title={project.repo}>{project.repo.split("/")[1]}</span>
            ) : (
              "Your repository"
            )
          }
          detail={!status && checking ? "Checking GitHub…" : projectParts?.detail ?? "Add .github/FUNDING.yml with your link"}
        >
          {projectParts?.action ?? (status ? <CopyButton value={fundingYml(link)} label="Copy FUNDING.yml" className={COPY} /> : null)}
        </Row>
        {(status?.account || (!status && checking)) && (
          <Row
            icon={<Glyph name="layers" className="size-4" />}
            title="All your repositories"
            detail={accountParts?.detail ?? "Checking GitHub…"}
          >
            {accountParts?.action}
          </Row>
        )}
        <Row
          icon={<span className="text-[10px] font-bold tracking-tight text-[#cb3837]">npm</span>}
          title="npm package"
          detail={<span className="font-mono">{npmFundingField(npmLink(base, username))}</span>}
        >
          <CopyButton value={npmFundingField(npmLink(base, username))} label="Copy for package.json" className={COPY} />
        </Row>
      </ul>
      <p className="mt-2.5 text-xs text-muted">
        GitHub opens with the file filled in. Commit it and a Sponsor button appears at the top of the repo.
      </p>
    </div>
  );
}
