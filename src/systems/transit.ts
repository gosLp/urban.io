// ============================================================
// Transit Model
// Bus routes, rail lines, capacity, ridership, property effects
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

/** Rail property value boost per station */
const RAIL_PROPERTY_BOOST = 0.15;
/** Bus property value boost per stop */
const BUS_PROPERTY_BOOST = 0.03;
/** Minimum density for rail to be cost-effective */
const RAIL_DENSITY_THRESHOLD = 8000;
/** Ridership growth rate per turn */
const RIDERSHIP_GROWTH_RATE = 0.05;
/** Maximum ridership as fraction of capacity */
const MAX_RIDERSHIP_RATIO = 1.2; // can overcrowd

/**
 * Calculate ridership for a transit line based on density of connected districts.
 */
export function calculateRidership(
  line: TransitLine,
  districts: District[]
): number {
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

  // Ridership scales with density
  // Rail needs high density to justify, bus works at lower density
  const densityFactor =
    line.type === TransitType.Rail
      ? Math.max(0, avgDensity / RAIL_DENSITY_THRESHOLD)
      : Math.max(0.2, avgDensity / (RAIL_DENSITY_THRESHOLD / 2));

  const baseRidership = line.capacity * densityFactor * 0.6;

  // Gradual growth toward equilibrium
  const targetRidership = Math.min(
    baseRidership,
    line.capacity * MAX_RIDERSHIP_RATIO
  );
  const newRidership =
    line.ridership + (targetRidership - line.ridership) * RIDERSHIP_GROWTH_RATE;

  return Math.max(0, Math.round(newRidership));
}

/**
 * Check if a transit line is cost-effective.
 * Revenue = ridership * fare. Compare to operating cost.
 */
export function isTransitCostEffective(
  line: TransitLine,
  farePerRider: number = 2.5
): { costEffective: boolean; revenueRatio: number } {
  const revenue = line.ridership * farePerRider;
  const ratio = line.operatingCost > 0 ? revenue / line.operatingCost : 0;
  return { costEffective: ratio >= 0.5, revenueRatio: ratio };
}

/**
 * Apply property value effects from transit lines to districts.
 */
export function applyTransitPropertyEffects(
  districts: District[],
  transitLines: TransitLine[]
): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const line of transitLines) {
    if (line.constructionTurnsRemaining > 0) continue;

    const boost =
      line.type === TransitType.Rail ? RAIL_PROPERTY_BOOST : BUS_PROPERTY_BOOST;

    for (const districtId of line.districts) {
      const d = districtMap.get(districtId);
      if (d) {
        // Additive boost, not multiplicative (prevents runaway)
        d.metrics.propertyValue += boost * line.propertyValueBoost;
        d.hasTransitStation = true;
      }
    }
  }
}

/**
 * Progress construction on transit lines under construction.
 */
export function progressConstruction(
  transitLines: TransitLine[]
): GameEvent[] {
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

        // Mark districts as having transit
        // (done in applyTransitPropertyEffects)
      }
    }
  }

  return events;
}

/**
 * Create a new transit line proposal.
 */
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
    operatingCost: isRail ? capacity * 0.5 : capacity * 0.15,
    constructionTurnsRemaining: isRail
      ? 4 + districtIds.length
      : 1 + Math.floor(districtIds.length / 3),
    propertyValueBoost: isRail ? 1.0 : 0.3,
  };
}

/**
 * Run the transit simulation tick.
 */
export function tickTransit(
  districts: District[],
  transitLines: TransitLine[],
  metrics: CityMetrics,
  budget: Budget
): GameEvent[] {
  const events: GameEvent[] = [];

  // 1. Progress construction
  events.push(...progressConstruction(transitLines));

  // 2. Update ridership
  for (const line of transitLines) {
    line.ridership = calculateRidership(line, districts);
  }

  // 3. Apply property value effects only for newly completed lines
  for (const event of events) {
    if (event.type === "milestone") {
      applyTransitPropertyEffects(districts, transitLines);
      break;
    }
  }

  // 4. Update city-wide transit ridership
  metrics.transitRidership = transitLines.reduce(
    (sum, l) => sum + l.ridership,
    0
  );

  // 5. Calculate transit operating costs
  const totalTransitCost = transitLines
    .filter((l) => l.constructionTurnsRemaining === 0)
    .reduce((sum, l) => sum + l.operatingCost, 0);

  // Add transit cost (engine resets expenses to base each tick)
  budget.expensesPerTurn += totalTransitCost * (1 - budget.transitSubsidy * 0.5);

  // 6. Update district transit access
  for (const d of districts) {
    d.transitLines = transitLines
      .filter((l) => l.districts.includes(d.id) && l.constructionTurnsRemaining === 0)
      .map((l) => l.id);
    d.hasTransitStation = d.transitLines.length > 0;
  }

  return events;
}
