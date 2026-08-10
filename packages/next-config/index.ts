import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

/**
 * Shared Next.js config for every app in the monorepo. The app is built by
 * vinext (Vite), which reads the same `next.config.ts` contract, so anything
 * added here must stay compatible with both toolchains.
 */
export const config: NextConfig = {};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);
