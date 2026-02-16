// ============================================================
// Simulation Engine
// Main orchestrator: processes turns, runs systems, tracks state
// ============================================================

import {
  GameState,
  GameMode,
  CityConfig,
  CityMetrics,
  PolicyProposal,
  TurnResult,
  ActiveEffect,
  GameEvent,
  VoteResult,
  SandboxControls,
  VoteRequirement,
  District,
  DistrictMetrics,
  ScenarioGoal,
} from "../types.js";

import { tickTraffic, calculateCityCongestion } from "../systems/traffic.js";
import { tickZoning } from "../systems/zoning.js";
import { tickTransit } from "../systems/transit.js";
import { conductVote, updateApproval, runElection } from "../systems/politics.js";
import { tickEconomy, updateCityMetrics } from "../systems/economy.js";

/** Default base rent used when not specified by city */
const DEFAULT_BASE_RENT = 1500;
/** Default median income */
const DEFAULT_MEDIAN_INCOME = 50000;

export class SimulationEngine {
  private state: GameState;
  private baseRent: number;
  private medianIncome: number;
  private baseExpenses: number;

  constructor(cityConfig: CityConfig, mode: GameMode = GameMode.Political) {
    this.baseRent = DEFAULT_BASE_RENT;
    this.medianIncome = DEFAULT_MEDIAN_INCOME;
    this.baseExpenses = cityConfig.budget.expensesPerTurn;

    this.state = {
      city: structuredClone(cityConfig),
      turn: 0,
      mode,
      metrics: { ...cityConfig.initialMetrics },
      activeEffects: [],
      policyHistory: [],
      electionLog: [],
      pendingProposal: null,
      lastVoteResult: null,
      gameOver: false,
    };

    // Initialize district densities
    for (const d of this.state.city.districts) {
      d.currentDensity = d.area > 0 ? d.population / d.area : 0;
    }
  }

  // --- Public API ---

  /** Get the current game state (read-only snapshot). */
  getState(): Readonly<GameState> {
    return this.state;
  }

  /** Get current city metrics. */
  getMetrics(): Readonly<CityMetrics> {
    return this.state.metrics;
  }

  /** Get all districts. */
  getDistricts(): readonly District[] {
    return this.state.city.districts;
  }

  /** Get current turn number. */
  getTurn(): number {
    return this.state.turn;
  }

  /** Check if game is over. */
  isGameOver(): boolean {
    return this.state.gameOver;
  }

  /**
   * Propose a policy. In Political mode, triggers a vote.
   * In Sandbox mode, auto-applies.
   */
  proposePolicy(proposal: PolicyProposal): VoteResult | null {
    if (this.state.gameOver) return null;

    if (this.state.mode === GameMode.Sandbox) {
      // Sandbox: auto-pass everything
      this.applyPolicy(proposal);
      return {
        policyId: proposal.id,
        votes: [],
        passed: true,
        votesFor: 0,
        votesAgainst: 0,
        required: VoteRequirement.ExecutiveOrder,
      };
    }

    // Political mode: conduct vote
    const result = conductVote(
      proposal,
      this.state.city.representatives,
      this.state.city.districts
    );

    this.state.lastVoteResult = result;

    if (result.passed) {
      this.applyPolicy(proposal);
    }

    // Record vote in representative histories
    for (const vote of result.votes) {
      const rep = this.state.city.representatives.find(
        (r) => r.id === vote.representativeId
      );
      if (rep) {
        rep.voteHistory.push({
          policyId: proposal.id,
          turn: this.state.turn,
          votedYes: vote.votedYes,
        });
      }
    }

    return result;
  }

  /**
   * Advance the simulation by one turn.
   * Runs all systems and returns the result.
   */
  tick(): TurnResult {
    if (this.state.gameOver) {
      return this.emptyTurnResult();
    }

    this.state.turn++;
    const metricsBefore = { ...this.state.metrics };
    const districtsBefore = this.state.city.districts.map((d) => ({
      districtId: d.id,
      metrics: { ...d.metrics },
    }));

    const allEvents: GameEvent[] = [];

    // Reset per-turn expenses to base (transit will add its component)
    this.state.city.budget.expensesPerTurn = this.baseExpenses;

    // 1. Zoning system (updates densities, rents, supply)
    tickZoning(
      this.state.city.districts,
      this.state.metrics,
      this.baseRent,
      this.medianIncome
    );

    // 2. Traffic system (updates commutes, congestion)
    tickTraffic(
      this.state.city.districts,
      this.state.city.roadNetwork,
      this.state.city.transitLines,
      this.state.metrics
    );

    // 3. Transit system (construction, ridership, property effects)
    const transitEvents = tickTransit(
      this.state.city.districts,
      this.state.city.transitLines,
      this.state.metrics,
      this.state.city.budget
    );
    allEvents.push(...transitEvents);

    // 4. Economy & population (happiness, migration, budget, effects)
    const { moves, events: econEvents } = tickEconomy(
      this.state.city.districts,
      this.state.metrics,
      this.state.city.budget,
      this.state.activeEffects
    );
    allEvents.push(...econEvents);

    // 5. Update city congestion from road network
    this.state.metrics.congestionIndex = calculateCityCongestion(
      this.state.city.roadNetwork
    );

    // 6. Political system (approval updates)
    updateApproval(
      this.state.city.representatives,
      this.state.city.districts
    );

    // 7. Elections (if interval reached)
    let election = undefined;
    if (
      this.state.mode === GameMode.Political &&
      this.state.turn % this.state.city.electionInterval === 0 &&
      this.state.turn > 0
    ) {
      const { result, events: electionEvents } = runElection(
        this.state.city.representatives,
        this.state.city.districts,
        this.state.turn
      );
      election = result;
      this.state.electionLog.push(result);
      allEvents.push(...electionEvents);
    }

    // 8. Check scenario goals / game over
    this.checkGameOver(allEvents);

    // Build turn result
    const metricsAfter = { ...this.state.metrics };
    const districtChanges = this.state.city.districts.map((d, i) => ({
      districtId: d.id,
      metricsBefore: districtsBefore[i].metrics,
      metricsAfter: { ...d.metrics },
    }));

    return {
      turn: this.state.turn,
      metricsBefor: metricsBefore,
      metricsAfter,
      districtChanges,
      populationMoves: moves,
      events: allEvents,
      election,
      voteResult: this.state.lastVoteResult ?? undefined,
    };
  }

  /**
   * Apply sandbox controls directly (Sandbox mode only).
   */
  applySandboxControls(controls: SandboxControls): void {
    if (this.state.mode !== GameMode.Sandbox) return;

    // Apply density multiplier to all district max densities
    for (const d of this.state.city.districts) {
      d.maxDensity *= controls.densityMultiplier;
    }

    // Apply road capacity
    for (const [key, cap] of this.state.city.roadNetwork.capacities) {
      this.state.city.roadNetwork.capacities.set(
        key,
        cap * controls.roadCapacity
      );
    }

    // Apply parking minimums
    for (const d of this.state.city.districts) {
      d.parkingMinimum = controls.parkingMinimum;
    }

    // Apply tax rate
    this.state.city.budget.taxRate = controls.taxRate;

    // Apply transit subsidy
    this.state.city.budget.transitSubsidy = controls.transitSubsidy;
  }

  /**
   * Get available policy proposals based on current state.
   */
  getAvailablePolicies(): PolicyProposal[] {
    // This could be expanded with a policy catalog
    // For now, return empty - policies are created by the player/UI
    return [];
  }

  /**
   * Check if scenario goals are met.
   */
  checkGoals(): { goal: ScenarioGoal; met: boolean }[] {
    return this.state.city.scenarioGoals.map((goal) => {
      const value = this.state.metrics[goal.metric] as number;
      const met =
        goal.comparison === "above" ? value >= goal.target : value <= goal.target;
      return { goal, met };
    });
  }

  // --- Private Methods ---

  private applyPolicy(proposal: PolicyProposal): void {
    // Add to history
    this.state.policyHistory.push({
      policy: proposal,
      turnPassed: this.state.turn,
      votesFor: this.state.lastVoteResult?.votesFor ?? 0,
      votesAgainst: this.state.lastVoteResult?.votesAgainst ?? 0,
    });

    // Create active effects
    for (const effect of proposal.effects) {
      this.state.activeEffects.push({
        policyId: proposal.id,
        effect,
        turnsRemaining: effect.duration === 0 ? -1 : effect.duration,
        turnsUntilActive: effect.delay,
      });
    }

    // Apply budget cost
    this.state.city.budget.balance -= proposal.cost;
  }

  private checkGameOver(events: GameEvent[]): void {
    // Budget bankruptcy
    if (this.state.city.budget.balance < -5000) {
      this.state.gameOver = true;
      this.state.gameOverReason = "City went bankrupt.";
      events.push({
        type: "crisis",
        message: "The city is bankrupt! Game over.",
        severity: "critical",
      });
      return;
    }

    // Check if all goals met (win condition)
    const goals = this.checkGoals();
    if (goals.length > 0 && goals.every((g) => g.met)) {
      this.state.gameOver = true;
      this.state.gameOverReason = "All scenario goals achieved!";
      events.push({
        type: "milestone",
        message: "Congratulations! All scenario goals achieved!",
        severity: "info",
      });
    }
  }

  private emptyTurnResult(): TurnResult {
    return {
      turn: this.state.turn,
      metricsBefor: { ...this.state.metrics },
      metricsAfter: { ...this.state.metrics },
      districtChanges: [],
      populationMoves: [],
      events: [
        {
          type: "crisis",
          message: "Game is over.",
          severity: "critical",
        },
      ],
    };
  }
}
