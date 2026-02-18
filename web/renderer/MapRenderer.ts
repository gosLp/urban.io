// ============================================
// Leaflet Map Renderer — Real Bengaluru Tiles
// Uses CartoDB Dark Matter tiles as base map.
// Game overlays (districts, roads, transit)
// rendered as Leaflet vector layers on top.
// ============================================

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { District, TransitLine, RoadNetwork, GameState } from "@engine/types.js";
import { TransitType } from "@engine/types.js";
import {
  BENGALURU_GEODATA,
  DISTRICT_CENTERS,
  DISTRICT_BOUNDARIES,
  type Coord,
} from "@engine/data/bengaluru/geodata.js";
import {
  DISTRICT_COLORS,
  TRANSIT_RAIL_COLOR,
  TRANSIT_BUS_COLOR,
} from "./colors.js";
import { roadKey } from "@engine/systems/traffic.js";

export interface RendererState {
  selectedDistrict: string | null;
  hoveredDistrict: string | null;
  time: number;
  camera: { x: number; y: number; zoom: number }; // kept for API compat
}

export interface MapRendererCallbacks {
  onDistrictClick?: (district: District) => void;
  onDistrictDeselect?: () => void;
}

/** Convert [lng, lat] geodata coord to Leaflet [lat, lng] */
function ll(coord: Coord): L.LatLngExpression {
  return [coord[1], coord[0]];
}

function llAll(coords: Coord[]): L.LatLngExpression[] {
  return coords.map(ll);
}

export class MapRenderer {
  private map: L.Map;
  public state: RendererState = {
    selectedDistrict: null,
    hoveredDistrict: null,
    time: 0,
    camera: { x: 0, y: 0, zoom: 1 },
  };

  // Game layers
  private districtLayers = new Map<string, L.Polygon>();
  private districtColors = new Map<string, string>();
  private gameRoadLayers = new Map<string, L.Polyline>();
  private transitLayers: L.Layer[] = [];
  private labelMarkers = new Map<string, L.Marker>();

  // State tracking
  private currentDistricts: District[] = [];
  private callbacks: MapRendererCallbacks;
  private initialized = false;
  private lastUpdateTime = 0;
  private lastTransitHash = "";

  constructor(container: HTMLElement, callbacks: MapRendererCallbacks = {}) {
    this.callbacks = callbacks;

    // Create Leaflet map
    this.map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false, // use SVG renderer for crisp vector overlays
    });

    // CartoDB Dark Matter — free, no API key, dark aesthetic
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(this.map);

    // Fit to Bengaluru bounds
    const [minLng, minLat, maxLng, maxLat] = BENGALURU_GEODATA.bbox;
    this.map.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [20, 20] }
    );

    // Static geographic layers (painted once)
    this._addCityBoundary();
    this._addWaterFeatures();
    this._addGeoRoads();
  }

  // ─── Static layers ────────────────────────────────────────────

  private _addCityBoundary() {
    L.polygon(llAll(BENGALURU_GEODATA.boundary), {
      fillColor: "#141e32",
      fillOpacity: 0.12,
      color: "rgba(100,140,180,0.22)",
      weight: 1.5,
      interactive: false,
    }).addTo(this.map);
  }

  private _addWaterFeatures() {
    for (const lake of BENGALURU_GEODATA.water) {
      L.polygon(llAll(lake.coords), {
        fillColor: "#2196f3",
        fillOpacity: 0.22,
        color: "rgba(33,150,243,0.4)",
        weight: 1,
        interactive: false,
      }).addTo(this.map);
    }
  }

  private _addGeoRoads() {
    for (const road of BENGALURU_GEODATA.roads) {
      L.polyline(llAll(road), {
        color: "rgba(90,110,150,0.45)",
        weight: 1.5,
        interactive: false,
      }).addTo(this.map);
    }
  }

  // ─── Dynamic layer init (called once on first render) ─────────

  private _initDistricts(districts: District[]) {
    for (const d of districts) {
      const boundary = DISTRICT_BOUNDARIES[d.id];
      if (!boundary || boundary.length < 3) continue;

      const color = DISTRICT_COLORS[d.id] ?? "#4fc3f7";
      this.districtColors.set(d.id, color);

      const polygon = L.polygon(llAll(boundary), {
        fillColor: color,
        fillOpacity: 0.2,
        color: color,
        weight: 1,
        opacity: 0.35,
        interactive: true,
      });

      // Click → select district
      polygon.on("click", () => {
        this.state.selectedDistrict = d.id;
        const current = this.currentDistricts.find((x) => x.id === d.id);
        if (current) this.callbacks.onDistrictClick?.(current);
      });

      // Hover highlight
      polygon.on("mouseover", () => {
        this.state.hoveredDistrict = d.id;
        this.map.getContainer().style.cursor = "pointer";
      });
      polygon.on("mouseout", () => {
        if (this.state.hoveredDistrict === d.id) {
          this.state.hoveredDistrict = null;
          this.map.getContainer().style.cursor = "";
        }
      });

      polygon.addTo(this.map);
      this.districtLayers.set(d.id, polygon);

      // Label marker
      const center = DISTRICT_CENTERS[d.id];
      if (center) {
        const marker = L.marker(ll(center), {
          icon: this._buildLabelIcon(d, color),
          interactive: false,
          zIndexOffset: 100,
        });
        marker.addTo(this.map);
        this.labelMarkers.set(d.id, marker);
      }
    }
  }

  private _initGameRoads(districts: District[]) {
    const drawn = new Set<string>();
    for (const d of districts) {
      for (const adjId of d.adjacentDistricts) {
        const key = [d.id, adjId].sort().join("--");
        if (drawn.has(key)) continue;
        drawn.add(key);

        const cA = DISTRICT_CENTERS[d.id];
        const cB = DISTRICT_CENTERS[adjId];
        if (!cA || !cB) continue;

        const line = L.polyline([ll(cA), ll(cB)], {
          color: "#3c5c8c",
          weight: 2,
          opacity: 0.2,
          interactive: false,
        }).addTo(this.map);

        this.gameRoadLayers.set(key, line);
      }
    }
  }

  // ─── Per-frame style updates (throttled to ~10fps) ────────────

  private _updateDistrictStyles(districts: District[]) {
    const t = this.state.time;

    for (const d of districts) {
      const polygon = this.districtLayers.get(d.id);
      if (!polygon) continue;

      const color = this.districtColors.get(d.id) ?? "#4fc3f7";
      const isSel = this.state.selectedDistrict === d.id;
      const isHov = this.state.hoveredDistrict === d.id;

      // Breathing pulse
      const breathe = Math.sin(t * 0.0015 + d.id.charCodeAt(4) * 0.3) * 0.04;
      const baseAlpha = 0.22 + breathe;

      const fillOpacity = isSel ? 0.5 : isHov ? 0.4 : baseAlpha;
      const opacity = isSel ? 0.9 : isHov ? 0.7 : 0.35;
      const weight = isSel ? 2.5 : isHov ? 2 : 1;

      // Congestion red-tint blended into fill color
      const cong = d.metrics.trafficCongestion;
      const fillColor =
        cong > 0.4 ? blendHex(color, "#ef5350", (cong - 0.4) * 0.55) : color;

      polygon.setStyle({
        fillColor,
        fillOpacity,
        color: isSel ? "#ffffff" : color,
        weight,
        opacity,
        dashArray: isSel ? "6, 4" : undefined,
      });

      if (isSel || isHov) polygon.bringToFront();
    }
  }

  private _updateGameRoadStyles(districts: District[], roadNetwork: RoadNetwork) {
    const drawn = new Set<string>();
    for (const d of districts) {
      for (const adjId of d.adjacentDistricts) {
        const key = [d.id, adjId].sort().join("--");
        if (drawn.has(key)) continue;
        drawn.add(key);

        const line = this.gameRoadLayers.get(key);
        if (!line) continue;

        const rk = roadKey(d.id, adjId);
        const cap = roadNetwork.capacities.get(rk) ?? 1;
        const load = roadNetwork.loads.get(rk) ?? 0;
        const cong = Math.min(load / cap, 1);

        const r = Math.round(60 + cong * 179);
        const g = Math.round(100 - cong * 60);
        const b = Math.round(140 - cong * 60);

        line.setStyle({
          color: `rgb(${r},${g},${b})`,
          weight: 2 + cong * 4,
          opacity: 0.15 + cong * 0.45,
        });
      }
    }
  }

  private _updateTransitLines(districts: District[], transitLines: TransitLine[]) {
    // Remove old transit layers
    for (const layer of this.transitLayers) {
      layer.remove();
    }
    this.transitLayers = [];

    for (const tLine of transitLines) {
      const isRail = tLine.type === TransitType.Rail;
      const underCon = tLine.constructionTurnsRemaining > 0;
      const color = isRail ? TRANSIT_RAIL_COLOR : TRANSIT_BUS_COLOR;

      const points = tLine.districts
        .map((id) => DISTRICT_CENTERS[id])
        .filter((c): c is Coord => !!c)
        .map((c) => ll(c));

      if (points.length < 2) continue;

      const pline = L.polyline(points, {
        color,
        weight: isRail ? 3.5 : 2.5,
        opacity: underCon ? 0.3 : 0.85,
        dashArray: underCon ? "8,6" : isRail ? undefined : "5,5",
        interactive: false,
      }).addTo(this.map);
      this.transitLayers.push(pline);

      // Station dots
      if (!underCon) {
        for (const distId of tLine.districts) {
          const center = DISTRICT_CENTERS[distId];
          if (!center) continue;

          const outer = L.circleMarker(ll(center), {
            radius: isRail ? 5 : 4,
            fillColor: color,
            fillOpacity: 1,
            color: "#0a0e1a",
            weight: 1.5,
            interactive: false,
          }).addTo(this.map);
          this.transitLayers.push(outer);
        }
      }
    }
  }

  private _updateLabels(districts: District[]) {
    for (const d of districts) {
      const marker = this.labelMarkers.get(d.id);
      if (!marker) continue;
      const color = this.districtColors.get(d.id) ?? "#4fc3f7";
      marker.setIcon(this._buildLabelIcon(d, color));
    }
  }

  private _buildSkylineSVG(d: District, color: string): string {
    const ratio = d.maxDensity > 0 ? Math.min(1, d.currentDensity / d.maxDensity) : 0;
    // 5 buildings with staggered max heights (in a 62×21 viewBox, ground at y=20)
    const maxHeights = [10, 16, 20, 14, 8];
    const xPositions = [1,  13, 25, 39, 51];
    const widths     = [10, 10, 12, 10, 10];
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const fill   = `rgba(${r},${g},${b},0.75)`;
    const shadow = `rgba(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)},0.85)`;
    const GROUND = 20;
    const rects = maxHeights.map((maxH, i) => {
      const h = Math.max(2, Math.round(maxH * ratio));
      const y = GROUND - h;
      const x = xPositions[i];
      const w = widths[i];
      return (
        `<rect x="${x}" y="${y}" width="${w - 2}" height="${h}" fill="${fill}"/>` +
        `<rect x="${x + w - 2}" y="${y}" width="2" height="${h}" fill="${shadow}"/>`
      );
    });
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="62" height="21" viewBox="0 0 62 21"` +
      ` style="display:block;margin:0 auto 2px">` +
      rects.join("") +
      `<line x1="0" y1="20" x2="62" y2="20" stroke="${fill}" stroke-width="1" opacity="0.5"/>` +
      `</svg>`
    );
  }

  private _buildLabelIcon(d: District, color: string): L.DivIcon {
    const shortName = d.name.split("(")[0].split("/")[0].trim();
    const popStr =
      d.population >= 1_000_000
        ? `${(d.population / 1_000_000).toFixed(1)}M`
        : `${(d.population / 1000).toFixed(0)}k`;
    const hap = d.metrics.happiness;
    const hapColor = hap > 0.55 ? "#66bb6a" : hap > 0.35 ? "#ffca28" : "#ef5350";
    const isSel = this.state.selectedDistrict === d.id;
    const metroIcon = d.hasTransitStation
      ? `<span class="dlabel-metro" style="color:${TRANSIT_RAIL_COLOR}">M</span>`
      : "";

    const skyline = this._buildSkylineSVG(d, color);

    return L.divIcon({
      className: "district-label",
      html: `<div class="district-label-inner${isSel ? " selected" : ""}" style="--dcolor:${color}">
        ${metroIcon}
        ${skyline}
        <span class="dlabel-name">${shortName}</span>
        <span class="dlabel-pop" style="color:${hapColor}">${popStr}</span>
      </div>`,
      iconSize: [120, 56],
      iconAnchor: [60, 28],
    });
  }

  // ─── Public API ───────────────────────────────────────────────

  /** Main render — call every animation frame */
  render(gameState: GameState, dt: number) {
    this.state.time += dt;
    this.currentDistricts = gameState.city.districts as District[];

    // One-time initialization
    if (!this.initialized && this.currentDistricts.length > 0) {
      this._initDistricts(this.currentDistricts);
      this._initGameRoads(this.currentDistricts);
      this.initialized = true;
    }

    // Throttle style updates to ~10fps (every 100ms)
    const now = this.state.time;
    if (now - this.lastUpdateTime < 100) return;
    this.lastUpdateTime = now;

    const { districts, roadNetwork, transitLines } = gameState.city;

    this._updateDistrictStyles(districts as District[]);
    this._updateGameRoadStyles(districts as District[], roadNetwork);

    const hash = transitLines
      .map((l) => `${l.id}:${l.constructionTurnsRemaining}`)
      .join("|");
    if (hash !== this.lastTransitHash) {
      this._updateTransitLines(districts as District[], transitLines);
      this.lastTransitHash = hash;
    }

    this._updateLabels(districts as District[]);
  }

  /** No-op — kept for main.ts compatibility. Leaflet handles events. */
  hitTest(_x: number, _y: number, _districts: District[]): District | null {
    return null;
  }
}

// ─── Utilities ────────────────────────────────────────────────

/** Linear interpolation between two hex colors */
function blendHex(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
