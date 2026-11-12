import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port fixe attendu par src-tauri/tauri.conf.json (devUrl).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1430, strictPort: true, host: "127.0.0.1", watch: { ignored: ["**/src-tauri/**", "**/target/**"] } },
  build: { target: "es2021", sourcemap: false },
});
