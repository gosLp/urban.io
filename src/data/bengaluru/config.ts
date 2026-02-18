// ============================================================
// Bengaluru City Configuration
// Sprawl, traffic choke points, IT corridors, weak metro,
// zoning fragmentation, water stress
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

export function createBengaluru(): CityConfig {
  // --- Districts ---
  // Bengaluru: 8 districts representing key areas

  const majestic = createDistrict("blr_majestic", "Majestic (City Center)", {
    position: { x: 4, y: 4 },
    population: 180000,
    area: 12,
    maxDensity: 25000,
    zones: {
      [ZoneType.Commercial]: 35,
      [ZoneType.MixedUse]: 25,
      [ZoneType.MidDensityResidential]: 20,
      [ZoneType.HighDensityResidential]: 10,
      [ZoneType.Park]: 5,
      [ZoneType.LowDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_malleshwaram", "blr_indiranagar", "blr_jayanagar", "blr_rajajinagar"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  majestic.metrics.trafficCongestion = 0.8;
  majestic.metrics.averageCommuteMinutes = 45;
  majestic.metrics.rentBurden = 0.35;

  const whitefield = createDistrict("blr_whitefield", "Whitefield (IT Hub East)", {
    position: { x: 8, y: 4 },
    population: 250000,
    area: 25,
    maxDensity: 15000,
    zones: {
      [ZoneType.Commercial]: 40,
      [ZoneType.MidDensityResidential]: 25,
      [ZoneType.LowDensityResidential]: 15,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Park]: 5,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_indiranagar", "blr_sarjapur"],
    hasTransitStation: false,
    parkingMinimum: 2,
  });
  whitefield.metrics.trafficCongestion = 0.9;
  whitefield.metrics.averageCommuteMinutes = 65;
  whitefield.metrics.jobAccessScore = 0.7;
  whitefield.metrics.rentBurden = 0.4;

  const electronicCity = createDistrict("blr_ecity", "Electronic City (IT Hub South)", {
    position: { x: 5, y: 8 },
    population: 200000,
    area: 20,
    maxDensity: 12000,
    zones: {
      [ZoneType.Commercial]: 45,
      [ZoneType.Industrial]: 15,
      [ZoneType.MidDensityResidential]: 20,
      [ZoneType.LowDensityResidential]: 10,
      [ZoneType.Park]: 5,
      [ZoneType.MixedUse]: 5,
    },
    adjacentDistricts: ["blr_jayanagar", "blr_sarjapur", "blr_bannerghatta"],
    hasTransitStation: false,
    parkingMinimum: 2,
  });
  electronicCity.metrics.trafficCongestion = 0.85;
  electronicCity.metrics.averageCommuteMinutes = 70;
  electronicCity.metrics.jobAccessScore = 0.6;

  const indiranagar = createDistrict("blr_indiranagar", "Indiranagar", {
    position: { x: 6, y: 3 },
    population: 120000,
    area: 10,
    maxDensity: 20000,
    zones: {
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.MixedUse]: 25,
      [ZoneType.Commercial]: 20,
      [ZoneType.LowDensityResidential]: 15,
      [ZoneType.Park]: 5,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_majestic", "blr_whitefield", "blr_malleshwaram"],
    hasTransitStation: true,
    parkingMinimum: 1,
  });
  indiranagar.metrics.rentBurden = 0.45;
  indiranagar.metrics.propertyValue = 1.4;

  const jayanagar = createDistrict("blr_jayanagar", "Jayanagar", {
    position: { x: 4, y: 6 },
    population: 150000,
    area: 15,
    maxDensity: 18000,
    zones: {
      [ZoneType.MidDensityResidential]: 35,
      [ZoneType.LowDensityResidential]: 25,
      [ZoneType.Commercial]: 15,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Park]: 10,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_majestic", "blr_ecity", "blr_bannerghatta"],
    hasTransitStation: true,
  });

  const malleshwaram = createDistrict("blr_malleshwaram", "Malleshwaram", {
    position: { x: 3, y: 2 },
    population: 100000,
    area: 12,
    maxDensity: 15000,
    zones: {
      [ZoneType.LowDensityResidential]: 35,
      [ZoneType.MidDensityResidential]: 25,
      [ZoneType.MixedUse]: 15,
      [ZoneType.Commercial]: 10,
      [ZoneType.Park]: 10,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_majestic", "blr_indiranagar", "blr_rajajinagar"],
    hasTransitStation: true,
  });
  malleshwaram.metrics.greenSpaceAccess = 0.6;

  const rajajinagar = createDistrict("blr_rajajinagar", "Rajajinagar", {
    position: { x: 2, y: 4 },
    population: 130000,
    area: 14,
    maxDensity: 14000,
    zones: {
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.LowDensityResidential]: 25,
      [ZoneType.Industrial]: 15,
      [ZoneType.Commercial]: 15,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Park]: 5,
    },
    adjacentDistricts: ["blr_majestic", "blr_malleshwaram"],
  });

  const sarjapur = createDistrict("blr_sarjapur", "Sarjapur Road", {
    position: { x: 7, y: 7 },
    population: 180000,
    area: 22,
    maxDensity: 12000,
    zones: {
      [ZoneType.LowDensityResidential]: 35,
      [ZoneType.MidDensityResidential]: 30,
      [ZoneType.Commercial]: 15,
      [ZoneType.MixedUse]: 10,
      [ZoneType.Park]: 5,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_whitefield", "blr_ecity", "blr_bannerghatta"],
  });
  sarjapur.metrics.trafficCongestion = 0.75;
  sarjapur.metrics.averageCommuteMinutes = 55;

  const bannerghatta = createDistrict("blr_bannerghatta", "Bannerghatta Road", {
    position: { x: 4, y: 8 },
    population: 140000,
    area: 18,
    maxDensity: 10000,
    zones: {
      [ZoneType.LowDensityResidential]: 40,
      [ZoneType.MidDensityResidential]: 25,
      [ZoneType.Park]: 15,
      [ZoneType.Commercial]: 10,
      [ZoneType.MixedUse]: 5,
      [ZoneType.HighDensityResidential]: 5,
    },
    adjacentDistricts: ["blr_jayanagar", "blr_ecity", "blr_sarjapur"],
  });
  bannerghatta.metrics.greenSpaceAccess = 0.7;
  bannerghatta.metrics.trafficCongestion = 0.65;

  const districts = [
    majestic, whitefield, electronicCity, indiranagar,
    jayanagar, malleshwaram, rajajinagar, sarjapur, bannerghatta,
  ];

  // --- Representatives ---
  const representatives = [
    createRepresentative("rep_blr_1", "Cllr. Ramesh Kumar", "blr_majestic",
      PoliticalLeaning.Moderate, [PolicyCategory.Transit, PolicyCategory.Budget, PolicyCategory.Infrastructure]),
    createRepresentative("rep_blr_2", "Cllr. Priya Nair", "blr_whitefield",
      PoliticalLeaning.YIMBY, [PolicyCategory.Transit, PolicyCategory.Zoning, PolicyCategory.Housing]),
    createRepresentative("rep_blr_3", "Cllr. Suresh Reddy", "blr_ecity",
      PoliticalLeaning.Progressive, [PolicyCategory.Transit, PolicyCategory.Housing, PolicyCategory.Infrastructure]),
    createRepresentative("rep_blr_4", "Cllr. Deepa Sharma", "blr_indiranagar",
      PoliticalLeaning.NIMBY, [PolicyCategory.Zoning, PolicyCategory.Infrastructure, PolicyCategory.Budget]),
    createRepresentative("rep_blr_5", "Cllr. Venkatesh Gowda", "blr_jayanagar",
      PoliticalLeaning.Moderate, [PolicyCategory.Housing, PolicyCategory.Transit, PolicyCategory.Budget]),
    createRepresentative("rep_blr_6", "Cllr. Lakshmi Devi", "blr_malleshwaram",
      PoliticalLeaning.Conservative, [PolicyCategory.Budget, PolicyCategory.Infrastructure, PolicyCategory.Zoning]),
    createRepresentative("rep_blr_7", "Cllr. Mohammed Arif", "blr_rajajinagar",
      PoliticalLeaning.Populist, [PolicyCategory.Housing, PolicyCategory.CongestionPricing, PolicyCategory.Transit]),
    createRepresentative("rep_blr_8", "Cllr. Kavitha Murthy", "blr_sarjapur",
      PoliticalLeaning.YIMBY, [PolicyCategory.Transit, PolicyCategory.Zoning, PolicyCategory.Housing]),
    createRepresentative("rep_blr_9", "Cllr. Ravi Shankar", "blr_bannerghatta",
      PoliticalLeaning.NIMBY, [PolicyCategory.Infrastructure, PolicyCategory.Zoning, PolicyCategory.Budget]),
  ];

  // --- Road Network ---
  const roadNetwork = buildRoadNetwork(districts, (a, b) => {
    // Bengaluru roads: generally constrained, IT corridor roads slightly better
    const itDistricts = ["blr_whitefield", "blr_ecity"];
    if (itDistricts.includes(a) || itDistricts.includes(b)) return 4000;
    if (a === "blr_majestic" || b === "blr_majestic") return 6000;
    return 3500;
  });

  // --- Transit Lines (existing, limited metro) ---
  const transitLines = [
    createTransitLine("blr_purple", "Purple Line Metro", TransitType.Rail,
      ["blr_rajajinagar", "blr_majestic", "blr_indiranagar"], 15000, true),
    createTransitLine("blr_green", "Green Line Metro", TransitType.Rail,
      ["blr_malleshwaram", "blr_majestic", "blr_jayanagar"], 12000, true),
    createTransitLine("blr_bus_1", "BMTC Route 1", TransitType.Bus,
      ["blr_majestic", "blr_whitefield"], 5000, true),
    createTransitLine("blr_bus_2", "BMTC Route 2", TransitType.Bus,
      ["blr_majestic", "blr_ecity"], 4000, true),
  ];

  return {
    id: "bengaluru",
    name: "Bengaluru",
    country: "India",
    description: "India's Silicon Valley: sprawling, congested, water-stressed, with IT corridors far from the center and a metro system struggling to catch up with explosive growth.",
    districts,
    representatives,
    transitLines,
    roadNetwork,
    budget: {
      balance: 50000,
      incomePerTurn: 2500,
      expensesPerTurn: 650,
      taxRate: 0.15,
      transitSubsidy: 0.3,
    },
    initialMetrics: {
      totalPopulation: districts.reduce((s, d) => s + d.population, 0),
      averageCommute: 50,
      averageRent: 1200,
      overallHappiness: 0.42,
      congestionIndex: 0.75,
      transitRidership: 32000,
      budgetHealth: 0.55,
      housingSupply: 500000,
      housingDemand: 620000,
      jobsTotal: 450000,
      economicOutput: 85000,
    },
    electionInterval: 20,
    scenarioGoals: [
      { metric: "averageCommute", target: 35, comparison: "below", label: "Average commute under 35 minutes" },
      { metric: "overallHappiness", target: 0.6, comparison: "above", label: "Overall happiness above 60%" },
      { metric: "congestionIndex", target: 0.5, comparison: "below", label: "Congestion index below 0.5" },
    ],
  };
}
