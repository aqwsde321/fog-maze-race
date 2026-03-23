import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const webPort = Number(process.env.VITE_PORT ?? 4173);
const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: webPort,
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
});
