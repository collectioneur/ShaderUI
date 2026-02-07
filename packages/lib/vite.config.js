import { defineConfig } from "vite";
import typegpuPlugin from "unplugin-typegpu/vite";

export default defineConfig({
  plugins: [typegpuPlugin({})],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
    sourcemap: true,
  },
});
