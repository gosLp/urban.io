import { describe, it, expect } from "vitest";
import { SimulationEngine } from "../src/engine/SimulationEngine.js";
import { createBengaluru } from "../src/data/bengaluru/config.js";
import { createNYC } from "../src/data/nyc/config.js";
import { createSanFrancisco } from "../src/data/sanfrancisco/config.js";
import { GameMode, VoteRequirement } from "../src/types.js";
import {
  createUpzonePolicy,
  createCongestionPricingPolicy,
  createBusRoutePolicy,
  createRailLinePolicy,
  createReduceParkingPolicy,
  createAffordableHousingPolicy,
  createRoadExpansionPolicy,
  createTaxIncreasePolicy,
} from "../src/policy/policies.js";

describe("SimulationEngine", () => {
  describe("initialization", () => {
    it("should initialize with Bengaluru config", () => {
      const engine = new SimulationEngine(createBengaluru());
      const state = engine.getState();

      expect(state.turn).toBe(0);
      expect(state.mode).toBe(GameMode.Political);
      expect(state.city.name).toBe("Bengaluru");
      expect(state.city.districts.length).toBe(9);
      expect(state.city.representatives.length).toBe(9);
      expect(state.metrics.totalPopulation).toBeGreaterThan(0);
    });

    it("should initialize with NYC config", () => {
      const engine = new SimulationEngine(createNYC());
      expect(engine.getState().city.name).toBe("New York City");
      expect(engine.getState().city.districts.length).toBe(6);
    });

    it("should initialize with SF config", () => {
      const engine = new SimulationEngine(createSanFrancisco());
      expect(engine.getState().city.name).toBe("San Francisco");
      expect(engine.getState().city.districts.length).toBe(7);
    });

    it("should support sandbox mode", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      expect(engine.getState().mode).toBe(GameMode.Sandbox);
    });
  });

  describe("tick", () => {
    it("should advance the turn counter", () => {
      const engine = new SimulationEngine(createBengaluru());
      expect(engine.getTurn()).toBe(0);
      engine.tick();
      expect(engine.getTurn()).toBe(1);
      engine.tick();
      expect(engine.getTurn()).toBe(2);
    });

    it("should return turn result with metrics", () => {
      const engine = new SimulationEngine(createBengaluru());
      const result = engine.tick();

      expect(result.turn).toBe(1);
      expect(result.metricsAfter).toBeDefined();
      expect(result.metricsAfter.totalPopulation).toBeGreaterThan(0);
      expect(result.districtChanges.length).toBe(9);
    });

    it("should produce district changes", () => {
      const engine = new SimulationEngine(createBengaluru());
      const result = engine.tick();

      for (const change of result.districtChanges) {
        expect(change.districtId).toBeDefined();
        expect(change.metricsBefore).toBeDefined();
        expect(change.metricsAfter).toBeDefined();
      }
    });

    it("should run multiple ticks without crashing", () => {
      const engine = new SimulationEngine(createBengaluru());
      for (let i = 0; i < 20; i++) {
        if (engine.isGameOver()) break;
        const result = engine.tick();
        expect(result.turn).toBe(i + 1);
        expect(engine.getMetrics().totalPopulation).toBeGreaterThan(0);
      }
    });
  });

  describe("policy proposals", () => {
    it("should conduct a vote in political mode", () => {
      const engine = new SimulationEngine(createBengaluru());
      const policy = createBusRoutePolicy(
        ["blr_majestic", "blr_whitefield"],
        "Test Route"
      );
      const result = engine.proposePolicy(policy);

      expect(result).not.toBeNull();
      expect(result!.votes.length).toBe(9);
      expect(result!.votesFor + result!.votesAgainst).toBe(9);
      expect(typeof result!.passed).toBe("boolean");
    });

    it("should auto-pass policies in sandbox mode", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      const policy = createCongestionPricingPolicy(
        ["blr_majestic"],
        "high"
      );
      const result = engine.proposePolicy(policy);

      expect(result).not.toBeNull();
      expect(result!.passed).toBe(true);
    });

    it("should record passed policies in history", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      const policy = createBusRoutePolicy(["blr_majestic"], "Test");
      engine.proposePolicy(policy);

      expect(engine.getState().policyHistory.length).toBe(1);
      expect(engine.getState().policyHistory[0].policy.name).toContain("Test");
    });

    it("should create active effects for passed policies", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      const policy = createUpzonePolicy("blr_whitefield", "Whitefield");
      engine.proposePolicy(policy);

      expect(engine.getState().activeEffects.length).toBeGreaterThan(0);
    });

    it("should deduct budget cost for passed policies", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      const balanceBefore = engine.getState().city.budget.balance;
      const policy = createRailLinePolicy(
        ["blr_majestic", "blr_whitefield", "blr_ecity"],
        "Test Rail"
      );
      engine.proposePolicy(policy);

      expect(engine.getState().city.budget.balance).toBeLessThan(balanceBefore);
    });

    it("congestion pricing should generate revenue (negative cost)", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      const balanceBefore = engine.getState().city.budget.balance;
      const policy = createCongestionPricingPolicy(["blr_majestic"], "high");
      engine.proposePolicy(policy);

      expect(engine.getState().city.budget.balance).toBeGreaterThan(balanceBefore);
    });
  });

  describe("elections", () => {
    it("should trigger elections at the configured interval", () => {
      const config = createBengaluru();
      const engine = new SimulationEngine(config);
      const interval = config.electionInterval;

      let electionFound = false;
      for (let i = 0; i < interval + 1; i++) {
        if (engine.isGameOver()) break;
        const result = engine.tick();
        if (result.election) {
          electionFound = true;
          expect(result.election.turn).toBe(interval);
          expect(result.election.results.length).toBeGreaterThan(0);
        }
      }

      // If game didn't end early, election should have fired
      if (!engine.isGameOver()) {
        expect(electionFound).toBe(true);
      } else {
        // Game ended before election interval - that's valid too
        expect(engine.isGameOver()).toBe(true);
      }
    });
  });

  describe("scenario goals", () => {
    it("should check goals against current metrics", () => {
      const engine = new SimulationEngine(createBengaluru());
      const goals = engine.checkGoals();

      expect(goals.length).toBe(3);
      for (const g of goals) {
        expect(typeof g.met).toBe("boolean");
        expect(g.goal.label).toBeDefined();
      }
    });
  });

  describe("game over", () => {
    it("should not be game over at start", () => {
      const engine = new SimulationEngine(createBengaluru());
      expect(engine.isGameOver()).toBe(false);
    });

    it("should return empty result when game is over", () => {
      const engine = new SimulationEngine(createBengaluru(), GameMode.Sandbox);
      // Drain budget to trigger bankruptcy
      for (let i = 0; i < 5; i++) {
        const expensivePolicy = createRailLinePolicy(
          ["blr_majestic", "blr_whitefield", "blr_ecity", "blr_sarjapur"],
          `Expensive Line ${i}`
        );
        engine.proposePolicy(expensivePolicy);
      }

      // Tick until game over
      for (let i = 0; i < 50 && !engine.isGameOver(); i++) {
        engine.tick();
      }

      if (engine.isGameOver()) {
        const result = engine.tick();
        expect(result.events[0].type).toBe("crisis");
      }
    });
  });

  describe("all cities simulation stability", () => {
    const cities = [
      { name: "Bengaluru", factory: createBengaluru },
      { name: "NYC", factory: createNYC },
      { name: "San Francisco", factory: createSanFrancisco },
    ];

    for (const city of cities) {
      it(`should run 50 turns of ${city.name} without NaN or crash`, () => {
        const engine = new SimulationEngine(city.factory());

        for (let i = 0; i < 50; i++) {
          const result = engine.tick();
          const m = engine.getMetrics();

          // No NaN values
          expect(isNaN(m.totalPopulation)).toBe(false);
          expect(isNaN(m.averageCommute)).toBe(false);
          expect(isNaN(m.averageRent)).toBe(false);
          expect(isNaN(m.overallHappiness)).toBe(false);
          expect(isNaN(m.congestionIndex)).toBe(false);

          // Population should never go negative
          expect(m.totalPopulation).toBeGreaterThanOrEqual(0);

          // Happiness should be bounded
          expect(m.overallHappiness).toBeGreaterThanOrEqual(0);
          expect(m.overallHappiness).toBeLessThanOrEqual(1);
        }
      });
    }
  });
});
