import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../..");

test("docker start script prints compose up command in dry-run mode", async () => {
  const scriptPath = resolve(repoRoot, "scripts/docker/start.sh");
  const { stdout } = await execFileAsync("bash", [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DRY_RUN: "1"
    }
  });

  assert.match(stdout, /docker compose up --build -d/);
});

test("docker stop script prints compose stop command in dry-run mode", async () => {
  const scriptPath = resolve(repoRoot, "scripts/docker/stop.sh");
  const { stdout } = await execFileAsync("bash", [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DRY_RUN: "1"
    }
  });

  assert.match(stdout, /docker compose stop/);
});

test("docker remove script prints compose down command in dry-run mode", async () => {
  const scriptPath = resolve(repoRoot, "scripts/docker/remove.sh");
  const { stdout } = await execFileAsync("bash", [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DRY_RUN: "1"
    }
  });

  assert.match(stdout, /docker compose down --remove-orphans --rmi local/);
});
