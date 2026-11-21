import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port fixe attendu par src-tauri/tauri.conf.json (devUrl).
// fs.allow : le calcul de Fajr est importé de ../priere/src/core (même dépôt).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1436, strictPort: true, host: "127.0.0.1", fs: { allow: [".", "../priere/src/core"] }, watch: { ignored: ["**/src-tauri/**"] } },
  build: { target: "es2021", sourcemap: false },
  test: { include: ["test/**/*.test.ts"] },
});
