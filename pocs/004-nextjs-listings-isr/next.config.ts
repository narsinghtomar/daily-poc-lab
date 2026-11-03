import type { NextConfig } from "next";

// Classic App Router caching model (route segment `revalidate`) is used on
// purpose: the ISR milestone relies on it, so Cache Components stays off.
const nextConfig: NextConfig = {};

export default nextConfig;
