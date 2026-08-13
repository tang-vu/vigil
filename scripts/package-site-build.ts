import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const serverEntrypoint = resolve(workspace, "dist", "server", "index.js");
const hostingSource = resolve(workspace, ".openai", "hosting.json");
const hostingDirectory = resolve(workspace, "dist", ".openai");
const hostingTarget = resolve(hostingDirectory, "hosting.json");

// A prior `next build` leaves validators that import Next-specific route type
// names. Vinext then replaces routes.d.ts with its own namespace, so retaining
// those stale generated validators makes a later `tsc --noEmit` fail. They are
// build artifacts, not source, and vinext performs its own route analysis.
await Promise.all([
  rm(resolve(workspace, ".next", "types", "validator.ts"), { force: true }),
  rm(resolve(workspace, ".next", "dev", "types", "validator.ts"), {
    force: true,
  }),
]);

await access(serverEntrypoint, constants.R_OK);
await access(hostingSource, constants.R_OK);
await mkdir(hostingDirectory, { recursive: true });
await copyFile(hostingSource, hostingTarget);
await access(hostingTarget, constants.R_OK);

process.stdout.write(
  "Sites package verified: dist/server/index.js + dist/.openai/hosting.json\n",
);
