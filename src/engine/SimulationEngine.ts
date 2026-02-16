// ============================================================
// Simulation Engine
// Main orchestrator: processes turns, runs systems, tracks state
// Key fix: initializes road loads, passes transit cost, clean budget
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
  ScenarioGoal,
} from "../types.js";

import { tickTraffic, calculateCityCongestion, initializeRoadLoads } from "../systems/traffic.js";
import { tickZoning } from "../systems/zoning.js";
import { tickTransit } from "../systems/transit.js";
import { conductVote, updateApproval, runElection } from "../systems/politics.js";
import { tickEconomy, updateCityMetrics } from "../systems/economy.js";

const DEFAULT_BASE_RENT = 1200;
const DEFAULT_MEDIAN_INCOME = 50000;

export class SimulationEngine {
  private state: GameState;
  private baseRent: number;
  private medianIncome: number;

  constructor(cityConfig: CityConfig, mode: GameMode = GameMode.Political) {
    this.baseRent = DEFAULT_BASE_RENT;
    this.medianIncome = DEFAULT_MEDIAN_INCOME;

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

    // CRITICAL: Initialize road loads from district congestion values
    // so the first tick doesn't snap metrics to zero
    initializeRoadLoads(this.state.city.roadNetwork, this.state.city.districts);
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  getMetrics(): Readonly<CityMetrics> {
    return this.state.metrics;
  }

  getDistricts(): readonly District[] {
    return this.state.city.districts;
  }

  getTurn(): number {
    return this.state.turn;
  }

  isGameOver(): boolean {
    return this.state.gameOver;
  }

  proposePolicy(proposal: PolicyProposal): VoteResult | null {
    if (this.state.gameOver) return null;

    if (this.state.mode === GameMode.Sandbox) {
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

    const result = conductVote(
      proposal,
      this.state.city.representatives,
      this.state.city.districts
    );

    this.state.lastVoteResult = result;

    if (result.passed) {
      this.applyPolicy(proposal);
    }

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

    // 1. Zoning (densities, rents — damped)
    tickZoning(
      this.state.city.districts,
      this.state.metrics,
      this.baseRent,
      this.medianIncome
    );

    // 2. Traffic (loads, commutes, congestion — damped, loads persist)
    tickTraffic(
      this.state.city.districts,
      this.state.city.roadNetwork,
      this.state.city.transitLines,
      this.state.metrics
    );

    // 3. Transit (construction, ridership — damped, returns cost)
    const { events: transitEvents, transitCost } = tickTransit(
      this.state.city.districts,
      this.state.city.transitLines,
      this.state.metrics,
      this.state.city.budget
    );
    allEvents.push(...transitEvents);

    // 4. Economy (happiness, migration, budget — all damped, transit cost passed in)
    const { moves, events: econEvents } = tickEconomy(
      this.state.city.districts,
      this.state.metrics,
      this.state.city.budget,
      this.state.activeEffects,
      transitCost
    );
    allEvents.push(...econEvents);

    // 5. City congestion from road network (already damped via load persistence)
    this.state.metrics.congestionIndex = calculateCityCongestion(
      this.state.city.roadNetwork
    );

    // 6. Political approval
    updateApproval(
      this.state.city.representatives,
      this.state.city.districts
    );

    // 7. Elections
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

    // 8. Check game over
    this.checkGameOver(allEvents);

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

  applySandboxControls(controls: SandboxControls): void {
    if (this.state.mode !== GameMode.Sandbox) return;
    for (const d of this.state.city.districts) {
      d.maxDensity *= controls.densityMultiplier;
      d.parkingMinimum = controls.parkingMinimum;
    }
    for (const [key, cap] of this.state.city.roadNetwork.capacities) {
      this.state.city.roadNetwork.capacities.set(key, cap * controls.roadCapacity);
    }
    this.state.city.budget.taxRate = controls.taxRate;
    this.state.city.budget.transitSubsidy = controls.transitSubsidy;
  }

  checkGoals(): { goal: ScenarioGoal; met: boolean }[] {
    return this.state.city.scenarioGoals.map((goal) => {
      const value = this.state.metrics[goal.metric] as number;
      const met = goal.comparison === "above" ? value >= goal.target : value <= goal.target;
      return { goal, met };
    });
  }

  private applyPolicy(proposal: PolicyProposal): void {
    this.state.policyHistory.push({
      policy: proposal,
      turnPassed: this.state.turn,
      votesFor: this.state.lastVoteResult?.votesFor ?? 0,
      votesAgainst: this.state.lastVoteResult?.votesAgainst ?? 0,
    });

    for (const effect of proposal.effects) {
      this.state.activeEffects.push({
        policyId: proposal.id,
        effect,
        turnsRemaining: effect.duration === 0 ? -1 : effect.duration,
        turnsUntilActive: effect.delay,
      });
    }

    this.state.city.budget.balance -= proposal.cost;
  }

  private checkGameOver(events: GameEvent[]): void {
    if (this.state.city.budget.balance < -10000) {
      this.state.gameOver = true;
      this.state.gameOverReason = "City went bankrupt.";
      events.push({ type: "crisis", message: "The city is bankrupt! Game over.", severity: "critical" });
      return;
    }

    const goals = this.checkGoals();
    if (goals.length > 0 && goals.every((g) => g.met)) {
      this.state.gameOver = true;
      this.state.gameOverReason = "All scenario goals achieved!";
      events.push({ type: "milestone", message: "Congratulations! All scenario goals achieved!", severity: "info" });
    }
  }

  private emptyTurnResult(): TurnResult {
    return {
      turn: this.state.turn,
      metricsBefor: { ...this.state.metrics },
      metricsAfter: { ...this.state.metrics },
      districtChanges: [],
      populationMoves: [],
      events: [{ type: "crisis", message: "Game is over.", severity: "critical" }],
    };
  }
}
