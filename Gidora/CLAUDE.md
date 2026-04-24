# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A rhythm-action game suite featuring multiplayer 2D/3D mini-games built with Three.js and vanilla JavaScript, plus a Python-based data visualization tool (TableVisualizer) for managing Excel game data.

**Games:** Gidora (4-headed dragon co-op), Flora (rhythm flower attacks), Ptero, Bomber, Shooter variants (TypeC/D/E)

## Running the Games

Games are single HTML files with no build step. Open directly in a browser:

```
open Gidora/Gidora.html
open Flora/Flora.html
open Ptero/Ptero.html
open Bomber/Bomber.html
open Shooter_TypeC/Shooter_TypeE_Twin-Stick.html
```

Three.js is loaded from CDN (`https://unpkg.com/three@0.160.0`) — internet access required.

## TableVisualizer (Python GUI)

```bash
cd TableVisualizer

# Setup
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
pip install -r requirements.txt

# Run
python3 table_visualizer_gui.py

# Build executables
./build_mac.command              # macOS → .app
build_pc.bat                     # Windows → .exe
```

## Game Architecture (Gidora as reference)

Each game is a self-contained HTML file structured in layers:

1. **CONFIG object** — All tunable constants at the top: HP, damage, movement, bullet physics, combo rates, visual colors. This is the first place to look when tweaking balance.

2. **Sound System** — Procedural synthesis via Web Audio API. No audio files; all sounds are generated from oscillators, filters, and envelopes.

3. **Three.js Scene** — Lambert/Basic materials, shadow mapping, directional + ambient lighting. Camera follows the player group centroid.

4. **Entity Classes** (defined inline in the HTML):
   - `Bullet` — Projectile with gravity, homing, penetration flags
   - `Particle` — Short-lived visual effect
   - `Vine` — Segmented combo-attack whip visualization
   - `LevelManager` — Destructible blocks
   - Enemy subtypes: `MeleeEnemy`, `RangedEnemy`, `NinjaEnemy`, `TauntEnemy`/Boss
   - `Gidora` — Player character; body has heads (P1–P3) + tail (P4), handles bullet shooting, melee headbutt, and combo charge meter

5. **Input System** — Keyboard (P1: WASD, P2: Arrows, P3: IJKL, P4: TFGH) + Gamepad API (up to 3 controllers). Polling happens each frame with per-action cooldowns.

6. **Main Loop (`animate`)** — `requestAnimationFrame` loop with delta-time (`dt`) updates: input → entity updates → collision detection → particle updates → camera follow → render.

**Collision** is Euclidean distance-based (no physics engine). Gravity on single bullets is custom. Knockback applied to both player and enemies.

**Game Modes (Gidora):**
- 2P Duo: 2 heads, standard bullet sync
- 4P Quad: 4 heads + tail, merged special shots

## TableVisualizer Architecture

PyQt6 desktop app with four modules:
- `table_visualizer_gui.py` — Main window (Graph View, Relation View, Details Panel, Toolbar)
- `config_manager.py` — Persists UI settings to `gui_config.json`
- `excel_handler.py` — Reads/writes `.xlsx` via openpyxl; COM-based Excel integration on Windows
- `relationship_analyzer.py` — NetworkX graph algorithms for table-to-table relationships

Cached state: `excel_structure.json`, `relationship_graph.json` — regenerated when Excel file changes.

## Tech Stack

| Layer | Technology |
|---|---|
| 3D rendering | Three.js 0.160.0 (ES6 modules via CDN) |
| Game logic | Vanilla JavaScript (ES6+) |
| Audio | Web Audio API (procedural synthesis) |
| Input | Keyboard events + Gamepad API |
| GUI tool | Python 3.13 + PyQt6 6.6+ |
| Excel I/O | openpyxl 3.1+ / pandas 2.0+ |
| Graph analysis | NetworkX 3.0 |
| Packaging | PyInstaller (macOS .app / Windows .exe) |

## 自訂
一律使用繁體中文回覆我
需要我同意指令或任務完成時，請在桌面跳出通知