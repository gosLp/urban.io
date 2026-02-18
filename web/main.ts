// ============================================
// urban.io — Main Entry Point
// Wires engine → renderer → UI
// ============================================

import { SimulationEngine } from "@engine/engine/SimulationEngine.js";
import { createBengaluru } from "@engine/data/bengaluru/config.js";
import { GameMode } from "@engine/types.js";
import type { PolicyProposal, District } from "@engine/types.js";

import { MapRenderer } from "./renderer/MapRenderer.js";
import { updateCityHUD, updateDistrictPanel } from "./ui/HUD.js";
import { getAvailablePolicies, renderPolicyButtons } from "./ui/PolicyPanel.js";
import { showVoteResult, showEvents } from "./ui/VoteDisplay.js";

// --- Initialize ---
const engine = new SimulationEngine(createBengaluru(), GameMode.Political);
const mapContainer = document.getElementById("map-container") as HTMLDivElement;

let selectedDistrict: District | null = null;
let isProcessing = false;

// Renderer — receives district-click callbacks instead of canvas hit-testing
const renderer = new MapRenderer(mapContainer, {
  onDistrictClick: (district: District) => {
    // Always look up the freshest copy from engine state
    const fresh = engine.getState().city.districts.find((d) => d.id === district.id);
    if (!fresh) return;

    selectedDistrict = fresh as District;
    renderer.state.selectedDistrict = fresh.id;

    const rep = engine.getState().city.representatives.find(
      (r) => r.districtId === fresh.id
    );
    updateDistrictPanel(fresh as District, rep);
    refreshPolicies();
  },
});

// --- Initial UI update ---
refreshUI();
refreshPolicies();

// --- Render Loop ---
let lastTime = performance.now();

function frame(now: number) {
  const dt = now - lastTime;
  lastTime = now;

  renderer.render(engine.getState() as any, dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Close district panel
document.getElementById("district-close")!.addEventListener("click", () => {
  selectedDistrict = null;
  renderer.state.selectedDistrict = null;
  updateDistrictPanel(null, undefined);
  refreshPolicies();
});

// --- Next Turn ---
document.getElementById("btn-next-turn")!.addEventListener("click", async () => {
  if (isProcessing || engine.isGameOver()) return;

  const result = engine.tick();
  showEvents(result.events);
  refreshUI();
  refreshPolicies();

  // Refresh selected district panel
  if (selectedDistrict) {
    const updated = engine.getState().city.districts.find((d) => d.id === selectedDistrict!.id);
    const rep = engine.getState().city.representatives.find(
      (r) => r.districtId === selectedDistrict!.id
    );
    if (updated) {
      selectedDistrict = updated as District;
      updateDistrictPanel(updated as District, rep);
    }
  }

  if (engine.isGameOver()) {
    (document.getElementById("btn-next-turn") as HTMLButtonElement).disabled = true;
    showEvents([
      {
        type: "crisis",
        message: engine.getState().gameOverReason || "Game Over",
        severity: "critical",
      },
    ]);
  }
});

// --- Policy Proposal ---
async function handlePolicySelect(policy: PolicyProposal) {
  if (isProcessing || engine.isGameOver()) return;
  isProcessing = true;

  const result = engine.proposePolicy(policy);

  if (result) {
    await showVoteResult(result, policy.name, engine.getState().city.representatives as any[]);
  }

  refreshUI();
  refreshPolicies();
  isProcessing = false;
}

// --- Refresh Helpers ---
function refreshUI() {
  updateCityHUD(engine.getState() as any);
}

function refreshPolicies() {
  const policies = getAvailablePolicies(engine.getState() as any, selectedDistrict?.id ?? null);
  renderPolicyButtons(policies, handlePolicySelect);
}

// --- Keyboard shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    document.getElementById("btn-next-turn")!.click();
  }
  if (e.key === "Escape") {
    selectedDistrict = null;
    renderer.state.selectedDistrict = null;
    updateDistrictPanel(null, undefined);
    refreshPolicies();
  }
});
