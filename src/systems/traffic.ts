// ============================================================
// Traffic & Commute Simulation
// Models: congestion, induced demand, commute times
// ============================================================

import {
  District,
  DistrictId,
  RoadNetwork,
  TransitLine,
  TransitType,
  CityMetrics,
} from "../types.js";

/** How much extra demand each unit of road capacity induces (induced demand) */
const INDUCED_DEMAND_FACTOR = 0.3;
/** Max congestion before gridlock */
const GRIDLOCK_THRESHOLD = 1.0;
/** Minutes added per unit of congestion */
const CONGESTION_COMMUTE_PENALTY = 30;
/** Base commute in minutes for adjacent districts */
const BASE_COMMUTE_ADJACENT = 15;
/** Base commute in minutes for non-adjacent districts */
const BASE_COMMUTE_DISTANT = 35;
/** Transit commute reduction factor */
const TRANSIT_COMMUTE_REDUCTION = 0.4;
/** Density proximity benefit: high density near jobs reduces commute */
const DENSITY_PROXIMITY_FACTOR = 0.15;
/** Mixed-use self-containment factor */
const MIXED_USE_COMMUTE_REDUCTION = 0.3;

export function roadKey(a: DistrictId, b: DistrictId): string {
  return [a, b].sort().join("|");
}

/**
 * Calculate congestion between two districts.
 * Congestion = load / capacity, capped at GRIDLOCK_THRESHOLD.
 */
export function calculateCongestion(
  road: RoadNetwork,
  districtA: DistrictId,
  districtB: DistrictId
): number {
  const key = roadKey(districtA, districtB);
  const capacity = road.capacities.get(key) ?? 1000;
  const load = road.loads.get(key) ?? 0;
  return Math.min(load / capacity, GRIDLOCK_THRESHOLD);
}

/**
 * Update road loads based on population and commute patterns.
 * More population = more load. Roads near dense areas get loaded.
 * Models induced demand: expanding roads generates new trips.
 */
export function updateRoadLoads(
  road: RoadNetwork,
  districts: District[],
  transitLines: TransitLine[]
): void {
  // Reset loads
  for (const key of road.loads.keys()) {
    road.loads.set(key, 0);
  }

  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const district of districts) {
    for (const adjId of district.adjacentDistricts) {
      const adj = districtMap.get(adjId);
      if (!adj) continue;

      const key = roadKey(district.id, adjId);
      const capacity = road.capacities.get(key) ?? 1000;

      // Base load proportional to populations of both districts
      const popFactor = (district.population + adj.population) / 2;
      let baseLoad = popFactor * 0.01;

      // Induced demand: higher capacity roads attract more traffic
      baseLoad += capacity * INDUCED_DEMAND_FACTOR * 0.001;

      // Transit absorbs some trips
      const transitCapacity = getTransitCapacityBetween(
        district.id,
        adjId,
        transitLines
      );
      const transitAbsorption = Math.min(transitCapacity * 0.5, baseLoad * 0.6);
      baseLoad -= transitAbsorption;

      // Mixed-use reduces trips (people live and work in same district)
      const mixedUseRatio =
        (district.zones.mixed_use + adj.zones.mixed_use) / 2 / 100;
      baseLoad *= 1 - mixedUseRatio * MIXED_USE_COMMUTE_REDUCTION;

      const existing = road.loads.get(key) ?? 0;
      road.loads.set(key, existing + Math.max(0, baseLoad));
    }
  }
}

/**
 * Get transit capacity between two districts from active transit lines.
 */
function getTransitCapacityBetween(
  a: DistrictId,
  b: DistrictId,
  transitLines: TransitLine[]
): number {
  let total = 0;
  for (const line of transitLines) {
    if (line.constructionTurnsRemaining > 0) continue;
    const indexA = line.districts.indexOf(a);
    const indexB = line.districts.indexOf(b);
    if (indexA >= 0 && indexB >= 0) {
      // Adjacent stops on same line = full capacity, further = reduced
      const distance = Math.abs(indexA - indexB);
      total += line.capacity / distance;
    }
  }
  return total;
}

/**
 * Calculate average commute time for a district.
 */
export function calculateDistrictCommute(
  district: District,
  allDistricts: District[],
  road: RoadNetwork,
  transitLines: TransitLine[]
): number {
  const districtMap = new Map(allDistricts.map((d) => [d.id, d]));
  let totalCommute = 0;
  let connections = 0;

  // Self-contained commute (mixed-use benefit)
  const mixedUseRatio = district.zones.mixed_use / 100;
  const selfContainedPortion = mixedUseRatio * MIXED_USE_COMMUTE_REDUCTION;
  const selfContainedCommute = 10; // 10 min walk/bike within district

  for (const adjId of district.adjacentDistricts) {
    const adj = districtMap.get(adjId);
    if (!adj) continue;

    let commute = BASE_COMMUTE_ADJACENT;

    // Congestion adds time
    const congestion = calculateCongestion(road, district.id, adjId);
    commute += congestion * CONGESTION_COMMUTE_PENALTY;

    // Transit reduces time
    const transitCap = getTransitCapacityBetween(
      district.id,
      adjId,
      transitLines
    );
    if (transitCap > 0) {
      const transitBenefit = Math.min(TRANSIT_COMMUTE_REDUCTION, transitCap / 10000);
      commute *= 1 - transitBenefit;
    }

    // High density near jobs reduces commute
    const avgDensityRatio =
      (district.currentDensity / district.maxDensity +
        adj.currentDensity / adj.maxDensity) /
      2;
    commute *= 1 - avgDensityRatio * DENSITY_PROXIMITY_FACTOR;

    totalCommute += commute;
    connections++;
  }

  if (connections === 0) return BASE_COMMUTE_DISTANT;

  const externalCommute = totalCommute / connections;
  return (
    selfContainedPortion * selfContainedCommute +
    (1 - selfContainedPortion) * externalCommute
  );
}

/**
 * Calculate city-wide congestion index (0-1).
 */
export function calculateCityCongestion(
  road: RoadNetwork
): number {
  let totalCongestion = 0;
  let segments = 0;

  for (const key of road.capacities.keys()) {
    const capacity = road.capacities.get(key) ?? 1;
    const load = road.loads.get(key) ?? 0;
    totalCongestion += Math.min(load / capacity, 1);
    segments++;
  }

  return segments > 0 ? totalCongestion / segments : 0;
}

/**
 * Run the full traffic simulation tick.
 */
export function tickTraffic(
  districts: District[],
  road: RoadNetwork,
  transitLines: TransitLine[],
  _metrics: CityMetrics
): void {
  // 1. Update road loads
  updateRoadLoads(road, districts, transitLines);

  // 2. Update each district's commute and congestion metrics
  for (const district of districts) {
    district.metrics.averageCommuteMinutes = calculateDistrictCommute(
      district,
      districts,
      road,
      transitLines
    );

    // Update district congestion as average of all adjacent road congestion
    let totalCong = 0;
    let adjCount = 0;
    for (const adjId of district.adjacentDistricts) {
      totalCong += calculateCongestion(road, district.id, adjId);
      adjCount++;
    }
    district.metrics.trafficCongestion =
      adjCount > 0 ? totalCong / adjCount : 0;
  }
}
