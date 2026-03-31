import { spawn } from "node:child_process";

const devServer = spawn("npm run dev -- --host localhost --port 5173", {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    VITE_API_BASE_URL: "http://127.0.0.1:8000",
  },
});

const shutdown = () => {
  if (!devServer.killed) {
    devServer.kill("SIGTERM");
  }
};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, shutdown);
}

devServer.on("exit", (code) => {
  process.exit(code ?? 0);
});
