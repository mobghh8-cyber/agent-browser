import browserEngine from "@/lib/browser/engine";
import actionExecutor from "@/lib/browser/actions";
import visionSystem from "@/lib/browser/vision";
import { createTaskState, type DinoTaskState } from "./task-state";
import { RecoveryDecisionEngine } from "./decision-engine";
import { detectRecoveryState } from "./recovery/detector";
import { createEscalation } from "./recovery/escalation";

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

    const observation = await this.observe(sessionId);
    state.lastObservation = observation.summary;

    const decision = this.decisions.decide(state, observation);

    if (decision.type === "ask_owner") {
      state.status = "waiting_for_owner";
      state.blockers.push(decision.blocker);
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
      return {
        state,
        message: `Recovery path selected: ${decision.option.label}. The browser action layer can now execute the site's normal recovery flow.`,
      };
    }

    return { state, message: decision.reason };
  }
}

export const dinoRecoveryAgent = new DinoRecoveryAgent();
export default dinoRecoveryAgent;
