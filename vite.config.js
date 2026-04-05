import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    plugins: [react(), tailwindcss()],
    clearScreen: false,
    base: "./",
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    var normalizedId = id.replace(/\\/g, "/");
                    if (normalizedId.includes("/node_modules/")) {
                        if (normalizedId.includes("/react/") || normalizedId.includes("/react-dom/")) {
                            return "react-vendor";
                        }
                        if (normalizedId.includes("/@tauri-apps/")) {
                            return "tauri-vendor";
                        }
                        if (normalizedId.includes("/pdfjs-dist/")) {
                            return "pdf-vendor";
                        }
                        if (normalizedId.includes("/zod/") || normalizedId.includes("/nspell/")) {
                            return "utility-vendor";
                        }
                        return "vendor";
                    }
                    if (normalizedId.includes("/src/lib/i18n.ts")) {
                        return "i18n";
                    }
                    if (normalizedId.includes("/src/components/views/")) {
                        return "views";
                    }
                    if (normalizedId.includes("/src/components/modals/")) {
                        return "modals";
                    }
                    if (normalizedId.includes("/src/components/overlay/")) {
                        return "overlay";
                    }
                    // These feature folders import each other heavily. Forcing them into
                    // separate manual chunks produces circular chunk warnings during build,
                    // so we let Rollup place them automatically.
                    if (normalizedId.includes("/src/lib/helpGuideLocalization.ts") ||
                        normalizedId.includes("/src/lib/releaseNotesLocalization.ts") ||
                        normalizedId.includes("/src/lib/regressionChecklistLocalization.ts")) {
                        return "localized-content";
                    }
                    if (normalizedId.includes("/quality/release-log.json") ||
                        normalizedId.includes("/quality/qa-feedback.json") ||
                        normalizedId.includes("/quality/reports/latest.json")) {
                        return "quality-data";
                    }
                    return undefined;
                }
            }
        }
    },
    server: {
        port: 1420,
        strictPort: true
    },
    preview: {
        port: 1421,
        strictPort: true
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    }
});
