import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["scripts/vercel-serverless.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "api/index.js",
  external: ["@electric-sql/pglite", "@electric-sql/pglite/node", "@electric-sql/pglite/worker"],
  resolveExtensions: [".ts", ".js", ".mjs", ".cjs", ".json"],
  logLevel: "info",
});

console.log("built api/index.js for Vercel");
