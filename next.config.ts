import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
