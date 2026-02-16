// ============================================
// Canvas 2D Map Renderer — io-style bubbly map
// ============================================

import type { District, TransitLine, RoadNetwork, GameState } from "@engine/types.js";
import { TransitType } from "@engine/types.js";
import {
  DISTRICT_COLORS,
  glowColor,
  darken,
  lighten,
  congestionColor,
  ROAD_COLOR,
  TRANSIT_RAIL_COLOR,
  TRANSIT_BUS_COLOR,
  GRID_COLOR,
} from "./colors.js";
import { roadKey } from "@engine/systems/traffic.js";

// --- Layout: Bengaluru districts positioned on a ~10x10 abstract grid ---
// These are hand-tuned to roughly match Bengaluru's real geography
const BENGALURU_LAYOUT: Record<string, { x: number; y: number; r: number }> = {
  blr_malleshwaram:  { x: 3.5, y: 2.5, r: 1.1 },
  blr_rajajinagar:   { x: 2.0, y: 4.2, r: 1.15 },
  blr_majestic:      { x: 4.5, y: 4.0, r: 1.35 }, // city center, biggest
  blr_indiranagar:   { x: 6.5, y: 3.2, r: 1.05 },
  blr_whitefield:    { x: 8.8, y: 3.8, r: 1.3 },
  blr_jayanagar:     { x: 4.2, y: 6.0, r: 1.15 },
  blr_bannerghatta:  { x: 3.5, y: 8.0, r: 1.1 },
  blr_ecity:         { x: 5.8, y: 8.5, r: 1.2 },
  blr_sarjapur:      { x: 7.8, y: 6.8, r: 1.2 },
};

export interface RendererState {
  selectedDistrict: string | null;
  hoveredDistrict: string | null;
  time: number;
  camera: { x: number; y: number; zoom: number };
}

export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  public state: RendererState = {
    selectedDistrict: null,
    hoveredDistrict: null,
    time: 0,
    camera: { x: 0, y: 0, zoom: 1 },
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** Convert grid coords to screen coords */
  private toScreen(gx: number, gy: number): [number, number] {
    const cam = this.state.camera;
    // Map 0-10 grid to screen, centered
    const scale = Math.min(this.width, this.height) * 0.08 * cam.zoom;
    const ox = this.width / 2 - 5.5 * scale + cam.x;
    const oy = this.height / 2 - 5.5 * scale + cam.y;
    return [ox + gx * scale, oy + gy * scale];
  }

  /** Get grid unit size in screen pixels */
  private gridScale(): number {
    return Math.min(this.width, this.height) * 0.08 * this.state.camera.zoom;
  }

  /** Hit-test: which district is under screen coords? */
  hitTest(sx: number, sy: number, districts: District[]): District | null {
    const scale = this.gridScale();
    for (const d of districts) {
      const layout = BENGALURU_LAYOUT[d.id];
      if (!layout) continue;
      const [cx, cy] = this.toScreen(layout.x, layout.y);
      const r = layout.r * scale;
      const dx = sx - cx;
      const dy = sy - cy;
      if (dx * dx + dy * dy <= r * r) {
        return d;
      }
    }
    return null;
  }

  /** Main render frame */
  render(gameState: GameState, dt: number) {
    this.state.time += dt;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, w, h);

    // Background grid
    this.drawGrid();

    const { districts, roadNetwork, transitLines } = gameState.city;

    // Draw road connections
    this.drawRoads(districts, roadNetwork);

    // Draw transit lines
    this.drawTransitLines(districts, transitLines);

    // Draw districts (bubbles)
    this.drawDistricts(districts);

    // Draw labels
    this.drawLabels(districts);
  }

  private drawGrid() {
    const ctx = this.ctx;
    const scale = this.gridScale();
    const cam = this.state.camera;
    const ox = this.width / 2 - 5.5 * scale + cam.x;
    const oy = this.height / 2 - 5.5 * scale + cam.y;

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= 11; i++) {
      const x = ox + i * scale;
      ctx.beginPath();
      ctx.moveTo(x, oy);
      ctx.lineTo(x, oy + 11 * scale);
      ctx.stroke();

      const y = oy + i * scale;
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(ox + 11 * scale, y);
      ctx.stroke();
    }
  }

  private drawRoads(districts: District[], roadNetwork: RoadNetwork) {
    const ctx = this.ctx;
    const scale = this.gridScale();

    for (const d of districts) {
      const layoutA = BENGALURU_LAYOUT[d.id];
      if (!layoutA) continue;

      for (const adjId of d.adjacentDistricts) {
        const layoutB = BENGALURU_LAYOUT[adjId];
        if (!layoutB) continue;

        // Only draw each road once (alphabetical)
        if (d.id > adjId) continue;

        const [x1, y1] = this.toScreen(layoutA.x, layoutA.y);
        const [x2, y2] = this.toScreen(layoutB.x, layoutB.y);

        // Congestion color
        const key = roadKey(d.id, adjId);
        const capacity = roadNetwork.capacities.get(key) ?? 1;
        const load = roadNetwork.loads.get(key) ?? 0;
        const congestion = Math.min(load / capacity, 1);

        const r = Math.round(60 + congestion * 179); // 60 → 239
        const g = Math.round(80 - congestion * 40);   // 80 → 40
        const b = Math.round(120 - congestion * 40);  // 120 → 80
        const a = 0.3 + congestion * 0.35;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.lineWidth = 2 + congestion * 3;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }

  private drawTransitLines(districts: District[], transitLines: TransitLine[]) {
    const ctx = this.ctx;
    const scale = this.gridScale();

    for (const line of transitLines) {
      const isRail = line.type === TransitType.Rail;
      const underConstruction = line.constructionTurnsRemaining > 0;

      ctx.strokeStyle = isRail ? TRANSIT_RAIL_COLOR : TRANSIT_BUS_COLOR;
      ctx.lineWidth = isRail ? 3.5 : 2;
      ctx.globalAlpha = underConstruction ? 0.3 : 0.7;

      if (underConstruction) {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash(isRail ? [] : [4, 4]);
      }

      ctx.beginPath();
      let started = false;

      for (const districtId of line.districts) {
        const layout = BENGALURU_LAYOUT[districtId];
        if (!layout) continue;
        const [x, y] = this.toScreen(layout.x, layout.y);

        // Offset transit lines slightly to not overlap roads
        const offset = isRail ? -4 : 4;
        if (!started) {
          ctx.moveTo(x + offset, y + offset);
          started = true;
        } else {
          ctx.lineTo(x + offset, y + offset);
        }
      }

      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  }

  private drawDistricts(districts: District[]) {
    const ctx = this.ctx;
    const scale = this.gridScale();
    const t = this.state.time;

    for (const d of districts) {
      const layout = BENGALURU_LAYOUT[d.id];
      if (!layout) continue;

      const [cx, cy] = this.toScreen(layout.x, layout.y);
      const baseR = layout.r * scale;
      const color = DISTRICT_COLORS[d.id] || "#4fc3f7";

      const isSelected = this.state.selectedDistrict === d.id;
      const isHovered = this.state.hoveredDistrict === d.id;

      // Breathing animation
      const breathe = Math.sin(t * 0.002 + layout.x * 0.5) * 0.03;
      const pulseExtra = isSelected ? Math.sin(t * 0.004) * 0.05 : 0;
      const hoverExtra = isHovered ? 0.08 : 0;
      const r = baseR * (1 + breathe + pulseExtra + hoverExtra);

      // Outer glow
      if (isSelected || isHovered) {
        const glowR = r * 1.5;
        const grd = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowR);
        grd.addColorStop(0, glowColor(color, 0.25));
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main bubble gradient
      const grd = ctx.createRadialGradient(
        cx - r * 0.2, cy - r * 0.25, r * 0.1,
        cx, cy, r
      );
      grd.addColorStop(0, lighten(color, 0.35));
      grd.addColorStop(0.6, color);
      grd.addColorStop(1, darken(color, 0.25));

      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Glossy highlight (top-left crescent)
      ctx.save();
      ctx.globalAlpha = 0.25;
      const hlGrd = ctx.createRadialGradient(
        cx - r * 0.25, cy - r * 0.3, r * 0.05,
        cx - r * 0.15, cy - r * 0.15, r * 0.6
      );
      hlGrd.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      hlGrd.addColorStop(1, "transparent");
      ctx.fillStyle = hlGrd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Congestion ring (outer ring colored by traffic)
      const cong = d.metrics.trafficCongestion;
      if (cong > 0.3) {
        ctx.strokeStyle = congestionColor(cong);
        ctx.lineWidth = 2 + cong * 2;
        ctx.globalAlpha = 0.4 + cong * 0.3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2 * cong);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Transit station indicator (small inner dot)
      if (d.hasTransitStation) {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(cx + r * 0.35, cy - r * 0.35, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawLabels(districts: District[]) {
    const ctx = this.ctx;
    const scale = this.gridScale();

    for (const d of districts) {
      const layout = BENGALURU_LAYOUT[d.id];
      if (!layout) continue;

      const [cx, cy] = this.toScreen(layout.x, layout.y);
      const r = layout.r * scale;

      // District name
      ctx.font = `600 ${Math.max(10, scale * 0.14)}px Inter, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Short name
      const shortName = d.name.split("(")[0].split("/")[0].trim();
      ctx.fillText(shortName, cx, cy - 2);

      // Population below
      ctx.font = `500 ${Math.max(8, scale * 0.1)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      const popStr = d.population >= 1000000
        ? `${(d.population / 1000000).toFixed(1)}M`
        : `${(d.population / 1000).toFixed(0)}k`;
      ctx.fillText(popStr, cx, cy + scale * 0.13);

      // Happiness mini-bar below bubble
      const barW = r * 0.8;
      const barH = 3;
      const barX = cx - barW / 2;
      const barY = cy + r + 8;

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(barX, barY, barW, barH);

      const hap = d.metrics.happiness;
      const hapColor = hap > 0.55 ? "#66bb6a" : hap > 0.35 ? "#ffca28" : "#ef5350";
      ctx.fillStyle = hapColor;
      ctx.fillRect(barX, barY, barW * hap, barH);
    }
  }
}
