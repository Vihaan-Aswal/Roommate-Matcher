import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function candidateList(repoRoot) {
  const candidates = [];

  if (process.env.PYTHON_EXECUTABLE) {
    candidates.push({
      command: process.env.PYTHON_EXECUTABLE,
      prefixArgs: [],
      label: "PYTHON_EXECUTABLE",
    });
  }

  const localVenvWindows = path.join(
    repoRoot,
    ".venv",
    "Scripts",
    "python.exe",
  );
  if (fs.existsSync(localVenvWindows)) {
    candidates.push({
      command: localVenvWindows,
      prefixArgs: [],
      label: ".venv/Scripts/python.exe",
    });
  }

  const localVenvPosix = path.join(repoRoot, ".venv", "bin", "python");
  if (fs.existsSync(localVenvPosix)) {
    candidates.push({
      command: localVenvPosix,
      prefixArgs: [],
      label: ".venv/bin/python",
    });
  }

  candidates.push({ command: "python3", prefixArgs: [], label: "python3" });
  candidates.push({ command: "python", prefixArgs: [], label: "python" });

  if (process.platform === "win32") {
    candidates.push({ command: "py", prefixArgs: ["-3"], label: "py -3" });
  }

  return candidates;
}

function probePython(candidate) {
  const result = spawnSync(
    candidate.command,
    [...candidate.prefixArgs, "--version"],
    {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return result.status === 0;
}

export function resolvePythonRuntime(repoRoot) {
  const candidates = candidateList(repoRoot);

  for (const candidate of candidates) {
    if (probePython(candidate)) {
      return candidate;
    }
  }

  const labels = candidates.map((item) => item.label).join(", ");
  throw new Error(
    `Unable to locate a Python interpreter. Tried: ${labels}. ` +
      "Set PYTHON_EXECUTABLE to a valid Python binary path.",
  );
}
