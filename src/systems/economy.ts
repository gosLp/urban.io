// ============================================================
// Economic & Population Model
// Budget, migration, happiness, population dynamics
// ============================================================

import {
  District,
  DistrictId,
  Budget,
  CityMetrics,
  GameEvent,
  ActiveEffect,
} from "../types.js";

/** Migration sensitivity: how responsive people are to conditions */
const MIGRATION_RATE = 0.02;
/** Natural population growth rate per turn */
const NATURAL_GROWTH_RATE = 0.002;
/** Income growth with economic output */
const INCOME_GROWTH_RATE = 0.01;
/** Base city income per person */
const TAX_PER_CAPITA = 0.05;
/** Happiness weights */
const HAPPINESS_WEIGHTS = {
  commute: 0.25,
  rent: 0.25,
  jobs: 0.15,
  traffic: 0.15,
  services: 0.1,
  green: 0.1,
};

/**
 * Calculate composite happiness for a district (0-1).
 */
export function calculateHappiness(district: District): number {
  const m = district.metrics;

  // Each component: higher is better
  const commuteScore = Math.max(0, 1 - m.averageCommuteMinutes / 60);
  const rentScore = Math.max(0, 1 - m.rentBurden);
  const jobScore = m.jobAccessScore;
  const trafficScore = 1 - m.trafficCongestion;
  const serviceScore = m.publicServiceSatisfaction;
  const greenScore = m.greenSpaceAccess;

  return (
    commuteScore * HAPPINESS_WEIGHTS.commute +
    rentScore * HAPPINESS_WEIGHTS.rent +
    jobScore * HAPPINESS_WEIGHTS.jobs +
    trafficScore * HAPPINESS_WEIGHTS.traffic +
    serviceScore * HAPPINESS_WEIGHTS.services +
    greenScore * HAPPINESS_WEIGHTS.green
  );
}

/**
 * Calculate job access score for a district.
 * Based on: jobs in district + reachable jobs in adjacent districts.
 */
export function calculateJobAccess(
  district: District,
  allDistricts: District[],
  totalJobs: number
): number {
  if (totalJobs === 0) return 0;

  const districtMap = new Map(allDistricts.map((d) => [d.id, d]));

  // Jobs in own district (mixed-use, commercial, industrial zones)
  const localJobs = estimateDistrictJobs(district);

  // Jobs in adjacent districts (discounted by commute difficulty)
  let reachableJobs = localJobs;
  for (const adjId of district.adjacentDistricts) {
    const adj = districtMap.get(adjId);
    if (adj) {
      const adjJobs = estimateDistrictJobs(adj);
      // Transit makes adjacent jobs more accessible
      const accessFactor = district.hasTransitStation && adj.hasTransitStation
        ? 0.8
        : 0.5;
      reachableJobs += adjJobs * accessFactor;
    }
  }

  return Math.min(1, reachableJobs / (totalJobs * 0.3));
}

function estimateDistrictJobs(d: District): number {
  const { mixed_use, commercial, industrial, transit_oriented } = d.zones;
  const jobZonePercent = mixed_use + commercial + industrial + transit_oriented;
  return (jobZonePercent / 100) * d.area * d.currentDensity * 0.5;
}

/**
 * Simulate population migration between districts.
 * People move toward: better jobs, lower rent, better commute.
 */
export function simulateMigration(
  districts: District[]
): { from: DistrictId; to: DistrictId; count: number }[] {
  const moves: { from: DistrictId; to: DistrictId; count: number }[] = [];

  // Calculate attractiveness of each district
  const attractiveness = new Map<DistrictId, number>();
  for (const d of districts) {
    const score =
      d.metrics.happiness * 0.4 +
      (1 - d.metrics.rentBurden) * 0.3 +
      d.metrics.jobAccessScore * 0.3;
    attractiveness.set(d.id, score);
  }

  // People move from less attractive to more attractive adjacent districts
  for (const d of districts) {
    const myScore = attractiveness.get(d.id) ?? 0.5;

    for (const adjId of d.adjacentDistricts) {
      const adjDistrict = districts.find((dd) => dd.id === adjId);
      if (!adjDistrict) continue;

      const adjScore = attractiveness.get(adjId) ?? 0.5;
      const diff = adjScore - myScore;

      if (diff > 0.05) {
        // Adjacent is more attractive
        // Check capacity
        const adjCapacity = adjDistrict.maxDensity * adjDistrict.area;
        const adjRoom = adjCapacity - adjDistrict.population;

        if (adjRoom > 0) {
          const migrants = Math.floor(
            d.population * MIGRATION_RATE * diff
          );
          const actualMigrants = Math.min(migrants, Math.floor(adjRoom * 0.1));

          if (actualMigrants > 0) {
            moves.push({ from: d.id, to: adjId, count: actualMigrants });
          }
        }
      }
    }
  }

  // Apply moves
  const districtMap = new Map(districts.map((d) => [d.id, d]));
  for (const move of moves) {
    const from = districtMap.get(move.from);
    const to = districtMap.get(move.to);
    if (from && to) {
      from.population -= move.count;
      to.population += move.count;
    }
  }

  return moves;
}

/**
 * Apply natural population growth.
 */
export function applyPopulationGrowth(districts: District[]): void {
  for (const d of districts) {
    const capacity = d.maxDensity * d.area;
    const room = capacity - d.population;
    if (room > 0) {
      const growth = Math.floor(d.population * NATURAL_GROWTH_RATE);
      d.population += Math.min(growth, Math.floor(room * 0.05));
    }
  }
}

/**
 * Update the city budget.
 */
export function updateBudget(
  budget: Budget,
  districts: District[],
  activeEffects: ActiveEffect[]
): GameEvent[] {
  const events: GameEvent[] = [];

  // Income = population * tax rate * per capita rate
  const totalPop = districts.reduce((s, d) => s + d.population, 0);
  budget.incomePerTurn = totalPop * TAX_PER_CAPITA * budget.taxRate;

  // Net
  const net = budget.incomePerTurn - budget.expensesPerTurn;
  budget.balance += net;

  if (budget.balance < 0) {
    events.push({
      type: "budget",
      message: `Budget deficit! Balance: ${budget.balance.toFixed(0)}. Consider raising taxes or cutting services.`,
      severity: "critical",
    });
  } else if (net < 0) {
    events.push({
      type: "budget",
      message: `Running a deficit of ${Math.abs(net).toFixed(0)} per turn.`,
      severity: "warning",
    });
  }

  return events;
}

/**
 * Apply active policy effects that have passed their delay.
 */
export function applyActiveEffects(
  activeEffects: ActiveEffect[],
  districts: District[],
  metrics: CityMetrics
): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const ae of activeEffects) {
    if (ae.turnsUntilActive > 0) {
      ae.turnsUntilActive--;
      continue;
    }

    const effect = ae.effect;

    // Apply to target
    switch (effect.target.type) {
      case "district": {
        const d = districtMap.get(effect.target.districtId);
        if (d && effect.metric in d.metrics) {
          (d.metrics as any)[effect.metric] += effect.delta;
          clampMetric(d.metrics as any, effect.metric);
        }
        break;
      }
      case "districts": {
        for (const did of effect.target.districtIds) {
          const d = districtMap.get(did);
          if (d && effect.metric in d.metrics) {
            (d.metrics as any)[effect.metric] += effect.delta;
            clampMetric(d.metrics as any, effect.metric);
          }
        }
        break;
      }
      case "city": {
        if (effect.metric in metrics) {
          (metrics as any)[effect.metric] += effect.delta;
        }
        break;
      }
      case "adjacent": {
        const source = districtMap.get(effect.target.districtId);
        if (source) {
          for (const adjId of source.adjacentDistricts) {
            const adj = districtMap.get(adjId);
            if (adj && effect.metric in adj.metrics) {
              (adj.metrics as any)[effect.metric] += effect.delta * 0.5;
              clampMetric(adj.metrics as any, effect.metric);
            }
          }
        }
        break;
      }
    }

    // Decrement duration
    if (ae.turnsRemaining > 0) {
      ae.turnsRemaining--;
    }
  }

  // Remove expired effects
  const before = activeEffects.length;
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    if (activeEffects[i].turnsRemaining === 0) {
      activeEffects.splice(i, 1);
    }
  }
}

function clampMetric(obj: Record<string, number>, key: string): void {
  const clamped = [
    "trafficCongestion", "rentBurden", "happiness",
    "jobAccessScore", "publicServiceSatisfaction", "greenSpaceAccess",
  ];
  if (clamped.includes(key)) {
    obj[key] = Math.max(0, Math.min(1, obj[key]));
  }
}

/**
 * Update city-wide metrics from district data.
 */
export function updateCityMetrics(
  districts: District[],
  metrics: CityMetrics
): void {
  const totalPop = districts.reduce((s, d) => s + d.population, 0);
  metrics.totalPopulation = totalPop;

  if (totalPop === 0) return;

  // Population-weighted averages
  metrics.averageCommute =
    districts.reduce((s, d) => s + d.metrics.averageCommuteMinutes * d.population, 0) /
    totalPop;

  metrics.overallHappiness =
    districts.reduce((s, d) => s + d.metrics.happiness * d.population, 0) /
    totalPop;

  metrics.congestionIndex =
    districts.reduce((s, d) => s + d.metrics.trafficCongestion * d.population, 0) /
    totalPop;

  metrics.housingDemand = Math.floor(totalPop / 2.5 * 1.1); // 10% over actual pop demand

  metrics.budgetHealth = Math.max(0, Math.min(1, 0.5)); // updated by budget system
}

/**
 * Run the full economy/population tick.
 */
export function tickEconomy(
  districts: District[],
  metrics: CityMetrics,
  budget: Budget,
  activeEffects: ActiveEffect[]
): { moves: { from: DistrictId; to: DistrictId; count: number }[]; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // 1. Apply active policy effects
  applyActiveEffects(activeEffects, districts, metrics);

  // 2. Update happiness for each district
  for (const d of districts) {
    d.metrics.happiness = calculateHappiness(d);
  }

  // 3. Update job access
  for (const d of districts) {
    d.metrics.jobAccessScore = calculateJobAccess(d, districts, metrics.jobsTotal);
  }

  // 4. Population growth
  applyPopulationGrowth(districts);

  // 5. Migration
  const moves = simulateMigration(districts);

  // 6. Update city metrics
  updateCityMetrics(districts, metrics);

  // 7. Budget
  events.push(...updateBudget(budget, districts, activeEffects));

  return { moves, events };
}
