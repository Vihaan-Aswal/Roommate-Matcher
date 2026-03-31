import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePythonRuntime } from "./python-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const seedScript = path.join(repoRoot, "demo-data", "seed.py");
const python = resolvePythonRuntime(repoRoot);

execFileSync(
  python.command,
  [...python.prefixArgs, seedScript, "--reset", "--schema-only"],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);
