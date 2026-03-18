import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  title: "Calcutta Edge — The Calcutta Auction Platform | Free Hosting + Strategy Analytics",
  description:
    "Host your Calcutta auction for free with real-time bidding, countdown timers, and commissioner controls. Upgrade to strategy analytics with devigged odds, fair values, and profit projections. $29.99/event.",
  keywords: [
    "calcutta auction",
    "calcutta auction hosting",
    "calcutta auction platform",
    "live calcutta auction",
    "free calcutta hosting",
    "calcutta auction calculator",
    "march madness calcutta",
    "calcutta bidding strategy",
    "calcutta auction tool",
    "calcutta auction odds",
  ],
  openGraph: {
    title: "Calcutta Edge — Host Your Calcutta Auction Free",
    description:
      "The only platform that hosts your live Calcutta auction AND gives you the strategy edge to win it. Free hosting + $29.99 analytics.",
    url: "https://calcuttaedge.com",
    siteName: "Calcutta Edge",
    type: "website",
    images: [
      {
        url: "/brand/calcutta_edge_banner.png",
        width: 1500,
        height: 500,
        alt: "Calcutta Edge — Host Free. Bid Smart.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Calcutta Edge — Free Calcutta Auction Hosting + Strategy Analytics",
    description:
      "Host your Calcutta auction for free. Upgrade to devigged odds, fair values, and profit projections for $29.99/event.",
    images: ["/brand/calcutta_edge_banner.png"],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Calcutta Edge',
  url: 'https://calcuttaedge.com',
  description:
    'Host your Calcutta auction for free with real-time bidding. Upgrade to strategy analytics with devigged odds and fair values.',
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
      price: '29.99',
      priceCurrency: 'USD',
      description: 'Devigged odds, fair value calculations, suggested bids, and round-by-round profit projections.',
    },
  ],
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
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
