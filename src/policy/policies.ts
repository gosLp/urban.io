// ============================================================
// Policy Templates & Effect System
// Defines all available policies and their effects
// ============================================================

import {
  PolicyProposal,
  PolicyCategory,
  VoteRequirement,
  PolicyEffect,
  DistrictId,
} from "../types.js";

let policyCounter = 0;

function nextPolicyId(): string {
  return `policy_${++policyCounter}`;
}

// --- Policy Factory Functions ---

/**
 * Rezone a district to allow higher density.
 */
export function createUpzonePolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Upzone ${districtName}`,
    description: `Allow higher density development in ${districtName}. Increases housing supply but changes neighborhood character.`,
    category: PolicyCategory.Zoning,
    voteRequirement: VoteRequirement.SuperMajority,
    cost: 50,
    targetDistricts: [districtId],
    politicalCost: 0.7,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "averageRent",
        delta: -0.1,
        delay: 3,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "propertyValue",
        delta: -0.05,
        delay: 1,
        duration: 0,
      },
      {
        target: { type: "city" },
        metric: "housingSupply",
        delta: 500,
        delay: 4,
        duration: 0,
      },
    ],
  };
}

/**
 * Build a new bus route connecting districts.
 */
export function createBusRoutePolicy(
  districtIds: DistrictId[],
  routeName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `New Bus Route: ${routeName}`,
    description: `Establish a new bus route connecting ${districtIds.length} districts. Quick to deploy, moderate impact.`,
    category: PolicyCategory.Transit,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 200,
    targetDistricts: districtIds,
    politicalCost: 0.2,
    effects: districtIds.map((districtId) => ({
      target: { type: "district" as const, districtId },
      metric: "trafficCongestion",
      delta: -0.05,
      delay: 1,
      duration: 0,
    })),
  };
}

/**
 * Build a new rail/metro line connecting districts.
 */
export function createRailLinePolicy(
  districtIds: DistrictId[],
  lineName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `New Rail Line: ${lineName}`,
    description: `Build a new rail line connecting ${districtIds.length} districts. Expensive and slow to build, but transformative.`,
    category: PolicyCategory.Transit,
    voteRequirement: VoteRequirement.SuperMajority,
    cost: 2000 + districtIds.length * 500,
    targetDistricts: districtIds,
    politicalCost: 0.5,
    effects: [
      ...districtIds.map(
        (districtId): PolicyEffect => ({
          target: { type: "district", districtId },
          metric: "trafficCongestion",
          delta: -0.15,
          delay: 6,
          duration: 0,
        })
      ),
      ...districtIds.map(
        (districtId): PolicyEffect => ({
          target: { type: "district", districtId },
          metric: "propertyValue",
          delta: 0.1,
          delay: 4,
          duration: 0,
        })
      ),
      {
        target: { type: "city" },
        metric: "congestionIndex",
        delta: -0.05,
        delay: 6,
        duration: 0,
      },
    ],
  };
}

/**
 * Implement congestion pricing in target districts.
 */
export function createCongestionPricingPolicy(
  districtIds: DistrictId[],
  priceLevel: "low" | "medium" | "high"
): PolicyProposal {
  const multiplier = priceLevel === "low" ? 1 : priceLevel === "medium" ? 2 : 3;
  const revenue = 300 * multiplier;

  return {
    id: nextPolicyId(),
    name: `Congestion Pricing (${priceLevel})`,
    description: `Charge vehicles entering core districts. Level: ${priceLevel}. Reduces traffic, generates revenue, but politically contentious.`,
    category: PolicyCategory.CongestionPricing,
    voteRequirement: VoteRequirement.SuperMajority,
    cost: -revenue, // generates revenue
    targetDistricts: districtIds,
    politicalCost: 0.8,
    effects: [
      ...districtIds.map(
        (districtId): PolicyEffect => ({
          target: { type: "district", districtId },
          metric: "trafficCongestion",
          delta: -0.1 * multiplier,
          delay: 1,
          duration: 0,
        })
      ),
      {
        target: { type: "city" },
        metric: "congestionIndex",
        delta: -0.05 * multiplier,
        delay: 1,
        duration: 0,
      },
    ],
  };
}

/**
 * Build affordable housing in a district.
 */
export function createAffordableHousingPolicy(
  districtId: DistrictId,
  units: number
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Affordable Housing (${units} units)`,
    description: `Build ${units} affordable housing units. Reduces rent burden but requires budget.`,
    category: PolicyCategory.Housing,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: units * 2,
    targetDistricts: [districtId],
    politicalCost: 0.3,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "rentBurden",
        delta: -0.05,
        delay: 3,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "happiness",
        delta: 0.05,
        delay: 3,
        duration: 0,
      },
      {
        target: { type: "city" },
        metric: "housingSupply",
        delta: units,
        delay: 3,
        duration: 0,
      },
    ],
  };
}

/**
 * Reduce parking minimums in a district.
 */
export function createReduceParkingPolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Reduce Parking Minimums: ${districtName}`,
    description: `Remove or reduce mandatory parking requirements. Allows more housing, reduces car dependency, but angers drivers.`,
    category: PolicyCategory.Zoning,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 0,
    targetDistricts: [districtId],
    politicalCost: 0.5,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "averageRent",
        delta: -0.05,
        delay: 2,
        duration: 0,
      },
      {
        target: { type: "city" },
        metric: "housingSupply",
        delta: 200,
        delay: 3,
        duration: 0,
      },
    ],
  };
}

/**
 * Expand road capacity between districts.
 */
export function createRoadExpansionPolicy(
  districtIds: DistrictId[]
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: "Road Expansion",
    description: `Widen roads and add lanes. Short-term traffic relief, but induces demand long-term.`,
    category: PolicyCategory.Infrastructure,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 800,
    targetDistricts: districtIds,
    politicalCost: 0.3,
    effects: [
      // Short-term relief
      ...districtIds.map(
        (districtId): PolicyEffect => ({
          target: { type: "district", districtId },
          metric: "trafficCongestion",
          delta: -0.15,
          delay: 2,
          duration: 5, // wears off as induced demand kicks in
        })
      ),
      // Long-term: induced demand makes it worse
      ...districtIds.map(
        (districtId): PolicyEffect => ({
          target: { type: "district", districtId },
          metric: "trafficCongestion",
          delta: 0.1,
          delay: 7,
          duration: 0,
        })
      ),
    ],
  };
}

/**
 * Raise taxes to fund services.
 */
export function createTaxIncreasePolicy(
  amount: number
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Tax Increase (+${(amount * 100).toFixed(0)}%)`,
    description: `Raise tax rates to fund public services. Unpopular but necessary for ambitious projects.`,
    category: PolicyCategory.Taxation,
    voteRequirement: VoteRequirement.SuperMajority,
    cost: 0,
    targetDistricts: "all",
    politicalCost: 0.9,
    effects: [
      {
        target: { type: "city" },
        metric: "budgetHealth",
        delta: 0.1,
        delay: 1,
        duration: 0,
      },
      {
        target: { type: "city" },
        metric: "overallHappiness",
        delta: -0.05,
        delay: 0,
        duration: 3,
      },
    ],
  };
}

// ============================================================
// EARLY-GAME POLICIES
// Cheap, low-risk moves that give players viable actions from turn 1.
// These are the "small wins" that stabilize the situation before
// the player has political capital for bigger reforms.
// ============================================================

/**
 * Dedicate bus lanes on congested corridors.
 * Free (just paint and signs), immediately reduces bus travel time,
 * small congestion relief. Easy political sell.
 */
export function createBusLanePolicy(
  districtIds: DistrictId[],
  corridorName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Bus Lanes: ${corridorName}`,
    description: `Dedicate bus lanes on ${corridorName}. Costs almost nothing — just paint and enforcement. Speeds up buses, slight congestion relief for transit users.`,
    category: PolicyCategory.Transit,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 30,
    targetDistricts: districtIds,
    politicalCost: 0.15,
    effects: districtIds.map((districtId) => ({
      target: { type: "district" as const, districtId },
      metric: "trafficCongestion",
      delta: -0.03,
      delay: 1,
      duration: 0,
    })),
  };
}

/**
 * Enforce parking rules and meter unmetered lots.
 * GENERATES revenue, reduces illegal parking blocking traffic.
 * Populists hate it, everyone else is fine.
 */
export function createParkingEnforcementPolicy(
  districtIds: DistrictId[]
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: "Parking Enforcement & Metering",
    description: `Meter unmetered lots and enforce existing parking rules. Generates revenue, reduces illegal parking that blocks traffic. Quick to implement.`,
    category: PolicyCategory.Infrastructure,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: -150, // generates revenue
    targetDistricts: districtIds,
    politicalCost: 0.25,
    effects: [
      ...districtIds.map((districtId) => ({
        target: { type: "district" as const, districtId },
        metric: "trafficCongestion",
        delta: -0.02,
        delay: 1,
        duration: 0,
      })),
    ],
  };
}

/**
 * Fix key intersections — signal timing, turn lanes, pedestrian signals.
 * Cheap, targeted, immediate effect. Every council member likes this
 * when it's in their district.
 */
export function createIntersectionFixPolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Fix Intersections: ${districtName}`,
    description: `Upgrade signal timing, add turn lanes, and improve pedestrian crossings in ${districtName}. Cheap and effective.`,
    category: PolicyCategory.Infrastructure,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 80,
    targetDistricts: [districtId],
    politicalCost: 0.1,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "trafficCongestion",
        delta: -0.04,
        delay: 1,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "publicServiceSatisfaction",
        delta: 0.03,
        delay: 1,
        duration: 0,
      },
    ],
  };
}

/**
 * Improve public services — water, streetlights, waste collection.
 * Cheap, universally popular, boosts happiness directly.
 * The "safe vote" for any politician.
 */
export function createPublicServicesPolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Improve Services: ${districtName}`,
    description: `Better water supply, streetlights, and waste collection in ${districtName}. Small cost, universally popular.`,
    category: PolicyCategory.Infrastructure,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 100,
    targetDistricts: [districtId],
    politicalCost: 0.05,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "publicServiceSatisfaction",
        delta: 0.06,
        delay: 1,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "happiness",
        delta: 0.02,
        delay: 1,
        duration: 0,
      },
    ],
  };
}

/**
 * Add bus frequency / extend hours on existing routes.
 * Cheap upgrade to existing infrastructure. Increases ridership,
 * slight congestion relief. Easy political sell.
 */
export function createBusFrequencyPolicy(
  districtIds: DistrictId[],
  routeName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `More Buses: ${routeName}`,
    description: `Increase frequency and extend hours on ${routeName}. Uses existing infrastructure, just more buses on the road.`,
    category: PolicyCategory.Transit,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 120,
    targetDistricts: districtIds,
    politicalCost: 0.1,
    effects: districtIds.map((districtId) => ({
      target: { type: "district" as const, districtId },
      metric: "trafficCongestion",
      delta: -0.03,
      delay: 0,
      duration: 0,
    })),
  };
}

/**
 * Plant trees and create pocket parks.
 * Cheap, universally popular, boosts green space and happiness.
 * No political opposition.
 */
export function createGreenSpacePolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Green Spaces: ${districtName}`,
    description: `Plant trees, create pocket parks, and beautify public spaces in ${districtName}. Popular with everyone.`,
    category: PolicyCategory.Infrastructure,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 60,
    targetDistricts: [districtId],
    politicalCost: 0.05,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "greenSpaceAccess",
        delta: 0.05,
        delay: 2,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "happiness",
        delta: 0.02,
        delay: 2,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "propertyValue",
        delta: 0.03,
        delay: 3,
        duration: 0,
      },
    ],
  };
}

/**
 * Pilot congestion pricing — limited area, temporary, lower rates.
 * Tests the idea without full political commitment.
 * Generates some revenue, less political backlash than full pricing.
 */
export function createPilotCongestionPricingPolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Pilot Congestion Pricing: ${districtName}`,
    description: `6-month trial of congestion pricing in ${districtName} only. Lower rates, limited scope. Tests the concept with less political risk.`,
    category: PolicyCategory.CongestionPricing,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: -100, // generates revenue (less than full pricing)
    targetDistricts: [districtId],
    politicalCost: 0.4,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "trafficCongestion",
        delta: -0.06,
        delay: 1,
        duration: 6, // temporary pilot
      },
    ],
  };
}

/**
 * Footpath and cycling infrastructure.
 * Low cost, reduces short-trip car usage, mild congestion relief.
 * Progressive/YIMBY love it, no real opposition.
 */
export function createWalkabilityPolicy(
  districtId: DistrictId,
  districtName: string
): PolicyProposal {
  return {
    id: nextPolicyId(),
    name: `Walkability: ${districtName}`,
    description: `Build proper footpaths and cycling lanes in ${districtName}. Reduces short car trips, improves livability.`,
    category: PolicyCategory.Infrastructure,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 90,
    targetDistricts: [districtId],
    politicalCost: 0.1,
    effects: [
      {
        target: { type: "district", districtId },
        metric: "trafficCongestion",
        delta: -0.02,
        delay: 2,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "happiness",
        delta: 0.03,
        delay: 2,
        duration: 0,
      },
      {
        target: { type: "district", districtId },
        metric: "publicServiceSatisfaction",
        delta: 0.03,
        delay: 2,
        duration: 0,
      },
    ],
  };
}
