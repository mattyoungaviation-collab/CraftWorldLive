export type PriceMap = Record<string, number>; // COIN per unit

export interface FactoryRow {
  id: string;
  outputSymbol: string;
  level: number;
  durationSec: number;
  outputPerCraft: number;
  input1Symbol: string;
  input1Amount: number;
  input2Symbol?: string;
  input2Amount?: number;
  xpPerCraft: number;
  upgradeCostSymbol?: string;
  upgradeCostAmount?: number;
  event?: string;
}

export interface BoostState {
  autoApply: boolean;
  workshopLevels: Record<string, number>; // { SYMBOL: level }
  masteryLevels: Record<string, number>; // { SYMBOL: claimedLevel }
  manualWorkshopPercent?: number; // e.g. 59
  manualMasteryLevel?: number;    // 0..10
}

export interface Multipliers {
  durationMult: number;
  inputMult: number;
  outputMult: number;
}

export const DEFAULT_MULTS: Multipliers = { durationMult: 1, inputMult: 1, outputMult: 1 };

export type Tier = 1 | 2 | 3 | 4;

const TIER_1 = new Set(["MUD", "CLAY", "SAND"]);
const TIER_2 = new Set(["COPPER", "SEAWATER", "HEAT", "ALGAE", "LAVA", "CERAMICS", "STEEL", "OXYGEN", "GLASS"]);
const TIER_3 = new Set(["GAS", "STONE", "STEAM", "SCREWS", "FUEL", "CEMENT", "OIL", "ACID", "SULFUR"]);
const TIER_4 = new Set(["PLASTICS", "FIBERGLASS", "ENERGY", "HYDROGEN", "DYNAMITE"]);

export function tierForSymbol(symbol: string): Tier | null {
  const s = symbol.toUpperCase();
  if (TIER_1.has(s)) return 1;
  if (TIER_2.has(s)) return 2;
  if (TIER_3.has(s)) return 3;
  if (TIER_4.has(s)) return 4;
  return null;
}

// Workshop % tables (level index 0..10)
const WORKSHOP_BOOST_PERCENT: Record<Tier, number[]> = {
  1: [0, 11, 23, 35, 47, 59, 69, 79, 85, 92, 100],
  2: [0, 10, 20, 30, 39, 47, 54, 61, 69, 75, 82],
  3: [0, 9, 18, 25, 32, 39, 45, 52, 56, 61, 67],
  4: [0, 8, 15, 22, 28, 33, 37, 41, 45, 49, 54],
};

export function workshopPercentFor(symbol: string, workshopLevels: Record<string, number>): number {
  const t = tierForSymbol(symbol);
  if (!t) return 0;
  const key = symbol.toUpperCase();
  const lvlRaw = workshopLevels[key] ?? workshopLevels[symbol] ?? 0;
  const lvl = Math.max(0, Math.min(10, Number(lvlRaw) || 0));
  return WORKSHOP_BOOST_PERCENT[t][lvl] ?? 0;
}

/**
 * Workshop percent is a speed boost:
 * speed = 1 + percent/100
 * durationMult = 1 / speed
 * Example: 100% => 2x faster => 0.5 duration
 */
export function durationMultiplierFromWorkshopPercent(percent: number): number {
  const p = Math.max(0, Number(percent) || 0);
  const speed = 1 + p / 100;
  return speed > 0 ? 1 / speed : 1;
}

// Mastery curve (yield bonus % => less input used)
const MASTERY_YIELD_BONUS_PERCENT: number[] = [
  100.0, // level 0
  102.0,
  102.9,
  103.3,
  103.7,
  104.2,
  104.4,
  104.6,
  104.8,
  105.0,
  105.3,
];

export function masteryInputMultiplierFromLevel(level: number): number {
  const lvl = Math.max(0, Math.min(10, Number(level) || 0));
  const bonus = MASTERY_YIELD_BONUS_PERCENT[lvl] ?? 100.0;
  const reduction = Math.max(0, (bonus - 100) / 100);
  return Math.max(0, 1 - reduction);
}

export function multipliersForRow(row: FactoryRow, boost: BoostState): Multipliers {
  const symbol = row.outputSymbol.toUpperCase();

  let workshopPercent = 0;
  if (boost.autoApply) workshopPercent = workshopPercentFor(symbol, boost.workshopLevels);
  else workshopPercent = Math.max(0, Number(boost.manualWorkshopPercent ?? 0) || 0);
  const durationMult = durationMultiplierFromWorkshopPercent(workshopPercent);

  let masteryLevel = 0;
  if (boost.autoApply) masteryLevel = Number(boost.masteryLevels[symbol] ?? 0) || 0;
  else masteryLevel = Number(boost.manualMasteryLevel ?? 0) || 0;
  const inputMult = masteryInputMultiplierFromLevel(masteryLevel);

  return { durationMult, inputMult, outputMult: 1 };
}

// --- Core calculations ---

export function computePerCraft(row: FactoryRow, prices: PriceMap, mults: Multipliers = DEFAULT_MULTS) {
  const outAmt = row.outputPerCraft * mults.outputMult;
  const in1Amt = row.input1Amount * mults.inputMult;
  const in2Amt = (row.input2Amount ?? 0) * mults.inputMult;

  const revenue = outAmt * (prices[row.outputSymbol] ?? 0);
  const cost =
    in1Amt * (prices[row.input1Symbol] ?? 0) +
    (row.input2Symbol ? in2Amt * (prices[row.input2Symbol] ?? 0) : 0);

  const pnl = revenue - cost;
  const roi = cost > 0 ? pnl / cost : 0;

  return { outAmt, in1Amt, in2Amt, revenueCoin: revenue, costCoin: cost, pnlCoin: pnl, roi };
}

export function computePerDay(row: FactoryRow, prices: PriceMap, mults: Multipliers = DEFAULT_MULTS) {
  const duration = row.durationSec * mults.durationMult;
  const craftsPerDay = duration > 0 ? 86400 / duration : 0;
  const perCraft = computePerCraft(row, prices, mults);
  return {
    craftsPerDay,
    outputPerDay: perCraft.outAmt * craftsPerDay,
    pnlPerDayCoin: perCraft.pnlCoin * craftsPerDay,
    revenuePerDayCoin: perCraft.revenueCoin * craftsPerDay,
    costPerDayCoin: perCraft.costCoin * craftsPerDay,
    roi: perCraft.roi,
  };
}

export function computeStartWithInput1(row: FactoryRow, startInput1: number, mults: Multipliers = DEFAULT_MULTS) {
  const in1 = row.input1Amount * mults.inputMult;
  const in2 = (row.input2Amount ?? 0) * mults.inputMult;
  const crafts = in1 > 0 ? Math.floor(startInput1 / in1) : 0;
  return {
    crafts,
    requiredInput2: row.input2Symbol ? crafts * in2 : 0,
    output: crafts * row.outputPerCraft * mults.outputMult,
    timeSec: crafts * row.durationSec * mults.durationMult,
  };
}

export function computeStartWithInput2(row: FactoryRow, startInput2: number, mults: Multipliers = DEFAULT_MULTS) {
  if (!row.input2Symbol || !row.input2Amount) return { crafts: 0, requiredInput1: 0, output: 0, timeSec: 0 };
  const in1 = row.input1Amount * mults.inputMult;
  const in2 = row.input2Amount * mults.inputMult;
  const crafts = in2 > 0 ? Math.floor(startInput2 / in2) : 0;
  return {
    crafts,
    requiredInput1: crafts * in1,
    output: crafts * row.outputPerCraft * mults.outputMult,
    timeSec: crafts * row.durationSec * mults.durationMult,
  };
}
