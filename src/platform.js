// Client for the Agent Games platform verification API (Kurier path).
// Flow per the Build guide: submit a Groth16 proof with its public signals, then poll
// until the job reaches Finalized; only then is the proof reference safe to return.
// All calls use the agent's API key in the `x-api-key` header. The key and the HMAC
// secret live ONLY in server environment variables — never in code, logs, or the repo.

const BASE = process.env.PLATFORM_API_BASE || "https://agentgames.zkverify.io";
const API_KEY = process.env.AGENT_API_KEY || "";

async function call(pathname, body) {
    const res = await fetch(`${BASE}${pathname}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": API_KEY },
          body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`platform ${pathname} -> HTTP ${res.status}`);
    return res.json();
}

export async function submitProof({ proof, publicSignals, vkHash }) {
    return call("/api/vfy/submit", { proof, public_signals: publicSignals, vkHash });
}

export async function verifyStatus(reference) {
    return call("/api/vfy/verify", { reference });
}

export async function submitAndFinalize(payload, { timeoutMs = 45_000, pollMs = 3_000 } = {}) {
    const submitted = await submitProof(payload);
    const reference = submitted?.reference || submitted?.proofReference || submitted?.txHash || submitted?.id;
    if (!reference) return { finalized: false, reference: null, raw: submitted };
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
          const st = await verifyStatus(reference);
          const status = String(st?.status || st?.state || "").toLowerCase();
          if (status.includes("final")) return { finalized: true, reference, raw: st };
          if (status.includes("reject") || status.includes("fail")) return { finalized: false, reference, raw: st };
          await new Promise((r) => setTimeout(r, pollMs));
    }
    return { finalized: false, reference, raw: submitted };
}
