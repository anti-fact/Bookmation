import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import autoprefixer from "autoprefixer"
import tailwindcss from "tailwindcss"
import { defineConfig } from "vite"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: path.resolve(projectRoot, "build/ui-preview")
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: path.resolve(projectRoot, "tailwind.preview.config.mjs")
        }),
        autoprefixer()
      ]
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "~": path.resolve(projectRoot, "src")
    }
  },
  root: path.resolve(projectRoot, "preview"),
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true
  }
})
