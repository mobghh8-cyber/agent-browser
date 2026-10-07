import type { RecoveryBlocker } from "../task-state";

export interface OwnerEscalation {
  required: true;
  blocker: RecoveryBlocker;
  message: string;
  resumeAfterOwnerAction: boolean;
}

export function createEscalation(
  blocker: RecoveryBlocker,
): OwnerEscalation {
  const messages: Record<RecoveryBlocker, string> = {
    captcha: "Complete the CAPTCHA in the browser, then Dino can continue.",
    mfa: "Complete the site's MFA challenge using your authorized device or method.",
    identity_verification:
      "Complete the site's identity verification process as the account owner.",
    recovery_key:
      "Provide the site's legitimate recovery key or use another offered recovery method.",
    unknown_owner_input:
      "The site requires information that only the account owner can provide.",
  };

  return {
    required: true,
    blocker,
    message: messages[blocker],
    resumeAfterOwnerAction: true,
  };
}
