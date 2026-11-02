import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Hugging Face Spaces shows the app inside an iframe on its own page.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://huggingface.co",
          },
        ],
      },
    ];
  },
};
export default config;
