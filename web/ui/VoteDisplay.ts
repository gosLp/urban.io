// ============================================
// Vote Result Display & Event Feed
// ============================================

import type { VoteResult, Representative, CityMetrics, GameEvent } from "@engine/types.js";

/**
 * Show the vote result overlay.
 */
export function showVoteResult(
  result: VoteResult,
  policyName: string,
  representatives: Representative[]
): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.getElementById("vote-overlay")!;
    const title = document.getElementById("vote-title")!;
    const badge = document.getElementById("vote-result-badge")!;
    const tally = document.getElementById("vote-tally")!;
    const breakdown = document.getElementById("vote-breakdown")!;
    const dismissBtn = document.getElementById("vote-dismiss")!;

    title.textContent = policyName;

    badge.textContent = result.passed ? "PASSED" : "FAILED";
    badge.className = result.passed ? "passed" : "failed";

    const total = result.votesFor + result.votesAgainst;
    tally.textContent = `${result.votesFor} for / ${result.votesAgainst} against (${total} total) · Requires: ${result.required.replace("_", " ")}`;

    const repMap = new Map(representatives.map((r) => [r.id, r]));
    breakdown.innerHTML = "";

    for (const v of result.votes) {
      const rep = repMap.get(v.representativeId);
      const row = document.createElement("div");
      row.className = "vote-row";

      const icon = document.createElement("div");
      icon.className = `vote-icon ${v.votedYes ? "yes" : "no"}`;
      icon.textContent = v.votedYes ? "\u2713" : "\u2717";

      const name = document.createElement("span");
      name.className = "vote-rep-name";
      name.textContent = rep?.name || v.representativeId;

      const reason = document.createElement("span");
      reason.className = "vote-reason";
      reason.textContent = v.reason;

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(reason);
      breakdown.appendChild(row);
    }

    overlay.classList.remove("hidden");

    const dismiss = () => {
      overlay.classList.add("hidden");
      dismissBtn.removeEventListener("click", dismiss);
      resolve();
    };
    dismissBtn.addEventListener("click", dismiss);
  });
}

/**
 * Show a single consolidated summary of what changed this turn.
 * Uses metricsBefor/metricsAfter from TurnResult.
 */
export function showTurnSummary(
  turn: number,
  before: CityMetrics,
  after: CityMetrics
): void {
  type Entry = { label: string; delta: number; fmt: (v: number) => string; goodDir: "up" | "down"; threshold: number };
  const checks: Entry[] = [
    { label: "Commute",    delta: after.averageCommute - before.averageCommute,                        fmt: (v) => `${v.toFixed(1)}min`, goodDir: "down", threshold: 0.5 },
    { label: "Happiness",  delta: (after.overallHappiness - before.overallHappiness) * 100,            fmt: (v) => `${v.toFixed(1)}%`,   goodDir: "up",   threshold: 0.5 },
    { label: "Congestion", delta: (after.congestionIndex - before.congestionIndex) * 100,              fmt: (v) => `${v.toFixed(1)}%`,   goodDir: "down", threshold: 0.5 },
    { label: "Rent",       delta: after.averageRent - before.averageRent,                              fmt: (v) => `$${v.toFixed(0)}`,   goodDir: "down", threshold: 10  },
  ];

  const parts: string[] = [];
  for (const c of checks) {
    if (Math.abs(c.delta) <= c.threshold) continue;
    const isGood = c.goodDir === "up" ? c.delta > 0 : c.delta < 0;
    const arrow = c.delta > 0 ? "↑" : "↓";
    const cls   = isGood ? "summary-good" : "summary-bad";
    parts.push(`<span class="${cls}">${c.label} ${arrow}${c.fmt(Math.abs(c.delta))}</span>`);
  }

  if (parts.length === 0) return;

  const feed = document.getElementById("event-feed")!;
  const el = document.createElement("div");
  el.className = "turn-summary";
  // Content is entirely internally generated — no user input
  el.innerHTML =
    `<span class="summary-turn">Turn ${turn}:</span> ` +
    parts.join(`<span class="summary-sep"> · </span>`);
  feed.appendChild(el);

  setTimeout(() => {
    el.classList.add("toast-out");
    setTimeout(() => el.parentNode?.removeChild(el), 400);
  }, 4000);
}

/**
 * Show events as toast notifications.
 */
export function showEvents(events: GameEvent[]) {
  const feed = document.getElementById("event-feed")!;

  for (const event of events) {
    const toast = document.createElement("div");
    let cls = "event-toast";
    if (event.severity === "warning") cls += " warning";
    if (event.severity === "critical") cls += " critical";
    toast.className = cls;
    toast.textContent = event.message;
    feed.appendChild(toast);

    // Auto-remove after animation
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }
}
