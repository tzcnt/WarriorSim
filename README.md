# WarriorSim
A webapp to simulate how 1.12/Classic Era and WoW Forever DPS Warrior performs with different gear, buffs, rotations, and talents.

Latest commit is up live here:
https://fleetcode.com/WarriorSim/

## Cutting-edge Tech
This project is WASM-accelerated (C++ to Emscripten), offering a 2-3x, simulation speedup over the original [Guybrush version](https://github.com/GuybrushGit/WarriorSim). Additionally, it adds the option to share your compute with other users of the site, accelerating simulation for everyone. This can push the speedup to 5x or more. I personally seed the compute pool with over 50 cores.

Due to the substantial differences in Emscripten code and the original Javascript that make porting changes complex, I've left the fork network.

This project also fixes a number of bugs that were present in upstream, such as incorrectly carrying over buff and cooldown state between simulation runs, cross-contamination between SoD and Classic abilities, missing spell implementations, and more.

## WoW Forever Implementation Status

- Talents: Done, based on [https://talentsforever.com/warrior](https://talentsforever.com/warrior). Some of the values are estimates and will be revised once Beta is available.
- Racials: In progress.
- Gear: Not done / can't be done until we get in game.

## Self-hosting and Contributing

`dist/` is generated locally and is not tracked in Git. Install Node.js and the
Emscripten SDK, run `npm ci`, then build with `./build-dist.sh` (Linux/macOS) or
`.\build-dist.bat` (Windows) before serving the site. Rebuild after pulling updates.
See [the setup guide](CONTRIBUTING.md) for details.

Simulations run in WebAssembly, with a separate native engine in each browser worker.
Classic Era (`classic.html`) and WoW Forever (`index.html`) keep their existing
JavaScript character setup and catalogs. WoW Forever uses its own talent tree and
provisional combat rules; see [the Forever notes](data/forever/README.md) for
assumptions and the retained defensive-model limitations. See [the native engine guide](wasm/README.md)
for the resolved-spec interface, optimizations, and parity validation.

**Share Compute** contributes idle browser workers and receives help with your
simulations. It is on by default, and turning it off is remembered in that
browser. The panel has a slider for your local threads (always used for your own runs)
and one for the threads you share, plus the threads everyone else is sharing; both
sliders are remembered between visits. Starting a simulation
immediately gives your own work priority; disabling sharing keeps execution
local and dims the two sharing rows. Both tabs use the same optional
[compute coordinator](server/README.md), with separate pools for each bundle hash.
Each tab preloads and verifies its complete simulation bundle at startup, so later
simulations keep working after deployment assets change. Public helper results
are structurally validated but are not independently audited.
