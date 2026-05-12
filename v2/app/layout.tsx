import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: '/favicon.ico',
    apple: '/brand/calcutta_edge_180x180.png',
  },
  title: "Calcutta Edge | Free Online Calcutta Auction Hosting + Strategy Analytics",
  description:
    "Host your Masters, March Madness, or NFL Calcutta auction free. Get devigged odds, fair values, and bid strategy from $14.99/event. The only all-in-one Calcutta platform.",
  keywords: [
    "masters calcutta auction 2026",
    "masters calcutta auction",
    "golf calcutta auction",
    "calcutta auction online",
    "calcutta auction platform",
    "host calcutta auction free",
    "what is a calcutta auction",
    "how to run a calcutta auction",
    "calcutta auction rules golf",
    "golf calcutta strategy",
    "calcutta auction fair value calculator",
    "calcutta vs bracket pool golf",
    "masters pool 2026",
    "calcutta auction payout structure",
    "march madness calcutta",
  ],
  openGraph: {
    title: "Calcutta Edge | Free Calcutta Auction Hosting + Strategy Analytics",
    description:
      "Host your Masters or March Madness Calcutta auction free. Devigged odds, fair values, and bid strategy from $14.99/event.",
    url: "https://calcuttaedge.com",
    siteName: "Calcutta Edge",
    type: "website",
    images: [
      {
        url: "/brand/calcutta_edge_banner.png",
        width: 1500,
        height: 500,
        alt: "Calcutta Edge — Free Calcutta Auction Hosting + Strategy Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Calcutta Edge | Free Calcutta Auction Hosting + Strategy Analytics",
    description:
      "Host your Masters Calcutta auction free. Devigged odds, fair values, and profit projections from $14.99/event.",
    images: ["/brand/calcutta_edge_banner.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://calcuttaedge.com",
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Calcutta Edge',
  url: 'https://calcuttaedge.com',
  description:
    'Host your Calcutta auction free with real-time bidding. Strategy analytics with devigged odds and fair values from $14.99/event.',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Any',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Hosting',
      price: '0',
      priceCurrency: 'USD',
      description: 'Live auction hosting with real-time bidding, commissioner controls, and settlement tools.',
    },
    {
      '@type': 'Offer',
      name: 'Strategy Analytics',
      price: '14.99',
      priceCurrency: 'USD',
      description: 'Per-tournament unlock: devigged odds from multiple sportsbooks, fair value calculations, suggested bids, and round-by-round profit projections. Available for the Masters, PGA Championship, March Madness, and other supported events.',
    },
  ],
  publisher: {
    '@type': 'Organization',
    name: 'Calcutta Edge',
    url: 'https://calcuttaedge.com',
    logo: {
      '@type': 'ImageObject',
      url: 'https://calcuttaedge.com/brand/calcutta_edge_180x180.png',
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark landing-theme">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
