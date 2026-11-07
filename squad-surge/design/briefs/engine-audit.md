# Task for Codex: engine audit of Squad Surge (read-only analysis, write ONE report file)

Repo: /home/user/my-first-repo/squad-surge, a browser crowd-runner shooter (three.js r128, plain scripts).
Read index.html (the core: the frame loop, the step simulation, squad, enemies, bullets, gates, solids, boss and
rendering), js/objects3d.js, js/scenery.js, js/powerups.js and js/juice.js.

Write `design/engine-audit.md` (≤ 1,200 words). Do not modify any other file.

1. **Architecture:** how the simulation and rendering work today: units as sprites, billboards or meshes; instancing;
   draw calls; collision approach (O(n²)?); squad formation; enemy AI; bullet system; level generation (procedural
   segments); boss logic.
2. **Hot spots and limits:** per-frame allocations, O(n²) loops, unbatched draws, DOM work every frame, the max squad
   cap (600) and why. What breaks or gets slow first on a mid-range phone.
3. **Gameplay-engine limits that make the game too easy or samey:**
   - enemy variety and behaviours (do enemies shoot, flank, shield or charge?)
   - formation and collisions (does the crowd squeeze through gaps or around obstacles?)
   - procedural segments versus authored levels
   - how difficulty scales
4. **A concrete improvement plan, prioritised.** For each item give the expected impact and the effort:
   - data-driven authored levels (a level script format for a story campaign: waves, enemy types, hazards, gates,
     bosses, events)
   - new enemy archetypes and boss phase scripts
   - crowd simulation upgrades: spatial hash, flocking/separation, squeezing through gaps, obstacle avoidance, death
     knockback
   - rendering (InstancedMesh for units, LOD, pooling)
   - fixed-timestep simulation
   - dynamic difficulty adjustment hooks
   - a deterministic replay/test mode
Cite line numbers.
