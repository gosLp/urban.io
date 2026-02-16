// ============================================
// Canvas 2D Map Renderer — Real Bengaluru Geography
// Draws: city boundary, district zones, major roads,
//        lakes, transit lines, congestion overlays
// ============================================

import type { District, TransitLine, RoadNetwork, GameState } from "@engine/types.js";
import { TransitType } from "@engine/types.js";
import {
  BENGALURU_GEODATA,
  DISTRICT_CENTERS,
  DISTRICT_BOUNDARIES,
  projectToScreen,
  type Coord,
  type BengaluruGeoData,
} from "@engine/data/bengaluru/geodata.js";
import {
  DISTRICT_COLORS,
  glowColor,
  darken,
  lighten,
  congestionColor,
  TRANSIT_RAIL_COLOR,
  TRANSIT_BUS_COLOR,
} from "./colors.js";
import { roadKey } from "@engine/systems/traffic.js";

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
  private padding = 40;
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

  /** Project geo coord to screen pixel */
  private project(coord: Coord): [number, number] {
    const [sx, sy] = projectToScreen(coord, this.width, this.height, this.padding);
    const cam = this.state.camera;
    return [sx * cam.zoom + cam.x, sy * cam.zoom + cam.y];
  }

  /** Hit-test: which district is under screen coords? */
  hitTest(sx: number, sy: number, districts: District[]): District | null {
    // Check point-in-polygon for each district boundary
    for (const d of districts) {
      const boundary = DISTRICT_BOUNDARIES[d.id];
      if (!boundary) continue;

      const screenPoly = boundary.map((c) => this.project(c));
      if (pointInPolygon(sx, sy, screenPoly)) {
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

    // Clear with dark background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, w, h);

    const { districts, roadNetwork, transitLines } = gameState.city;

    // 1. City boundary outline (subtle)
    this.drawBoundary();

    // 2. District fills
    this.drawDistrictFills(districts);

    // 3. Major roads from geodata
    this.drawGeoRoads();

    // 4. Game road connections (congestion overlay)
    this.drawGameRoads(districts, roadNetwork);

    // 5. Water features
    this.drawWater();

    // 6. Transit lines
    this.drawTransitLines(districts, transitLines);

    // 7. District labels and indicators
    this.drawLabels(districts);
  }

  private drawBoundary() {
    const ctx = this.ctx;
    const boundary = BENGALURU_GEODATA.boundary;
    if (boundary.length < 3) return;

    ctx.beginPath();
    const [sx, sy] = this.project(boundary[0]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < boundary.length; i++) {
      const [px, py] = this.project(boundary[i]);
      ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Subtle fill to show city area
    ctx.fillStyle = "rgba(20, 30, 50, 0.5)";
    ctx.fill();

    // Boundary stroke
    ctx.strokeStyle = "rgba(100, 140, 180, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawDistrictFills(districts: District[]) {
    const ctx = this.ctx;
    const t = this.state.time;

    for (const d of districts) {
      const boundary = DISTRICT_BOUNDARIES[d.id];
      if (!boundary || boundary.length < 3) continue;

      const color = DISTRICT_COLORS[d.id] || "#4fc3f7";
      const isSelected = this.state.selectedDistrict === d.id;
      const isHovered = this.state.hoveredDistrict === d.id;

      // Draw district polygon
      const screenPoints = boundary.map((c) => this.project(c));
      ctx.beginPath();
      ctx.moveTo(screenPoints[0][0], screenPoints[0][1]);
      for (let i = 1; i < screenPoints.length; i++) {
        ctx.lineTo(screenPoints[i][0], screenPoints[i][1]);
      }
      ctx.closePath();

      // Fill with district color (semi-transparent)
      const breathe = Math.sin(t * 0.0015 + d.id.charCodeAt(4) * 0.3) * 0.04;
      const baseAlpha = 0.2 + breathe;
      const alpha = isSelected ? 0.45 : isHovered ? 0.35 : baseAlpha;
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.fill();

      // Border
      ctx.strokeStyle = hexToRgba(color, isSelected ? 0.8 : isHovered ? 0.6 : 0.3);
      ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1;
      ctx.stroke();

      // Congestion overlay (red tint for high congestion)
      const cong = d.metrics.trafficCongestion;
      if (cong > 0.4) {
        const congAlpha = (cong - 0.4) * 0.25;
        ctx.fillStyle = `rgba(239, 83, 80, ${congAlpha})`;
        ctx.fill();
      }

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.save();
        ctx.shadowColor = glowColor(color, 0.5);
        ctx.shadowBlur = 15;
        ctx.strokeStyle = hexToRgba(color, 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Selection dashed outline
      if (isSelected) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawGeoRoads() {
    const ctx = this.ctx;

    for (const road of BENGALURU_GEODATA.roads) {
      if (road.length < 2) continue;

      ctx.beginPath();
      const [sx, sy] = this.project(road[0]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < road.length; i++) {
        const [px, py] = this.project(road[i]);
        ctx.lineTo(px, py);
      }

      ctx.strokeStyle = "rgba(80, 100, 130, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawGameRoads(districts: District[], roadNetwork: RoadNetwork) {
    const ctx = this.ctx;

    for (const d of districts) {
      const centerA = DISTRICT_CENTERS[d.id];
      if (!centerA) continue;

      for (const adjId of d.adjacentDistricts) {
        if (d.id > adjId) continue; // draw each road once
        const centerB = DISTRICT_CENTERS[adjId];
        if (!centerB) continue;

        const [x1, y1] = this.project(centerA);
        const [x2, y2] = this.project(centerB);

        const key = roadKey(d.id, adjId);
        const capacity = roadNetwork.capacities.get(key) ?? 1;
        const load = roadNetwork.loads.get(key) ?? 0;
        const congestion = Math.min(load / capacity, 1);

        // Color by congestion intensity
        const r = Math.round(60 + congestion * 179);
        const g = Math.round(100 - congestion * 60);
        const b = Math.round(140 - congestion * 60);
        const a = 0.15 + congestion * 0.45;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.lineWidth = 2 + congestion * 4;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }

  private drawWater() {
    const ctx = this.ctx;

    for (const lake of BENGALURU_GEODATA.water) {
      if (lake.coords.length < 3) continue;

      const screenPoints = lake.coords.map((c) => this.project(c));
      ctx.beginPath();
      ctx.moveTo(screenPoints[0][0], screenPoints[0][1]);
      for (let i = 1; i < screenPoints.length; i++) {
        ctx.lineTo(screenPoints[i][0], screenPoints[i][1]);
      }
      ctx.closePath();

      // Water fill
      ctx.fillStyle = "rgba(33, 150, 243, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(33, 150, 243, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawTransitLines(districts: District[], transitLines: TransitLine[]) {
    const ctx = this.ctx;

    for (const line of transitLines) {
      const isRail = line.type === TransitType.Rail;
      const underConstruction = line.constructionTurnsRemaining > 0;

      ctx.strokeStyle = isRail ? TRANSIT_RAIL_COLOR : TRANSIT_BUS_COLOR;
      ctx.lineWidth = isRail ? 3 : 2;
      ctx.globalAlpha = underConstruction ? 0.3 : 0.8;

      if (underConstruction) {
        ctx.setLineDash([8, 6]);
      } else {
        ctx.setLineDash(isRail ? [] : [4, 4]);
      }

      ctx.beginPath();
      let started = false;

      for (const districtId of line.districts) {
        const center = DISTRICT_CENTERS[districtId];
        if (!center) continue;
        const [x, y] = this.project(center);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      // Station dots
      if (!underConstruction) {
        for (const districtId of line.districts) {
          const center = DISTRICT_CENTERS[districtId];
          if (!center) continue;
          const [x, y] = this.project(center);

          ctx.fillStyle = isRail ? TRANSIT_RAIL_COLOR : TRANSIT_BUS_COLOR;
          ctx.beginPath();
          ctx.arc(x, y, isRail ? 4 : 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#0a0e1a";
          ctx.beginPath();
          ctx.arc(x, y, isRail ? 2 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawLabels(districts: District[]) {
    const ctx = this.ctx;

    for (const d of districts) {
      const center = DISTRICT_CENTERS[d.id];
      if (!center) continue;
      const [cx, cy] = this.project(center);

      const isSelected = this.state.selectedDistrict === d.id;
      const isHovered = this.state.hoveredDistrict === d.id;

      // Background pill for readability
      const shortName = d.name.split("(")[0].split("/")[0].trim();
      const fontSize = Math.max(10, Math.min(14, this.width * 0.012));

      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      const textWidth = ctx.measureText(shortName).width;

      if (isSelected || isHovered) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        const pillW = textWidth + 12;
        const pillH = fontSize + 20;
        roundRect(ctx, cx - pillW / 2, cy - pillH / 2 - 2, pillW, pillH, 6);
        ctx.fill();
      }

      // District name
      ctx.fillStyle = isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(shortName, cx, cy - 4);

      // Population below
      ctx.font = `500 ${Math.max(8, fontSize * 0.75)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      const popStr = d.population >= 1000000
        ? `${(d.population / 1000000).toFixed(1)}M`
        : `${(d.population / 1000).toFixed(0)}k`;
      ctx.fillText(popStr, cx, cy + fontSize * 0.6);

      // Happiness indicator dot
      const hap = d.metrics.happiness;
      const hapColor = hap > 0.55 ? "#66bb6a" : hap > 0.35 ? "#ffca28" : "#ef5350";
      ctx.fillStyle = hapColor;
      ctx.beginPath();
      ctx.arc(cx + textWidth / 2 + 8, cy - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Transit station indicator
      if (d.hasTransitStation) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = `bold ${Math.max(8, fontSize * 0.7)}px sans-serif`;
        ctx.fillText("M", cx - textWidth / 2 - 10, cy - 4);
      }
    }
  }
}

// --- Utilities ---

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
