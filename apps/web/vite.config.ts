import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

type EnvLike = Record<string, string | undefined>;

export function resolveAllowedHosts(env: EnvLike) {
  if (env.VITE_ALLOW_ALL_HOSTS !== "false") {
    return true;
  }

  const configuredHosts = [env.VITE_ALLOWED_HOSTS, env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return configuredHosts.length > 0 ? [...new Set(configuredHosts)] : undefined;
}

export function buildViteConfig(env: EnvLike = process.env): UserConfig {
  const webHost = env.VITE_HOST ?? "0.0.0.0";
  const webPort = Number(env.VITE_PORT ?? 4173);
  const proxyTarget = env.VITE_PROXY_TARGET ?? "http://127.0.0.1:3000";

  return {
    plugins: [react()],
    server: {
      host: webHost,
      port: webPort,
      allowedHosts: resolveAllowedHosts(env),
      proxy: {
        "/api": {
          target: proxyTarget
        },
        "/socket.io": {
          target: proxyTarget,
          ws: true
        }
      }
    }
  };
}

export default defineConfig(buildViteConfig());
