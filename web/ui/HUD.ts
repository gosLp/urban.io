// ============================================
// HUD: updates city metrics & district panel
// ============================================

import type { GameState, District, Representative, CityMetrics } from "@engine/types.js";

/** Update the city-level metrics display */
export function updateCityHUD(state: GameState) {
  const m = state.metrics;
  const b = state.city.budget;

  setText("turn-display", `Turn ${state.turn}`);

  setMetric("m-population", formatPop(m.totalPopulation));
  setMetric("m-commute", `${m.averageCommute.toFixed(1)} min`, qualityReverse(m.averageCommute, 25, 45));
  setMetric("m-rent", `$${m.averageRent.toFixed(0)}`, qualityReverse(m.averageRent, 1200, 2500));
  setMetric("m-happiness", `${(m.overallHappiness * 100).toFixed(1)}%`, quality(m.overallHappiness, 0.4, 0.6));
  setMetric("m-congestion", `${(m.congestionIndex * 100).toFixed(1)}%`, qualityReverse01(m.congestionIndex));
  setMetric("m-transit", formatPop(m.transitRidership));
  setMetric("m-budget", `$${b.balance.toFixed(0)}`, b.balance > 2000 ? "good" : b.balance > 0 ? "warn" : "bad");

  const gap = m.housingDemand - m.housingSupply;
  setMetric("m-housing", gap > 0 ? `-${formatPop(gap)}` : `+${formatPop(-gap)}`, gap > 50000 ? "bad" : gap > 0 ? "warn" : "good");

  // Goals
  updateGoals(state);
}

function updateGoals(state: GameState) {
  const container = document.getElementById("goals-list")!;
  container.innerHTML = "";

  for (const goal of state.city.scenarioGoals) {
    const value = state.metrics[goal.metric] as number;
    const met = goal.comparison === "above" ? value >= goal.target : value <= goal.target;

    const row = document.createElement("div");
    row.className = "goal-row";

    const check = document.createElement("div");
    check.className = `goal-check ${met ? "met" : ""}`;
    check.textContent = met ? "\u2713" : "";

    const label = document.createElement("span");
    label.className = `goal-label ${met ? "met" : ""}`;
    label.textContent = goal.label;

    row.appendChild(check);
    row.appendChild(label);
    container.appendChild(row);
  }
}

/** Update the district detail panel */
export function updateDistrictPanel(district: District | null, rep: Representative | undefined) {
  const panel = document.getElementById("district-panel")!;

  if (!district) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  setText("district-name", district.name);

  const stats = document.getElementById("district-stats")!;
  const m = district.metrics;
  stats.innerHTML = `
    ${metricRow("Population", formatPop(district.population))}
    ${metricRow("Density", `${district.currentDensity.toFixed(0)}/km²`)}
    ${metricRow("Commute", `${m.averageCommuteMinutes.toFixed(1)} min`, qualityReverse(m.averageCommuteMinutes, 20, 50))}
    ${metricRow("Rent", `$${m.averageRent.toFixed(0)}`, qualityReverse(m.averageRent, 1000, 2500))}
    ${metricRow("Rent Burden", `${(m.rentBurden * 100).toFixed(0)}%`, qualityReverse01(m.rentBurden))}
    ${metricRow("Congestion", `${(m.trafficCongestion * 100).toFixed(0)}%`, qualityReverse01(m.trafficCongestion))}
    ${metricRow("Job Access", `${(m.jobAccessScore * 100).toFixed(0)}%`, quality(m.jobAccessScore, 0.4, 0.65))}
    ${metricRow("Happiness", `${(m.happiness * 100).toFixed(0)}%`, quality(m.happiness, 0.4, 0.6))}
    ${metricRow("Services", `${(m.publicServiceSatisfaction * 100).toFixed(0)}%`, quality(m.publicServiceSatisfaction, 0.4, 0.6))}
    ${metricRow("Transit", district.hasTransitStation ? "Yes" : "No")}
  `;

  const repDiv = document.getElementById("district-rep")!;
  if (rep) {
    repDiv.innerHTML = `
      <div class="rep-name">${rep.name}</div>
      <div class="rep-leaning">${rep.leaning.replace("_", " ")}</div>
      <div class="rep-approval">Approval: ${(rep.approvalRating * 100).toFixed(0)}% · Risk: ${(rep.reElectionRisk * 100).toFixed(0)}%</div>
    `;
  } else {
    repDiv.innerHTML = "";
  }
}

// --- Helpers ---

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setMetric(id: string, text: string, cls?: string) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    el.className = "metric-value" + (cls ? ` ${cls}` : "");
  }
}

function metricRow(label: string, value: string, cls?: string): string {
  return `<div class="metric-row">
    <span class="metric-label">${label}</span>
    <span class="metric-value ${cls || ''}">${value}</span>
  </div>`;
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toFixed(0);
}

function quality(v: number, low: number, high: number): string {
  if (v >= high) return "good";
  if (v >= low) return "warn";
  return "bad";
}

function qualityReverse(v: number, good: number, bad: number): string {
  if (v <= good) return "good";
  if (v <= bad) return "warn";
  return "bad";
}

function qualityReverse01(v: number): string {
  if (v < 0.35) return "good";
  if (v < 0.6) return "warn";
  return "bad";
}
