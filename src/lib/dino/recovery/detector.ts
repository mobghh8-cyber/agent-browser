import type { RecoveryBlocker } from "../task-state";
import type { RecoveryOption } from "./paths";
import type { VisionResult } from "@/lib/browser/types";

export interface RecoveryDetection {
  authenticated: boolean;
  blocker?: RecoveryBlocker;
  options: RecoveryOption[];
  summary: string;
}

const textOf = (vision: VisionResult) =>
  [
    vision.metadata.title,
    vision.metadata.description,
    vision.dom,
    ...vision.interactiveElements.map((e) => [
      e.text,
      e.attributes["aria-label"],
      e.attributes.placeholder,
      e.attributes.name,
      e.attributes.type,
    ].filter(Boolean).join(" ")),
  ].join(" ").toLowerCase();

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function detectRecoveryState(vision: VisionResult): RecoveryDetection {
  const text = textOf(vision);

  if (hasAny(text, ["captcha", "i'm not a robot", "verify you are human"])) {
    return {
      authenticated: false,
      blocker: "captcha",
      options: [],
      summary: "Human verification is required.",
    };
  }

  if (hasAny(text, ["two-factor", "two factor", "2fa", "verification code", "authenticator"])) {
    return {
      authenticated: false,
      blocker: "mfa",
      options: [],
      summary: "Multi-factor authentication is required.",
    };
  }

  if (hasAny(text, ["identity verification", "verify your identity", "government id"])) {
    return {
      authenticated: false,
      blocker: "identity_verification",
      options: [],
      summary: "Identity verification is required.",
    };
  }

  if (hasAny(text, ["recovery key", "backup code", "security key"])) {
    return {
      authenticated: false,
      blocker: "recovery_key",
      options: [],
      summary: "Owner-controlled recovery credentials are required.",
    };
  }

  const authenticated =
    hasAny(text, ["log out", "sign out", "my account", "account settings", "dashboard"]) &&
    !hasAny(text, ["sign in", "log in"]);

  const options: RecoveryOption[] = [];
  const add = (
    path: RecoveryOption["path"],
    label: string,
    confidence: number,
    requiresOwnerInput = false,
  ) => options.push({ path, label, confidence, requiresOwnerInput });

  if (hasAny(text, ["forgot password", "reset password", "password reset"])) {
    add("password_reset", "Password reset", 0.95);
  }
  if (hasAny(text, ["recover email", "email recovery", "lost email"])) {
    add("email_recovery", "Email recovery", 0.9);
  }
  if (hasAny(text, ["new phone", "lost phone", "lost device", "recover account"])) {
    add("device_recovery", "Device/account recovery", 0.8);
  }
  if (hasAny(text, ["contact support", "support", "help center"])) {
    add("support_recovery", "Official support recovery", 0.65);
  }
  if (hasAny(text, ["verify", "alternative", "another way", "other options"])) {
    add("alternate_verification", "Alternative verification", 0.7, true);
  }

  return {
    authenticated,
    options,
    summary: vision.metadata.title || vision.metadata.url,
  };
}
