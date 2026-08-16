/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "#161616",
        surface: "#1E1E1E",
        muted: "#505050",
        ink: "#EAEAEA",
        accent: "#B9D4EA",
        danger: "#C33232",
        subtle: "#8A8484"
      },
      borderRadius: {
        card: "14.5px",
        panel: "24px"
      },
      minWidth: {
        card: "16rem"
      }
    }
  },
  plugins: []
}
