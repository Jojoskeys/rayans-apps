// Construit l'application dans dist-app/ : processus principal, pont (preload) et interface React.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";

const out = "dist-app";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/renderer`, { recursive: true });
const common = { bundle: true, logLevel: "warning", legalComments: "eof", minify: true, sourcemap: false };

await Promise.all([
  build({ ...common, entryPoints: ["src/main/main.ts"], outfile: `${out}/main.cjs`, platform: "node", format: "cjs", target: "node22", external: ["electron"] }),
  build({ ...common, entryPoints: ["src/main/preload.ts"], outfile: `${out}/preload.cjs`, platform: "node", format: "cjs", target: "node22", external: ["electron"] }),
  build({
    ...common, entryPoints: ["src/renderer/main.tsx"], outfile: `${out}/renderer/app.js`, platform: "browser", format: "iife",
    target: "chrome130", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  }),
]);
for (const f of ["index.html", "styles.css"]) copyFileSync(`src/renderer/${f}`, `${out}/renderer/${f}`);
console.log(`Application construite dans ${out}/`);
