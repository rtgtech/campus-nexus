import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_BUILD_DIR: ".next-browser",
    CAMPUS_NEXUS_API_URL: "http://127.0.0.1:5055",
    NEXT_PUBLIC_CAMPUS_NEXUS_API_URL: "http://127.0.0.1:5055",
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
