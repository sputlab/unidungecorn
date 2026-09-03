# 🦄 UniDungeCorn

A procedurally generated roguelike with a **unicorn & rainbow** theme, entirely contained in a single self-sufficient HTML file — no external images, fonts, or audio: everything is generated in code.

---

## 1. Quick start

- **Game file:** `index.html`
- **Requirements:** any modern browser (Chrome, Firefox, Edge, Safari) with Canvas 2D and Web Audio API support — no installation, no internet connection required.
- **How to play:** simply double-click the `.html` file, or drag it into a browser window.
- **Contest compliance:** single file, **13,077 bytes** (under the 13 KB / 13,312-byte limit), fully self-contained — no references to online resources, CDNs, or external libraries (graphics on Canvas, audio synthesized via the Web Audio API, persistence via `localStorage`).

---

## 2. The game

### Setting
The **Grey Kingdom** has lost all its color. Playing as a unicorn, you descend ever deeper into a procedurally generated dungeon, defeating creatures of shadow and bringing the rainbow back one floor at a time.

### Goal
Descend as far as you can — the descent is endless, there is no "final floor": the game is about beating your own best depth (saved locally) before you fall.

### Playable classes
Chosen on the splash screen (↑↓ to navigate, Enter/Space to confirm):

| Class | HP | ATK | DEF | Special |
|---|---|---|---|---|
| 🦄 **Alicorn Warrior** | 20 | 4 | 3 | Sturdy and resilient, shrugs off hits with ease |
| 🦄 **Shadow Pony** | 15 | 5 | 1 | 25% critical hit chance (double damage) |
| 🦄 **Star Mage** | 12 | 3 | 0 | Ranged spell (key `F`, range 4, requires line of sight) |

### Controls

| Key | Action |
|---|---|
| `W A S D` / Arrows | Move (and attack by "bumping" into an enemy) |
| `E` | Drink a potion (backpack: max 3) |
| `F` | Ranged spell *(Star Mage only)* |
| `M` | Toggle music on/off |
| `Enter` | Start game (on splash screen) · Toggle fullscreen (in-game) |
| `R` | Restart (after death) |

### Core mechanics
- **Procedural dungeon**: rooms + corridors generated on every floor, with an endless descent via stairs (`>`)
- **Fog of war with true line of sight** (Bresenham's algorithm, not a simple radius) — you only see what's actually visible in a straight line
- **Bump-to-attack combat**: move into an enemy to strike it
- **Inventory and equipment**: healing potions (3-slot backpack), Enchanted Horns (`/`, permanent +ATK), Shining Manes (`[`, permanent +DEF), rare Rainbow Crystals (`*`, a bonus to all stats)
- **Enemies**: Envious Shadows, Grey Clouds (erratic movement), Storm Trolls (a powered-up "charge" attack every 3 hits), and the boss **Storm King** every 5 floors
- **Fleeing enemies**: below 25% HP (boss excluded), enemies flee instead of attacking
- **Hidden traps**: dark clouds (damage) or unstable portals (teleport) concealed in some rooms
- **Visual and audio feedback**: freely floating colored particles, screen shake, mobile vibration, stereo positional audio, continuous procedural ambient music
- **Minimap**, multi-line message log, directional indicator for nearby off-screen enemies, passive HP regeneration (+1 every 25 turns), a personal best saved across sessions

### Difficulty
The game is designed to be **challenging**: enemy stats scale quickly with depth (roughly +22% per floor), bosses are a genuine wall, traps are frequent and punishing, and potions heal little and are scarce. Dying regularly is normal — expected, even — it's part of the roguelike "try, die, try again" loop.

---

## 3. Technical notes

### Stack
- **Vanilla HTML/CSS/JS**, zero libraries or external dependencies
- **Rendering**: Canvas 2D, using glyphs/emoji as sprites (classic text-based roguelike style)
- **Audio**: Web Audio API oscillators generated at runtime (no audio samples), with stereo panning positioned relative to the target/attacker
- **Persistence**: `localStorage` for the best depth reached

### Adaptive canvas and fullscreen
- The canvas resizes dynamically to fit the available window space (`fitCanvas()`, called on resize): tile size always stays fixed at 16px, so a larger window shows **more of the map**, not bigger or blurrier elements
- The dungeon's logical map is generous (110×60 tiles) to give plenty of room on large screens; unexplored areas simply remain hidden in the fog of war
- The `Enter` key (outside the splash screen) triggers real **browser fullscreen** via the native Fullscreen API

### Procedural generation
- Each floor generates 9-14 rectangular rooms connected by L-shaped corridors, avoiding overlaps (with a safety attempt cap to always guarantee termination)
- Room population: enemies (~55% chance per room), items (~40%), hidden traps (~42% of non-start/non-stairs rooms)
- Enemy type and power scale with floor depth; a boss appears every 5 floors

### Performance optimizations
- **Cached minimap**: instead of redrawing the whole minimap (up to 6,600 cells) every frame, it's rendered once per turn onto an offscreen canvas and simply blitted (`drawImage`) — near-zero per-frame cost
- **Turn-independent animation loop**: a real `requestAnimationFrame` loop (`tickFX`) animates particles and screen shake in real time (with delta-time), decoupled from player input — sparks float freely with inertia and a slight upward drift, instead of only updating on each keypress

### Minification and budget
- The readable source (`unidungecorn_readable_source.js`, ~21 KB) is compressed with **Terser** (`-c -m --toplevel`), which renames top-level variables/functions and strips whitespace and comments
- Several repeated strings/colors/font sizes were factored into shared constants to further reduce the minified weight
- The HTML wrapper is trimmed to the essentials (no explicit `<head>`/`<body>`, minimal CSS just to center the canvas)
- **Final result**: 13,077 raw bytes (~5.8 KB gzip), against a 13 KB (13,312-byte) limit

### Balancing approach
Difficulty tuning wasn't done by eye: it was validated with an **automated playtesting bot** (a Node.js script that simulates full runs using BFS pathfinding, potion management, and ranged-spell usage) to empirically measure death rate and average floor reached before adjusting the game's constants (enemy scaling, trap damage, potion healing, room density).

### Working files
- `index.html` — final minified build, ready for submission
- `unidungecorn_readable_source.js` — commented, human-readable JavaScript source, useful for understanding or modifying the game logic (it needs to be pasted back into the HTML template and re-minified to produce a new build)

---

## 4. Credits
Developed as an entry for the [js13kgames](https://js13kgames.com/) competition, themed around unicorns and rainbows. No third-party assets: graphics, sound, and music are all generated entirely in code at runtime.
