/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bm: {
          paper: "var(--bm-color-paper)",
          ink: "var(--bm-color-ink)",
          accent: "var(--bm-color-accent)",
          panel: "var(--bm-color-panel)",
          "on-panel": "var(--bm-color-on-panel)",
          muted: "var(--bm-color-muted)",
          placeholder: "var(--bm-color-placeholder)",
          "muted-text": "var(--bm-color-muted-text)",
          "control-muted": "var(--bm-color-control-muted)",
          danger: "var(--bm-color-danger)",
          error: "var(--bm-color-error)",
          black: "var(--bm-color-black)",
          border: "var(--bm-color-border)",
          focus: "var(--bm-color-focus)"
        }
      },
      borderRadius: {
        "bm-control": "var(--bm-radius-control)",
        "bm-field": "var(--bm-radius-field)",
        "bm-switch": "var(--bm-radius-switch)",
        "bm-dialog": "var(--bm-radius-dialog)",
        "bm-chip": "var(--bm-radius-chip)",
        "bm-pill": "var(--bm-radius-pill)"
      },
      boxShadow: {
        "bm-header": "var(--bm-shadow-header)",
        "bm-floating": "var(--bm-shadow-floating)",
        "bm-control": "var(--bm-shadow-control)"
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "Noto Sans JP",
          "Hiragino Kaku Gothic ProN",
          "Meiryo",
          "sans-serif"
        ]
      },
      zIndex: {
        "bm-sticky": "var(--bm-z-sticky)",
        "bm-floating": "var(--bm-z-floating)",
        "bm-popover": "var(--bm-z-popover)",
        "bm-dialog": "var(--bm-z-dialog)",
        "bm-toast": "var(--bm-z-toast)"
      },
      keyframes: {
        "bm-overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "bm-dialog-in": {
          from: {
            opacity: "0",
            transform: "translate(-50%, -48%) scale(0.98)"
          },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" }
        }
      },
      animation: {
        "bm-overlay-in": "bm-overlay-in 160ms ease-out",
        "bm-dialog-in": "bm-dialog-in 180ms ease-out"
      }
    }
  },
  plugins: []
}
