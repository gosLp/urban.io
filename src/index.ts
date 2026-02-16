// ============================================================
// Urban.io - Political Simulation Game Engine
// "Govern what you inherited."
// ============================================================

// Core engine
export { SimulationEngine } from "./engine/SimulationEngine.js";

// Types
export * from "./types.js";

// Systems (for advanced usage / custom integrations)
export * as traffic from "./systems/traffic.js";
export * as zoning from "./systems/zoning.js";
export * as transit from "./systems/transit.js";
export * as politics from "./systems/politics.js";
export * as economy from "./systems/economy.js";

// Policy templates
export * as policies from "./policy/policies.js";

// City helpers
export * as cityHelpers from "./city/helpers.js";

// City configurations
export { createBengaluru } from "./data/bengaluru/config.js";
export { createNYC } from "./data/nyc/config.js";
export { createSanFrancisco } from "./data/sanfrancisco/config.js";
