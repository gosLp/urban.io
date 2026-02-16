// ============================================================
// City Building Helpers
// Utility functions for constructing city configurations
// ============================================================

import {
  District,
  DistrictId,
  DistrictMetrics,
  Representative,
  RepresentativeId,
  PoliticalLeaning,
  PolicyCategory,
  ZoneAllocation,
  ZoneType,
  Position,
  RoadNetwork,
  TransitLine,
  TransitType,
  TransitLineId,
} from "../types.js";

import { roadKey } from "../systems/traffic.js";

/**
 * Create a district with sensible defaults.
 */
export function createDistrict(
  id: DistrictId,
  name: string,
  opts: {
    position: Position;
    population: number;
    area: number;
    maxDensity: number;
    zones: Partial<ZoneAllocation>;
    adjacentDistricts: DistrictId[];
    hasTransitStation?: boolean;
    parkingMinimum?: number;
  }
): District {
  const defaultZones: ZoneAllocation = {
    [ZoneType.LowDensityResidential]: 0,
    [ZoneType.MidDensityResidential]: 0,
    [ZoneType.HighDensityResidential]: 0,
    [ZoneType.MixedUse]: 0,
    [ZoneType.Commercial]: 0,
    [ZoneType.Industrial]: 0,
    [ZoneType.TransitOriented]: 0,
    [ZoneType.Park]: 0,
  };

  const zones = { ...defaultZones, ...opts.zones };

  return {
    id,
    name,
    position: opts.position,
    population: opts.population,
    area: opts.area,
    zones,
    maxDensity: opts.maxDensity,
    currentDensity: opts.area > 0 ? opts.population / opts.area : 0,
    metrics: defaultMetrics(),
    adjacentDistricts: opts.adjacentDistricts,
    hasTransitStation: opts.hasTransitStation ?? false,
    transitLines: [],
    parkingMinimum: opts.parkingMinimum ?? 1,
  };
}

/**
 * Create a representative for a district.
 */
export function createRepresentative(
  id: RepresentativeId,
  name: string,
  districtId: DistrictId,
  leaning: PoliticalLeaning,
  priorities: PolicyCategory[]
): Representative {
  return {
    id,
    name,
    districtId,
    leaning,
    approvalRating: 0.55,
    reElectionRisk: 0.25,
    priorities,
    voteHistory: [],
    termNumber: 1,
  };
}

/**
 * Build a road network from district adjacency lists.
 */
export function buildRoadNetwork(
  districts: District[],
  capacityFn?: (a: DistrictId, b: DistrictId) => number
): RoadNetwork {
  const capacities = new Map<string, number>();
  const loads = new Map<string, number>();
  const defaultCapacity = capacityFn ?? (() => 5000);

  for (const d of districts) {
    for (const adjId of d.adjacentDistricts) {
      const key = roadKey(d.id, adjId);
      if (!capacities.has(key)) {
        capacities.set(key, defaultCapacity(d.id, adjId));
        loads.set(key, 0);
      }
    }
  }

  return { capacities, loads };
}

/**
 * Create a transit line.
 */
export function createTransitLine(
  id: TransitLineId,
  name: string,
  type: TransitType,
  districts: DistrictId[],
  capacity: number,
  operational: boolean = true
): TransitLine {
  return {
    id,
    name,
    type,
    districts,
    capacity,
    ridership: operational ? capacity * 0.4 : 0,
    operatingCost: type === TransitType.Rail ? capacity * 0.5 : capacity * 0.15,
    constructionTurnsRemaining: operational ? 0 : type === TransitType.Rail ? 6 : 2,
    propertyValueBoost: type === TransitType.Rail ? 1.0 : 0.3,
  };
}

function defaultMetrics(): DistrictMetrics {
  return {
    averageCommuteMinutes: 30,
    averageRent: 1500,
    rentBurden: 0.35,
    jobAccessScore: 0.5,
    trafficCongestion: 0.5,
    publicServiceSatisfaction: 0.5,
    happiness: 0.5,
    propertyValue: 1.0,
    crimeRate: 0.2,
    greenSpaceAccess: 0.4,
  };
}
