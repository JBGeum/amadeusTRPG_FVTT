import { defineConfig } from "vite";

// Foundry는 정적 자산(templates, lang, icons, packs)을 systems/amadeus/... 경로로
// 직접 서빙하므로 번들 대상은 JS 진입점과 거기서 import한 SCSS뿐이다.
// 산출물: dist/amadeus.mjs, dist/amadeus.css
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false, // 디버깅 편의를 위해 비압축 출력 (필요 시 true)
    lib: {
      entry: "module/amadeus.mjs",
      formats: ["es"],
      fileName: () => "amadeus.mjs",
    },
    rollupOptions: {
      output: {
        // import된 SCSS는 단일 에셋으로 추출된다 → amadeus.css
        assetFileNames: "amadeus.[ext]",
      },
    },
  },
});
