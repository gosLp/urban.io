// ============================================================
// Demo: Play through a few turns of Bengaluru
// Run with: npm run demo
// ============================================================

import { SimulationEngine } from "./engine/SimulationEngine.js";
import { createBengaluru } from "./data/bengaluru/config.js";
import { createNYC } from "./data/nyc/config.js";
import { createSanFrancisco } from "./data/sanfrancisco/config.js";
import { GameMode } from "./types.js";
import {
  createUpzonePolicy,
  createCongestionPricingPolicy,
  createBusRoutePolicy,
  createRailLinePolicy,
  createReduceParkingPolicy,
  createBusLanePolicy,
  createParkingEnforcementPolicy,
  createIntersectionFixPolicy,
  createPublicServicesPolicy,
} from "./policy/policies.js";

function printMetrics(engine: SimulationEngine, label: string) {
  const m = engine.getMetrics();
  const state = engine.getState();
  console.log(`\n=== ${label} (Turn ${engine.getTurn()}) ===`);
  console.log(`Population:     ${m.totalPopulation.toLocaleString()}`);
  console.log(`Avg Commute:    ${m.averageCommute.toFixed(1)} min`);
  console.log(`Avg Rent:       $${m.averageRent.toFixed(0)}`);
  console.log(`Happiness:      ${(m.overallHappiness * 100).toFixed(1)}%`);
  console.log(`Congestion:     ${(m.congestionIndex * 100).toFixed(1)}%`);
  console.log(`Transit Riders: ${m.transitRidership.toLocaleString()}`);
  console.log(`Housing S/D:    ${m.housingSupply.toLocaleString()} / ${m.housingDemand.toLocaleString()}`);
  console.log(`Budget:         $${state.city.budget.balance.toFixed(0)}`);
}

function printVoteResult(result: any) {
  if (!result) return;
  const status = result.passed ? "PASSED" : "FAILED";
  console.log(`  Vote: ${status} (${result.votesFor} for, ${result.votesAgainst} against)`);
  for (const v of result.votes) {
    const emoji = v.votedYes ? "[YES]" : "[NO ]";
    console.log(`    ${emoji} ${v.representativeId}: ${v.reason}`);
  }
}

function printEvents(result: any) {
  if (result.events.length > 0) {
    console.log("  Events:");
    for (const e of result.events) {
      const prefix = e.severity === "critical" ? "!!!" : e.severity === "warning" ? " ! " : "   ";
      console.log(`  ${prefix} ${e.message}`);
    }
  }
}

// --- Run Demo ---

console.log("╔═══════════════════════════════════════════════╗");
console.log("║        URBAN.IO - Political Sim Engine        ║");
console.log("║       \"Govern what you inherited.\"             ║");
console.log("╚═══════════════════════════════════════════════╝");

// --- Bengaluru Scenario ---
console.log("\n\n▓▓▓ BENGALURU SCENARIO ▓▓▓");
console.log("Challenge: Sprawling IT city, brutal traffic, weak metro");

const blr = new SimulationEngine(createBengaluru(), GameMode.Political);
printMetrics(blr, "Bengaluru - Initial State");

// Turn 1: Advance to see baseline — metrics should NOT snap wildly
console.log("\n--- Turn 1: Baseline tick (should change GRADUALLY) ---");
let result = blr.tick();
printEvents(result);
printMetrics(blr, "After baseline tick");

// Turn 2: Quick win — fix intersections (cheap, easy pass)
console.log("\n--- Turn 2: Fix Intersections in Whitefield (quick win) ---");
const intersections = createIntersectionFixPolicy("blr_whitefield", "Whitefield");
let voteResult = blr.proposePolicy(intersections);
printVoteResult(voteResult);
result = blr.tick();
printEvents(result);

// Turn 3: Quick win — parking enforcement (generates revenue!)
console.log("\n--- Turn 3: Parking Enforcement (generates revenue) ---");
const parking = createParkingEnforcementPolicy(["blr_majestic", "blr_whitefield", "blr_ecity"]);
voteResult = blr.proposePolicy(parking);
printVoteResult(voteResult);
result = blr.tick();
printEvents(result);

// Turn 4: Bus lanes (cheap, easy)
console.log("\n--- Turn 4: Bus Lanes on IT corridor ---");
const busLanes = createBusLanePolicy(
  ["blr_majestic", "blr_whitefield", "blr_sarjapur"],
  "IT Corridor"
);
voteResult = blr.proposePolicy(busLanes);
printVoteResult(voteResult);
result = blr.tick();
printEvents(result);

// Turn 5: Improve services (universally popular)
console.log("\n--- Turn 5: Improve Services in E-City ---");
const services = createPublicServicesPolicy("blr_ecity", "Electronic City");
voteResult = blr.proposePolicy(services);
printVoteResult(voteResult);
result = blr.tick();
printEvents(result);

printMetrics(blr, "After 5 turns with quick wins");

// Run a few more turns to see effects cascade
console.log("\n--- Running 5 more turns... ---");
for (let i = 0; i < 5; i++) {
  result = blr.tick();
}
printMetrics(blr, "Bengaluru - After 10 turns");
printEvents(result);

// Check goals
const goals = blr.checkGoals();
console.log("\n  Scenario Goals:");
for (const g of goals) {
  const status = g.met ? "[MET]  " : "[     ]";
  console.log(`  ${status} ${g.goal.label}`);
}

// --- Quick NYC Sandbox ---
console.log("\n\n▓▓▓ NYC SANDBOX MODE ▓▓▓");
console.log("Mode: No voting, just turn knobs and see effects");

const nyc = new SimulationEngine(createNYC(), GameMode.Sandbox);
printMetrics(nyc, "NYC - Initial State");

// In sandbox, policies auto-pass
const nycRail = createRailLinePolicy(
  ["nyc_queens", "nyc_brooklyn", "nyc_statenisland"],
  "Cross-Borough Express"
);
nyc.proposePolicy(nycRail);

for (let i = 0; i < 10; i++) {
  nyc.tick();
}
printMetrics(nyc, "NYC - After 10 turns + rail investment");

// --- Quick SF Summary ---
console.log("\n\n▓▓▓ SAN FRANCISCO ▓▓▓");
const sf = new SimulationEngine(createSanFrancisco(), GameMode.Political);
printMetrics(sf, "San Francisco - Initial State");

// Try to upzone in SF (NIMBY-heavy council!)
console.log("\n--- SF: Try to upzone Richmond/Sunset (good luck...) ---");
const sfUpzone = createUpzonePolicy("sf_richmond", "Richmond / Sunset");
voteResult = sf.proposePolicy(sfUpzone);
printVoteResult(voteResult);

console.log("\n\n════════════════════════════════════════════");
console.log("Demo complete. The engine is working.");
console.log("Next: Build a UI on top of this engine.");
console.log("════════════════════════════════════════════\n");
