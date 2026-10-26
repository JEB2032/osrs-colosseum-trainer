/**
 * Fortis Colosseum modifiers ("invocations") the waves trainer can simulate.
 * Tier numbers are from the OSRS Wiki's Fortis Colosseum strategy guide.
 */
export type InvocationState = {
  /** I: every orb hits twice. II: unprotected hits venom. III: any orb order. */
  mantimayhem: 0 | 1 | 2 | 3;
  /** Base Hitpoints reduced by 10% / 20% / 40%, overhealing disabled. */
  frailty: 0 | 1 | 2 | 3;
  /** Prayer drained by 20% / 40% / 60% of damage taken. */
  blasphemy: 0 | 1 | 2 | 3;
  /** Each hit taken adds a stack; death at 15 / 10 / 5 stacks. */
  doom: 0 | 1 | 2 | 3;
  /** Player attack range reduced by 2 / 4 / 6 tiles. */
  myopia: 0 | 1 | 2 | 3;
  /** Shockwave Colossi spawn in pairs. */
  dynamicDuo: boolean;
  /** One extra Fremennik warbander spawns every wave. */
  quartet: boolean;
};

export const DEFAULT_INVOCATIONS: InvocationState = {
  mantimayhem: 0,
  frailty: 0,
  blasphemy: 0,
  doom: 0,
  myopia: 0,
  dynamicDuo: false,
  quartet: false,
};

export const TIERED_INVOCATIONS: { key: keyof InvocationState; label: string; tiers: string[] }[] = [
  { key: "mantimayhem", label: "Mantimayhem", tiers: ["Each orb hits twice", "+ venom if unprotected", "+ any orb order"] },
  { key: "frailty", label: "Frailty", tiers: ["-10% HP", "-20% HP", "-40% HP"] },
  { key: "blasphemy", label: "Blasphemy", tiers: ["20% of damage drains prayer", "40%", "60%"] },
  { key: "doom", label: "Doom", tiers: ["Die at 15 stacks", "Die at 10 stacks", "Die at 5 stacks"] },
  { key: "myopia", label: "Myopia", tiers: ["-2 attack range", "-4 attack range", "-6 attack range"] },
];

export const TOGGLE_INVOCATIONS: { key: keyof InvocationState; label: string; description: string }[] = [
  { key: "dynamicDuo", label: "Dynamic Duo", description: "Shockwave Colossi spawn in pairs" },
  { key: "quartet", label: "Quartet", description: "An extra Fremennik warbander every wave" },
];

/** Offered in game but not simulated yet. */
export const UNSUPPORTED_INVOCATIONS = ["Bees!", "Volatility", "Reentry", "Relentless", "Solarflare", "Totemic", "Red Flag"];

/** Fraction of base Hitpoints removed; the removed amount is rounded down (99 HP -> 90 / 80 / 60). */
export const FRAILTY_HP_REDUCTION = [0, 0.1, 0.2, 0.4];
export const BLASPHEMY_DRAIN_RATIO = [0, 0.2, 0.4, 0.6];
export const DOOM_LETHAL_STACKS = [Infinity, 15, 10, 5];
export const MYOPIA_RANGE_REDUCTION = [0, 2, 4, 6];

export function sanitizeInvocations(value: unknown): InvocationState {
  const input = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof InvocationState, unknown>>;
  const tier = (v: unknown) => (Math.max(0, Math.min(3, Math.trunc(Number(v) || 0))) as 0 | 1 | 2 | 3);
  return {
    mantimayhem: tier(input.mantimayhem),
    frailty: tier(input.frailty),
    blasphemy: tier(input.blasphemy),
    doom: tier(input.doom),
    myopia: tier(input.myopia),
    dynamicDuo: input.dynamicDuo === true,
    quartet: input.quartet === true,
  };
}
