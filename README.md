**English** · [한국어](README.ko.md)

# Amadeus — Foundry VTT Game System

![Foundry v13](https://img.shields.io/badge/foundry-v13-green)
![Language](https://img.shields.io/badge/language-Korean-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

A **game system** for playing the Japanese TRPG **"Amadeus"** in [Foundry VTT](https://foundryvtt.com/). It provides the character sheets, ability/item checks, and compendiums (parent gods, items, roll tables) needed to run a session. The interface and rules text are **entirely in Korean**.

> A mythic fantasy TRPG in which children of the gods carry out missions in the "Severed World." This system lets you run its rules on top of Foundry VTT.

## What it does

- **Character management** — Manage name, age, job, the six abilities, health, money, background, parent god, pantheon, and color attribute all on one sheet.
- **Amadeus-style checks** — Not d20, but a **rank-based d6 roll**. The number of dice depends on the ability's rank (`S=4d6 · A=3d6 · B=2d6 · C=1d6 · D=2d6`), and **each die is judged individually** as a success or failure against the target number (4 by default). `1 = fumble`, `6 = special`.
- **Vitality & health** — A vitality check automatically calculates the starting health and fills it into the sheet. The left value is current HP, the right is the maximum.
- **Item & gift rolls** — Rolling divine weapons, gear, memories, treasures, and gifts (spell / passive / support) from the sheet outputs the result as a **chat card**.
- **Parent god linking** — Dropping a parent god item onto a character applies the ranks and modifiers of all six abilities at once.

### The six core abilities

| Ability  | Key |
|----------|------|
| 武勇       | warfare |
| 技術       | technique |
| 頭脳       | brain |
| 霊力       | spirit |
| 愛情       | love |
| 日常       | mundane |

Each ability has a **rank (S–D)** and a **modifier (`+++` to `--`)**, which together determine the number of dice rolled and the bonus applied.

### Content included

- **Character types**: Player Character, NPC
- **Backgrounds**: Child of Genesis · Calamity · Oracle · Beast · Legend · Machine · Lost · Changeling
- **Pantheons**: Greek · Yamato · Egyptian · Cthulhu · Norse · Chinese · Celtic · Indian · Mesoamerican · Titan
- **Items**: Gift · Background · Parent God · Divine Weapon · Gear · Memory · Treasure

## Requirements

- **Foundry VTT v13 or later**

### Option A — Manifest URL (recommended)

In Foundry's **Game Systems → Install System** screen, paste the manifest URL into the bottom field and click Install:

```
https://github.com/JBGeum/amadeusTRPG_FVTT/releases/latest/download/system.json
```

> ⚠️ This URL is a temporary placeholder. It only works once a GitHub Release containing `system.json` and `amadeus.zip` has been published. Until then, use Option B.

### Option B — Manual install

The build output `dist/` is itself a complete, self-contained system package.

1. Build the system (see [Building from source](#building-from-source) below). If you already have a built `dist/`, use it as is.
2. Copy the **entire contents** of `dist/` into `Data/systems/amadeus/` under your Foundry data path.
   - The Foundry data path is usually:
     - Windows: `%localappdata%\FoundryVTT\Data\systems\`
     - macOS: `~/Library/Application Support/FoundryVTT/Data/systems/`
     - Linux: `~/.local/share/FoundryVTT/Data/systems/`
3. Launch Foundry VTT and create a world by selecting *Amadeus* from the **Game Systems** list.

> After changing system files (e.g. `system.json`), **restart** Foundry for the changes to take effect.

## License

MIT — see `LICENSE.txt` for details.

---

## Building from source

To build from source you need Node.js (LTS) and npm. The build tool is **Vite**; `npm run build` bundles the JS, SCSS, and metadata into a self-contained `dist/`.

```bash
npm install        # install dependencies (first time only)
npm run build      # bundle into dist/ — required before installing
npm run dev        # rebuild automatically on source changes
```

> For compendium pack editing (`npm run pack:extract` / `pack:compile`), code conventions, architecture, and other development details, see `CLAUDE.md` in the repository.