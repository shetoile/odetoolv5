import type { CSSProperties } from "react";

export type MindMapThemeStyle = CSSProperties & Record<`--${string}`, string>;

export type MindMapTheme = {
  start: string;
  end: string;
  glow: string;
  border: string;
  accent: string;
  connector: string;
  connectorGlow: string;
  chipBorder: string;
  chipBg: string;
  metaBorder: string;
  metaBg: string;
  focus: string;
  shadow: string;
};

export const MIND_MAP_LEVEL_THEMES: MindMapTheme[] = [
  {
    start: "rgba(3, 26, 47, 0.98)",
    end: "rgba(7, 35, 59, 0.98)",
    glow: "rgba(52, 161, 219, 0.24)",
    border: "rgba(72, 159, 210, 0.58)",
    accent: "#7edbff",
    connector: "rgba(98, 203, 248, 0.88)",
    connectorGlow: "rgba(72, 182, 232, 0.36)",
    chipBorder: "rgba(87, 177, 222, 0.46)",
    chipBg: "rgba(6, 31, 49, 0.78)",
    metaBorder: "rgba(102, 192, 235, 0.52)",
    metaBg: "rgba(8, 38, 58, 0.8)",
    focus: "rgba(127, 223, 255, 0.92)",
    shadow: "rgba(3, 17, 29, 0.44)"
  },
  {
    start: "rgba(7, 36, 58, 0.98)",
    end: "rgba(10, 52, 82, 0.98)",
    glow: "rgba(55, 167, 228, 0.22)",
    border: "rgba(83, 169, 218, 0.6)",
    accent: "#82dcff",
    connector: "rgba(103, 206, 249, 0.88)",
    connectorGlow: "rgba(78, 186, 234, 0.36)",
    chipBorder: "rgba(91, 180, 225, 0.46)",
    chipBg: "rgba(7, 36, 56, 0.78)",
    metaBorder: "rgba(106, 197, 237, 0.52)",
    metaBg: "rgba(9, 42, 64, 0.8)",
    focus: "rgba(133, 225, 255, 0.92)",
    shadow: "rgba(4, 20, 33, 0.42)"
  },
  {
    start: "rgba(11, 50, 79, 0.98)",
    end: "rgba(16, 74, 114, 0.98)",
    glow: "rgba(67, 186, 237, 0.22)",
    border: "rgba(93, 182, 226, 0.62)",
    accent: "#8ce3ff",
    connector: "rgba(113, 213, 252, 0.88)",
    connectorGlow: "rgba(88, 194, 239, 0.38)",
    chipBorder: "rgba(104, 191, 232, 0.48)",
    chipBg: "rgba(10, 45, 69, 0.78)",
    metaBorder: "rgba(116, 205, 243, 0.54)",
    metaBg: "rgba(11, 51, 77, 0.82)",
    focus: "rgba(143, 230, 255, 0.94)",
    shadow: "rgba(5, 23, 37, 0.4)"
  },
  {
    start: "rgba(20, 69, 106, 0.98)",
    end: "rgba(27, 107, 155, 0.98)",
    glow: "rgba(99, 205, 247, 0.24)",
    border: "rgba(112, 198, 238, 0.66)",
    accent: "#a8efff",
    connector: "rgba(126, 222, 255, 0.9)",
    connectorGlow: "rgba(101, 205, 243, 0.4)",
    chipBorder: "rgba(121, 206, 241, 0.5)",
    chipBg: "rgba(15, 56, 83, 0.8)",
    metaBorder: "rgba(129, 214, 247, 0.56)",
    metaBg: "rgba(17, 62, 91, 0.84)",
    focus: "rgba(173, 240, 255, 0.95)",
    shadow: "rgba(6, 28, 43, 0.38)"
  },
  {
    start: "rgba(73, 40, 12, 0.98)",
    end: "rgba(126, 74, 22, 0.98)",
    glow: "rgba(233, 150, 58, 0.22)",
    border: "rgba(220, 148, 69, 0.62)",
    accent: "#ffcf8d",
    connector: "rgba(243, 173, 95, 0.88)",
    connectorGlow: "rgba(222, 142, 59, 0.38)",
    chipBorder: "rgba(221, 157, 82, 0.48)",
    chipBg: "rgba(68, 39, 14, 0.8)",
    metaBorder: "rgba(227, 167, 96, 0.54)",
    metaBg: "rgba(79, 46, 17, 0.84)",
    focus: "rgba(255, 210, 145, 0.94)",
    shadow: "rgba(30, 18, 9, 0.4)"
  },
  {
    start: "rgba(87, 67, 15, 0.98)",
    end: "rgba(154, 122, 28, 0.98)",
    glow: "rgba(242, 198, 83, 0.22)",
    border: "rgba(225, 190, 88, 0.64)",
    accent: "#ffe39a",
    connector: "rgba(247, 206, 103, 0.88)",
    connectorGlow: "rgba(228, 184, 76, 0.38)",
    chipBorder: "rgba(227, 194, 96, 0.5)",
    chipBg: "rgba(78, 60, 15, 0.82)",
    metaBorder: "rgba(232, 200, 105, 0.56)",
    metaBg: "rgba(90, 69, 17, 0.86)",
    focus: "rgba(255, 231, 163, 0.95)",
    shadow: "rgba(32, 24, 9, 0.38)"
  },
  {
    start: "rgba(21, 68, 37, 0.98)",
    end: "rgba(34, 130, 72, 0.98)",
    glow: "rgba(82, 201, 122, 0.22)",
    border: "rgba(95, 201, 133, 0.62)",
    accent: "#b7f6c6",
    connector: "rgba(112, 219, 149, 0.88)",
    connectorGlow: "rgba(82, 191, 120, 0.36)",
    chipBorder: "rgba(104, 205, 141, 0.48)",
    chipBg: "rgba(18, 63, 34, 0.8)",
    metaBorder: "rgba(112, 214, 148, 0.54)",
    metaBg: "rgba(22, 75, 40, 0.84)",
    focus: "rgba(194, 255, 208, 0.94)",
    shadow: "rgba(10, 27, 15, 0.38)"
  }
];

export const QUICK_ACCESS_GROUP_THEME: MindMapTheme = {
  start: "rgba(38, 29, 9, 0.98)",
  end: "rgba(74, 56, 16, 0.98)",
  glow: "rgba(198, 152, 52, 0.18)",
  border: "rgba(173, 136, 58, 0.7)",
  accent: "#f2d38b",
  connector: "rgba(214, 173, 84, 0.88)",
  connectorGlow: "rgba(185, 145, 60, 0.34)",
  chipBorder: "rgba(171, 138, 67, 0.52)",
  chipBg: "rgba(49, 36, 11, 0.82)",
  metaBorder: "rgba(186, 151, 74, 0.56)",
  metaBg: "rgba(56, 42, 13, 0.86)",
  focus: "rgba(244, 214, 136, 0.94)",
  shadow: "rgba(24, 18, 7, 0.42)"
};

export function getMindMapTheme(level: number): MindMapTheme {
  if (level <= 1) return MIND_MAP_LEVEL_THEMES[0];
  if (level >= 7) return MIND_MAP_LEVEL_THEMES[6];
  return MIND_MAP_LEVEL_THEMES[level - 1];
}

export function buildMindMapThemeStyleFromTheme(theme: MindMapTheme): MindMapThemeStyle {
  return {
    "--ode-mind-start": theme.start,
    "--ode-mind-end": theme.end,
    "--ode-mind-glow": theme.glow,
    "--ode-mind-border": theme.border,
    "--ode-mind-accent": theme.accent,
    "--ode-mind-connector-color": theme.connector,
    "--ode-mind-connector-glow": theme.connectorGlow,
    "--ode-mind-chip-border": theme.chipBorder,
    "--ode-mind-chip-bg": theme.chipBg,
    "--ode-mind-meta-border": theme.metaBorder,
    "--ode-mind-meta-bg": theme.metaBg,
    "--ode-mind-focus": theme.focus,
    "--ode-mind-shadow": theme.shadow
  };
}

export function buildMindMapThemeStyle(level: number): MindMapThemeStyle {
  return buildMindMapThemeStyleFromTheme(getMindMapTheme(level));
}
