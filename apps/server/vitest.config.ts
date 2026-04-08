import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const sharedIndexPath = fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url));
const sharedSrcPath = fileURLToPath(new URL("../../packages/shared/src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@fog-maze-race\/shared$/,
        replacement: sharedIndexPath
      },
      {
        find: /^@fog-maze-race\/shared\/(.+)$/,
        replacement: `${sharedSrcPath}/$1.ts`
      }
    ]
  },
  test: {
    name: "server",
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
