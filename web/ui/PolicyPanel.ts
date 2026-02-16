// ============================================
// Policy Panel: shows available policies
// Organized: quick wins first, then bigger reforms
// ============================================

import type { PolicyProposal, District, GameState } from "@engine/types.js";
import {
  createUpzonePolicy,
  createBusRoutePolicy,
  createRailLinePolicy,
  createCongestionPricingPolicy,
  createReduceParkingPolicy,
  createAffordableHousingPolicy,
  createBusLanePolicy,
  createParkingEnforcementPolicy,
  createIntersectionFixPolicy,
  createPublicServicesPolicy,
  createBusFrequencyPolicy,
  createGreenSpacePolicy,
  createPilotCongestionPricingPolicy,
  createWalkabilityPolicy,
} from "@engine/policy/policies.js";

export type PolicySelectCallback = (policy: PolicyProposal) => void;

/**
 * Generate available policies based on game state and selected district.
 * Early-game "quick wins" appear first, bigger reforms appear after.
 */
export function getAvailablePolicies(
  state: GameState,
  selectedDistrictId: string | null
): PolicyProposal[] {
  const quickWins: PolicyProposal[] = [];
  const reforms: PolicyProposal[] = [];
  const districts = state.city.districts;
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  if (selectedDistrictId) {
    const d = districtMap.get(selectedDistrictId);
    if (d) {
      const shortName = d.name.split("(")[0].trim();

      // --- Quick wins (cheap, easy to pass) ---
      quickWins.push(createIntersectionFixPolicy(d.id, shortName));
      quickWins.push(createPublicServicesPolicy(d.id, shortName));
      quickWins.push(createWalkabilityPolicy(d.id, shortName));
      quickWins.push(createGreenSpacePolicy(d.id, shortName));

      // Bus lanes to adjacent congested districts
      if (d.adjacentDistricts.length > 0) {
        const routeDistricts = [d.id, ...d.adjacentDistricts.slice(0, 2)];
        const adjNames = d.adjacentDistricts
          .slice(0, 2)
          .map((id) => districtMap.get(id)?.name.split("(")[0].trim() || id);
        quickWins.push(
          createBusLanePolicy(
            routeDistricts,
            `${shortName} → ${adjNames.join(" → ")}`
          )
        );
        quickWins.push(
          createBusFrequencyPolicy(
            routeDistricts,
            `${shortName} corridor`
          )
        );
      }

      // Pilot congestion pricing (only if district is congested)
      if (d.metrics.trafficCongestion > 0.6) {
        quickWins.push(createPilotCongestionPricingPolicy(d.id, shortName));
      }

      // --- Bigger reforms ---
      reforms.push(createAffordableHousingPolicy(d.id, 200));
      reforms.push(createReduceParkingPolicy(d.id, d.name));
      reforms.push(createUpzonePolicy(d.id, d.name));

      // New bus route
      if (d.adjacentDistricts.length > 0) {
        const routeDistricts = [d.id, ...d.adjacentDistricts.slice(0, 2)];
        const adjNames = d.adjacentDistricts
          .slice(0, 2)
          .map((id) => districtMap.get(id)?.name.split("(")[0].trim() || id);
        reforms.push(
          createBusRoutePolicy(
            routeDistricts,
            `${shortName} → ${adjNames.join(" → ")}`
          )
        );
      }
    }
  }

  // City-wide policies (always available)
  const congestedIds = districts
    .filter((d) => d.metrics.trafficCongestion > 0.5)
    .map((d) => d.id);

  // Parking enforcement across congested areas (revenue-generating quick win)
  if (congestedIds.length > 0) {
    quickWins.push(createParkingEnforcementPolicy(congestedIds.slice(0, 4)));
  }

  // Full congestion pricing (reform)
  if (congestedIds.length > 0) {
    reforms.push(createCongestionPricingPolicy(congestedIds.slice(0, 3), "medium"));
  }

  // Rail expansion (major reform)
  const topPop = [...districts]
    .sort((a, b) => b.population - a.population)
    .slice(0, 3)
    .map((d) => d.id);
  reforms.push(createRailLinePolicy(topPop, "Metro Expansion"));

  return [...quickWins, ...reforms];
}

/**
 * Render policy buttons into the bottom bar.
 */
export function renderPolicyButtons(
  policies: PolicyProposal[],
  onSelect: PolicySelectCallback
) {
  const container = document.getElementById("policy-buttons")!;
  container.innerHTML = "";

  for (const p of policies) {
    const btn = document.createElement("button");
    const costLabel = p.cost < 0 ? `+$${Math.abs(p.cost)}` : `$${p.cost}`;
    btn.className = `btn-policy category-${getCategoryClass(p.category)}`;
    btn.textContent = p.name;
    btn.title = `${p.description}\nCost: ${costLabel} · Vote: ${p.voteRequirement.replace("_", " ")}`;
    btn.addEventListener("click", () => onSelect(p));
    container.appendChild(btn);
  }
}

function getCategoryClass(cat: string): string {
  if (cat.includes("transit")) return "transit";
  if (cat.includes("zoning")) return "zoning";
  if (cat.includes("congestion")) return "congestion";
  if (cat.includes("housing")) return "housing";
  if (cat.includes("infrastructure")) return "infra";
  return "";
}
