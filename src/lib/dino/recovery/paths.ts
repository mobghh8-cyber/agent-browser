export type RecoveryPath =
  | "password_reset"
  | "email_recovery"
  | "device_recovery"
  | "support_recovery"
  | "alternate_verification";

export interface RecoveryOption {
  path: RecoveryPath;
  label: string;
  confidence: number;
  requiresOwnerInput: boolean;
}

const ORDER: RecoveryPath[] = [
  "password_reset",
  "email_recovery",
  "device_recovery",
  "alternate_verification",
  "support_recovery",
];

export function rankRecoveryOptions(
  options: RecoveryOption[],
): RecoveryOption[] {
  return [...options].sort((a, b) => {
    const order = ORDER.indexOf(a.path) - ORDER.indexOf(b.path);
    return order || b.confidence - a.confidence;
  });
}
