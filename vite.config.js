import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Foundry는 정적 자산(templates, lang, icons, packs)을 systems/amadeus/... 경로로
// 직접 서빙하므로 번들 대상은 JS 진입점과 거기서 import한 SCSS뿐이다.
// 산출물: dist/amadeus.mjs, dist/amadeus.css
export default defineConfig({
  // dist를 자립형 시스템 패키지로 만든다: 정적 자산을 dist 루트로 복사한다.
  // 따라서 dist/ 하나만 서버의 systems/amadeus 로 배포하면 완전한 시스템이 된다.
  // (system.json의 esmodules/styles/packs/lang 경로는 모두 dist 루트 기준이다.)
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "system.json", dest: "." },
        { src: "template.json", dest: "." },
        { src: "lang", dest: "." },
        { src: "templates", dest: "." },
        { src: "icons", dest: "." },
        { src: "packs", dest: "." },
        { src: "LICENSE.txt", dest: "." },
      ],
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // @import deprecation 경고 억제 (Dart Sass 3.0 전까지 @import 유지).
        // 근본 전환(@use/@forward)은 스타일 회귀 검증이 필요한 별도 작업으로 분리한다.
        silenceDeprecations: ["import"],
      },
    },
  },
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
