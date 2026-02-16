// ============================================================
// Transit Model
// Bus routes, rail lines, capacity, ridership, property effects
// Key fix: ridership converges gradually, sane operating costs
// ============================================================

import {
  District,
  DistrictId,
  TransitLine,
  TransitType,
  TransitLineId,
  CityMetrics,
  Budget,
  GameEvent,
} from "../types.js";

const RAIL_PROPERTY_BOOST = 0.15;
const BUS_PROPERTY_BOOST = 0.03;
const RAIL_DENSITY_THRESHOLD = 8000;
/** How fast ridership converges per tick (higher = faster) */
const RIDERSHIP_DAMPING = 0.1;
const MAX_RIDERSHIP_RATIO = 1.2;

export function calculateRidership(line: TransitLine, districts: District[]): number {
  if (line.constructionTurnsRemaining > 0) return 0;

  const districtMap = new Map(districts.map((d) => [d.id, d]));
  let totalDensity = 0;
  let connectedDistricts = 0;

  for (const districtId of line.districts) {
    const d = districtMap.get(districtId);
    if (d) {
      totalDensity += d.currentDensity;
      connectedDistricts++;
    }
  }
  if (connectedDistricts === 0) return 0;

  const avgDensity = totalDensity / connectedDistricts;
  const densityFactor =
    line.type === TransitType.Rail
      ? Math.max(0, avgDensity / RAIL_DENSITY_THRESHOLD)
      : Math.max(0.3, avgDensity / (RAIL_DENSITY_THRESHOLD / 2));

  const targetRidership = Math.min(
    line.capacity * densityFactor * 0.6,
    line.capacity * MAX_RIDERSHIP_RATIO
  );

  // DAMPED convergence — ridership moves toward target, not snaps
  const newRidership =
    line.ridership * (1 - RIDERSHIP_DAMPING) + targetRidership * RIDERSHIP_DAMPING;

  return Math.max(0, Math.round(newRidership));
}

export function isTransitCostEffective(
  line: TransitLine,
  farePerRider: number = 2.5
): { costEffective: boolean; revenueRatio: number } {
  const revenue = line.ridership * farePerRider;
  const ratio = line.operatingCost > 0 ? revenue / line.operatingCost : 0;
  return { costEffective: ratio >= 0.5, revenueRatio: ratio };
}

export function applyTransitPropertyEffects(
  districts: District[],
  transitLines: TransitLine[]
): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));
  for (const line of transitLines) {
    if (line.constructionTurnsRemaining > 0) continue;
    const boost = line.type === TransitType.Rail ? RAIL_PROPERTY_BOOST : BUS_PROPERTY_BOOST;
    for (const districtId of line.districts) {
      const d = districtMap.get(districtId);
      if (d) {
        d.metrics.propertyValue += boost * line.propertyValueBoost;
        d.hasTransitStation = true;
      }
    }
  }
}

export function progressConstruction(transitLines: TransitLine[]): GameEvent[] {
  const events: GameEvent[] = [];
  for (const line of transitLines) {
    if (line.constructionTurnsRemaining > 0) {
      line.constructionTurnsRemaining--;
      if (line.constructionTurnsRemaining === 0) {
        events.push({
          type: "milestone",
          message: `${line.name} (${line.type}) is now operational!`,
          severity: "info",
        });
      }
    }
  }
  return events;
}

export function createTransitLine(
  id: TransitLineId,
  name: string,
  type: TransitType,
  districtIds: DistrictId[],
  capacity: number
): TransitLine {
  const isRail = type === TransitType.Rail;
  return {
    id,
    name,
    type,
    districts: districtIds,
    capacity,
    ridership: 0,
    // FIXED: much lower operating costs (per-turn, not per-hour)
    operatingCost: isRail ? capacity * 0.02 : capacity * 0.008,
    constructionTurnsRemaining: isRail
      ? 4 + districtIds.length
      : 1 + Math.floor(districtIds.length / 3),
    propertyValueBoost: isRail ? 1.0 : 0.3,
  };
}

/**
 * Run the transit simulation tick.
 * Returns transit operating cost for budget system.
 */
export function tickTransit(
  districts: District[],
  transitLines: TransitLine[],
  metrics: CityMetrics,
  _budget: Budget
): { events: GameEvent[]; transitCost: number } {
  const events: GameEvent[] = [];

  // 1. Progress construction
  const constructionEvents = progressConstruction(transitLines);
  events.push(...constructionEvents);

  // 2. Apply property effects for newly completed lines only
  if (constructionEvents.length > 0) {
    applyTransitPropertyEffects(districts, transitLines);
  }

  // 3. Update ridership (damped)
  for (const line of transitLines) {
    line.ridership = calculateRidership(line, districts);
  }

  // 4. City-wide transit ridership
  metrics.transitRidership = transitLines.reduce((sum, l) => sum + l.ridership, 0);

  // 5. Calculate transit operating costs (returned, NOT added to budget here)
  const transitCost = transitLines
    .filter((l) => l.constructionTurnsRemaining === 0)
    .reduce((sum, l) => sum + l.operatingCost, 0);

  // 6. Update district transit access
  for (const d of districts) {
    d.transitLines = transitLines
      .filter((l) => l.districts.includes(d.id) && l.constructionTurnsRemaining === 0)
      .map((l) => l.id);
    d.hasTransitStation = d.transitLines.length > 0;
  }

  return { events, transitCost };
}
