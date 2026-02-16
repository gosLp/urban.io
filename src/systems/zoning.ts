// ============================================================
// Zoning System
// Controls density caps, housing supply, rent dynamics
// Key fix: rents change incrementally via damping
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
  [ZoneType.Commercial]: 2000,
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

/** Rent multiplier by zone type */
const RENT_MULTIPLIERS: Record<ZoneType, number> = {
  [ZoneType.LowDensityResidential]: 1.3,
  [ZoneType.MidDensityResidential]: 1.0,
  [ZoneType.HighDensityResidential]: 0.85,
  [ZoneType.MixedUse]: 0.9,
  [ZoneType.Commercial]: 1.1,
  [ZoneType.Industrial]: 0.7,
  [ZoneType.TransitOriented]: 0.8,
  [ZoneType.Park]: 1.2,
};

/** How fast rent converges to target per tick */
const RENT_DAMPING = 0.08;

export function calculateZoningCapacity(district: District): number {
  let capacity = 0;
  for (const [zoneType, percentage] of Object.entries(district.zones)) {
    const areaFraction = percentage / 100;
    const zoneArea = district.area * areaFraction;
    const density = DENSITY_YIELDS[zoneType as ZoneType] ?? 0;
    capacity += zoneArea * density;
  }
  return Math.min(capacity, district.maxDensity * district.area);
}

export function calculateHousingSupply(districts: District[]): number {
  let total = 0;
  for (const d of districts) {
    total += calculateZoningCapacity(d);
  }
  return Math.floor(total / 2.5);
}

export function calculateJobCapacity(districts: District[]): number {
  let totalJobs = 0;
  for (const d of districts) {
    for (const [zoneType, percentage] of Object.entries(d.zones)) {
      const areaFraction = percentage / 100;
      const zoneArea = d.area * areaFraction;
      totalJobs += zoneArea * (JOB_YIELDS[zoneType as ZoneType] ?? 0);
    }
  }
  return Math.floor(totalJobs);
}

function calculateTargetRent(
  district: District,
  cityBaseRent: number,
  supplyDemandRatio: number
): number {
  let weightedMultiplier = 0;
  let totalWeight = 0;
  for (const [zoneType, percentage] of Object.entries(district.zones)) {
    if (percentage <= 0) continue;
    weightedMultiplier += (RENT_MULTIPLIERS[zoneType as ZoneType] ?? 1.0) * percentage;
    totalWeight += percentage;
  }
  const avgMultiplier = totalWeight > 0 ? weightedMultiplier / totalWeight : 1.0;

  // Capped supply-demand pressure
  const demandPressure = Math.max(0.8, Math.min(1.4, supplyDemandRatio));
  const transitDiscount = district.hasTransitStation ? 0.97 : 1.02;
  const densityRatio = district.currentDensity / Math.max(district.maxDensity, 1);
  const densityEffect = 1 - densityRatio * 0.1;

  return cityBaseRent * avgMultiplier * demandPressure * transitDiscount * densityEffect;
}

export function calculateRentBurden(rent: number, medianIncome: number): number {
  return Math.min(1.0, (rent * 12) / Math.max(medianIncome, 1));
}

export function updateDistrictDensity(district: District): void {
  district.currentDensity = district.area > 0 ? district.population / district.area : 0;
}

export function applyZoningChange(
  district: District,
  newZones: Partial<ZoneAllocation>
): { success: boolean; error?: string } {
  const merged = { ...district.zones, ...newZones };
  const total = Object.values(merged).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 0.1) {
    return { success: false, error: `Zone allocations must sum to 100%, got ${total.toFixed(1)}%` };
  }
  district.zones = merged;
  return { success: true };
}

/**
 * Run zoning tick: update densities and rents INCREMENTALLY.
 */
export function tickZoning(
  districts: District[],
  metrics: CityMetrics,
  cityBaseRent: number,
  medianIncome: number
): void {
  for (const d of districts) {
    updateDistrictDensity(d);
  }

  const supply = Math.max(metrics.housingSupply, 1);
  const sdRatio = metrics.housingDemand / supply;

  // DAMPED rent updates
  for (const d of districts) {
    const targetRent = calculateTargetRent(d, cityBaseRent, sdRatio);
    d.metrics.averageRent =
      d.metrics.averageRent * (1 - RENT_DAMPING) + targetRent * RENT_DAMPING;
    d.metrics.rentBurden = calculateRentBurden(d.metrics.averageRent, medianIncome);
  }

  // Recalculate supply/jobs from zone math
  metrics.housingSupply = calculateHousingSupply(districts);
  metrics.jobsTotal = calculateJobCapacity(districts);

  // Population-weighted city rent
  const totalPop = districts.reduce((s, d) => s + d.population, 0);
  if (totalPop > 0) {
    metrics.averageRent =
      districts.reduce((s, d) => s + d.metrics.averageRent * d.population, 0) / totalPop;
  }
}
