import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // funding.json (https://fundingjson.org) and its ownership proof are read by
    // directories and validators, some of them in the browser.
    return [
      {
        source: "/funding.json",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/.well-known/funding-manifest-urls",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
