import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import typegpuPlugin from "unplugin-typegpu/vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      shaderui: path.resolve(__dirname, "../lib/dist/index.js"),
    },
  },
  plugins: [
    typegpuPlugin({
      include: [path.resolve(__dirname, "src/**/*.{ts,tsx}")],
    }),
    react(),
  ],
  optimizeDeps: {
    exclude: ["shaderui"],
  },
  server: {
    watch: {
      ignored: (path) =>
        path.includes("node_modules") &&
        !path.includes("packages/lib"),
    },
  },
});
