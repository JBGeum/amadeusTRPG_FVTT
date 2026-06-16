/**
 * 컴펜디엄 팩 빌드 헬퍼.
 *
 *   node tools/packs.mjs extract   LevelDB(packs/<name>) → 텍스트 소스(src/packs/<name>/*.yaml)
 *   node tools/packs.mjs compile   텍스트 소스(src/packs/<name>) → LevelDB(packs/<name>)
 *
 * 텍스트 소스(src/packs)는 git에서 diff 가능하게 관리하고, LevelDB(packs)는 Foundry가 로드한다.
 */
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { existsSync } from "node:fs";

// system.json의 packs와 일치시킬 것.
const PACKS = ["gifts", "items", "parents", "rolltable"];

const mode = process.argv[2];
if (!["extract", "compile"].includes(mode)) {
  console.error("Usage: node tools/packs.mjs <extract|compile>");
  process.exit(1);
}

for (const name of PACKS) {
  const db = `packs/${name}`;
  const src = `src/packs/${name}`;

  if (mode === "extract") {
    if (!existsSync(db)) {
      console.warn(`skip extract: ${db} (LevelDB 없음)`);
      continue;
    }
    await extractPack(db, src, { yaml: true, log: true });
    console.log(`extracted ${name} → ${src}`);
  } else {
    if (!existsSync(src)) {
      console.warn(`skip compile: ${src} (소스 없음)`);
      continue;
    }
    await compilePack(src, db, { yaml: true, log: true });
    console.log(`compiled ${name} → ${db}`);
  }
}
