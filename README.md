# Bitcoin — Agent Games (zkVerify) agent

Competition agent for [Agent Games](https://agentgames.zkverify.io) (zkVerify), account **@BITCOIN**.
Entered in both tracks: **Proof Gatekeeper** and **Steal the VFY**.

## What it does

Implements the official Build-guide contract:

- `GET /health` → `{"status":"ok"}` (continuous platform health probes).
- `POST /agent` accepts signed task envelopes and answers within the 60s hard deadline:
  - `gatekeeper-task` → one deterministic decision. APPROVE only when `amount >= minimum`,
    `publicBalance` covers it, the recipient matches, and the proof VK equals the registered
    gatekeeper `vkHash`; otherwise REJECT with the guide's reason codes
    (`AMOUNT_BELOW_MINIMUM`, `INSUFFICIENT_BALANCE`, `RECIPIENT_MISMATCH`, `VK_SUBSTITUTION`,
    `THRESHOLD_MISMATCH`). Approvals generate a fresh Groth16 proof (snarkjs, official circuit
    artifacts in `artifacts/`) and submit it through the platform verification API, returning the
    reference only after it reaches **Finalized**.
  - `steal-task` → policy v1 answers **HOLD** (amount omitted, as the schema requires). The real
    strategy plugs into `src/policy.js`.
- Every response is signed: `x-agent-games-signature` = HMAC-SHA256 over the raw response body.
- Idempotent: a repeated `idempotencyKey`/`taskId` replays the identical signed response.
- Fail closed: timeouts and uncertainty degrade to REJECT (Gatekeeper) / HOLD (Steal).

## Configuration (environment only — never commit secrets)

| Variable | Meaning |
|---|---|
| `HMAC_SECRET` | Platform secret from the dashboard **Rotate Secret** action |
| `AGENT_API_KEY` | API key issued when the agent was registered |
| `PLATFORM_API_BASE` | Default `https://agentgames.zkverify.io` |
| `REQUIRE_INCOMING_SIG` | `1` to enforce verification of incoming task signatures |
| `STRICT_PROOF` | `1` to degrade unprovable APPROVEs to REJECT |
| `GATEKEEPER_VK_HASH` | Registered gatekeeper vk hash (see `/api/circuit-info`) |
| `GATEKEEPER_INPUT_MAP` | JSON map of circuit input signals → task fields |

See `.env.example`.

## Run

```bash
npm install
npm start          # listens on $PORT (default 3000)
curl localhost:3000/health
```

## Deploy

Public HTTPS only (Fly.io / Railway / Render). `Dockerfile` and `render.yaml` are included.
After deploying, put the endpoint URL (e.g. `https://<host>/agent`) into the agent's
registration in the dashboard, rotate the HMAC secret there, and set the same value as
`HMAC_SECRET` in the host's environment. Do not hot-swap the endpoint while a round is live.

## Circuit artifacts

Downloaded from the official circuit endpoints (hashes published at `/api/circuit-info`):

| Circuit | vkHash |
|---|---|
| Gatekeeper | `0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0` |
| VFY policy | `0x6c56509f1c56fd1fd4e9737f906d2220f4b95f1d507f1adf6899085bd74be047` |
