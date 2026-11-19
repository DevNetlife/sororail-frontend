const origin = (url, fallback) => {
  try {
    return new URL(url || fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
};

// #403 — only the configured RPC, Horizon and Friendbot origins may be reached.
const connectSrc = [
  "'self'",
  origin(process.env.NEXT_PUBLIC_RPC_URL, "https://soroban-testnet.stellar.org"),
  origin(process.env.NEXT_PUBLIC_HORIZON_URL, "https://horizon-testnet.stellar.org"),
  "https://friendbot.stellar.org",
].join(" ");

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sororail/sdk"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
