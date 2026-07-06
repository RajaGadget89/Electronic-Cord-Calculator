import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png", "icon-192.png", "icon-512.png", "manual.pdf", "fonts/*.ttf"],
      workbox: {
        // precache pdf + fonts too (so the manual works offline)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,ttf,pdf}"],
        // don't let the SPA navigation fallback (index.html) hijack the PDF/fonts
        navigateFallbackDenylist: [/\.pdf$/, /\/fonts\//],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "9SPYRE Wire — คำนวณสายไฟ (วสท.)",
        short_name: "9SPYRE Wire",
        description: "คำนวณขนาดสายไฟและเบรกเกอร์ตามมาตรฐาน วสท.",
        lang: "th",
        theme_color: "#0A1929",
        background_color: "#0A1929",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
