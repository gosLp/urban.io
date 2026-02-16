// ============================================================
// San Francisco City Configuration
// Extremely constrained zoning, sky-high rents, tech jobs,
// transit underexpanded, politically polarized
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

export function createSanFrancisco(): CityConfig {
  // --- Districts ---

  const soma = createDistrict("sf_soma", "SoMa / Financial District", {
    position: { x: 4, y: 4 },
    population: 80000,
    area: 8,
    maxDensity: 30000,
    zones: {
      [ZoneType.Commercial]: 35,
      [ZoneType.HighDensityResidential]: 20,
      [ZoneType.MixedUse]: 20,
      [ZoneType.TransitOriented]: 15,
      [ZoneType.MidDensityResidential]: 5,
      [ZoneType.Park]: 5,
    },
    adjacentDistricts: ["sf_mission", "sf_marina", "sf_tenderloin", "sf_castro"],
    hasTransitStation: true,
    parkingMinimum: 0,
  });
  soma.metrics.jobAccessScore = 0.9;
  soma.metrics.rentBurden = 0.5;
  soma.metrics.propertyValue = 2.8;
  soma.metrics.trafficCongestion = 0.6;

  const mission = createDistrict("sf_mission", "The Mission", {
    position: { x: 5, y: 5 },
    population: 60000,
    area: 6,
    maxDensity: 22000,
    zones: {
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.MixedUse]: 25,
      [ZoneType.Commercial]: 15,
      [ZoneType.LowDensityResidential]: 15,
      [ZoneType.HighDensityResidential]: 10,
      [ZoneType.Park]: 5,
    },
    adjacentDistricts: ["sf_soma", "sf_castro", "sf_bayview"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  mission.metrics.rentBurden = 0.55;
  mission.metrics.averageCommuteMinutes = 30;
  mission.metrics.propertyValue = 2.0;

  const marina = createDistrict("sf_marina", "Marina / Pacific Heights", {
    position: { x: 3, y: 2 },
    population: 45000,
    area: 8,
    maxDensity: 12000,
    zones: {
      [ZoneType.LowDensityResidential]: 40,
      [ZoneType.MidDensityResidential]: 25,
      [ZoneType.Commercial]: 10,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Park]: 15,
    },
    adjacentDistricts: ["sf_soma", "sf_richmond", "sf_tenderloin"],
    parkingMinimum: 1,
  });
  marina.metrics.rentBurden = 0.45;
  marina.metrics.propertyValue = 2.3;
  marina.metrics.greenSpaceAccess = 0.7;

  const richmond = createDistrict("sf_richmond", "Richmond / Sunset", {
    position: { x: 1, y: 3 },
    population: 120000,
    area: 20,
    maxDensity: 8000,
    zones: {
      [ZoneType.LowDensityResidential]: 50,
      [ZoneType.MidDensityResidential]: 20,
      [ZoneType.Commercial]: 10,
      [ZoneType.Park]: 15,
      [ZoneType.MixedUse]: 5,
    },
    adjacentDistricts: ["sf_marina", "sf_tenderloin"],
    parkingMinimum: 2,
  });
  richmond.metrics.averageCommuteMinutes = 45;
  richmond.metrics.trafficCongestion = 0.45;
  richmond.metrics.greenSpaceAccess = 0.65;

  const tenderloin = createDistrict("sf_tenderloin", "Tenderloin / Civic Center", {
    position: { x: 4, y: 3 },
    population: 35000,
    area: 3,
    maxDensity: 25000,
    zones: {
      [ZoneType.HighDensityResidential]: 30,
      [ZoneType.MidDensityResidential]: 20,
      [ZoneType.Commercial]: 20,
      [ZoneType.MixedUse]: 15,
      [ZoneType.TransitOriented]: 10,
      [ZoneType.Park]: 5,
    },
    adjacentDistricts: ["sf_soma", "sf_marina", "sf_richmond", "sf_castro"],
    hasTransitStation: true,
    parkingMinimum: 0,
  });
  tenderloin.metrics.rentBurden = 0.6;
  tenderloin.metrics.crimeRate = 0.6;
  tenderloin.metrics.publicServiceSatisfaction = 0.3;
  tenderloin.metrics.happiness = 0.3;

  const castro = createDistrict("sf_castro", "Castro / Noe Valley", {
    position: { x: 4, y: 6 },
    population: 40000,
    area: 5,
    maxDensity: 15000,
    zones: {
      [ZoneType.LowDensityResidential]: 30,
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.MixedUse]: 20,
      [ZoneType.Commercial]: 10,
      [ZoneType.Park]: 10,
    },
    adjacentDistricts: ["sf_soma", "sf_mission", "sf_tenderloin"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  castro.metrics.rentBurden = 0.5;
  castro.metrics.propertyValue = 2.2;

  const bayview = createDistrict("sf_bayview", "Bayview / Hunter's Point", {
    position: { x: 6, y: 7 },
    population: 40000,
    area: 10,
    maxDensity: 12000,
    zones: {
      [ZoneType.LowDensityResidential]: 25,
      [ZoneType.MidDensityResidential]: 20,
      [ZoneType.Industrial]: 25,
      [ZoneType.Commercial]: 10,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Park]: 10,
    },
    adjacentDistricts: ["sf_mission"],
    parkingMinimum: 1,
  });
  bayview.metrics.publicServiceSatisfaction = 0.35;
  bayview.metrics.averageCommuteMinutes = 40;
  bayview.metrics.crimeRate = 0.45;

  const districts = [soma, mission, marina, richmond, tenderloin, castro, bayview];

  // --- Representatives ---
  const representatives = [
    createRepresentative("rep_sf_1", "Sup. Alex Chen", "sf_soma",
      PoliticalLeaning.YIMBY, [PolicyCategory.Zoning, PolicyCategory.Housing, PolicyCategory.Transit]),
    createRepresentative("rep_sf_2", "Sup. Rosa Gutierrez", "sf_mission",
      PoliticalLeaning.Progressive, [PolicyCategory.Housing, PolicyCategory.Transit, PolicyCategory.Taxation]),
    createRepresentative("rep_sf_3", "Sup. Katherine Blake", "sf_marina",
      PoliticalLeaning.NIMBY, [PolicyCategory.Zoning, PolicyCategory.Budget, PolicyCategory.Infrastructure]),
    createRepresentative("rep_sf_4", "Sup. David Park", "sf_richmond",
      PoliticalLeaning.NIMBY, [PolicyCategory.Zoning, PolicyCategory.Transit, PolicyCategory.Infrastructure]),
    createRepresentative("rep_sf_5", "Sup. James Mitchell", "sf_tenderloin",
      PoliticalLeaning.Progressive, [PolicyCategory.Housing, PolicyCategory.Infrastructure, PolicyCategory.Budget]),
    createRepresentative("rep_sf_6", "Sup. Sarah Kim", "sf_castro",
      PoliticalLeaning.Moderate, [PolicyCategory.Housing, PolicyCategory.Transit, PolicyCategory.Zoning]),
    createRepresentative("rep_sf_7", "Sup. Marcus Thompson", "sf_bayview",
      PoliticalLeaning.Populist, [PolicyCategory.Housing, PolicyCategory.Infrastructure, PolicyCategory.Transit]),
  ];

  // --- Road Network ---
  const roadNetwork = buildRoadNetwork(districts, (a, b) => {
    // SF is geographically constrained, limited road capacity
    if (a === "sf_soma" || b === "sf_soma") return 5000;
    return 3000;
  });

  // --- Transit Lines ---
  const transitLines = [
    createTransitLine("sf_bart", "BART", TransitType.Rail,
      ["sf_richmond", "sf_tenderloin", "sf_soma", "sf_mission", "sf_bayview"], 25000, true),
    createTransitLine("sf_muni_metro", "Muni Metro", TransitType.Rail,
      ["sf_castro", "sf_tenderloin", "sf_soma"], 15000, true),
    createTransitLine("sf_muni_bus", "Muni Bus Network", TransitType.Bus,
      ["sf_marina", "sf_richmond", "sf_tenderloin", "sf_soma", "sf_mission", "sf_castro", "sf_bayview"], 20000, true),
  ];

  return {
    id: "sanfrancisco",
    name: "San Francisco",
    country: "United States",
    description: "A city strangled by its own zoning: sky-high rents, tech wealth alongside homelessness, transit that could work but is underbuilt, and a politically polarized Board of Supervisors where NIMBY vs YIMBY battles define every vote.",
    districts,
    representatives,
    transitLines,
    roadNetwork,
    budget: {
      balance: 8000,
      incomePerTurn: 2000,
      expensesPerTurn: 1800,
      taxRate: 0.13,
      transitSubsidy: 0.4,
    },
    initialMetrics: {
      totalPopulation: districts.reduce((s, d) => s + d.population, 0),
      averageCommute: 38,
      averageRent: 3200,
      overallHappiness: 0.4,
      congestionIndex: 0.5,
      transitRidership: 60000,
      budgetHealth: 0.55,
      housingSupply: 375000,
      housingDemand: 480000,
      jobsTotal: 550000,
      economicOutput: 450000,
    },
    electionInterval: 6,
    scenarioGoals: [
      { metric: "averageRent", target: 2500, comparison: "below", label: "Average rent below $2,500" },
      { metric: "housingSupply", target: 450000, comparison: "above", label: "Housing supply above 450k units" },
      { metric: "overallHappiness", target: 0.55, comparison: "above", label: "Overall happiness above 55%" },
    ],
  };
}
