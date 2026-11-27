import type { Metadata } from "next";
import { Board } from "./board";

// Refreshed every few minutes, like the home page.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The most-supported projects on buymeatokens, ranked by AI tokens received.",
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardPage() {
  return <Board period="lifetime" />;
}
