import {
  DinoTaskState,
  RecoveryBlocker,
} from "./task-state";
import {
  RecoveryOption,
  rankRecoveryOptions,
} from "./recovery/paths";

export type Decision =
  | { type: "continue"; reason: string }
  | { type: "try_recovery"; option: RecoveryOption }
  | { type: "ask_owner"; blocker: RecoveryBlocker; reason: string }
  | { type: "complete"; reason: string }
  | { type: "fail"; reason: string };

export interface Observation {
  authenticated: boolean;
  recoveryOptions: RecoveryOption[];
  blocker?: RecoveryBlocker;
  pageSummary?: string;
}

export class RecoveryDecisionEngine {
  decide(state: DinoTaskState, observation: Observation): Decision {
    if (observation.authenticated) {
      return {
        type: "complete",
        reason: "The account is authenticated; verify the final account state.",
      };
    }

    if (observation.blocker) {
      return {
        type: "ask_owner",
        blocker: observation.blocker,
        reason: "The site requires owner-controlled verification.",
      };
    }

    const attempted = new Set(state.attempts.map((a) => a.path));
    const next = rankRecoveryOptions(observation.recoveryOptions).find(
      (option) => !attempted.has(option.path),
    );

    if (next) {
      return { type: "try_recovery", option: next };
    }

    if (state.attempts.length > 0) {
      return {
        type: "fail",
        reason: "All discovered legitimate recovery paths have been exhausted.",
      };
    }

    return {
      type: "continue",
      reason: "No recovery path is visible yet; observe the current page again.",
    };
  }
}
