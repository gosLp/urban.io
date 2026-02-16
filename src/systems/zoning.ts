// ============================================================
// Zoning System
// Controls density caps, housing supply, rent dynamics
// ============================================================

import {
  District,
  ZoneType,
  ZoneAllocation,
  CityMetrics,
} from "../types.js";

/** Population density per sq km for each zone type */
const DENSITY_YIELDS: Record<ZoneType, number> = {
  [ZoneType.LowDensityResidential]: 3000,
  [ZoneType.MidDensityResidential]: 10000,
  [ZoneType.HighDensityResidential]: 25000,
  [ZoneType.MixedUse]: 15000,
  [ZoneType.Commercial]: 2000, // some residential above shops
  [ZoneType.Industrial]: 500,
  [ZoneType.TransitOriented]: 20000,
  [ZoneType.Park]: 0,
};

/** Job density per sq km for each zone type */
const JOB_YIELDS: Record<ZoneType, number> = {
  [ZoneType.LowDensityResidential]: 500,
  [ZoneType.MidDensityResidential]: 2000,
  [ZoneType.HighDensityResidential]: 5000,
  [ZoneType.MixedUse]: 8000,
  [ZoneType.Commercial]: 15000,
  [ZoneType.Industrial]: 6000,
  [ZoneType.TransitOriented]: 10000,
  [ZoneType.Park]: 100,
};

/** Rent multiplier by zone type (base = 1.0) */
const RENT_MULTIPLIERS: Record<ZoneType, number> = {
  [ZoneType.LowDensityResidential]: 1.3,
  [ZoneType.MidDensityResidential]: 1.0,
  [ZoneType.HighDensityResidential]: 0.85,
  [ZoneType.MixedUse]: 0.9,
  [ZoneType.Commercial]: 1.1,
  [ZoneType.Industrial]: 0.7,
  [ZoneType.TransitOriented]: 0.8,
  [ZoneType.Park]: 1.2, // parks raise nearby values
};

/**
 * Calculate the effective population capacity of a district based on zoning.
 */
export function calculateZoningCapacity(district: District): number {
  let capacity = 0;
  const zones = district.zones;

  for (const [zoneType, percentage] of Object.entries(zones)) {
    const areaFraction = percentage / 100;
    const zoneArea = district.area * areaFraction;
    const density = DENSITY_YIELDS[zoneType as ZoneType] ?? 0;
    capacity += zoneArea * density;
  }

  // Cap by district max density
  const maxFromDensity = district.maxDensity * district.area;
  return Math.min(capacity, maxFromDensity);
}

/**
 * Calculate housing supply units based on zoning.
 * Assumes ~2.5 people per housing unit.
 */
export function calculateHousingSupply(districts: District[]): number {
  let totalCapacity = 0;
  for (const d of districts) {
    totalCapacity += calculateZoningCapacity(d);
  }
  return Math.floor(totalCapacity / 2.5);
}

/**
 * Calculate job capacity based on zoning.
 */
export function calculateJobCapacity(districts: District[]): number {
  let totalJobs = 0;
  for (const d of districts) {
    for (const [zoneType, percentage] of Object.entries(d.zones)) {
      const areaFraction = percentage / 100;
      const zoneArea = d.area * areaFraction;
      const jobs = JOB_YIELDS[zoneType as ZoneType] ?? 0;
      totalJobs += zoneArea * jobs;
    }
  }
  return Math.floor(totalJobs);
}

/**
 * Calculate average rent for a district based on:
 * - Zone type mix (supply effect)
 * - Supply vs demand ratio
 * - Transit access bonus
 * - Property values
 */
export function calculateDistrictRent(
  district: District,
  cityBaseRent: number,
  cityMetrics: CityMetrics
): number {
  // Weighted average rent multiplier from zone mix
  let weightedMultiplier = 0;
  let totalWeight = 0;

  for (const [zoneType, percentage] of Object.entries(district.zones)) {
    if (percentage <= 0) continue;
    const mult = RENT_MULTIPLIERS[zoneType as ZoneType] ?? 1.0;
    weightedMultiplier += mult * percentage;
    totalWeight += percentage;
  }

  const avgMultiplier = totalWeight > 0 ? weightedMultiplier / totalWeight : 1.0;

  // Supply-demand pressure
  const supplyDemandRatio =
    cityMetrics.housingSupply > 0
      ? cityMetrics.housingDemand / cityMetrics.housingSupply
      : 2.0;
  const demandPressure = Math.max(0.5, Math.min(2.0, supplyDemandRatio));

  // Transit access reduces rent pressure (more options = less car cost = can live further)
  const transitDiscount = district.hasTransitStation ? 0.95 : 1.05;

  // Density: higher density = more supply = lower rents (the key insight)
  const densityRatio = district.currentDensity / Math.max(district.maxDensity, 1);
  const densityEffect = 1 - densityRatio * 0.15; // Up to 15% reduction at max density

  return cityBaseRent * avgMultiplier * demandPressure * transitDiscount * densityEffect;
}

/**
 * Calculate rent burden (rent as fraction of income).
 * Lower income districts feel rent more.
 */
export function calculateRentBurden(
  rent: number,
  medianIncome: number
): number {
  const annualRent = rent * 12;
  return Math.min(1.0, annualRent / Math.max(medianIncome, 1));
}

/**
 * Update district current density based on actual population.
 */
export function updateDistrictDensity(district: District): void {
  district.currentDensity = district.area > 0
    ? district.population / district.area
    : 0;
}

/**
 * Apply a zoning change to a district.
 * Validates that total percentages sum to 100.
 */
export function applyZoningChange(
  district: District,
  newZones: Partial<ZoneAllocation>
): { success: boolean; error?: string } {
  const merged = { ...district.zones, ...newZones };
  const total = Object.values(merged).reduce((a, b) => a + b, 0);

  if (Math.abs(total - 100) > 0.1) {
    return {
      success: false,
      error: `Zone allocations must sum to 100%, got ${total.toFixed(1)}%`,
    };
  }

  district.zones = merged;
  return { success: true };
}

/**
 * Run zoning tick: update densities and property values.
 */
export function tickZoning(
  districts: District[],
  metrics: CityMetrics,
  cityBaseRent: number,
  medianIncome: number
): void {
  // Update densities
  for (const d of districts) {
    updateDistrictDensity(d);
  }

  // Update rents and rent burden
  for (const d of districts) {
    d.metrics.averageRent = calculateDistrictRent(d, cityBaseRent, metrics);
    d.metrics.rentBurden = calculateRentBurden(d.metrics.averageRent, medianIncome);
  }

  // Update city-wide housing/jobs
  metrics.housingSupply = calculateHousingSupply(districts);
  metrics.jobsTotal = calculateJobCapacity(districts);

  // Update city average rent
  const totalPop = districts.reduce((s, d) => s + d.population, 0);
  if (totalPop > 0) {
    metrics.averageRent =
      districts.reduce((s, d) => s + d.metrics.averageRent * d.population, 0) /
      totalPop;
  }
}
