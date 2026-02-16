// ============================================================
// Traffic & Commute Simulation
// Models: congestion, induced demand, commute times
// Key fix: loads persist across ticks, metrics change incrementally
// ============================================================

import {
  District,
  DistrictId,
  RoadNetwork,
  TransitLine,
  TransitType,
  CityMetrics,
} from "../types.js";

/** How much extra demand each unit of road capacity induces */
const INDUCED_DEMAND_FACTOR = 0.15;
/** Minutes added per unit of congestion (0-1) */
const CONGESTION_COMMUTE_PENALTY = 35;
/** Base commute in minutes for adjacent districts */
const BASE_COMMUTE_ADJACENT = 20;
/** Base commute for non-adjacent/disconnected */
const BASE_COMMUTE_DISTANT = 50;
/** Transit commute reduction cap */
const TRANSIT_COMMUTE_REDUCTION = 0.3;
/** Density proximity reduces commute */
const DENSITY_PROXIMITY_FACTOR = 0.12;
/** Mixed-use self-containment */
const MIXED_USE_COMMUTE_REDUCTION = 0.25;
/** How fast metrics converge to target per tick (0-1, lower = smoother) */
const DAMPING = 0.15;
/** How fast road loads converge per tick */
const LOAD_DAMPING = 0.2;

export function roadKey(a: DistrictId, b: DistrictId): string {
  return [a, b].sort().join("|");
}

/**
 * Calculate congestion between two districts.
 */
export function calculateCongestion(
  road: RoadNetwork,
  districtA: DistrictId,
  districtB: DistrictId
): number {
  const key = roadKey(districtA, districtB);
  const capacity = road.capacities.get(key) ?? 1000;
  const load = road.loads.get(key) ?? 0;
  return Math.min(load / capacity, 1.0);
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
      const distance = Math.abs(indexA - indexB);
      total += line.capacity / Math.max(distance, 1);
    }
  }
  return total;
}

/**
 * Update road loads incrementally (don't reset to 0).
 * Calculates target loads from population, then blends toward target.
 */
export function updateRoadLoads(
  road: RoadNetwork,
  districts: District[],
  transitLines: TransitLine[]
): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const district of districts) {
    for (const adjId of district.adjacentDistricts) {
      const adj = districtMap.get(adjId);
      if (!adj) continue;

      const key = roadKey(district.id, adjId);
      if (!road.capacities.has(key)) continue;

      const capacity = road.capacities.get(key)!;
      const currentLoad = road.loads.get(key) ?? capacity * 0.5;

      // Target load from population
      const popFactor = (district.population + adj.population) / 2;
      let targetLoad = popFactor * 0.015; // cars per person

      // Induced demand: more capacity = more driving
      targetLoad += capacity * INDUCED_DEMAND_FACTOR * 0.002;

      // Transit absorbs some trips (proportional to transit capacity vs road capacity)
      const transitCap = getTransitCapacityBetween(district.id, adjId, transitLines);
      const transitAbsorption = Math.min(transitCap * 0.3, targetLoad * 0.4);
      targetLoad -= transitAbsorption;

      // Mixed-use reduces trips
      const mixedUseRatio =
        (district.zones.mixed_use + adj.zones.mixed_use) / 2 / 100;
      targetLoad *= 1 - mixedUseRatio * MIXED_USE_COMMUTE_REDUCTION;

      targetLoad = Math.max(0, targetLoad);

      // DAMPED update: blend current load toward target
      const newLoad = currentLoad * (1 - LOAD_DAMPING) + targetLoad * LOAD_DAMPING;
      road.loads.set(key, newLoad);
    }
  }
}

/**
 * Calculate target commute time for a district.
 */
function calculateTargetCommute(
  district: District,
  allDistricts: District[],
  road: RoadNetwork,
  transitLines: TransitLine[]
): number {
  const districtMap = new Map(allDistricts.map((d) => [d.id, d]));
  let totalCommute = 0;
  let connections = 0;

  // Mixed-use self-containment
  const mixedUseRatio = district.zones.mixed_use / 100;
  const selfContainedPortion = mixedUseRatio * MIXED_USE_COMMUTE_REDUCTION;
  const selfContainedCommute = 10;

  for (const adjId of district.adjacentDistricts) {
    const adj = districtMap.get(adjId);
    if (!adj) continue;

    let commute = BASE_COMMUTE_ADJACENT;

    // Congestion adds time
    const congestion = calculateCongestion(road, district.id, adjId);
    commute += congestion * CONGESTION_COMMUTE_PENALTY;

    // Transit reduces time
    const transitCap = getTransitCapacityBetween(district.id, adjId, transitLines);
    if (transitCap > 0) {
      const transitBenefit = Math.min(TRANSIT_COMMUTE_REDUCTION, transitCap / 15000);
      commute *= 1 - transitBenefit;
    }

    // Density near jobs reduces commute
    const avgDensityRatio =
      (district.currentDensity / Math.max(district.maxDensity, 1) +
        adj.currentDensity / Math.max(adj.maxDensity, 1)) / 2;
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
export function calculateCityCongestion(road: RoadNetwork): number {
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
 * Initialize road loads from district initial congestion values.
 * Called once at game start so first tick doesn't snap.
 */
export function initializeRoadLoads(
  road: RoadNetwork,
  districts: District[]
): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const district of districts) {
    for (const adjId of district.adjacentDistricts) {
      const adj = districtMap.get(adjId);
      if (!adj) continue;

      const key = roadKey(district.id, adjId);
      const capacity = road.capacities.get(key);
      if (capacity === undefined) continue;

      // Initialize load from average of both districts' congestion
      const avgCongestion =
        (district.metrics.trafficCongestion + adj.metrics.trafficCongestion) / 2;
      road.loads.set(key, capacity * avgCongestion);
    }
  }
}

/**
 * Run the full traffic simulation tick.
 * All metric changes are DAMPED — they move toward targets, not snap.
 */
export function tickTraffic(
  districts: District[],
  road: RoadNetwork,
  transitLines: TransitLine[],
  _metrics: CityMetrics
): void {
  // 1. Update road loads (incremental, not reset)
  updateRoadLoads(road, districts, transitLines);

  // 2. Update each district's commute and congestion (damped)
  for (const district of districts) {
    const targetCommute = calculateTargetCommute(district, districts, road, transitLines);
    district.metrics.averageCommuteMinutes =
      district.metrics.averageCommuteMinutes * (1 - DAMPING) +
      targetCommute * DAMPING;

    // District congestion from adjacent roads (damped)
    let totalCong = 0;
    let adjCount = 0;
    for (const adjId of district.adjacentDistricts) {
      totalCong += calculateCongestion(road, district.id, adjId);
      adjCount++;
    }
    const targetCongestion = adjCount > 0 ? totalCong / adjCount : 0;
    district.metrics.trafficCongestion =
      district.metrics.trafficCongestion * (1 - DAMPING) +
      targetCongestion * DAMPING;
  }
}
