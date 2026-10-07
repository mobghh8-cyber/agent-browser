export type RecoveryStatus =
  | "idle"
  | "observing"
  | "recovering"
  | "waiting_for_owner"
  | "completed"
  | "failed";

export type RecoveryBlocker =
  | "captcha"
  | "mfa"
  | "identity_verification"
  | "recovery_key"
  | "unknown_owner_input";

export interface RecoveryAttempt {
  path: string;
  startedAt: string;
  completedAt?: string;
  result: "success" | "failed" | "blocked";
  note?: string;
}

export interface DinoTaskState {
  taskId: string;
  targetUrl: string;
  accountHint?: string;
  status: RecoveryStatus;
  attempts: RecoveryAttempt[];
  blockers: RecoveryBlocker[];
  ownerInputRequired: boolean;
  lastObservation?: string;
}

export function createTaskState(
  taskId: string,
  targetUrl: string,
  accountHint?: string,
): DinoTaskState {
  return {
    taskId,
    targetUrl,
    accountHint,
    status: "idle",
    attempts: [],
    blockers: [],
    ownerInputRequired: false,
  };
}
