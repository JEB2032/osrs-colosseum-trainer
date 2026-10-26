"use strict";

import { Projectile, Random, Trainer } from "osrs-sdk";

import { SolSandPool } from "./SolSandPool";

/** Volatility III / Reentry molten sand: up to 15 damage every other tick while stood on. */
export class MoltenSand extends SolSandPool {
  override tick() {
    ++this.age;
    const player = Trainer.player;
    if (!player || player.dying >= 0) return;
    if (this.age % 2 === 0 && player.location.x === this.location.x && player.location.y === this.location.y) {
      const damage = Math.floor(Random.get() * 16);
      player.addProjectile(new Projectile(null, damage, player, player, "typeless", { setDelay: 0 }));
    }
  }
}
