import { build, context } from "esbuild";
import { cpSync, rmSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const buildOptions = {
  entryPoints: [
    "src/background/service-worker.ts",
    "src/options/options.ts",
    "src/dashboard/dashboard.ts",
    "src/content/formFiller.ts",
    "src/content/xCollector.ts",
  ],
  outdir: "dist",
  outbase: "src",
  bundle: true,
  format: "iife",
  target: "chrome110",
  platform: "browser",
  sourcemap: true,
  logLevel: "info",
};

function copyStaticAssets() {
  mkdirSync("dist/options", { recursive: true });
  mkdirSync("dist/dashboard", { recursive: true });
  cpSync("src/options/options.html", "dist/options/options.html");
  cpSync("src/dashboard/dashboard.html", "dist/dashboard/dashboard.html");
  cpSync("src/dashboard/dashboard.css", "dist/dashboard/dashboard.css");
  cpSync("manifest.json", "dist/manifest.json");
  cpSync("icons", "dist/icons", { recursive: true });
}

if (watch) {
  const ctx = await context({
    ...buildOptions,
    plugins: [
      {
        name: "copy-static-assets",
        setup(build) {
          build.onEnd(() => copyStaticAssets());
        },
      },
    ],
  });
  await ctx.watch();
  console.log("Watching for changes... (Ctrl+C to stop)");
} else {
  await build(buildOptions);
  copyStaticAssets();
  console.log("Build complete: dist/");
}
