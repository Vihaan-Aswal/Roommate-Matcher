import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const pythonExe = path.join(repoRoot, ".venv", "Scripts", "python.exe");
const seedScript = path.join(repoRoot, "demo-data", "seed.py");

execFileSync(
  pythonExe,
  [seedScript, "--reset", "--schema-only"],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);
