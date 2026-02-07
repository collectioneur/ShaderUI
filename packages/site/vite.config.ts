import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@shaderui/lib"],
  },
  server: {
    watch: {
      ignored: (path) =>
        path.includes("node_modules") &&
        !path.includes("@shaderui/lib") &&
        !path.includes("packages/lib"),
    },
  },
});
