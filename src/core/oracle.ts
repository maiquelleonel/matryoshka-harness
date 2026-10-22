/**
 * Oracle integration wrapper conforming to Matryoshka-Harness specification.
 * Bridges paladini/harness-score oracle scanner with internal telemetry.
 */
export {
  executeHarnessScore,
  runHarnessScoreSubprocess,
  resolveHarnessScoreBinary,
  evaluateInMemoryFallback,
  normalizeMaturityLevel,
  inferGovernanceAxis,
} from "../scanner";
