import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

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

function parseNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  // strip commas
  const cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDurationHMS(hms: string): number {
  const s = String(hms ?? "").trim();
  if (!s) return 0;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return 0;
  const [hh, mm, ss] = parts;
  return hh * 3600 + mm * 60 + ss;
}

function deriveFromId(id: string) {
  const [sym, lvl] = id.split("_");
  return { outputSymbol: sym, level: Number(lvl || 0) || 0 };
}

export function loadFactoriesFromCsv(csvPath: string): FactoryRow[] {
  const text = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    // eslint-disable-next-line no-console
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 3));
  }
  const rows: FactoryRow[] = [];
  for (const r of parsed.data) {
    const id = String(r["ID"] ?? "").trim();
    if (!id) continue;
    const { outputSymbol, level } = deriveFromId(id);
    const input2SymbolRaw = String(r["INPUT 2 SYMBOL"] ?? "").trim();
    const row: FactoryRow = {
      id,
      outputSymbol,
      level,
      durationSec: parseDurationHMS(r["DURATION"]),
      outputPerCraft: parseNumber(r["OUTPUT"]),
      input1Symbol: String(r["INPUT 1 SYMBOL"] ?? "").trim(),
      input1Amount: parseNumber(r["INPUT 1 AMOUNT"]),
      input2Symbol: input2SymbolRaw || undefined,
      input2Amount: input2SymbolRaw ? parseNumber(r["INPUT 2 AMOUNT"]) : undefined,
      xpPerCraft: parseNumber(r["XP PER OUTPUT"]),
      upgradeCostSymbol: String(r["COST SYMBOL"] ?? "").trim() || undefined,
      upgradeCostAmount: parseNumber(r["COST AMOUNT"]) || undefined,
      event: String(r["EVENT"] ?? "").trim() || undefined
    };
    rows.push(row);
  }
  return rows;
}

export function loadAssets() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
  const assets = path.join(root, "assets");
  const factories = loadFactoriesFromCsv(path.join(assets, "factories.csv"));
  const mines = loadFactoriesFromCsv(path.join(assets, "mines.csv"));
  return { factories, mines };
}
