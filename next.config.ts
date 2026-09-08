import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" removed — incompatible with Vercel's build runner
  reactStrictMode: true,
  // transformers.js pulls in onnxruntime-node, whose native .node binding
  // cannot be bundled. It is imported lazily and only when the optional
  // encoder is installed (see src/lib/ml/encoder.ts), but it still has to be
  // left external for the server build to succeed.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
