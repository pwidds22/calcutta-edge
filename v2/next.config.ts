import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/auction",
        destination: "/strategy",
        permanent: true,
      },
      {
        source: "/auction/:path*",
        destination: "/strategy/:path*",
        permanent: true,
      },
    ];
  },
  // PostHog reverse proxy — prevent ad blockers from blocking analytics
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
