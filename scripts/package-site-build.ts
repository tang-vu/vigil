import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const serverEntrypoint = resolve(workspace, "dist", "server", "index.js");
const hostingSource = resolve(workspace, ".openai", "hosting.json");
const hostingDirectory = resolve(workspace, "dist", ".openai");
const hostingTarget = resolve(hostingDirectory, "hosting.json");

await access(serverEntrypoint, constants.R_OK);
await access(hostingSource, constants.R_OK);
await mkdir(hostingDirectory, { recursive: true });
await copyFile(hostingSource, hostingTarget);
await access(hostingTarget, constants.R_OK);

process.stdout.write(
  "Sites package verified: dist/server/index.js + dist/.openai/hosting.json\n",
);
