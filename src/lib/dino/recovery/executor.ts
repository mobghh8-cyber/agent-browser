import actionExecutor from "@/lib/browser/actions";
import browserEngine from "@/lib/browser/engine";
import visionSystem from "@/lib/browser/vision";
import type { RecoveryOption } from "./paths";

export interface RecoveryExecutionResult {
  success: boolean;
  changedPage: boolean;
  message: string;
}

const LABELS: Record<RecoveryOption["path"], string[]> = {
  password_reset: ["forgot password", "reset password", "password reset"],
  email_recovery: ["recover email", "email recovery", "lost email"],
  device_recovery: ["lost phone", "lost device", "new phone", "recover account"],
  alternate_verification: ["another way", "other options", "alternative", "verify"],
  support_recovery: ["contact support", "support", "help center"],
};

function matches(label: string, terms: string[]) {
  const value = label.toLowerCase();
  return terms.some((term) => value.includes(term));
}

export class RecoveryPathExecutor {
  async execute(
    sessionId: string,
    option: RecoveryOption,
    accountHint?: string,
  ): Promise<RecoveryExecutionResult> {
    const session = browserEngine.getSession(sessionId);
    if (!session) {
      return { success: false, changedPage: false, message: "Browser session is not active." };
    }

    const vision = await visionSystem.captureVision(session.page);
    const terms = LABELS[option.path];

    const control = vision.interactiveElements.find((element) =>
      matches(
        [element.text, element.attributes["aria-label"], element.attributes.name, element.attributes.placeholder]
          .filter(Boolean)
          .join(" "),
        terms,
      ),
    );

    if (!control) {
      return {
        success: false,
        changedPage: false,
        message: `Could not find a safe control for recovery path "${option.label}".`,
      };
    }

    const click = await actionExecutor.execute(sessionId, {
      action: "click",
      target: control.selector,
    });

    if (!click.success) {
      return {
        success: false,
        changedPage: false,
        message: click.error || `Could not activate "${option.label}".`,
      };
    }

    if (accountHint) {
      const nextVision = await visionSystem.captureVision(session.page);
      const input = nextVision.interactiveElements.find((element) => {
        const text = [
          element.text,
          element.attributes["aria-label"],
          element.attributes.name,
          element.attributes.placeholder,
          element.type,
        ].filter(Boolean).join(" ").toLowerCase();

        return element.type === "input" &&
          (text.includes("email") || text.includes("username") || text.includes("account"));
      });

      if (input) {
        await actionExecutor.execute(sessionId, {
          action: "type",
          target: input.selector,
          value: accountHint,
        });
      }
    }

    return {
      success: true,
      changedPage: true,
      message: `Activated the normal "${option.label}" recovery flow.`,
    };
  }
}

export const recoveryPathExecutor = new RecoveryPathExecutor();
export default recoveryPathExecutor;
