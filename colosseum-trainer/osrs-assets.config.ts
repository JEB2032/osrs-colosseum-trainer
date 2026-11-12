import { defineConfig } from "osrs-sdk-assets";
import { COLOSSEUM_ASSETS } from "./src/assets";
import { DOOM_ASSETS } from "./src/doomAssets";
import { MAGGOT_ASSETS } from "./src/maggotAssets";

/** Merge per-encounter asset lists category by category. */
function mergeAssets<A extends Record<string, object>, B extends Record<string, object>>(a: A, b: B) {
  const merged: Record<string, object> = { ...a };
  for (const [category, entries] of Object.entries(b)) {
    merged[category] = { ...(merged[category] ?? {}), ...entries };
  }
  return merged as A & B;
}

export default defineConfig({
  cache: { openrs2: 2762 },
  assets: mergeAssets(mergeAssets(COLOSSEUM_ASSETS, DOOM_ASSETS), MAGGOT_ASSETS),
  outDir: "./public/osrs-assets",
});
