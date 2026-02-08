import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import typegpuPlugin from "unplugin-typegpu/vite";
import path from "path";

export default defineConfig({
  plugins: [
    typegpuPlugin({
      include: [path.resolve(__dirname, "src/**/*.{ts,tsx}")],
    }),
    react(),
  ],
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
