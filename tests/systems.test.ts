import { describe, it, expect } from "vitest";
import {
  calculateZoningCapacity,
  calculateHousingSupply,
  calculateDistrictRent,
  applyZoningChange,
  calculateJobCapacity,
} from "../src/systems/zoning.js";
import {
  calculateRidership,
  isTransitCostEffective,
  createTransitLine,
} from "../src/systems/transit.js";
import {
  calculateHappiness,
  simulateMigration,
  calculateJobAccess,
} from "../src/systems/economy.js";
import {
  roadKey,
  calculateCongestion,
  calculateDistrictCommute,
} from "../src/systems/traffic.js";
import {
  ZoneType,
  TransitType,
  CityMetrics,
  RoadNetwork,
} from "../src/types.js";
import { createDistrict, createTransitLine as helperTransitLine } from "../src/city/helpers.js";

function makeDistrict(id: string, overrides: any = {}) {
  const d = createDistrict(id, `Test ${id}`, {
    position: { x: 0, y: 0 },
    population: overrides.population ?? 50000,
    area: overrides.area ?? 10,
    maxDensity: overrides.maxDensity ?? 15000,
    zones: overrides.zones ?? {
      [ZoneType.MidDensityResidential]: 40,
      [ZoneType.Commercial]: 20,
      [ZoneType.MixedUse]: 20,
      [ZoneType.LowDensityResidential]: 10,
      [ZoneType.Park]: 10,
    },
    adjacentDistricts: overrides.adjacentDistricts ?? [],
    hasTransitStation: overrides.hasTransitStation ?? false,
  });
  if (overrides.currentDensity !== undefined) {
    d.currentDensity = overrides.currentDensity;
  }
  return d;
}

const defaultCityMetrics: CityMetrics = {
  totalPopulation: 500000,
  averageCommute: 35,
  averageRent: 1500,
  overallHappiness: 0.5,
  congestionIndex: 0.5,
  transitRidership: 50000,
  budgetHealth: 0.5,
  housingSupply: 200000,
  housingDemand: 220000,
  jobsTotal: 250000,
  economicOutput: 100000,
};

describe("Zoning System", () => {
  it("should calculate capacity based on zone mix", () => {
    const d = makeDistrict("z1", {
      area: 10,
      maxDensity: 30000,
      zones: {
        [ZoneType.HighDensityResidential]: 50,
        [ZoneType.Commercial]: 30,
        [ZoneType.Park]: 20,
      },
    });

    const capacity = calculateZoningCapacity(d);
    expect(capacity).toBeGreaterThan(0);
  });

  it("higher density zones should yield more capacity", () => {
    const lowDensity = makeDistrict("low", {
      area: 10,
      maxDensity: 30000,
      zones: { [ZoneType.LowDensityResidential]: 100 },
    });
    const highDensity = makeDistrict("high", {
      area: 10,
      maxDensity: 30000,
      zones: { [ZoneType.HighDensityResidential]: 100 },
    });

    expect(calculateZoningCapacity(highDensity)).toBeGreaterThan(
      calculateZoningCapacity(lowDensity)
    );
  });

  it("should enforce zone allocations sum to 100", () => {
    const d = makeDistrict("z1");
    const result = applyZoningChange(d, {
      [ZoneType.HighDensityResidential]: 80,
    });
    // Won't sum to 100 since other zones still have values
    expect(result.success).toBe(false);
    expect(result.error).toContain("100%");
  });

  it("should calculate housing supply from multiple districts", () => {
    const districts = [
      makeDistrict("d1", { population: 50000, area: 10 }),
      makeDistrict("d2", { population: 80000, area: 15 }),
    ];
    const supply = calculateHousingSupply(districts);
    expect(supply).toBeGreaterThan(0);
  });

  it("should calculate job capacity", () => {
    const districts = [makeDistrict("d1")];
    const jobs = calculateJobCapacity(districts);
    expect(jobs).toBeGreaterThan(0);
  });
});

describe("Traffic System", () => {
  it("roadKey should produce consistent keys regardless of order", () => {
    expect(roadKey("a", "b")).toBe(roadKey("b", "a"));
  });

  it("should calculate congestion from load/capacity", () => {
    const road: RoadNetwork = {
      capacities: new Map([["a|b", 1000]]),
      loads: new Map([["a|b", 500]]),
    };
    const congestion = calculateCongestion(road, "a", "b");
    expect(congestion).toBeCloseTo(0.5);
  });

  it("congestion should cap at 1.0", () => {
    const road: RoadNetwork = {
      capacities: new Map([["a|b", 100]]),
      loads: new Map([["a|b", 500]]),
    };
    const congestion = calculateCongestion(road, "a", "b");
    expect(congestion).toBeLessThanOrEqual(1.0);
  });
});

describe("Transit System", () => {
  it("should return 0 ridership for lines under construction", () => {
    const line = createTransitLine(
      "t1", "Test Line", TransitType.Rail, ["d1", "d2"], 10000
    );
    // createTransitLine in transit.ts sets constructionTurnsRemaining > 0 for new lines
    expect(line.constructionTurnsRemaining).toBeGreaterThan(0);

    const districts = [
      makeDistrict("d1", { currentDensity: 10000 }),
      makeDistrict("d2", { currentDensity: 10000 }),
    ];
    const ridership = calculateRidership(line, districts);
    expect(ridership).toBe(0);
  });

  it("operational lines should have ridership based on density", () => {
    const line = helperTransitLine(
      "t1", "Test Line", TransitType.Rail, ["d1", "d2"], 10000, true
    );
    const districts = [
      makeDistrict("d1", { currentDensity: 15000 }),
      makeDistrict("d2", { currentDensity: 15000 }),
    ];
    const ridership = calculateRidership(line, districts);
    expect(ridership).toBeGreaterThan(0);
  });

  it("should assess cost effectiveness", () => {
    const line = helperTransitLine(
      "t1", "Test", TransitType.Bus, ["d1"], 5000, true
    );
    line.ridership = 3000;
    const { costEffective, revenueRatio } = isTransitCostEffective(line);
    expect(typeof costEffective).toBe("boolean");
    expect(revenueRatio).toBeGreaterThan(0);
  });
});

describe("Economy System", () => {
  it("should calculate happiness between 0 and 1", () => {
    const d = makeDistrict("d1");
    d.metrics.averageCommuteMinutes = 30;
    d.metrics.rentBurden = 0.3;
    d.metrics.jobAccessScore = 0.6;
    d.metrics.trafficCongestion = 0.4;
    d.metrics.publicServiceSatisfaction = 0.5;
    d.metrics.greenSpaceAccess = 0.5;

    const happiness = calculateHappiness(d);
    expect(happiness).toBeGreaterThanOrEqual(0);
    expect(happiness).toBeLessThanOrEqual(1);
  });

  it("better conditions should yield higher happiness", () => {
    const good = makeDistrict("good");
    good.metrics.averageCommuteMinutes = 15;
    good.metrics.rentBurden = 0.2;
    good.metrics.jobAccessScore = 0.9;
    good.metrics.trafficCongestion = 0.1;
    good.metrics.publicServiceSatisfaction = 0.8;
    good.metrics.greenSpaceAccess = 0.8;

    const bad = makeDistrict("bad");
    bad.metrics.averageCommuteMinutes = 60;
    bad.metrics.rentBurden = 0.7;
    bad.metrics.jobAccessScore = 0.2;
    bad.metrics.trafficCongestion = 0.9;
    bad.metrics.publicServiceSatisfaction = 0.2;
    bad.metrics.greenSpaceAccess = 0.1;

    expect(calculateHappiness(good)).toBeGreaterThan(calculateHappiness(bad));
  });

  it("should simulate migration toward more attractive districts", () => {
    const happy = makeDistrict("happy", {
      population: 30000,
      area: 10,
      maxDensity: 10000,
      adjacentDistricts: ["sad"],
    });
    happy.metrics.happiness = 0.9;
    happy.metrics.rentBurden = 0.2;
    happy.metrics.jobAccessScore = 0.8;

    const sad = makeDistrict("sad", {
      population: 50000,
      area: 10,
      maxDensity: 10000,
      adjacentDistricts: ["happy"],
    });
    sad.metrics.happiness = 0.2;
    sad.metrics.rentBurden = 0.6;
    sad.metrics.jobAccessScore = 0.3;

    const moves = simulateMigration([happy, sad]);

    // People should move from sad to happy
    const sadToHappy = moves.find((m) => m.from === "sad" && m.to === "happy");
    expect(sadToHappy).toBeDefined();
    if (sadToHappy) {
      expect(sadToHappy.count).toBeGreaterThan(0);
    }
  });
});
