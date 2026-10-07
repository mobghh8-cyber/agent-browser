import browserEngine from "@/lib/browser/engine";
import actionExecutor from "@/lib/browser/actions";
import visionSystem from "@/lib/browser/vision";
import { createTaskState, type DinoTaskState } from "./task-state";
import { RecoveryDecisionEngine } from "./decision-engine";
import { detectRecoveryState } from "./recovery/detector";
import { createEscalation } from "./recovery/escalation";
import recoveryPathExecutor from "./recovery/executor";

const MAX_STEPS = 8;

export interface DinoRunResult {
  state: DinoTaskState;
  message: string;
}

export class DinoRecoveryAgent {
  private readonly decisions = new RecoveryDecisionEngine();

  async observe(sessionId: string) {
    const session = browserEngine.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const vision = await visionSystem.captureVision(session.page);
    return detectRecoveryState(vision);
  }

  async run(
    sessionId: string,
    targetUrl: string,
    accountHint?: string,
  ): Promise<DinoRunResult> {
    const state = createTaskState(
      `dino-${Date.now()}`,
      targetUrl,
      accountHint,
    );

    const session = browserEngine.getSession(sessionId);
    if (!session) {
      state.status = "failed";
      return { state, message: "Browser session is not active." };
    }

    state.status = "observing";
    const navigation = await actionExecutor.execute(sessionId, {
      action: "navigate",
      target: targetUrl,
    });

    if (!navigation.success) {
      state.status = "failed";
      return { state, message: navigation.error || "Navigation failed." };
    }

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const observation = await this.observe(sessionId);
      state.lastObservation = observation.summary;

      const decision = this.decisions.decide(state, observation);

      if (decision.type === "ask_owner") {
        state.status = "waiting_for_owner";
        if (!state.blockers.includes(decision.blocker)) {
          state.blockers.push(decision.blocker);
        }
        state.ownerInputRequired = true;
        return {
          state,
          message: createEscalation(decision.blocker).message,
        };
      }

      if (decision.type === "complete") {
        state.status = "completed";
        return { state, message: decision.reason };
      }

      if (decision.type === "try_recovery") {
        state.status = "recovering";
        const startedAt = new Date().toISOString();

        const execution = await recoveryPathExecutor.execute(
          sessionId,
          decision.option,
          accountHint,
        );

        state.attempts.push({
          path: decision.option.path,
          startedAt,
          completedAt: new Date().toISOString(),
          result: execution.success ? "success" : "failed",
          note: execution.message,
        });

        if (!execution.success) {
          continue;
        }

        continue;
      }

      if (decision.type === "continue") {
        state.status = "observing";
        await actionExecutor.execute(sessionId, {
          action: "wait",
          value: "500",
        });
        continue;
      }

      state.status = "failed";
      return { state, message: decision.reason };
    }

    state.status = "failed";
    return {
      state,
      message: `Recovery stopped after ${MAX_STEPS} bounded steps to prevent loops.`,
    };
  }
}

export const dinoRecoveryAgent = new DinoRecoveryAgent();
export default dinoRecoveryAgent;
