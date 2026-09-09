import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" removed — incompatible with Vercel's build runner
  reactStrictMode: true,
  // transformers.js pulls in onnxruntime-node, whose native .node binding
  // cannot be bundled. It is imported lazily and only when the optional
  // encoder is installed (see src/lib/ml/encoder.ts), but it still has to be
  // left external for the server build to succeed.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  // ...and kept out of the traced output entirely. onnxruntime-node is 211 MB
  // of prebuilt binaries for every platform; file tracing follows the lazy
  // import and would otherwise copy it into all 21 route bundles, pushing
  // each one past Vercel's 250 MB serverless limit and failing the deploy —
  // even for routes that never touch ML.
  //
  // Excluding it does not break the encoder where it is genuinely available:
  // a normal Node deployment resolves it from node_modules at runtime. On a
  // platform that only ships the traced bundle, the dynamic import fails and
  // `encoder.ts` falls back, which is the intended behaviour there anyway.
  //
  // `ml/` is excluded for the same reason: it is the offline trainer plus its
  // model weights and returned runs, never read by the server, but tracing
  // sweeps it into every route bundle.
  //
  // `data/` is deliberately NOT excluded — the engine reads the skill graph
  // and course catalogue from there at runtime, and tracing it is what makes
  // the app work on Vercel at all.
  outputFileTracingExcludes: {
    "**/*": [
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-common/**",
      "node_modules/@huggingface/transformers/**",
      "ml/**",
      "dist/**",
      "e2e/**",
    ],
  },
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/next/dist/server/**/*",
    ],
  },
};

export default nextConfig;
