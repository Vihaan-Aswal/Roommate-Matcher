import { spawn } from "node:child_process";

const devServer = spawn("npm run dev -- --host localhost --port 5173", {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    VITE_API_BASE_URL: "http://127.0.0.1:8000",
    // Placeholder Supabase config for a clean clone; the E2E flow uses demo
    // app tokens, never Supabase auth, so no network call is made.
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "e2e-anon-key",
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
