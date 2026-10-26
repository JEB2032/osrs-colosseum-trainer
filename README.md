# OSRS Colosseum Trainer (waves 10–11, double south)

A browser-based, 3D, tick-based practice simulator for the Fortis Colosseum, focused on
double south spawns on waves 10 and 11 using the A/B method at the north-west pillar.

Built on the open-source [OldSchoolSDK](https://github.com/OldSchoolSDK/osrs-sdk) engine and
Supalosa's [ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer) (GPL-3.0), with
3D models extracted from the OSRS cache via [osrscachereader](https://github.com/Supalosa/osrscachereader).
All game assets are property of Jagex. Not affiliated with Jagex.

## What's added on top of upstream

- **Fixed mode client** (765×503, stretched to fit): 512×334 scene, tabs above/below the side
  panel, chatbox. Toggle in the sidebar.
- **Waves trainer as the main page**: wave 10/11 picker, force double south (on by default),
  start on the AB start tile (5 south of the NW pillar) with A/B/start tile markers.
- **Invocations**: Mantimayhem, Frailty, Blasphemy, Doom, Myopia, Solarflare and Volatility (I–III),
  Dynamic Duo, Quartet.
- **Death replay**: every run is recorded (RNG seed + inputs per tick) and the last 30 seconds
  can be re-simulated in full 3D with play/pause, ±ticks, scrubbing and 0.25–2× speed.
- **Hotkeys**: Ctrl+R restart, Space start wave / pause replay. F-keys are rebindable in the
  in-game Settings tab.
- **Javelin toss** (every 5th Javelin Colossus attack lands on your tile 6 ticks later, up to 40
  typeless) and **Minotaur heal** (heals NPCs under 75% within 7 tiles/LoS while you're out of melee).
- **Real-fight loadout** (default on the waves page): Blue Moon helm/chest/tassets, tentacle, dragon
  defender, blood fury, Rada's blessing 4, infernal cape, barrows gloves, eternal boots, berserker
  ring (i); Crystal helm/body/legs, bowfa and Blue Moon spear switches; brews, restores, ranging, super combat, prayer regen.
- **NPC tile highlights** (NPC Indicators style): berserker light blue, archer red, seer green,
  shaman blue, jaguar red, javelin green, manticore green, shockwave blue, minotaur red.
- **Visual metronome** infobox counting 1–5 (1 = the tick the NPCs spawned), and RuneLite-style
  hovered tile (yellow) and true tile (cyan) indicators.

## Layout

| Folder | Upstream | Notes |
|---|---|---|
| `colosseum-trainer/` | Supalosa/ColosseumTrainer @ b53022c | the app |
| `osrs-sdk/` | OldSchoolSDK/osrs-sdk `feat/cache-render-bundle` @ c7d9693 | engine (fixed mode, replay hooks, invocation hooks) |
| `osrscachereader/` | Supalosa/osrscachereader `beta` @ 9a721f4 | cache reader used to extract 3D assets |

## Build (Node 20)

```bash
cd osrscachereader && npm ci && cd ..
cd osrs-sdk && npm ci && npm run build && cd ..
cd colosseum-trainer && npm ci
npm link ../osrs-sdk ../osrs-sdk/packages/osrs-sdk-react ../osrs-sdk/packages/osrs-sdk-assets
npm run assets        # downloads the pinned OpenRS2 cache and extracts models/sounds
npm start             # dev server on http://localhost:8000
```

Production build: `COMMIT_REF=x BUILD_DATE=x DEPLOY_URL=./ npx webpack` → `colosseum-trainer/dist/`.
On Windows, set `npm_config_script_shell` to Git Bash so the `rm -rf` scripts work.

## Known gaps

- Minotaur heal interval isn't documented; it's assumed to run on its 5-tick attack timer.
- Blue Moon spear autocasts Blood Barrage; Frostweaver and its special attack aren't simulated.
- Bees!, Reentry, Relentless, Totemic and Red Flag are not simulated.
- Volatility damage (up to 20) and timing (when the death animation ends) are assumptions; the wiki
  only documents the explosion size. Solarflare orb start corners/direction are also assumed.
- Fonts and a few weapon models load from the upstream trainers' CDNs.
