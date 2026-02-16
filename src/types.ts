// ============================================================
// Core Types for Urban.io Political Simulation Engine
// ============================================================

// --- Identifiers ---
export type DistrictId = string;
export type RepresentativeId = string;
export type PolicyId = string;
export type TransitLineId = string;

// --- Enums ---

export enum ZoneType {
  LowDensityResidential = "low_density_residential",
  MidDensityResidential = "mid_density_residential",
  HighDensityResidential = "high_density_residential",
  MixedUse = "mixed_use",
  Commercial = "commercial",
  Industrial = "industrial",
  TransitOriented = "transit_oriented",
  Park = "park",
}

export enum PoliticalLeaning {
  Progressive = "progressive",
  Moderate = "moderate",
  Conservative = "conservative",
  NIMBY = "nimby",
  YIMBY = "yimby",
  Populist = "populist",
}

export enum VoteRequirement {
  SimpleMajority = "simple_majority", // >50%
  SuperMajority = "super_majority", // >=2/3
  ExecutiveOrder = "executive_order", // No vote needed
  Referendum = "referendum", // All districts vote directly
}

export enum PolicyCategory {
  Zoning = "zoning",
  Transit = "transit",
  CongestionPricing = "congestion_pricing",
  Housing = "housing",
  Budget = "budget",
  Infrastructure = "infrastructure",
  Taxation = "taxation",
}

export enum TransitType {
  Bus = "bus",
  Rail = "rail",
}

export enum GameMode {
  Political = "political",
  Sandbox = "sandbox",
}

export enum ElectionOutcome {
  Retained = "retained",
  Replaced = "replaced",
}

// --- Core Data Structures ---

export interface Position {
  x: number;
  y: number;
}

export interface District {
  id: DistrictId;
  name: string;
  position: Position;
  population: number;
  area: number; // sq km
  zones: ZoneAllocation;
  maxDensity: number; // people per sq km cap
  currentDensity: number; // computed
  metrics: DistrictMetrics;
  adjacentDistricts: DistrictId[];
  hasTransitStation: boolean;
  transitLines: TransitLineId[];
  parkingMinimum: number; // spaces per unit, 0 = no minimum
}

export interface ZoneAllocation {
  [ZoneType.LowDensityResidential]: number; // percentage of area
  [ZoneType.MidDensityResidential]: number;
  [ZoneType.HighDensityResidential]: number;
  [ZoneType.MixedUse]: number;
  [ZoneType.Commercial]: number;
  [ZoneType.Industrial]: number;
  [ZoneType.TransitOriented]: number;
  [ZoneType.Park]: number;
}

export interface DistrictMetrics {
  averageCommuteMinutes: number;
  averageRent: number; // monthly, normalized to city median
  rentBurden: number; // rent as % of income (0-1)
  jobAccessScore: number; // 0-1, how many jobs reachable in 30min
  trafficCongestion: number; // 0-1, 1 = gridlock
  publicServiceSatisfaction: number; // 0-1
  happiness: number; // 0-1 composite
  propertyValue: number; // relative index
  crimeRate: number; // 0-1
  greenSpaceAccess: number; // 0-1
}

export interface Representative {
  id: RepresentativeId;
  name: string;
  districtId: DistrictId;
  leaning: PoliticalLeaning;
  approvalRating: number; // 0-1
  reElectionRisk: number; // 0-1, higher = more at risk
  priorities: PolicyCategory[]; // top 3 issues
  voteHistory: VoteRecord[];
  termNumber: number;
}

export interface VoteRecord {
  policyId: PolicyId;
  turn: number;
  votedYes: boolean;
}

// --- Policy ---

export interface PolicyProposal {
  id: PolicyId;
  name: string;
  description: string;
  category: PolicyCategory;
  voteRequirement: VoteRequirement;
  effects: PolicyEffect[];
  cost: number; // budget impact
  targetDistricts: DistrictId[] | "all";
  politicalCost: number; // how controversial (0-1)
}

export interface PolicyEffect {
  target: PolicyEffectTarget;
  metric: string; // key of DistrictMetrics or city-level metric
  delta: number; // change amount
  delay: number; // turns until effect kicks in
  duration: number; // turns the effect lasts, 0 = permanent
  condition?: string; // optional condition description
}

export type PolicyEffectTarget =
  | { type: "district"; districtId: DistrictId }
  | { type: "districts"; districtIds: DistrictId[] }
  | { type: "city" }
  | { type: "adjacent"; districtId: DistrictId };

// --- Transit ---

export interface TransitLine {
  id: TransitLineId;
  name: string;
  type: TransitType;
  districts: DistrictId[]; // ordered stops
  capacity: number; // passengers per hour
  ridership: number; // current
  operatingCost: number; // per turn
  constructionTurnsRemaining: number; // 0 = operational
  propertyValueBoost: number; // multiplier for adjacent property
}

// --- Infrastructure ---

export interface RoadNetwork {
  /** capacity between district pairs, keyed as "districtA|districtB" */
  capacities: Map<string, number>;
  /** current load between district pairs */
  loads: Map<string, number>;
}

// --- City ---

export interface CityConfig {
  id: string;
  name: string;
  country: string;
  description: string;
  districts: District[];
  representatives: Representative[];
  transitLines: TransitLine[];
  roadNetwork: RoadNetwork;
  budget: Budget;
  initialMetrics: CityMetrics;
  electionInterval: number; // turns between elections
  scenarioGoals: ScenarioGoal[];
}

export interface Budget {
  balance: number;
  incomePerTurn: number;
  expensesPerTurn: number;
  taxRate: number; // 0-1
  transitSubsidy: number;
}

export interface CityMetrics {
  totalPopulation: number;
  averageCommute: number;
  averageRent: number;
  overallHappiness: number;
  congestionIndex: number; // 0-1
  transitRidership: number;
  budgetHealth: number; // 0-1
  housingSupply: number; // units
  housingDemand: number; // units
  jobsTotal: number;
  economicOutput: number;
}

export interface ScenarioGoal {
  metric: keyof CityMetrics;
  target: number;
  comparison: "above" | "below";
  label: string;
}

// --- Game State ---

export interface GameState {
  city: CityConfig;
  turn: number;
  mode: GameMode;
  metrics: CityMetrics;
  activeEffects: ActiveEffect[];
  policyHistory: PassedPolicy[];
  electionLog: ElectionResult[];
  pendingProposal: PolicyProposal | null;
  lastVoteResult: VoteResult | null;
  gameOver: boolean;
  gameOverReason?: string;
}

export interface ActiveEffect {
  policyId: PolicyId;
  effect: PolicyEffect;
  turnsRemaining: number; // -1 = permanent
  turnsUntilActive: number; // countdown from delay
}

export interface PassedPolicy {
  policy: PolicyProposal;
  turnPassed: number;
  votesFor: number;
  votesAgainst: number;
}

export interface VoteResult {
  policyId: PolicyId;
  votes: { representativeId: RepresentativeId; votedYes: boolean; reason: string }[];
  passed: boolean;
  votesFor: number;
  votesAgainst: number;
  required: VoteRequirement;
}

export interface ElectionResult {
  turn: number;
  results: {
    districtId: DistrictId;
    incumbentId: RepresentativeId;
    outcome: ElectionOutcome;
    newRepresentativeId?: RepresentativeId;
    approvalAtElection: number;
  }[];
}

// --- Turn Result ---

export interface TurnResult {
  turn: number;
  metricsBefor: CityMetrics;
  metricsAfter: CityMetrics;
  districtChanges: {
    districtId: DistrictId;
    metricsBefore: DistrictMetrics;
    metricsAfter: DistrictMetrics;
  }[];
  populationMoves: {
    from: DistrictId;
    to: DistrictId;
    count: number;
  }[];
  events: GameEvent[];
  election?: ElectionResult;
  voteResult?: VoteResult;
}

export interface GameEvent {
  type: "policy_effect" | "election" | "crisis" | "milestone" | "migration" | "budget";
  message: string;
  districtId?: DistrictId;
  severity: "info" | "warning" | "critical";
}

// --- Sandbox Controls ---

export interface SandboxControls {
  densityMultiplier: number; // 0.5 - 3.0
  transitCoverage: number; // 0-1
  roadCapacity: number; // 0.5 - 3.0
  parkingMinimum: number; // 0-3
  taxRate: number; // 0-0.5
  transitSubsidy: number; // 0-1
  congestionPricingEnabled: boolean;
  congestionPriceLevel: number; // 0-1
}
