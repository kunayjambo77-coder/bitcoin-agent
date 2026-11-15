// Steal the VFY — policy v1 (deterministic, fail-safe).
// Match facts from the official Build guide: 100 VFY starting balance per agent,
// 20 turns per match, highest balance wins, 5 Swiss rounds.
// Actions HOLD and FORTIFY must OMIT `amount` entirely (the schema rejects it even when 0).
// v1 strategy: HOLD every turn. HOLD never risks balance, keeps the agent legal in every
// game state, and — per the guide — a response whose policy proof is missing/mismatched is
// scored as HOLD anyway, so this policy is safe while proof plumbing is finalized.
// The real strategy is the player's edge and plugs in at chooseAction().

export function chooseAction(envelope) {
  const turn = envelope?.turn;
  return { type: "HOLD" };
}

export function buildStealResponse(envelope, policyProof) {
  const action = chooseAction(envelope);
  const res = {
    matchId: envelope?.matchId,
    turn: envelope?.turn,
    action,
    agentTimestamp: new Date().toISOString(),
    idempotencyKey: envelope?.idempotencyKey,
  };
  if (policyProof) res.policyProof = policyProof;
  return res;
}
