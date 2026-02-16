import { describe, it, expect } from "vitest";
import {
  conductVote,
  determineVote,
  updateApproval,
  runElection,
} from "../src/systems/politics.js";
import {
  PoliticalLeaning,
  PolicyCategory,
  VoteRequirement,
  PolicyProposal,
  Representative,
  District,
  ZoneType,
} from "../src/types.js";
import { createDistrict, createRepresentative } from "../src/city/helpers.js";

function makeTestDistrict(id: string, overrides: Partial<District> = {}): District {
  const d = createDistrict(id, `Test ${id}`, {
    position: { x: 0, y: 0 },
    population: 50000,
    area: 10,
    maxDensity: 10000,
    zones: {
      [ZoneType.MidDensityResidential]: 40,
      [ZoneType.Commercial]: 20,
      [ZoneType.MixedUse]: 20,
      [ZoneType.LowDensityResidential]: 10,
      [ZoneType.Park]: 10,
    },
    adjacentDistricts: [],
  });
  return { ...d, ...overrides };
}

function makeTestPolicy(overrides: Partial<PolicyProposal> = {}): PolicyProposal {
  return {
    id: "test_policy",
    name: "Test Policy",
    description: "A test policy",
    category: PolicyCategory.Transit,
    voteRequirement: VoteRequirement.SimpleMajority,
    cost: 100,
    targetDistricts: "all",
    politicalCost: 0.3,
    effects: [],
    ...overrides,
  };
}

describe("Political System", () => {
  describe("determineVote", () => {
    it("YIMBY reps should support zoning changes", () => {
      const rep = createRepresentative("r1", "Test Rep", "d1",
        PoliticalLeaning.YIMBY, [PolicyCategory.Zoning]);
      const district = makeTestDistrict("d1");
      const policy = makeTestPolicy({ category: PolicyCategory.Zoning });

      const { votesYes } = determineVote(rep, policy, district);
      expect(votesYes).toBe(true);
    });

    it("NIMBY reps should oppose zoning changes", () => {
      const rep = createRepresentative("r1", "Test Rep", "d1",
        PoliticalLeaning.NIMBY, [PolicyCategory.Infrastructure]);
      const district = makeTestDistrict("d1");
      const policy = makeTestPolicy({ category: PolicyCategory.Zoning });

      const { votesYes } = determineVote(rep, policy, district);
      expect(votesYes).toBe(false);
    });

    it("progressive reps should support transit", () => {
      const rep = createRepresentative("r1", "Test Rep", "d1",
        PoliticalLeaning.Progressive, [PolicyCategory.Transit]);
      const district = makeTestDistrict("d1");
      const policy = makeTestPolicy({ category: PolicyCategory.Transit });

      const { votesYes } = determineVote(rep, policy, district);
      expect(votesYes).toBe(true);
    });

    it("reps at high re-election risk should avoid controversial votes", () => {
      const rep = createRepresentative("r1", "Test Rep", "d1",
        PoliticalLeaning.Moderate, [PolicyCategory.Budget]);
      rep.reElectionRisk = 0.8;
      const district = makeTestDistrict("d1");
      const policy = makeTestPolicy({ politicalCost: 0.9 });

      const { votesYes, reason } = determineVote(rep, policy, district);
      expect(reason).toContain("risky");
    });
  });

  describe("conductVote", () => {
    it("should pass simple majority with >50% support", () => {
      const districts = [
        makeTestDistrict("d1"),
        makeTestDistrict("d2"),
        makeTestDistrict("d3"),
      ];
      // 2 YIMBY + 1 Moderate should pass zoning with simple majority
      const reps = [
        createRepresentative("r1", "Rep 1", "d1", PoliticalLeaning.YIMBY, [PolicyCategory.Zoning]),
        createRepresentative("r2", "Rep 2", "d2", PoliticalLeaning.YIMBY, [PolicyCategory.Zoning]),
        createRepresentative("r3", "Rep 3", "d3", PoliticalLeaning.Moderate, [PolicyCategory.Budget]),
      ];
      const policy = makeTestPolicy({
        category: PolicyCategory.Zoning,
        voteRequirement: VoteRequirement.SimpleMajority,
      });

      const result = conductVote(policy, reps, districts);
      expect(result.votesFor).toBeGreaterThanOrEqual(2);
      expect(result.passed).toBe(true);
    });

    it("supermajority should require 2/3 votes", () => {
      const districts = Array.from({ length: 3 }, (_, i) => makeTestDistrict(`d${i}`));
      // 2 out of 3 is exactly 2/3 = passes
      const reps = [
        createRepresentative("r1", "Rep 1", "d0", PoliticalLeaning.YIMBY, [PolicyCategory.Zoning]),
        createRepresentative("r2", "Rep 2", "d1", PoliticalLeaning.YIMBY, [PolicyCategory.Zoning]),
        createRepresentative("r3", "Rep 3", "d2", PoliticalLeaning.NIMBY, [PolicyCategory.Budget]),
      ];
      const policy = makeTestPolicy({
        category: PolicyCategory.Zoning,
        voteRequirement: VoteRequirement.SuperMajority,
      });

      const result = conductVote(policy, reps, districts);
      // With 3 reps, need ceil(3 * 2/3) = 2 votes
      expect(result.required).toBe(VoteRequirement.SuperMajority);
    });

    it("executive order should always pass", () => {
      const districts = [makeTestDistrict("d1")];
      const reps = [
        createRepresentative("r1", "Rep 1", "d1", PoliticalLeaning.NIMBY, [PolicyCategory.Budget]),
      ];
      const policy = makeTestPolicy({
        voteRequirement: VoteRequirement.ExecutiveOrder,
      });

      const result = conductVote(policy, reps, districts);
      expect(result.passed).toBe(true);
    });
  });

  describe("updateApproval", () => {
    it("should increase approval for happy districts", () => {
      const district = makeTestDistrict("d1");
      district.metrics.happiness = 0.8;
      const rep = createRepresentative("r1", "Rep", "d1",
        PoliticalLeaning.Moderate, [PolicyCategory.Budget]);
      rep.approvalRating = 0.5;

      updateApproval([rep], [district]);

      expect(rep.approvalRating).toBeGreaterThan(0.5);
    });

    it("should decrease approval for unhappy districts", () => {
      const district = makeTestDistrict("d1");
      district.metrics.happiness = 0.2;
      const rep = createRepresentative("r1", "Rep", "d1",
        PoliticalLeaning.Moderate, [PolicyCategory.Budget]);
      rep.approvalRating = 0.5;

      updateApproval([rep], [district]);

      expect(rep.approvalRating).toBeLessThan(0.5);
    });
  });

  describe("elections", () => {
    it("should produce election results for all districts", () => {
      const districts = [makeTestDistrict("d1"), makeTestDistrict("d2")];
      const reps = [
        createRepresentative("r1", "Rep 1", "d1", PoliticalLeaning.Moderate, [PolicyCategory.Budget]),
        createRepresentative("r2", "Rep 2", "d2", PoliticalLeaning.Moderate, [PolicyCategory.Budget]),
      ];

      const { result } = runElection(reps, districts, 10);

      expect(result.turn).toBe(10);
      expect(result.results.length).toBe(2);
    });
  });
});
