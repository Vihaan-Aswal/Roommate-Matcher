import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const backendDir = path.join(repoRoot, "backend");
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

const server = spawn(
  pythonExe,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ],
  {
    cwd: backendDir,
    stdio: "inherit",
  },
);

const shutdown = () => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, shutdown);
}

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
