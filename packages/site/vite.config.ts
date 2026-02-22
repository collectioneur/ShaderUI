import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import typegpuPlugin from "unplugin-typegpu/vite";
import path from "path";
import fs from "fs";

export default defineConfig({
  base: "/ShaderUI",
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
    // GitHub Pages: при прямом заходе на /ShaderUI/examples или /ShaderUI/documentation
    // сервер отдаёт 404.html — это копия SPA, роутер отрисует нужную страницу
    {
      name: "github-pages-spa",
      closeBundle() {
        const outDir = path.resolve(__dirname, "dist");
        const src = path.join(outDir, "index.html");
        const dest = path.join(outDir, "404.html");
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      },
    },
  ],
  optimizeDeps: {
    exclude: ["shaderui"],
  },
  server: {
    watch: {
      ignored: (path) =>
        path.includes("node_modules") && !path.includes("packages/lib"),
    },
  },
});
