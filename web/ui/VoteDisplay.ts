// ============================================
// Vote Result Display & Event Feed
// ============================================

import type { VoteResult, Representative, TurnResult, GameEvent } from "@engine/types.js";

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
