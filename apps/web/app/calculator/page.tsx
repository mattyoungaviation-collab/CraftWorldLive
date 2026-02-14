"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePerCraft,
  computePerDay,
  computeStartWithInput1,
  computeStartWithInput2,
  FactoryRow,
  PriceMap,
  BoostState,
  multipliersForRow,
} from "@craftworld/calc";

import { apiFetch } from "../../lib/api";

function toPriceMapFromExchangePriceList(payload: any): PriceMap {
  const out: PriceMap = {};
  const list = payload?.data?.exchangePriceList || payload?.exchangePriceList;
  if (!list?.baseSymbol || !Array.isArray(list?.prices)) return out;

  const base = String(list.baseSymbol);
  for (const p of list.prices) {
    const ref = String(p.referenceSymbol);
    const amt = Number(p.amount);
    if (!ref || !Number.isFinite(amt) || amt <= 0) continue;
    if (base === "COIN") out[ref] = 1 / amt;
    else if (ref === "COIN") out[base] = amt;
  }
  out["COIN"] = 1;
  return out;
}

export default function CalculatorPage() {
  const [rows, setRows] = useState<FactoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [prices, setPrices] = useState<PriceMap>({});
  const [startInput1, setStartInput1] = useState<number>(100);
  const [startInput2, setStartInput2] = useState<number>(100);

  // Auth tokens
  const [idToken, setIdToken] = useState<string>("");

  // Auto pull/apply toggle
  const [autoPull, setAutoPull] = useState<boolean>(true);

  // Pulled boost maps (live)
  const [pulledWorkshop, setPulledWorkshop] = useState<Record<string, number>>({});
  const [pulledMastery, setPulledMastery] = useState<Record<string, number>>({});
  const [pullStatus, setPullStatus] = useState<string>("");

  // Manual overrides (when autoPull=false)
  const [manualWorkshopPercent, setManualWorkshopPercent] = useState<number>(0);
  const [manualMasteryLevel, setManualMasteryLevel] = useState<number>(0);

  useEffect(() => {
    setIdToken(localStorage.getItem("cw.idToken") || "");
  }, []);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/data/factories");
      const json = await res.json();
      const r = (json.rows || []) as FactoryRow[];
      setRows(r);
      setSelectedId(r[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/cw/prices");
      const json = await res.json();
      setPrices(toPriceMapFromExchangePriceList(json));
    })();
  }, []);

  // Auto-pull from Craft World whenever enabled (and token exists)
  useEffect(() => {
    (async () => {
      if (!autoPull) return;
      if (!idToken) {
        setPullStatus("Sign in first so we have an idToken to auto-pull boosts.");
        return;
      }
      try {
        setPullStatus("Auto-pulling Workshop + Proficiencies from Craft World...");

        const wsRes = await apiFetch("/cw/account/workshop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const wsJson = await wsRes.json();
        const wsList = wsJson?.data?.account?.workshop || [];
        const wsMap: Record<string, number> = {};
        for (const w of wsList) wsMap[String(w.symbol).toUpperCase()] = Number(w.level) || 0;
        setPulledWorkshop(wsMap);

        const mRes = await apiFetch("/cw/account/mastery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const mJson = await mRes.json();
        const mList = mJson?.data?.account?.proficiencies || [];
        const mMap: Record<string, number> = {};
        for (const m of mList) mMap[String(m.symbol).toUpperCase()] = Number(m.claimedLevel) || 0;
        setPulledMastery(mMap);

        setPullStatus(`Pulled workshop(${wsList.length}) + proficiencies(${mList.length}).`);
      } catch (e: any) {
        setPullStatus(`Auto-pull failed: ${e?.message || String(e)}`);
      }
    })();
  }, [autoPull, idToken]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const boost: BoostState = useMemo(() => {
    return {
      autoApply: autoPull,
      workshopLevels: autoPull ? pulledWorkshop : {},
      masteryLevels: autoPull ? pulledMastery : {},
      manualWorkshopPercent,
      manualMasteryLevel,
    };
  }, [autoPull, pulledWorkshop, pulledMastery, manualWorkshopPercent, manualMasteryLevel]);

  const mults = useMemo(() => (selected ? multipliersForRow(selected, boost) : null), [selected, boost]);

  const perCraft = useMemo(() => (selected && mults ? computePerCraft(selected, prices, mults) : null), [selected, prices, mults]);
  const perDay = useMemo(() => (selected && mults ? computePerDay(selected, prices, mults) : null), [selected, prices, mults]);
  const fromIn1 = useMemo(() => (selected && mults ? computeStartWithInput1(selected, startInput1, mults) : null), [selected, startInput1, mults]);
  const fromIn2 = useMemo(() => (selected && mults ? computeStartWithInput2(selected, startInput2, mults) : null), [selected, startInput2, mults]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>Calculator</h1>
      <p style={{ color: "#444" }}>
        Auto Pull uses the signed-in wallet’s Craft World idToken to fetch Workshop + Proficiencies and apply boosts automatically.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <b>Recipe</b>
          <div style={{ marginTop: 8 }}>
            <label>
              Factory/Level:{" "}
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ padding: 8, width: "100%" }}>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} ({r.input1Symbol}
                    {r.input2Symbol ? ` + ${r.input2Symbol}` : ""} → {r.outputSymbol})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              duration: {selected.durationSec}s · output/craft: {selected.outputPerCraft} · XP/craft: {selected.xpPerCraft}
              <br />
              inputs: {selected.input1Amount} {selected.input1Symbol}
              {selected.input2Symbol ? ` + ${selected.input2Amount} ${selected.input2Symbol}` : ""}
            </div>
          )}
        </div>

        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <b>Boosts</b>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={autoPull} onChange={(e) => setAutoPull(e.target.checked)} />
              Auto Pull + Apply boosts (signed-in wallet)
            </label>

            {pullStatus ? <div style={{ fontSize: 12, color: "#666" }}>{pullStatus}</div> : null}

            {!autoPull && (
              <>
                <label>
                  Manual workshop boost %:
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={manualWorkshopPercent}
                    onChange={(e) => setManualWorkshopPercent(Number(e.target.value))}
                    style={{ marginLeft: 8, padding: 8, width: 120 }}
                  />
                </label>

                <label>
                  Manual mastery level (0–10):
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={manualMasteryLevel}
                    onChange={(e) => setManualMasteryLevel(Number(e.target.value))}
                    style={{ marginLeft: 8, padding: 8, width: 120 }}
                  />
                </label>
              </>
            )}

            <div style={{ fontSize: 12, color: "#666" }}>
              Applied duration multiplier: <b>{mults ? mults.durationMult.toFixed(4) : "—"}</b>
              <br />
              Applied input multiplier: <b>{mults ? mults.inputMult.toFixed(4) : "—"}</b>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Per craft</h3>
          <pre style={{ margin: 0, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(perCraft, null, 2)}
          </pre>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Per day (24/7)</h3>
          <pre style={{ margin: 0, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(perDay, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Start with Input 1</h3>
          <label>Start amount ({selected?.input1Symbol || "—"}): </label>
          <input type="number" value={startInput1} onChange={(e) => setStartInput1(Number(e.target.value))} style={{ marginLeft: 8, padding: 6 }} />
          <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(fromIn1, null, 2)}
          </pre>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Start with Input 2</h3>
          <label>Start amount ({selected?.input2Symbol || "—"}): </label>
          <input type="number" value={startInput2} onChange={(e) => setStartInput2(Number(e.target.value))} style={{ marginLeft: 8, padding: 6 }} />
          <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(fromIn2, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        Price map loaded for {Object.keys(prices).length} symbols.
      </div>
    </div>
  );
}
