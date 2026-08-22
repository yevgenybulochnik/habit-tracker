import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages serves this repo at /habit-tracker/, so CI builds with
  // BASE_PATH set. Local dev/preview/E2E stay at "/" (e2e specs goto("/")).
  base: process.env.BASE_PATH ?? "/",
  server: {
    host: true, // listen on 0.0.0.0 (all network interfaces)
    allowedHosts: ["devbox.lan"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon-lite.png"],
      manifest: {
        name: "Habit Tracker",
        short_name: "Habits",
        description:
          "Track habits with metrics, sets, streaks, and a calendar heatmap.",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "pwa-192-lite.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512-lite.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512-maskable-lite.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**"],
  },
});
