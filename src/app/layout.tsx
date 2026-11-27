import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { HtmlFlags, InlineScript } from "@/components/inline-script";
import { SoundEffects } from "@/components/sound-effects";
import { SIGNED_IN_SCRIPT } from "@/lib/signed-in-hint";
import "./globals.css";

// Inter for running text and UI, Inter Tight only for big display headlines.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

// Search engine ownership tags, set per environment so no verification code lives in the repo.
const verification: Metadata["verification"] = {
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
  ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    // The search result title says what the product is; the brand line stays on link previews.
    default: "buymeatokens: Let your users buy you AI tokens, 0% platform fee",
    template: "%s · buymeatokens",
  },
  description:
    "A support page for developers, paid in AI tokens. Supporters buy you 1M-token bundles; the money goes straight to your Stripe, PayPal or USDC wallet. 0% fee.",
  applicationName: "buymeatokens",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  verification,
  openGraph: {
    type: "website",
    siteName: "buymeatokens",
    title: "buymeatokens: Coffee is nice. AI tokens ship code.",
    description: "Your users buy you AI tokens. Money goes straight to you, 0% platform fee.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Lets animations hide content before it reveals, only when JavaScript is running. */}
        <InlineScript html="document.documentElement.classList.add('js')" />
        {/* Shows "Dashboard" instead of "Create your page" to signed-in visitors on static pages; see signed-in-hint.ts. */}
        <InlineScript html={SIGNED_IN_SCRIPT} />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <HtmlFlags />
        {children}
        <SoundEffects />
      </body>
    </html>
  );
}
