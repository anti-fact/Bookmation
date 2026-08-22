/**
 * figma/Bookmation.svg と figma/Bookmation_component.svg から抽出した再利用 token。
 * SVG 自体は改変しない。値の変更はデザイン正本の更新と同時に行う。
 */
export const designTokens = {
  color: {
    paper: "#FFFFFF",
    ink: "#1E1E1E",
    accent: "#B9D4EA",
    panel: "#161616",
    onPanel: "#EAEAEA",
    muted: "#7A7A7A",
    mutedText: "#505050",
    controlMuted: "#505050",
    danger: "#C33232",
    error: "#FF383C",
    black: "#000000"
  },
  radius: {
    field: 4,
    switch: 5,
    control: 8,
    dialog: 14,
    chip: 14.5,
    pill: 24
  },
  layout: {
    controlHeight: 48,
    fieldHeight: 38,
    switchWidth: 80,
    switchHeight: 30,
    sliderWidth: 140,
    dialogMaxWidth: 818,
    stickyHeaderZIndex: 20,
    dialogZIndex: 50,
    popoverZIndex: 55,
    toastZIndex: 60
  }
} as const
