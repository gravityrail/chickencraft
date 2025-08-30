Original customer request:

> A game called "Chickencraft", suitable for giving to a very smart developer. It should specify all the game mechanics (make the game super fun and intuitive for anyone who has played Minecraft! And feel free to include any cute surprises you like) 
> Also be sure to specify clear development phases so that we can get a working engine early in the process and iterate while adding features. The basics are this: The game is similar to "minecraft", with the user able to place various kinds of blocks in a world. The world should be generated on a 1024x1024 grid. The game is built using whatever you think is the best web-based 3d gaming library or standard suitable for this. BabylonJS? 
> The types of blocks are: 
> - "chickenhead" blocks, which have a chicken face on them 
> - grass, wood, brick, bedrock, and lava blocks 
> - the user can choose between an sword, axe, pickaxe, and bare fist tools 
> - the landscape has varying elevation, with a water plane at the ground level if the terrain goes below 0 
> - the user can navigate with arrow keys (turn, forward/backward) or wasd + mouse look, or use web standard gaming controllers 
> - a crafting table to make the tools. Tools are made from the type of blocks you have on the crafting table. Certain configurations of blocks on a 3x3 grid result in certain tools or other objects becoming available. 
> - ability to generate new levels, with sliders to control mountainous-ness, types of terrain, weather (fog, night, sunset, sunny day, clouds, etc) and anything else you think would be fun.

## 0) Vision & Core Pillars

**High‑level:** First‑person voxel builder on a **1024 × 1024** world grid (X×Z) with vertical layers (Y). Place/break blocks, craft tools on a 3×3 table, and regenerate worlds with tunable sliders (terrain, weather, time of day). Includes a whimsical “chickenhead” block and a few tasteful surprises.

**Pillars**

1. **Intuitive**: WASD + mouselook, hotbar, crosshair mining—no tutorials required.
2. **Snappy**: 60 FPS target on mid‑range laptops; chunked meshing, greedy faces, texture atlas, pooled buffers.
3. **Tweakable**: Real‑time world‑gen sliders & seeds encourage rapid iteration.
4. **Silly Delight**: Lighthearted chicken‑themed secrets that never block core play.

---

## 1) Tech Stack & Rationale

* **Engine:** **Babylon.js** (TypeScript). Why: stable WebGPU/WebGL fallback, built‑in GUI & Gamepad API bindings, simple lights/fog/skybox, collisions helpers, and strong materials pipeline. Three.js is a fine alternative, but Babylon reduces boilerplate for cameras, post‑FX, and UI.
* **Language:** TypeScript (strict mode).
* **Build:** Vite + esbuild (fast HMR), ESLint, Prettier.
* **Physics:** Lightweight AABB + sweep tests (no rigid‑body sim needed).
* **Workers:** Web Worker for terrain generation + chunk meshing off the main thread.
* **Data:** IndexedDB for save games (binary chunks via ArrayBuffer).
* **Audio:** WebAudio (pooled buffers, simple mixer).

---

## 2) World Model

* **Horizontal size:** 1024 × 1024 tiles (X×Z).
* **Vertical range:** Y ∈ \[-32, 192] (suggested).
* **Sea level / water plane:** **Y = 0.** Any terrain below 0 is submerged.
* **Coordinates:** Babylon’s left‑handed system; Y up; X east; Z north.
* **Chunking:**  **32×32×64** (X×Z×Y) blocks per chunk.

  * Total vertical 225 layers fits into 4 chunks (−32..191) => manageable streaming.
* **Block representation (packed):**

  ```ts
  // 16 bits per cell (2 bytes). Fits nicely in a Uint16Array.
  // [ id: 10 bits | meta: 4 bits | light: 2 bits ]  // light is optional; can be repurposed.
  type Voxel = number;
  ```
* **Chunk store:**

  * In‑memory LRU of nearby chunks.
  * Disk: per‑chunk compressed binary (LZ4 or gzip stream).
  * Async load/save on worker, main thread notified via MessageChannel.

---

## 3) Block Types (v1)

| ID | Name        | Solid | Opaque | Gravity | Damage | Emits Light | Notes                                           |
| -- | ----------- | ----- | ------ | ------- | ------ | ----------- | ----------------------------------------------- |
| 1  | Grass       | ✅     | ✅      | ❌       | 0      | ❌           | Top texture grass, sides grassy-dirt blend      |
| 2  | Wood        | ✅     | ✅      | ❌       | 0      | ❌           | Used as a building block and for *wooden* tools |
| 3  | Brick       | ✅     | ✅      | ❌       | 0      | ❌           | “Stone‑like” material for stronger tools        |
| 4  | Bedrock     | ✅     | ✅      | ❌       | ∞      | ❌           | **Unbreakable**; bottom-most strata             |
| 5  | Lava        | ❌     | ✳︎     | ❌       | 1 DPS  | ✅ (low)     | Acts like a hazard volume; special shader       |
| 6  | Chickenhead | ✅     | ✅      | ❌       | 0      | ❌           | Chicken face on the +Z side (front)             |

✳︎ Lava is rendered as a non‑solid but “full voxel” for visibility; collision treats it as fluid damage, not walkable.

> **Texture atlas**: single 2048×2048 PNG (or 1024×1024) with 16–64 tiles; each block references per‑face tile indices for greedy meshing.

---

## 4) Player, Camera, Controls

**Camera**

* First‑person, 75° FOV (adjustable 60–90).
* Head bob (toggle), view bob disabled while sprinting for precision placement.

**Movement**

* Speed: walk 4.3 m/s, sprint 6.0 m/s, jump 1.2 m vertical. Gravity −20 m/s².
* Swim slower; water applies drag; space to ascend in water.

**Input (defaults)**

* **WASD** move, **Space** jump, **Shift** sprint, **E** inventory, **Q** drop, **F** toggle flashlight (if added later).
* **Mouse**: look; **LMB** break/attack; **RMB** place/use.
* **1..9** hotbar; **Tab** cycle.
* **Arrows**: Left/Right turn, Up/Down forward/back for trackpad users.
* **Gamepad (Xbox layout):**

  * LS move, RS look, **A** jump, **B** place/use, **X** break/attack, **Y** inventory, **LB/RB** hotbar prev/next, **D‑pad** select slots.

**Accessibility**

* Mouse sensitivity & invert Y sliders.
* Hold‑to‑break vs toggle options.

---

## 5) Interaction Model

**Raycast select:** from camera to 5 blocks distance max. Reports:

* `hit.blockId`, `hit.normal`, `hit.position` (int coords), `adjacent` (placement target).

**Breaking/placing**

* Hold LMB to break (progress bar/hit sparks).
* RMB to place selected block at `adjacent`.
* Placement respects collision (no intersecting player AABB).

**Inventory & Hotbar**

* 9‑slot hotbar + 27‑slot backpack.
* Items: blocks, tools, drops (e.g., “Feather” if chickens enabled later).

---

## 6) Tools & Harvesting

**Available tools:** Bare Fist, **Sword**, **Axe**, **Pickaxe**.

* **Sword:** combat bias; still breaks soft blocks slowly.
* **Axe:** best on Wood.
* **Pickaxe:** best on Brick; only tool that can harvest ore‑like hardness categories (future).
* **Bare Fist:** slow on everything; cannot break Bedrock (nothing can).

**Materials:** Wood, Brick, Chickenhead (novelty).

* **Durability (suggested):** Wood 60, Brick 180, Chickenhead 80 (see surprises).
* **Swing rate:** 2.5 swings/sec; break time = blockHardness / toolMultiplier.

**Block hardness (relative)**

* Grass: 1.0
* Wood: 2.0
* Brick: 4.0
* Bedrock: ∞
* Chickenhead: 1.5
* Lava: n/a (not breakable)

**Tool multipliers**

* Pickaxe on Brick: ×5; Axe on Wood: ×5; Sword on softs: ×1.2; Fist: ×1.

**Damage & hazards**

* Fall damage beyond 3 blocks: (fallBlocks − 3) × 1 heart.
* Lava: 1 heart / second; ignite visual; extinguish in water.
* Drowning: start after 10 s underwater, 1 heart / 2 s.

(“Hearts” UI can be abstracted to a health bar if preferred.)

---

## 7) Crafting

**Crafting Table**

* Place a Crafting Table block to access a **3×3** grid. (Initial build can allow crafting when within 2 blocks.)
* Shaped recipes (arrays) + shapeless support for later.

**Core recipes (by block *material* used)**

* **Sticks** (utility item):

  ```
  [ Wood,   null,  null ]
  [ Wood,   null,  null ]  => 4 × Stick
  [ null,   null,  null ]
  ```
* **Pickaxe** (material ∈ {Wood, Brick, Chickenhead}):

  ```
  [ Mat, Mat, Mat ]
  [ null,Stick,null ]  => Pickaxe(Mat)
  [ null,Stick,null ]
  ```
* **Axe**:

  ```
  [ Mat, Mat, null ]
  [ Mat, Stick, null ]  => Axe(Mat)
  [ null, Stick, null ]
  ```
* **Sword**:

  ```
  [ Mat, null, null ]
  [ Mat, null, null ]   => Sword(Mat)
  [ Stick, null, null ]
  ```
* **Crafting Table** (to bootstrap):

  ```
  [ Wood, Wood, null ]
  [ Wood, Wood, null ]  => Crafting Table
  [ null, null, null ]
  ```

> **Cute secret recipes (off by default in tests; enable with “Surprises” setting):**
>
> * **Chicken Wand**:
>
>   ```
>   [ Chickenhead, null, null ]
>   [ Stick,       null, null ]  => Chicken Wand (spawns a decorative chick particle)
>   [ Stick,       null, null ]
>   ```
> * **Cluck Shield** (cosmetic off‑hand):
>
>   ```
>   [ Chickenhead, Chickenhead, Chickenhead ] => Cluck Shield
>   [ null,       Brick,       null ]
>   [ null,       Stick,       null ]
>   ```

---

## 8) Terrain Generation

**Inputs / sliders (live‑regen UI)**

* **Seed** (string → 32‑bit).
* **Mountainous‑ness** (0–1): scales noise amplitude.
* **Roughness** (0–1): scales high‑frequency noise.
* **Moisture** (0–1): affects biome selection & grass density.
* **Temperature** (0–1): visual tint & cloud height (later).
* **Trees density** (0–1).
* **Lava pockets** (0–1): frequency of lava lakes/caves near Y<10.
* **Biome mix** (enum): Balanced / Flatlands / Highlands / Archipelago.

**Algorithm**

* Base height `h(x,z) = A * noise2D(x*f1, z*f1) + B * noise2D(x*f2, z*f2) + C`

  * `A` from Mountainous‑ness; `f1,f2` from Roughness.
* Clamp to \[-32, 192].
* Fill columns: Bedrock base (lowest 2–3 layers), then Brick (stone‑like) up to top−1, top block Grass.
* **Trees**: Poisson scatter; tree made of Wood pillars + canopy (Grass or separate Leaf block if added later). For v1 we can bake trees as just Wood columns with a cross‑billboard crown to keep the block list minimal.
* **Water plane** at Y=0 with animated normal‑mapped surface shader.
* **Lava**: spawn noise‑based basins Y<10; render hazard volumes.

**Biomes (v1 visuals via textures & decoration counts)**

* Plains (more grass),
* Hills (higher A),
* Rocky (exposed Brick),
* Wetlands (below 0 → shallow water plains).

---

## 9) Weather, Time, Lighting

**Time of day**

* 20‑minute full cycle (configurable).
* Sun directional light azimuthal sweep; moon as dim opposite (optional).

**Atmospherics**

* **Fog**: linear/exp with color keyed to time of day & weather.
* **Weather presets**: sunny, overcast, light fog, heavy fog, sunset, night.
* **Clouds**: billboards or simple noise sheet at Y ≈ 160 (toggle).

**“Fun” Weather Toggle**

* When surprises are on, rare **“Chicken Eclipse”** event (1% chance per day): sky slightly yellow, ambient clucks; chickenhead blocks glow faintly for 30 seconds.

---

## 10) Rendering Strategy

* **Meshing:** Greedy mesh per chunk (collapse coplanar faces with same tile). Face‑cull against neighbors to avoid internal faces.
* **Index/vertex buffers:** 16‑bit indices; interleaved positions/UVs; store one material index per face → sample from atlas in shader.
* **Frustum culling:** by chunk bounding boxes.
* **Instancing:** Keep to a single mesh per chunk; rolling updates.
* **Lighting:** Start with vertex colors for simple AO (optional) or unlit atlas + directional light. No real light propagation v1.
* **Materials:** One `StandardMaterial`/custom shader using atlas; water & lava use separate materials with scrolling UVs & emissive.

---

## 11) UI/UX

* **HUD:** crosshair, hotbar (1–9), health bar, breath bar (when underwater), tool durability.
* **Inventory:** drag‑drop grid; shift‑click moves to hotbar.
* **Crafting UI:** 3×3 grid + output + recipe book (locked by discovery initially).
* **World Gen Panel:** collapsible; sliders reflect current seed; “Generate New World” button (confirm dialog).
* **Settings:** Controls, sensitivity, FOV, audio, “Surprises” toggle, graphics (distance, clouds, AO).
* **Pause Menu:** Resume, Settings, Save & Quit, Regenerate World (with seed).

---

## 12) Audio

* **Events:** footsteps (surface‑based), place/break (material‑based), swing, hit, water in/out, lava sizzle, UI clicks.
* **Ambience:** wind/night insects; soft chicken clucks near chickenhead clusters (surprise rule below).
* **Underwater:** low‑pass filter.

---

## 13) Surprise Rules (opt‑in)

1. **Chicken Chorus:** If 4+ chickenhead blocks are adjacent in a 2×2 square, occasionally play a gentle “cluck chord.”
2. **Golden Egg Chance:** Breaking a chickenhead block has a 2% chance to drop a “Golden Egg” cosmetic that sparkles (sellable later as a novelty glow item).
3. **Chicken Compass:** Hold a Chicken Wand; hotbar slot icon gently points toward the nearest chickenhead block within 32 blocks.

These should be tiny, non‑intrusive delights.

---

## 14) Save/Load

* **Auto‑save** every 2 minutes and on menu exit.
* **Format:**

  * World meta (seed, sliders, time, weather),
  * Player (pos, rot, health, inventory),
  * Chunk diffs (only modified voxels vs generated baseline).
* **Storage:** IndexedDB; versioned. Provide “Reset World” and “Export Save” (blob download).

---

## 15) Error Handling & Performance Targets

* **Target:** 60 FPS on integrated graphics at 8‑chunk view distance (≈ 256×256×256 blocks visible volume, meshed).
* **Chunk gen budget:** < 6 ms main thread; heavy lifting in Worker.
* **Mesh rebuilds:** amortize across frames; never rebuild >2 chunks per frame.
* **Crash safe:** guard null textures; fallback to “safe” seed if gen fails.

---

## 16) Project Structure (suggested)

```
/src
  /engine
    BabylonApp.ts
    Renderer.ts
    Materials.ts
    Input.ts
    Audio.ts
    Gui.ts
  /world
    Block.ts         // registry + atlas mapping
    Chunk.ts
    ChunkMesh.ts
    World.ts
    WorldGen.ts
    Save.ts
  /game
    Player.ts
    Inventory.ts
    Crafting.ts
    Tools.ts
    Interact.ts      // raycast, place/break
    Damage.ts
    Surprises.ts
  /workers
    GenWorker.ts     // perlin/simplex, chunk fill, greedy mesher
  /ui
    Hud.tsx (or vanilla GUI), Menus.tsx, Panels.tsx
/assets
  textures/atlas.png
  audio/*.ogg
```

---

## 17) Key Data Definitions (TypeScript)

```ts
// Block registry entry
interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  opaque: boolean;
  hardness: number;     // ∞ => unbreakable
  emits?: number;       // 0..1
  faceTiles: [number, number, number, number, number, number]; // atlas tile indices per face
}

// Tool & materials
type ToolType = 'fist' | 'sword' | 'axe' | 'pickaxe';
type Material = 'wood' | 'brick' | 'chicken';

interface ToolDef {
  type: ToolType;
  material: Material;
  durability: number;
  multipliers: Partial<Record<number /*blockId*/, number>>;
}

// Recipe
interface Recipe {
  shaped: boolean;
  pattern: (number | null)[][];  // block ids or item ids; null for empty
  output: { itemId: number; count: number };
  predicate?: (inv) => boolean;  // for surprises toggles
}

// World settings
interface WorldSettings {
  seed: number;
  mountainous: number;   // 0..1
  roughness: number;     // 0..1
  moisture: number;      // 0..1
  temperature: number;   // 0..1
  trees: number;         // 0..1
  lavaPockets: number;   // 0..1
  biomeMix: 'Balanced' | 'Flatlands' | 'Highlands' | 'Archipelago';
  surprises: boolean;
}
```

---

## 18) Algorithms: Notes & Pseudocode

**Raycast to voxel**

```ts
function raycastVoxel(origin, dir, maxDist): Hit | null {
  // 3D DDA traversal
  // Step along grid cells until we hit a solid voxel or exceed maxDist.
}
```

**Greedy meshing (per chunk)**

```ts
// For each axis (X, Y, Z):
// 1) Build 2D masks comparing voxel faces against neighbor cells.
// 2) Sweep masks to merge rectangles with same tile id/UV rotation.
// 3) Emit quads, write positions/UVs/indices into typed arrays (pooled).
```

**Terrain fill (worker)**

```ts
for (x in chunkX..chunkX+31)
 for (z in chunkZ..chunkZ+31) {
   const h = height(x,z, settings);
   for (y = ymin; y <= ymax; y++) {
     let id = 0;
     if (y <= -30) id = BEDROCK;
     else if (y <= h-1) id = BRICK;
     else if (y === h) id = GRASS;
     if (y < 0) /* underwater visuals handled by global plane */;
     writeVoxel(x,y,z,id);
   }
   // decorations (trees) based on noise & thresholds
 }
```

---

## 19) Developer‑Facing Tuning Values (start here)

* **View distance:** 8 chunks (radial) default; options 4–12.
* **Mesh AO:** off by default; toggleable (baked 0.8–1.0 vertex colors).
* **Break reach:** 5 blocks; **place reach:** 5 blocks.
* **Sprint FOV kick:** +5° (toggle).
* **Lava light emissive:** 0.2; **night ambient:** 0.06.

---

## 20) QA Checklist (per feature)

* Place/break works at edges of chunks (cross‑chunk normals OK).
* Water plane doesn’t Z‑fight at Y=0; underwater fog & low‑pass audio trigger.
* Bedrock unbreakable everywhere.
* Lava damage + extinguish in water validated.
* Craft recipes produce correct tools; durability decrements; tools break.
* Regenerating world with same seed+sliders yields identical terrain.
* Save/load round‑trips player position, inventory, modified blocks.

---

## 21) Development Phases (iterate fast, play early)

**Phase 0 — Bootstrap (Engine Skeleton)**

* Vite + TS + Babylon scene; skybox/hemisphere light; FPS counter.
* UniversalCamera (FPS), basic input mapping, crosshair.
* ✔️ *Deliverable:* You can walk in an empty scene at 60 FPS.

**Phase 1 — Voxel Core & Chunks**

* Voxel storage (Uint16), chunk grid (32×32×64), world coordinate mapping.
* Greedy meshing + atlas material; frustum culling; chunk streaming.
* Raycast selection; highlight targeted block.
* Place/break with simple inventory of one block type.
* ✔️ *Deliverable:* A flat test world made of one block; place/break is fun and smooth.

**Phase 2 — Procedural Terrain, Water, Basic Blocks**

* Height noise in Worker; fill columns (Bedrock, Brick, Grass).
* Water plane at Y=0 with underwater fog/audio.
* Add Wood, Brick, Grass, Bedrock, Lava, Chickenhead definitions & textures.
* Hazard volumes for Lava; damage & health UI.
* ✔️ *Deliverable:* Walk a generated island/continent with water & some lava pools; place/break all basic blocks.

**Phase 3 — Inventory, Tools, Crafting**

* Full inventory/hotbar; drops & pickups.
* Crafting Table block & 3×3 UI; recipe system (data‑driven JSON).
* Implement tools & durability; block hardness matrix; break progress bar.
* ✔️ *Deliverable:* Player can collect Wood/Brick, craft Pickaxe/Axe/Sword variants, and feel the speed differences.

**Phase 4 — World‑Gen Panel & Weather/Time**

* Live World Settings panel (seed, mountainous‑ness, roughness, etc.).
* Day/night cycle, sky/fog presets, clouds toggle.
* Simple ambient audio loops & footstep sounds.
* ✔️ *Deliverable:* Click “Generate New World,” tweak sliders, get new terrain; sunset looks great.

**Phase 5 — Saves, Polish, Performance**

* IndexedDB save/load; chunk diffs only.
* Mesh rebuild throttling; worker pool; pool typed arrays.
* Graphics settings: view distance, AO, clouds, FOV.
* ✔️ *Deliverable:* Quit and resume same world; consistent 60 FPS at default settings.

**Phase 6 — Surprises & Extras (Optional)**

* Chicken Chorus, Golden Egg drops, Chicken Wand behaviors.
* Simple “chick” ambient critters (decorative particles that wander).
* Minimal achievements (e.g., “First Cluck”: craft a chickenhead tool).
* ✔️ *Deliverable:* Tiny delights that make people smile without affecting balance.

> **Each phase is shippable.** Playtest at the end of every phase and adjust tuning before adding scope.

---

## 22) Minimal Art & Audio Lists

* **Textures (atlas):** grass\_top, grass\_side, dirt, wood, brick, bedrock, lava, chickenhead\_front, chickenhead\_other\_faces, water (separate sheet).
* **UI:** hotbar slot, selection highlight, inventory tiles, simple icons for tools.
* **Audio:** footstep (grass/wood/stone), break/place (soft/hard), water enter/exit, lava sizzle, UI click, cluck (1–2 short clips).

---

## 23) Testing Scenes & Commands (Dev‑only)

* **Keybinds (dev):** F3 debug overlay (pos, chunk coords, FPS, tris), F10 reload atlas, F11 force remesh radius=2.
* **Commands:** `/seed`, `/tp x y z`, `/give blockId count`, `/time set day|night`, `/surprises on|off`.

---

## 24) Risks & Mitigations

* **Performance spikes on mesh rebuilds:** throttle remesh; prioritize nearest chunks; reuse buffers.
* **Texture seams:** pad atlas tiles by 2–4 px; clamp wrap; per‑face UV inset.
* **Precision at world edges:** keep player within world bounds; wrap X/Z if desired (future).

---

## 25) Acceptance Criteria (v1.0)

* Launch, generate default world, stable 55–60 FPS on integrated GPU.
* Walk, sprint, jump, swim; take damage; die & respawn at safe spawn.
* Place/break all 6 block types; lava harms; bedrock invulnerable.
* Inventory and 3×3 crafting functional with listed recipes.
* World‑gen sliders create visibly different worlds; seed repeatable.
* Save/Load preserves everything the player changed.
* Surprises toggle works (off = no special behaviors).

---

### Appendix A — Example Block Registry (partial)

```ts
const Blocks: BlockDef[] = [
  { id:1, name:'Grass', solid:true, opaque:true, hardness:1.0,
    faceTiles:[T.GRASS_TOP, T.GRASS_SIDE, T.GRASS_SIDE, T.GRASS_SIDE, T.GRASS_SIDE, T.DIRT] },
  { id:2, name:'Wood', solid:true, opaque:true, hardness:2.0,
    faceTiles:[T.WOOD, T.WOOD, T.WOOD, T.WOOD, T.WOOD, T.WOOD] },
  { id:3, name:'Brick', solid:true, opaque:true, hardness:4.0,
    faceTiles:[T.BRICK, T.BRICK, T.BRICK, T.BRICK, T.BRICK, T.BRICK] },
  { id:4, name:'Bedrock', solid:true, opaque:true, hardness:Infinity,
    faceTiles:[T.BEDROCK, T.BEDROCK, T.BEDROCK, T.BEDROCK, T.BEDROCK, T.BEDROCK] },
  { id:5, name:'Lava', solid:false, opaque:true, hardness:Infinity,
    faceTiles:[T.LAVA, T.LAVA, T.LAVA, T.LAVA, T.LAVA, T.LAVA] },
  { id:6, name:'Chickenhead', solid:true, opaque:true, hardness:1.5,
    faceTiles:[T.CHICKEN_SIDE, T.CHICKEN_SIDE, T.CHICKEN_SIDE, T.CHICKEN_SIDE, T.CHICKEN_SIDE, T.CHICKEN_FACE] },
];
```

### Appendix B — Example Tool Definitions

```ts
const makePickaxe = (mat:Material): ToolDef => ({
  type:'pickaxe', material:mat,
  durability: mat==='brick'?180 : mat==='wood'?60 : 80,
  multipliers: { [Blocks[2].id]: 5, [Blocks[3].id]: 5, [Blocks[1].id]: 2 }
});
```

---

## What to Build First (TL;DR for your dev)

1. **Phase 0–1** only: Babylon scene + chunked voxel renderer + place/break.
2. **Add** noise terrain, water plane, basic block set.
3. **Then** inventory + crafting + tools.
4. **Finally** world‑gen sliders, weather/time, save/load.
5. **Surprises** last.

This plan gets you a playable building toy quickly, then layers in systems without blocking iteration.
