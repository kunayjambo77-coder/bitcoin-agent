import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";

// Groth16 proof generation with the official circuit artifacts.
// Artifacts live in ../artifacts (downloaded from https://agentgames.zkverify.io/circuits/).
// Input-signal mapping is configurable via GATEKEEPER_INPUT_MAP / VFY_INPUT_MAP (JSON in env)
// because the exact signal names must match the compiled circuits; proving fails closed:
// any error -> null, and the caller answers REJECT/HOLD instead of inventing a proof reference.

const here = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(here, "..", "artifacts");

const CIRCUITS = {
  gatekeeper: {
    wasm: path.join(ART, "gatekeeper.wasm"),
    zkey: path.join(ART, "gatekeeper_final.zkey"),
  },
  vfyPolicy: {
    wasm: path.join(ART, "vfy-policy.wasm"),
    zkey: path.join(ART, "vfy-policy_final.zkey"),
  },
};

export async function generateProof(circuit, input) {
  const c = CIRCUITS[circuit];
  if (!c) throw new Error(`unknown circuit: ${circuit}`);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, c.wasm, c.zkey);
  return { proof, publicSignals };
}

export function parseInputMap(envValue) {
  if (!envValue) return null;
  try {
    return JSON.parse(envValue);
  } catch {
    return null;
  }
}

// Map a task object to circuit inputs using a { circuitSignalName: "taskField" | "$literal" } map.
export function mapInputs(map, task) {
  if (!map) return null;
  const out = {};
  for (const [signal, src] of Object.entries(map)) {
    if (typeof src === "string" && src.startsWith("$")) out[signal] = src.slice(1);
    else out[signal] = task?.[src];
  }
  return out;
}
