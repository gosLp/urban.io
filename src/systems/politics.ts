// ============================================================
// Political System
// Representatives, approval, voting, elections, coalitions
// Key fix: weighted voting, not binary hurt/help
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

const HIGH_RISK_THRESHOLD = 0.35;
const APPROVAL_DECAY = 0.008;
const HAPPINESS_APPROVAL_WEIGHT = 0.35;

/**
 * Determine how a representative will vote.
 * Uses WEIGHTED scoring, not binary hurt/help.
 */
export function determineVote(
  rep: Representative,
  proposal: PolicyProposal,
  district: District
): { votesYes: boolean; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const m = district.metrics;
  const targetIncludesDistrict =
    proposal.targetDistricts === "all" ||
    proposal.targetDistricts.includes(district.id);

  // 1. Ideology (moderate influence, 0-3 range)
  const ideologyScore = getIdeologyScore(rep.leaning, proposal);
  score += ideologyScore * 2;
  if (Math.abs(ideologyScore) > 0.3) {
    reasons.push(ideologyScore > 0 ? "aligns with ideology" : "conflicts with ideology");
  }

  // 2. District NEEDS — weighted by urgency, not binary
  // Traffic relief: value policies that reduce congestion if traffic is bad
  if (m.trafficCongestion > 0.5 &&
    (proposal.category === PolicyCategory.Transit ||
     proposal.category === PolicyCategory.CongestionPricing)) {
    const urgency = (m.trafficCongestion - 0.3) * 3; // 0-2.1
    score += urgency;
    if (urgency > 0.5) reasons.push("district needs traffic relief");
  }

  // Rent relief: value housing policies if rent is high
  if (m.rentBurden > 0.35 &&
    (proposal.category === PolicyCategory.Housing ||
     proposal.category === PolicyCategory.Zoning)) {
    const urgency = (m.rentBurden - 0.25) * 2.5; // 0-1.9
    score += urgency;
    if (urgency > 0.5) reasons.push("district needs rent relief");
  }

  // Infrastructure: value if services are poor
  if (m.publicServiceSatisfaction < 0.5 &&
    proposal.category === PolicyCategory.Infrastructure) {
    score += (0.5 - m.publicServiceSatisfaction) * 2;
    reasons.push("district needs better services");
  }

  // 3. Priority alignment — reps care about their top issues
  if (rep.priorities.includes(proposal.category)) {
    score += 1.0;
    reasons.push("priority issue");
  }

  // 4. District targeting
  if (targetIncludesDistrict) {
    score += 0.5; // slight bonus for "my district gets attention"
  } else {
    score -= 0.3; // slight penalty for "spending elsewhere"
  }

  // 5. Budget concern — scaled, not binary
  if (proposal.cost > 0) {
    // More expensive = more resistance, but not a hard block
    const costPenalty = Math.min(1.5, proposal.cost / 2000);
    if (rep.leaning === PoliticalLeaning.Conservative) {
      score -= costPenalty * 1.5;
      if (costPenalty > 0.5) reasons.push("too expensive");
    } else {
      score -= costPenalty * 0.3;
    }
  } else {
    // Revenue-generating policies get a budget bonus
    score += 0.5;
    reasons.push("generates revenue");
  }

  // 6. Political cost & re-election risk — risk-averse when threatened
  if (rep.reElectionRisk > 0.5 && proposal.politicalCost > 0.6) {
    const riskPenalty = rep.reElectionRisk * proposal.politicalCost;
    score -= riskPenalty;
    if (riskPenalty > 0.5) reasons.push("too risky before election");
  }

  // 7. Populist penalty for pricing/taxation (cars = freedom framing)
  if (rep.leaning === PoliticalLeaning.Populist &&
    proposal.category === PolicyCategory.CongestionPricing) {
    score -= 1.5;
    reasons.push("opposes pricing on principle");
  }

  const votesYes = score > 0;
  const reason = reasons.length > 0
    ? reasons.join("; ")
    : votesYes ? "generally supportive" : "not convinced";

  return { votesYes, reason };
}

function getIdeologyScore(leaning: PoliticalLeaning, proposal: PolicyProposal): number {
  const cat = proposal.category;
  switch (leaning) {
    case PoliticalLeaning.Progressive:
      if (cat === PolicyCategory.Housing) return 0.8;
      if (cat === PolicyCategory.Transit) return 0.7;
      if (cat === PolicyCategory.CongestionPricing) return 0.4;
      if (cat === PolicyCategory.Zoning) return 0.3;
      return 0;
    case PoliticalLeaning.Conservative:
      if (cat === PolicyCategory.CongestionPricing) return -0.4;
      if (cat === PolicyCategory.Taxation) return -0.8;
      if (cat === PolicyCategory.Zoning) return -0.3;
      return 0;
    case PoliticalLeaning.NIMBY:
      if (cat === PolicyCategory.Zoning) return -0.9;
      if (cat === PolicyCategory.Housing) return -0.4;
      return 0;
    case PoliticalLeaning.YIMBY:
      if (cat === PolicyCategory.Zoning) return 0.9;
      if (cat === PolicyCategory.Housing) return 0.7;
      if (cat === PolicyCategory.Transit) return 0.5;
      return 0;
    case PoliticalLeaning.Populist:
      if (cat === PolicyCategory.CongestionPricing) return -0.7;
      if (cat === PolicyCategory.Taxation) return -0.5;
      if (cat === PolicyCategory.Housing) return 0.5;
      if (cat === PolicyCategory.Transit) return 0.3;
      return 0;
    case PoliticalLeaning.Moderate:
      return 0.1; // slight positive bias toward doing something
    default:
      return 0;
  }
}

// --- Voting Execution ---

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
    votes.push({ representativeId: rep.id, votedYes: votesYes, reason });
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
      passed = true;
      break;
    case VoteRequirement.Referendum: {
      let popFor = 0, popTotal = 0;
      for (const vote of votes) {
        const rep = representatives.find((r) => r.id === vote.representativeId);
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
  }

  return { policyId: proposal.id, votes, passed, votesFor, votesAgainst, required: proposal.voteRequirement };
}

// --- Approval & Elections ---

export function updateApproval(representatives: Representative[], districts: District[]): void {
  const districtMap = new Map(districts.map((d) => [d.id, d]));
  for (const rep of representatives) {
    const district = districtMap.get(rep.districtId);
    if (!district) continue;
    const happinessEffect = (district.metrics.happiness - 0.5) * HAPPINESS_APPROVAL_WEIGHT;
    rep.approvalRating = Math.max(0, Math.min(1, rep.approvalRating + happinessEffect - APPROVAL_DECAY));
    rep.reElectionRisk = rep.approvalRating < HIGH_RISK_THRESHOLD ? 0.8
      : rep.approvalRating < 0.5 ? 0.5 : 0.2;
  }
}

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

    const loseChance = rep.reElectionRisk;
    const random = seededRandom(turn * 1000 + rep.id.charCodeAt(0));
    const loses = random < loseChance && rep.approvalRating < 0.5;

    if (loses) {
      const newLeaning = determineNewLeaning(district);
      const newRep: Representative = {
        id: `rep_${district.id}_t${turn}`,
        name: `Rep. ${district.name.split("(")[0].trim()} (New)`,
        districtId: district.id,
        leaning: newLeaning,
        approvalRating: 0.55,
        reElectionRisk: 0.2,
        priorities: determinePriorities(district),
        voteHistory: [],
        termNumber: 1,
      };

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
        message: `${district.name}: seat flipped to ${newLeaning.replace("_", " ")}`,
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

  return { result: { turn, results }, events };
}

function determineNewLeaning(district: District): PoliticalLeaning {
  const m = district.metrics;
  if (m.rentBurden > 0.5) return m.trafficCongestion > 0.5 ? PoliticalLeaning.YIMBY : PoliticalLeaning.Progressive;
  if (district.currentDensity < district.maxDensity * 0.3) return PoliticalLeaning.NIMBY;
  if (m.trafficCongestion > 0.7) return PoliticalLeaning.Populist;
  return PoliticalLeaning.Moderate;
}

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

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
