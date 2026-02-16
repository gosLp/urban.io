// ============================================
// Policy Panel: shows available policies
// ============================================

import type { PolicyProposal, District, GameState } from "@engine/types.js";
import {
  createUpzonePolicy,
  createBusRoutePolicy,
  createRailLinePolicy,
  createCongestionPricingPolicy,
  createReduceParkingPolicy,
  createAffordableHousingPolicy,
} from "@engine/policy/policies.js";

export type PolicySelectCallback = (policy: PolicyProposal) => void;

/**
 * Generate available policies based on game state and selected district.
 */
export function getAvailablePolicies(
  state: GameState,
  selectedDistrictId: string | null
): PolicyProposal[] {
  const policies: PolicyProposal[] = [];
  const districts = state.city.districts;
  const districtMap = new Map(districts.map((d) => [d.id, d]));

  if (selectedDistrictId) {
    const d = districtMap.get(selectedDistrictId);
    if (d) {
      // District-specific policies
      policies.push(createUpzonePolicy(d.id, d.name));
      policies.push(createReduceParkingPolicy(d.id, d.name));
      policies.push(createAffordableHousingPolicy(d.id, 200));

      // Bus routes from this district to adjacent
      if (d.adjacentDistricts.length > 0) {
        const routeDistricts = [d.id, ...d.adjacentDistricts.slice(0, 2)];
        const adjNames = d.adjacentDistricts
          .slice(0, 2)
          .map((id) => districtMap.get(id)?.name.split("(")[0].trim() || id);
        policies.push(
          createBusRoutePolicy(
            routeDistricts,
            `${d.name.split("(")[0].trim()} → ${adjNames.join(" → ")}`
          )
        );
      }
    }
  }

  // City-wide policies (always available)
  const coreDistricts = districts
    .filter((d) => d.metrics.trafficCongestion > 0.5)
    .map((d) => d.id)
    .slice(0, 3);

  if (coreDistricts.length > 0) {
    policies.push(createCongestionPricingPolicy(coreDistricts, "medium"));
  }

  // Rail expansion between well-connected districts
  const topPop = [...districts]
    .sort((a, b) => b.population - a.population)
    .slice(0, 3)
    .map((d) => d.id);
  policies.push(createRailLinePolicy(topPop, "Metro Expansion"));

  return policies;
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
    btn.className = `btn-policy category-${getCategoryClass(p.category)}`;
    btn.textContent = p.name;
    btn.title = `${p.description}\nCost: $${p.cost} · Vote: ${p.voteRequirement.replace("_", " ")}`;
    btn.addEventListener("click", () => onSelect(p));
    container.appendChild(btn);
  }
}

function getCategoryClass(cat: string): string {
  if (cat.includes("transit")) return "transit";
  if (cat.includes("zoning")) return "zoning";
  if (cat.includes("congestion")) return "congestion";
  if (cat.includes("housing")) return "housing";
  return "";
}
