import js from "@eslint/js";
import globals from "globals";

// ESLint 9+ flat config.
// @eslint/js recommended는 포맷 규칙을 포함하지 않으므로 Prettier와 충돌하지 않는다.
export default [
  {
    ignores: ["dist/**", "lib/**", "packs/**", "css/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        // --- Foundry VTT 전역 (전역으로 주입되어 import 없이 사용됨) ---
        foundry: "readonly",
        game: "readonly",
        CONFIG: "readonly",
        CONST: "readonly",
        Hooks: "readonly",
        ui: "readonly",
        canvas: "readonly",
        // Document/컬렉션 클래스
        Actor: "readonly",
        Item: "readonly",
        Actors: "readonly",
        Items: "readonly",
        ActorSheet: "readonly",
        ItemSheet: "readonly",
        ChatMessage: "readonly",
        Macro: "readonly",
        Roll: "readonly",
        RollTable: "readonly",
        Combat: "readonly",
        // 전역 유틸 (v13에서 foundry.utils.*로 이전 예정 — 마이그레이션 시 정리)
        Handlebars: "readonly",
        renderTemplate: "readonly",
        loadTemplates: "readonly",
        mergeObject: "readonly",
        duplicate: "readonly",
        DEFAULT_TOKEN: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // 빌드/도구 스크립트는 Node 환경에서 실행된다.
    files: ["tools/**/*.{mjs,js}", "*.config.{mjs,js}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
