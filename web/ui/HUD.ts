// ============================================
// HUD: updates city metrics & district panel
// ============================================

import type { GameState, District, Representative, CityMetrics } from "@engine/types.js";

// ── Delta / progress tracking (module-level state) ─────────────
let prevMetrics: CityMetrics | null = null;
let prevBudgetBalance: number | null = null;
const goalStartValues = new Map<string, number>();

// ── Public API ──────────────────────────────────────────────────

/** Update the city-level metrics display */
export function updateCityHUD(state: GameState) {
  const m = state.metrics;
  const b = state.city.budget;

  setText("turn-display", `Turn ${state.turn}`);

  // City Health Score (top of HUD)
  updateHealthScore(m);

  // Metrics with deltas
  setMetricHTML(
    "m-population",
    formatPop(m.totalPopulation),
    undefined,
    prevMetrics
      ? renderDelta(m.totalPopulation - prevMetrics.totalPopulation, (v) => formatPop(v), "up", 500)
      : ""
  );

  setMetricHTML(
    "m-commute",
    `${m.averageCommute.toFixed(1)} min`,
    qualityReverse(m.averageCommute, 25, 45),
    prevMetrics
      ? renderDelta(m.averageCommute - prevMetrics.averageCommute, (v) => `${v.toFixed(1)}m`, "down", 0.5)
      : ""
  );

  setMetricHTML(
    "m-rent",
    `$${m.averageRent.toFixed(0)}`,
    qualityReverse(m.averageRent, 1200, 2500),
    prevMetrics
      ? renderDelta(m.averageRent - prevMetrics.averageRent, (v) => `$${v.toFixed(0)}`, "down", 10)
      : ""
  );

  setMetricHTML(
    "m-happiness",
    `${(m.overallHappiness * 100).toFixed(1)}%`,
    quality(m.overallHappiness, 0.4, 0.6),
    prevMetrics
      ? renderDelta(
          (m.overallHappiness - prevMetrics.overallHappiness) * 100,
          (v) => `${v.toFixed(1)}%`,
          "up",
          0.5
        )
      : ""
  );

  setMetricHTML(
    "m-congestion",
    `${(m.congestionIndex * 100).toFixed(1)}%`,
    qualityReverse01(m.congestionIndex),
    prevMetrics
      ? renderDelta(
          (m.congestionIndex - prevMetrics.congestionIndex) * 100,
          (v) => `${v.toFixed(1)}%`,
          "down",
          0.5
        )
      : ""
  );

  setMetricHTML("m-transit", formatPop(m.transitRidership), undefined, "");

  setMetricHTML(
    "m-budget",
    `$${b.balance.toFixed(0)}`,
    b.balance > 2000 ? "good" : b.balance > 0 ? "warn" : "bad",
    prevBudgetBalance !== null
      ? renderDelta(b.balance - prevBudgetBalance, (v) => `$${v.toFixed(0)}`, "up", 50)
      : ""
  );

  const gap = m.housingDemand - m.housingSupply;
  setMetricHTML(
    "m-housing",
    gap > 0 ? `-${formatPop(gap)}` : `+${formatPop(-gap)}`,
    gap > 50000 ? "bad" : gap > 0 ? "warn" : "good",
    ""
  );

  // Goals with progress bars
  updateGoals(state);

  // Persist for next call
  prevMetrics = { ...m };
  prevBudgetBalance = b.balance;
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

// ── Private: health score ───────────────────────────────────────

function computeHealthScore(m: CityMetrics): number {
  const happinessPoints = m.overallHappiness * 40;
  const commuteNorm = Math.max(0, Math.min(1, (m.averageCommute - 15) / 45));
  const commutePoints = (1 - commuteNorm) * 30;
  const congestionPoints = (1 - Math.min(1, m.congestionIndex)) * 30;
  return Math.round(happinessPoints + commutePoints + congestionPoints);
}

function updateHealthScore(m: CityMetrics) {
  const score = computeHealthScore(m);
  const { grade, cls } = (() => {
    if (score >= 80) return { grade: "A", cls: "grade-a" };
    if (score >= 65) return { grade: "B", cls: "grade-b" };
    if (score >= 50) return { grade: "C", cls: "grade-c" };
    if (score >= 35) return { grade: "D", cls: "grade-d" };
    return { grade: "F", cls: "grade-f" };
  })();

  const el = document.getElementById("health-score-block");
  if (el) {
    el.innerHTML =
      `<span class="health-grade ${cls}">${grade}</span>` +
      `<div class="health-label-group">` +
      `<span class="health-label">City Health</span>` +
      `<span class="health-score-num">${score}/100</span>` +
      `</div>`;
  }
}

// ── Private: goal progress bars ────────────────────────────────

function updateGoals(state: GameState) {
  const container = document.getElementById("goals-list")!;
  container.innerHTML = "";

  for (const goal of state.city.scenarioGoals) {
    const value = state.metrics[goal.metric] as number;
    const met = goal.comparison === "above" ? value >= goal.target : value <= goal.target;

    // Anchor start value on first render for relative progress
    const key = goal.metric as string;
    if (!goalStartValues.has(key)) {
      goalStartValues.set(key, value);
    }
    const start = goalStartValues.get(key)!;

    let progress: number;
    if (goal.comparison === "below") {
      progress =
        start <= goal.target
          ? 100
          : Math.max(0, Math.min(100, ((start - value) / (start - goal.target)) * 100));
    } else {
      progress = Math.max(0, Math.min(100, (value / goal.target) * 100));
    }

    const barColor = met
      ? "var(--green)"
      : progress > 60
        ? "var(--yellow)"
        : "var(--red)";

    const currentStr = formatGoalValue(value, goal.metric);
    const targetStr  = formatGoalValue(goal.target, goal.metric);

    const row = document.createElement("div");
    row.className = `goal-row${met ? " met" : ""}`;
    row.innerHTML =
      `<div class="goal-header">` +
      `<span class="goal-label${met ? " met" : ""}">${goal.label}</span>` +
      `<span class="goal-values">${currentStr}→${targetStr}</span>` +
      `</div>` +
      `<div class="goal-bar-track">` +
      `<div class="goal-bar-fill" style="width:${progress.toFixed(1)}%;background:${barColor}"></div>` +
      `</div>`;
    container.appendChild(row);
  }
}

function formatGoalValue(v: number, metric: keyof CityMetrics): string {
  if (metric === "averageCommute") return `${v.toFixed(0)}m `;
  if (metric === "overallHappiness" || metric === "budgetHealth") return `${(v * 100).toFixed(0)}% `;
  if (metric === "congestionIndex") return `${(v * 100).toFixed(0)}% `;
  if (
    metric === "totalPopulation" ||
    metric === "transitRidership" ||
    metric === "housingSupply" ||
    metric === "housingDemand"
  )
    return `${formatPop(v)} `;
  if (metric === "averageRent") return `$${v.toFixed(0)} `;
  return `${v.toFixed(1)} `;
}

// ── Private: delta rendering ───────────────────────────────────

function renderDelta(
  delta: number,
  fmt: (v: number) => string,
  goodDir: "up" | "down",
  threshold: number
): string {
  if (Math.abs(delta) <= threshold) return "";
  const isGood = goodDir === "up" ? delta > 0 : delta < 0;
  const arrow = delta > 0 ? "↑" : "↓";
  const cls = isGood ? "delta-good" : "delta-bad";
  return ` <span class="metric-delta ${cls}">${arrow}${fmt(Math.abs(delta))}</span>`;
}

// ── Private: DOM helpers ───────────────────────────────────────

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Sets a metric element with a value + optional colored delta HTML */
function setMetricHTML(id: string, value: string, cls?: string, deltaHtml: string = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "metric-value" + (cls ? ` ${cls}` : "");
  // value is internally generated numeric/formatted text — safe to concat with deltaHtml
  el.innerHTML = escHtml(value) + deltaHtml;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function metricRow(label: string, value: string, cls?: string): string {
  return `<div class="metric-row">
    <span class="metric-label">${label}</span>
    <span class="metric-value ${cls || ""}">${value}</span>
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
