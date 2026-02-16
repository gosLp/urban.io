// ============================================================
// New York City Configuration
// Dense core, borough politics, rent pressure, aging transit,
// NIMBY districts, public housing
// ============================================================

import {
  CityConfig,
  ZoneType,
  PoliticalLeaning,
  PolicyCategory,
  TransitType,
} from "../../types.js";
import {
  createDistrict,
  createRepresentative,
  buildRoadNetwork,
  createTransitLine,
} from "../../city/helpers.js";

export function createNYC(): CityConfig {
  // --- Districts (boroughs + key neighborhoods) ---

  const manhattan = createDistrict("nyc_manhattan", "Manhattan", {
    position: { x: 5, y: 3 },
    population: 1600000,
    area: 60,
    maxDensity: 30000,
    zones: {
      [ZoneType.HighDensityResidential]: 25,
      [ZoneType.Commercial]: 30,
      [ZoneType.MixedUse]: 20,
      [ZoneType.MidDensityResidential]: 10,
      [ZoneType.TransitOriented]: 10,
      [ZoneType.Park]: 5,
    },
    adjacentDistricts: ["nyc_brooklyn", "nyc_queens", "nyc_bronx", "nyc_upperwest"],
    hasTransitStation: true,
    parkingMinimum: 0,
  });
  manhattan.metrics.trafficCongestion = 0.7;
  manhattan.metrics.averageCommuteMinutes = 35;
  manhattan.metrics.rentBurden = 0.55;
  manhattan.metrics.jobAccessScore = 0.9;
  manhattan.metrics.propertyValue = 2.5;

  const brooklyn = createDistrict("nyc_brooklyn", "Brooklyn", {
    position: { x: 6, y: 5 },
    population: 2600000,
    area: 180,
    maxDensity: 18000,
    zones: {
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.HighDensityResidential]: 15,
      [ZoneType.MixedUse]: 15,
      [ZoneType.Commercial]: 15,
      [ZoneType.LowDensityResidential]: 10,
      [ZoneType.Industrial]: 10,
      [ZoneType.Park]: 5,
    },
    adjacentDistricts: ["nyc_manhattan", "nyc_queens", "nyc_statenisland"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  brooklyn.metrics.rentBurden = 0.48;
  brooklyn.metrics.trafficCongestion = 0.55;
  brooklyn.metrics.averageCommuteMinutes = 42;

  const queens = createDistrict("nyc_queens", "Queens", {
    position: { x: 7, y: 3 },
    population: 2300000,
    area: 280,
    maxDensity: 12000,
    zones: {
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.LowDensityResidential]: 25,
      [ZoneType.Commercial]: 15,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Industrial]: 10,
      [ZoneType.Park]: 5,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["nyc_manhattan", "nyc_brooklyn", "nyc_bronx"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  queens.metrics.averageCommuteMinutes = 48;
  queens.metrics.trafficCongestion = 0.5;

  const bronx = createDistrict("nyc_bronx", "The Bronx", {
    position: { x: 5, y: 1 },
    population: 1400000,
    area: 110,
    maxDensity: 15000,
    zones: {
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.HighDensityResidential]: 15,
      [ZoneType.LowDensityResidential]: 15,
      [ZoneType.Industrial]: 15,
      [ZoneType.Commercial]: 10,
      [ZoneType.Park]: 10,
      [ZoneType.MixedUse]: 5,
    },
    adjacentDistricts: ["nyc_manhattan", "nyc_queens", "nyc_upperwest"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  bronx.metrics.rentBurden = 0.42;
  bronx.metrics.publicServiceSatisfaction = 0.35;
  bronx.metrics.crimeRate = 0.4;

  const statenIsland = createDistrict("nyc_statenisland", "Staten Island", {
    position: { x: 3, y: 6 },
    population: 475000,
    area: 150,
    maxDensity: 5000,
    zones: {
      [ZoneType.LowDensityResidential]: 50,
      [ZoneType.MidDensityResidential]: 15,
      [ZoneType.Commercial]: 10,
      [ZoneType.Park]: 15,
      [ZoneType.Industrial]: 5,
      [ZoneType.MixedUse]: 5,
    },
    adjacentDistricts: ["nyc_brooklyn"],
    parkingMinimum: 2,
  });
  statenIsland.metrics.averageCommuteMinutes = 55;
  statenIsland.metrics.trafficCongestion = 0.4;
  statenIsland.metrics.greenSpaceAccess = 0.7;

  const upperWest = createDistrict("nyc_upperwest", "Upper West Side / Harlem", {
    position: { x: 4, y: 2 },
    population: 400000,
    area: 20,
    maxDensity: 25000,
    zones: {
      [ZoneType.HighDensityResidential]: 30,
      [ZoneType.MidDensityResidential]: 25,
      [ZoneType.MixedUse]: 15,
      [ZoneType.Commercial]: 10,
      [ZoneType.Park]: 15,
      [ZoneType.LowDensityResidential]: 5,
    },
    adjacentDistricts: ["nyc_manhattan", "nyc_bronx"],
    hasTransitStation: true,
    parkingMinimum: 0,
  });
  upperWest.metrics.rentBurden = 0.5;
  upperWest.metrics.greenSpaceAccess = 0.7; // Central Park adjacent

  const districts = [manhattan, brooklyn, queens, bronx, statenIsland, upperWest];

  // --- Representatives ---
  const representatives = [
    createRepresentative("rep_nyc_1", "Cllr. Maria Santos", "nyc_manhattan",
      PoliticalLeaning.Progressive, [PolicyCategory.CongestionPricing, PolicyCategory.Transit, PolicyCategory.Housing]),
    createRepresentative("rep_nyc_2", "Cllr. DeShawn Williams", "nyc_brooklyn",
      PoliticalLeaning.YIMBY, [PolicyCategory.Housing, PolicyCategory.Zoning, PolicyCategory.Transit]),
    createRepresentative("rep_nyc_3", "Cllr. Wei Chen", "nyc_queens",
      PoliticalLeaning.Moderate, [PolicyCategory.Transit, PolicyCategory.Housing, PolicyCategory.Budget]),
    createRepresentative("rep_nyc_4", "Cllr. Carmen Diaz", "nyc_bronx",
      PoliticalLeaning.Populist, [PolicyCategory.Housing, PolicyCategory.Infrastructure, PolicyCategory.Taxation]),
    createRepresentative("rep_nyc_5", "Cllr. Michael O'Brien", "nyc_statenisland",
      PoliticalLeaning.NIMBY, [PolicyCategory.Infrastructure, PolicyCategory.Zoning, PolicyCategory.Budget]),
    createRepresentative("rep_nyc_6", "Cllr. Aisha Johnson", "nyc_upperwest",
      PoliticalLeaning.Progressive, [PolicyCategory.Housing, PolicyCategory.Transit, PolicyCategory.CongestionPricing]),
  ];

  // --- Road Network ---
  const roadNetwork = buildRoadNetwork(districts, (a, b) => {
    // Bridge/tunnel connections are bottlenecks
    if (a === "nyc_statenisland" || b === "nyc_statenisland") return 3000;
    if ((a === "nyc_manhattan" && b === "nyc_brooklyn") ||
        (b === "nyc_manhattan" && a === "nyc_brooklyn")) return 8000;
    if (a === "nyc_manhattan" || b === "nyc_manhattan") return 10000;
    return 6000;
  });

  // --- Transit Lines (extensive subway + buses) ---
  const transitLines = [
    createTransitLine("nyc_subway_1", "Subway Line 1/2/3", TransitType.Rail,
      ["nyc_bronx", "nyc_upperwest", "nyc_manhattan", "nyc_brooklyn"], 50000, true),
    createTransitLine("nyc_subway_7", "Subway Line 7", TransitType.Rail,
      ["nyc_manhattan", "nyc_queens"], 30000, true),
    createTransitLine("nyc_subway_4", "Subway Line 4/5", TransitType.Rail,
      ["nyc_bronx", "nyc_manhattan", "nyc_brooklyn"], 40000, true),
    createTransitLine("nyc_bus_bk", "Brooklyn Bus Network", TransitType.Bus,
      ["nyc_brooklyn", "nyc_manhattan"], 20000, true),
    createTransitLine("nyc_bus_qn", "Queens Bus Network", TransitType.Bus,
      ["nyc_queens", "nyc_manhattan"], 15000, true),
    createTransitLine("nyc_ferry_si", "Staten Island Ferry", TransitType.Bus, // treated as bus-class
      ["nyc_statenisland", "nyc_manhattan"], 5000, true),
  ];

  return {
    id: "nyc",
    name: "New York City",
    country: "United States",
    description: "America's densest city: transit-heavy but aging, rent-crushed, politically fragmented across boroughs, with massive public housing and NIMBY resistance to change.",
    districts,
    representatives,
    transitLines,
    roadNetwork,
    budget: {
      balance: 15000,
      incomePerTurn: 3500,
      expensesPerTurn: 3200,
      taxRate: 0.15,
      transitSubsidy: 0.5,
    },
    initialMetrics: {
      totalPopulation: districts.reduce((s, d) => s + d.population, 0),
      averageCommute: 42,
      averageRent: 2800,
      overallHappiness: 0.45,
      congestionIndex: 0.55,
      transitRidership: 160000,
      budgetHealth: 0.5,
      housingSupply: 3400000,
      housingDemand: 3800000,
      jobsTotal: 4200000,
      economicOutput: 750000,
    },
    electionInterval: 6,
    scenarioGoals: [
      { metric: "averageRent", target: 2200, comparison: "below", label: "Average rent below $2,200" },
      { metric: "overallHappiness", target: 0.6, comparison: "above", label: "Overall happiness above 60%" },
      { metric: "transitRidership", target: 200000, comparison: "above", label: "Transit ridership above 200k" },
    ],
  };
}
