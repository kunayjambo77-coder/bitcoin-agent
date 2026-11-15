// Proof Gatekeeper decision rules (deterministic — same input, same decision).
// APPROVE only when every condition holds; otherwise REJECT with the matching reason code.
// Reason codes per the official Build guide:
//   AMOUNT_BELOW_MINIMUM, RECIPIENT_MISMATCH, INSUFFICIENT_BALANCE, VK_SUBSTITUTION, THRESHOLD_MISMATCH
// Fail closed: any missing/uncertain input is a REJECT.

export const REASONS = {
  VALID: "VALID_CONDITION",
  AMOUNT_BELOW_MINIMUM: "AMOUNT_BELOW_MINIMUM",
  RECIPIENT_MISMATCH: "RECIPIENT_MISMATCH",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  VK_SUBSTITUTION: "VK_SUBSTITUTION",
  THRESHOLD_MISMATCH: "THRESHOLD_MISMATCH",
};

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

// task: { amount, minimum, publicBalance, recipient, proofVk, expectedRecipient? }
// expectedVkHash: the gatekeeper vkHash registered on zkVerify mainnet (see /api/circuit-info).
export function decideGatekeeper(task, expectedVkHash) {
  if (!task || typeof task !== "object") {
    return { decision: "REJECT", reason_code: REASONS.THRESHOLD_MISMATCH };
  }
  const { amount, minimum, publicBalance, recipient, proofVk, expectedRecipient } = task;

  if (!isNum(amount) || !isNum(minimum) || !isNum(publicBalance)) {
    return { decision: "REJECT", reason_code: REASONS.THRESHOLD_MISMATCH };
  }
  if (amount < minimum) {
    return { decision: "REJECT", reason_code: REASONS.AMOUNT_BELOW_MINIMUM };
  }
  if (publicBalance < minimum || publicBalance < amount) {
    return { decision: "REJECT", reason_code: REASONS.INSUFFICIENT_BALANCE };
  }
  if (expectedRecipient !== undefined && expectedRecipient !== null) {
    if (!recipient || String(recipient) !== String(expectedRecipient)) {
      return { decision: "REJECT", reason_code: REASONS.RECIPIENT_MISMATCH };
    }
  }
  if (expectedVkHash && proofVk) {
    if (String(proofVk).toLowerCase() !== String(expectedVkHash).toLowerCase()) {
      return { decision: "REJECT", reason_code: REASONS.VK_SUBSTITUTION };
    }
  }
  return { decision: "APPROVE", reason_code: REASONS.VALID };
}
