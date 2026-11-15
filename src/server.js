import express from "express";
import { signResponse, verifyIncoming } from "./sign.js";
import { decideGatekeeper } from "./gatekeeper.js";
import { generateProof, mapInputs, parseInputMap } from "./prove.js";
import { submitAndFinalize } from "./platform.js";
import { buildStealResponse } from "./policy.js";

// Agent Games agent server — "Bitcoin" (@BITCOIN)
// Implements the official Build-guide contract:
//  - GET  /health          -> {"status":"ok"}
//  - POST /agent (or /)    -> signed, deterministic task responses (< 60s, fail closed)
//  - Responses are signed with x-agent-games-signature = HMAC-SHA256(HMAC_SECRET, rawBody).
// Secrets come from the environment only: HMAC_SECRET (dashboard Rotate Secret value),
// AGENT_API_KEY (issued at registration). Never hardcode or log them.

const PORT = process.env.PORT || 3000;
const HMAC_SECRET = process.env.HMAC_SECRET || "";
const REQUIRE_INCOMING_SIG = process.env.REQUIRE_INCOMING_SIG === "1";
const STRICT_PROOF = process.env.STRICT_PROOF === "1";
const GATEKEEPER_VK = process.env.GATEKEEPER_VK_HASH || "0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0";
const GATEKEEPER_INPUT_MAP = parseInputMap(process.env.GATEKEEPER_INPUT_MAP);
const DEADLINE_MS = 55_000;

const app = express();
const idempotency = new Map(); // key -> { raw, sig }

app.get("/health", (_req, res) => res.json({ status: "ok" }));

function sendSigned(res, obj) {
  const raw = JSON.stringify(obj);
  if (HMAC_SECRET) res.setHeader("x-agent-games-signature", signResponse(HMAC_SECRET, raw));
  res.setHeader("content-type", "application/json");
  return res.send(raw);
}

async function handleGatekeeper(env) {
  const task = env.task || {};
  const verdict = decideGatekeeper(task, GATEKEEPER_VK);
  if (verdict.decision !== "APPROVE") return verdict;
  // APPROVE requires fresh proof evidence; generate + submit + wait for Finalized.
  const inputs = mapInputs(GATEKEEPER_INPUT_MAP, task);
  if (!inputs) {
    return STRICT_PROOF ? { decision: "REJECT", reason_code: "THRESHOLD_MISMATCH" } : verdict;
  }
  try {
    const { proof, publicSignals } = await generateProof("gatekeeper", inputs);
    const fin = await submitAndFinalize({ proof, publicSignals, vkHash: GATEKEEPER_VK });
    if (!fin.finalized) {
      return STRICT_PROOF ? { decision: "REJECT", reason_code: "THRESHOLD_MISMATCH" } : verdict;
    }
    return { ...verdict, proof_tx: fin.reference };
  } catch {
    return STRICT_PROOF ? { decision: "REJECT", reason_code: "THRESHOLD_MISMATCH" } : verdict;
  }
}

async function handleSteal(env) {
  // Policy proof wiring lands with the strategy commitment; v1 answers HOLD (see policy.js).
  return buildStealResponse(env, null);
}

async function handleEnvelope(env) {
  if (env?.kind === "gatekeeper-task") return handleGatekeeper(env);
  if (env?.kind === "steal-task") return handleSteal(env);
  return { error: "unknown_kind" };
}

app.post(["/agent", "/"], express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const rawBody = req.body?.toString("utf8") || "";
  const incomingSig = req.get("x-agent-games-signature");
  if (REQUIRE_INCOMING_SIG && !verifyIncoming(HMAC_SECRET, rawBody, incomingSig)) {
    return res.status(401).json({ error: "bad_signature" });
  }
  let env;
  try {
    env = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "bad_json" });
  }
  const idemKey = env.idempotencyKey || env.taskId || (env.matchId ? `${env.matchId}:${env.turn}` : null);
  if (idemKey && idempotency.has(idemKey)) {
    const hit = idempotency.get(idemKey);
    if (hit.sig) res.setHeader("x-agent-games-signature", hit.sig);
    res.setHeader("content-type", "application/json");
    return res.send(hit.raw);
  }
  let result;
  try {
    result = await Promise.race([
      handleEnvelope(env),
      new Promise((resolve) =>
        setTimeout(
          () => resolve(env?.kind === "steal-task" ? buildStealResponse(env, null) : { decision: "REJECT", reason_code: "THRESHOLD_MISMATCH" }),
          DEADLINE_MS
        )
      ),
    ]);
  } catch {
    result = env?.kind === "steal-task" ? buildStealResponse(env, null) : { decision: "REJECT", reason_code: "THRESHOLD_MISMATCH" };
  }
  const raw = JSON.stringify(result);
  const sig = HMAC_SECRET ? signResponse(HMAC_SECRET, raw) : null;
  if (idemKey) idempotency.set(idemKey, { raw, sig });
  if (sig) res.setHeader("x-agent-games-signature", sig);
  res.setHeader("content-type", "application/json");
  return res.send(raw);
});

app.listen(PORT, () => {
  console.log(`bitcoin-agent listening on :${PORT} (health: /health, tasks: POST /agent)`);
});
