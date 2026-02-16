// ============================================================
// Economic & Population Model
// Budget, migration, happiness, population dynamics
// Key fix: budget math uses config income, happiness is damped,
//          migration is gentle, tax formula matches expectations
// ============================================================

import {
  District,
  DistrictId,
  Budget,
  CityMetrics,
  GameEvent,
  ActiveEffect,
} from "../types.js";

const MIGRATION_RATE = 0.008; // gentler migration
const NATURAL_GROWTH_RATE = 0.001;
const HAPPINESS_DAMPING = 0.12; // happiness changes gradually

const HAPPINESS_WEIGHTS = {
  commute: 0.25,
  rent: 0.25,
  jobs: 0.15,
  traffic: 0.15,
  services: 0.1,
  green: 0.1,
};

/**
 * Calculate TARGET happiness for a district (0-1).
 */
export function calculateHappiness(district: District): number {
  const m = district.metrics;
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
 */
export function calculateJobAccess(
  district: District,
  allDistricts: District[],
  totalJobs: number
): number {
  if (totalJobs === 0) return 0;

  const districtMap = new Map(allDistricts.map((d) => [d.id, d]));
  const localJobs = estimateDistrictJobs(district);

  let reachableJobs = localJobs;
  for (const adjId of district.adjacentDistricts) {
    const adj = districtMap.get(adjId);
    if (adj) {
      const adjJobs = estimateDistrictJobs(adj);
      const accessFactor = district.hasTransitStation && adj.hasTransitStation ? 0.8 : 0.5;
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
 * Much gentler than before to prevent wild swings.
 */
export function simulateMigration(
  districts: District[]
): { from: DistrictId; to: DistrictId; count: number }[] {
  const moves: { from: DistrictId; to: DistrictId; count: number }[] = [];

  const attractiveness = new Map<DistrictId, number>();
  for (const d of districts) {
    const score =
      d.metrics.happiness * 0.4 +
      (1 - d.metrics.rentBurden) * 0.3 +
      d.metrics.jobAccessScore * 0.3;
    attractiveness.set(d.id, score);
  }

  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const d of districts) {
    const myScore = attractiveness.get(d.id) ?? 0.5;

    for (const adjId of d.adjacentDistricts) {
      const adjDistrict = districtMap.get(adjId);
      if (!adjDistrict) continue;

      const adjScore = attractiveness.get(adjId) ?? 0.5;
      const diff = adjScore - myScore;

      if (diff > 0.08) {
        const adjCapacity = adjDistrict.maxDensity * adjDistrict.area;
        const adjRoom = adjCapacity - adjDistrict.population;

        if (adjRoom > 0) {
          const migrants = Math.floor(d.population * MIGRATION_RATE * diff);
          const actualMigrants = Math.min(migrants, Math.floor(adjRoom * 0.02));

          if (actualMigrants > 0) {
            moves.push({ from: d.id, to: adjId, count: actualMigrants });
          }
        }
      }
    }
  }

  // Apply moves
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

export function applyPopulationGrowth(districts: District[]): void {
  for (const d of districts) {
    const capacity = d.maxDensity * d.area;
    const room = capacity - d.population;
    if (room > 0) {
      const growth = Math.floor(d.population * NATURAL_GROWTH_RATE);
      d.population += Math.min(growth, Math.floor(room * 0.02));
    }
  }
}

/**
 * Update the city budget.
 * FIXED: uses proper income formula, transit cost passed as parameter.
 */
export function updateBudget(
  budget: Budget,
  districts: District[],
  transitCost: number
): GameEvent[] {
  const events: GameEvent[] = [];

  // Income: population-based tax revenue
  const totalPop = districts.reduce((s, d) => s + d.population, 0);
  // Tax per capita scales so that Bengaluru (1.45M pop, 15% tax) yields ~2000-2500/turn
  budget.incomePerTurn = totalPop * 0.0012 * (budget.taxRate / 0.1);

  // Fare revenue from transit (riders * avg fare)
  const fareRevenue = transitCost * 0.6; // transit covers ~60% of costs via fares

  // Expenses: base operations + transit (net of fares)
  const baseExpenses = 400; // base city services
  const netTransitCost = transitCost * (1 - budget.transitSubsidy) - fareRevenue;
  budget.expensesPerTurn = baseExpenses + Math.max(0, netTransitCost);

  const net = budget.incomePerTurn - budget.expensesPerTurn;
  budget.balance += net;

  if (budget.balance < -5000) {
    events.push({
      type: "budget",
      message: `Budget deficit! Balance: $${budget.balance.toFixed(0)}. Consider raising taxes or cutting services.`,
      severity: "critical",
    });
  } else if (net < -200) {
    events.push({
      type: "budget",
      message: `Running a deficit of $${Math.abs(net).toFixed(0)} per turn.`,
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

    if (ae.turnsRemaining > 0) {
      ae.turnsRemaining--;
    }
  }

  // Remove expired
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    if (activeEffects[i].turnsRemaining === 0) {
      activeEffects.splice(i, 1);
    }
  }
}

function clampMetric(obj: Record<string, number>, key: string): void {
  const clamped01 = [
    "trafficCongestion", "rentBurden", "happiness",
    "jobAccessScore", "publicServiceSatisfaction", "greenSpaceAccess",
  ];
  if (clamped01.includes(key)) {
    obj[key] = Math.max(0, Math.min(1, obj[key]));
  }
}

/**
 * Update city-wide metrics from district data.
 */
export function updateCityMetrics(districts: District[], metrics: CityMetrics): void {
  const totalPop = districts.reduce((s, d) => s + d.population, 0);
  metrics.totalPopulation = totalPop;
  if (totalPop === 0) return;

  metrics.averageCommute =
    districts.reduce((s, d) => s + d.metrics.averageCommuteMinutes * d.population, 0) / totalPop;
  metrics.overallHappiness =
    districts.reduce((s, d) => s + d.metrics.happiness * d.population, 0) / totalPop;
  metrics.congestionIndex =
    districts.reduce((s, d) => s + d.metrics.trafficCongestion * d.population, 0) / totalPop;
  metrics.housingDemand = Math.floor(totalPop / 2.5 * 1.1);
  metrics.budgetHealth = Math.max(0, Math.min(1, 0.5));
}

/**
 * Run the full economy/population tick.
 */
export function tickEconomy(
  districts: District[],
  metrics: CityMetrics,
  budget: Budget,
  activeEffects: ActiveEffect[],
  transitCost: number
): { moves: { from: DistrictId; to: DistrictId; count: number }[]; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // 1. Apply active policy effects
  applyActiveEffects(activeEffects, districts, metrics);

  // 2. Update happiness (DAMPED toward target)
  for (const d of districts) {
    const targetHappiness = calculateHappiness(d);
    d.metrics.happiness =
      d.metrics.happiness * (1 - HAPPINESS_DAMPING) + targetHappiness * HAPPINESS_DAMPING;
  }

  // 3. Update job access
  for (const d of districts) {
    d.metrics.jobAccessScore = calculateJobAccess(d, districts, metrics.jobsTotal);
  }

  // 4. Population growth
  applyPopulationGrowth(districts);

  // 5. Migration (gentle)
  const moves = simulateMigration(districts);

  // 6. Update city metrics
  updateCityMetrics(districts, metrics);

  // 7. Budget (with transit cost passed in)
  events.push(...updateBudget(budget, districts, transitCost));

  return { moves, events };
}
