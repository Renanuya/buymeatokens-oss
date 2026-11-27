import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Board } from "../board";
import type { Period } from "@/lib/leaderboard";

export const revalidate = 300;
export const dynamicParams = false;

const SHORT: Period[] = ["daily", "weekly", "monthly"];

export function generateStaticParams() {
  return SHORT.map((period) => ({ period }));
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }): Promise<Metadata> {
  const { period } = await params;
  return {
    title: `Leaderboard: ${period}`,
    description: `The most-supported projects on buymeatokens in the ${period} view, ranked by AI tokens received.`,
    alternates: { canonical: `/leaderboard/${period}` },
  };
}

export default async function LeaderboardPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  if (!SHORT.includes(period as Period)) notFound();
  return <Board period={period as Period} />;
}
