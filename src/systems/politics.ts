// ============================================================
// Political System
// Representatives, approval, voting, elections, coalitions
// ============================================================

import {
  District,
  DistrictId,
  Representative,
  RepresentativeId,
  PolicyProposal,
  PolicyCategory,
  PoliticalLeaning,
  VoteRequirement,
  VoteResult,
  ElectionResult,
  ElectionOutcome,
  GameEvent,
} from "../types.js";

/** Approval threshold below which rep is at high re-election risk */
const HIGH_RISK_THRESHOLD = 0.35;
/** Approval decay per turn (slight natural erosion) */
const APPROVAL_DECAY = 0.01;
/** How much district happiness affects rep approval */
const HAPPINESS_APPROVAL_WEIGHT = 0.4;
/** How much voting record affects approval */
const VOTE_RECORD_WEIGHT = 0.2;

// --- Voting Logic ---

interface VoteContext {
  districtMetrics: District;
  policyCategory: PolicyCategory;
  policyCost: number;
  politicalCost: number;
  targetIncludesDistrict: boolean;
}

/**
 * Determine how a representative will vote on a policy.
 * Based on: ideology, constituent needs, re-election risk, policy effects.
 */
export function determineVote(
  rep: Representative,
  proposal: PolicyProposal,
  district: District
): { votesYes: boolean; reason: string } {
  let score = 0; // positive = vote yes, negative = vote no
  const reasons: string[] = [];

  const ctx: VoteContext = {
    districtMetrics: district,
    policyCategory: proposal.category,
    policyCost: proposal.cost,
    politicalCost: proposal.politicalCost,
    targetIncludesDistrict:
      proposal.targetDistricts === "all" ||
      proposal.targetDistricts.includes(district.id),
  };

  // 1. Ideological alignment
  const ideologyScore = getIdeologyScore(rep.leaning, proposal);
  score += ideologyScore * 3;
  if (ideologyScore > 0) reasons.push("aligns with ideology");
  if (ideologyScore < 0) reasons.push("conflicts with ideology");

  // 2. Constituent needs - does this help my district?
  const constituentScore = getConstituentScore(ctx, proposal);
  score += constituentScore * 4;
  if (constituentScore > 0) reasons.push("benefits constituents");
  if (constituentScore < 0) reasons.push("hurts constituents");

  // 3. Re-election risk - controversial votes are risky
  if (rep.reElectionRisk > 0.6 && proposal.politicalCost > 0.5) {
    score -= 2;
    reasons.push("too risky before election");
  }

  // 4. Priority alignment - reps care about certain categories
  if (rep.priorities.includes(proposal.category)) {
    score += 1.5;
    reasons.push("priority issue");
  }

  // 5. Budget hawks oppose expensive policies
  if (proposal.cost > 500 && rep.leaning === PoliticalLeaning.Conservative) {
    score -= 1.5;
    reasons.push("too expensive");
  }

  // 6. If district is directly affected positively
  if (ctx.targetIncludesDistrict) {
    // Check if effects are likely positive for the district
    const districtBenefits = proposal.effects.some(
      (e) => e.delta > 0 && ["happiness", "jobAccessScore", "publicServiceSatisfaction"].includes(e.metric)
    );
    const districtHurts = proposal.effects.some(
      (e) => e.delta < 0 && ["happiness", "averageRent"].includes(e.metric)
    );

    if (districtBenefits) score += 2;
    if (districtHurts) score -= 2;
  }

  const votesYes = score > 0;
  const reason = reasons.length > 0
    ? reasons.join("; ")
    : votesYes
    ? "generally supportive"
    : "generally opposed";

  return { votesYes, reason };
}

/**
 * Get ideology alignment score for a policy.
 */
function getIdeologyScore(
  leaning: PoliticalLeaning,
  proposal: PolicyProposal
): number {
  const cat = proposal.category;

  switch (leaning) {
    case PoliticalLeaning.Progressive:
      if (cat === PolicyCategory.Housing) return 1;
      if (cat === PolicyCategory.Transit) return 1;
      if (cat === PolicyCategory.CongestionPricing) return 0.5;
      if (cat === PolicyCategory.Zoning) return 0.5;
      return 0;

    case PoliticalLeaning.Conservative:
      if (cat === PolicyCategory.CongestionPricing) return -0.5;
      if (cat === PolicyCategory.Taxation) return -1;
      if (cat === PolicyCategory.Zoning) return -0.5;
      return 0;

    case PoliticalLeaning.NIMBY:
      if (cat === PolicyCategory.Zoning) return -1; // oppose rezoning
      if (cat === PolicyCategory.Housing) return -0.5;
      return 0;

    case PoliticalLeaning.YIMBY:
      if (cat === PolicyCategory.Zoning) return 1;
      if (cat === PolicyCategory.Housing) return 1;
      if (cat === PolicyCategory.Transit) return 0.5;
      return 0;

    case PoliticalLeaning.Populist:
      if (cat === PolicyCategory.CongestionPricing) return -1;
      if (cat === PolicyCategory.Taxation) return -0.5;
      if (cat === PolicyCategory.Housing) return 0.5;
      return 0;

    case PoliticalLeaning.Moderate:
      return 0; // moderates weigh other factors

    default:
      return 0;
  }
}

/**
 * Score how much a policy helps/hurts a representative's constituents.
 */
function getConstituentScore(
  ctx: VoteContext,
  proposal: PolicyProposal
): number {
  const d = ctx.districtMetrics;
  let score = 0;

  // If district has bad traffic and policy addresses transit/congestion
  if (
    d.metrics.trafficCongestion > 0.6 &&
    (ctx.policyCategory === PolicyCategory.Transit ||
      ctx.policyCategory === PolicyCategory.CongestionPricing)
  ) {
    score += 1;
  }

  // If district has high rent burden and policy addresses housing
  if (
    d.metrics.rentBurden > 0.4 &&
    ctx.policyCategory === PolicyCategory.Housing
  ) {
    score += 1;
  }

  // If policy targets other districts, less incentive
  if (!ctx.targetIncludesDistrict) {
    score -= 0.5;
  }

  // High cost = taxpayer burden
  if (ctx.policyCost > 1000) {
    score -= 0.5;
  }

  return score;
}

// --- Voting Execution ---

/**
 * Run a vote on a policy proposal.
 */
export function conductVote(
  proposal: PolicyProposal,
  representatives: Representative[],
  districts: District[]
): VoteResult {
  const districtMap = new Map(districts.map((d) => [d.id, d]));
  const votes: VoteResult["votes"] = [];

  for (const rep of representatives) {
    const district = districtMap.get(rep.districtId);
    if (!district) continue;

    const { votesYes, reason } = determineVote(rep, proposal, district);
    votes.push({
      representativeId: rep.id,
      votedYes: votesYes,
      reason,
    });
  }

  const votesFor = votes.filter((v) => v.votedYes).length;
  const votesAgainst = votes.length - votesFor;
  const totalVoters = votes.length;

  let passed = false;
  switch (proposal.voteRequirement) {
    case VoteRequirement.SimpleMajority:
      passed = votesFor > totalVoters / 2;
      break;
    case VoteRequirement.SuperMajority:
      passed = votesFor >= Math.ceil((totalVoters * 2) / 3);
      break;
    case VoteRequirement.ExecutiveOrder:
      passed = true; // always passes
      break;
    case VoteRequirement.Referendum:
      // For referendum, weight by district population
      let popFor = 0;
      let popTotal = 0;
      for (const vote of votes) {
        const rep = representatives.find(
          (r) => r.id === vote.representativeId
        );
        if (rep) {
          const d = districtMap.get(rep.districtId);
          if (d) {
            popTotal += d.population;
            if (vote.votedYes) popFor += d.population;
          }
        }
      }
      passed = popFor > popTotal / 2;
      break;
  }

  return {
    policyId: proposal.id,
    votes,
    passed,
    votesFor,
    votesAgainst,
    required: proposal.voteRequirement,
  };
}

// --- Approval & Elections ---

/**
 * Update representative approval ratings based on district conditions.
 */
export function updateApproval(
  representatives: Representative[],
  districts: District[]
): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  for (const rep of representatives) {
    const district = districtMap.get(rep.districtId);
    if (!district) continue;

    // Base: district happiness heavily influences approval
    const happinessEffect =
      (district.metrics.happiness - 0.5) * HAPPINESS_APPROVAL_WEIGHT;

    // Natural decay
    rep.approvalRating = Math.max(
      0,
      Math.min(1, rep.approvalRating + happinessEffect - APPROVAL_DECAY)
    );

    // Update re-election risk
    rep.reElectionRisk = rep.approvalRating < HIGH_RISK_THRESHOLD
      ? 0.8
      : rep.approvalRating < 0.5
      ? 0.5
      : 0.2;
  }
}

/**
 * Run an election cycle.
 * Low-approval reps get replaced.
 */
export function runElection(
  representatives: Representative[],
  districts: District[],
  turn: number
): { result: ElectionResult; events: GameEvent[] } {
  const districtMap = new Map(districts.map((d) => [d.id, d]));
  const events: GameEvent[] = [];
  const results: ElectionResult["results"] = [];

  for (const rep of representatives) {
    const district = districtMap.get(rep.districtId);
    if (!district) continue;

    // Election chance of losing seat based on approval
    const loseChance = rep.reElectionRisk;
    const random = seededRandom(turn * 1000 + rep.id.charCodeAt(0));
    const loses = random < loseChance && rep.approvalRating < 0.5;

    if (loses) {
      // Generate new representative with leaning influenced by district mood
      const newLeaning = determineNewLeaning(district);
      const newRep: Representative = {
        id: `rep_${district.id}_t${turn}`,
        name: `Rep. ${district.name} (New)`,
        districtId: district.id,
        leaning: newLeaning,
        approvalRating: 0.55, // fresh start
        reElectionRisk: 0.2,
        priorities: determinePriorities(district),
        voteHistory: [],
        termNumber: 1,
      };

      // Replace in array
      const idx = representatives.indexOf(rep);
      representatives[idx] = newRep;

      results.push({
        districtId: district.id,
        incumbentId: rep.id,
        outcome: ElectionOutcome.Replaced,
        newRepresentativeId: newRep.id,
        approvalAtElection: rep.approvalRating,
      });

      events.push({
        type: "election",
        message: `${district.name}: ${rep.name} lost seat to ${newRep.name} (${newLeaning})`,
        districtId: district.id,
        severity: "warning",
      });
    } else {
      rep.termNumber++;
      results.push({
        districtId: district.id,
        incumbentId: rep.id,
        outcome: ElectionOutcome.Retained,
        approvalAtElection: rep.approvalRating,
      });
    }
  }

  return {
    result: { turn, results },
    events,
  };
}

/**
 * Determine what political leaning a new representative would have
 * based on district conditions.
 */
function determineNewLeaning(district: District): PoliticalLeaning {
  const m = district.metrics;

  // High rent → progressive/YIMBY
  if (m.rentBurden > 0.5) {
    return m.trafficCongestion > 0.5
      ? PoliticalLeaning.YIMBY
      : PoliticalLeaning.Progressive;
  }

  // Low density, homeowner-heavy → NIMBY
  if (district.currentDensity < district.maxDensity * 0.3) {
    return PoliticalLeaning.NIMBY;
  }

  // High traffic frustration → Populist
  if (m.trafficCongestion > 0.7) {
    return PoliticalLeaning.Populist;
  }

  return PoliticalLeaning.Moderate;
}

/**
 * Determine priority issues for a representative based on district needs.
 */
function determinePriorities(district: District): PolicyCategory[] {
  const m = district.metrics;
  const priorities: { cat: PolicyCategory; urgency: number }[] = [
    { cat: PolicyCategory.Transit, urgency: m.trafficCongestion },
    { cat: PolicyCategory.Housing, urgency: m.rentBurden },
    { cat: PolicyCategory.CongestionPricing, urgency: m.trafficCongestion * 0.8 },
    { cat: PolicyCategory.Zoning, urgency: m.rentBurden * 0.9 },
    { cat: PolicyCategory.Infrastructure, urgency: 1 - m.publicServiceSatisfaction },
    { cat: PolicyCategory.Budget, urgency: 0.3 },
  ];

  priorities.sort((a, b) => b.urgency - a.urgency);
  return priorities.slice(0, 3).map((p) => p.cat);
}

/**
 * Simple seeded random for deterministic election outcomes.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
