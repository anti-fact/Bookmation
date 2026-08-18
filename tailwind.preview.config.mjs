import baseConfig from "./tailwind.config.js"

/** @type {import('tailwindcss').Config} */
export default {
  ...baseConfig,
  content: [...baseConfig.content, "./preview/**/*.{ts,tsx,html}"]
}
