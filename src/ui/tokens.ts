/**
 * デザインシート.svg から抽出した再利用 token。
 * SVG 自体は改変しない。値の変更はデザイン正本の更新と同時に行う。
 */
export const designTokens = {
  color: {
    canvas: "#161616",
    surface: "#1E1E1E",
    muted: "#505050",
    ink: "#EAEAEA",
    accent: "#B9D4EA",
    danger: "#C33232",
    subtle: "#8A8484"
  },
  radius: {
    sm: 4,
    md: 8,
    card: 14.5,
    panel: 24
  },
  layout: {
    cardMinWidthRem: 16,
    stickyHeaderZIndex: 20
  }
} as const
