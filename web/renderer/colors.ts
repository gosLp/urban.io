// ============================================
// io-style color palette & utility functions
// ============================================

/** District base colors — bubbly, saturated, distinctive */
export const DISTRICT_COLORS: Record<string, string> = {
  blr_majestic:      "#ff6b9d", // pink — city center
  blr_whitefield:    "#4ecdc4", // teal — IT east
  blr_ecity:         "#45b7d1", // sky blue — IT south
  blr_indiranagar:   "#f7dc6f", // golden — trendy
  blr_jayanagar:     "#82e0aa", // mint — residential
  blr_malleshwaram:  "#bb8fce", // lavender — heritage
  blr_rajajinagar:   "#f0b27a", // peach — west
  blr_sarjapur:      "#76d7c4", // aqua — growing southeast
  blr_bannerghatta:  "#a3e4d7", // soft green — nature corridor
};

/** Glow color (same hue, more transparent) */
export function glowColor(hex: string, alpha: number = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex color */
export function darken(hex: string, amount: number = 0.3): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Lighten a hex color */
export function lighten(hex: string, amount: number = 0.3): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Get color for a 0-1 metric: red (bad) → yellow → green (good) */
export function metricColor(value: number): string {
  if (value < 0.35) return "#ef5350";
  if (value < 0.55) return "#ffca28";
  return "#66bb6a";
}

/** Get color for congestion: green (low) → red (high) */
export function congestionColor(value: number): string {
  if (value < 0.3) return "#66bb6a";
  if (value < 0.6) return "#ffca28";
  return "#ef5350";
}

/** Road/connection line color */
export const ROAD_COLOR = "rgba(60, 80, 120, 0.4)";
export const ROAD_COLOR_CONGESTED = "rgba(239, 83, 80, 0.5)";

/** Transit line colors */
export const TRANSIT_RAIL_COLOR = "#4fc3f7";
export const TRANSIT_BUS_COLOR = "#a5d6a7";

/** Background grid color */
export const GRID_COLOR = "rgba(40, 55, 90, 0.15)";
export const GRID_COLOR_ACCENT = "rgba(40, 55, 90, 0.25)";
