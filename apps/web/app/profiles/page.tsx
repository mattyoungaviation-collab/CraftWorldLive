"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:10000";

export default function ProfilesPage() {
  const [sessionToken, setSessionToken] = useState<string>("");
  const [idToken, setIdToken] = useState<string>("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [name, setName] = useState("Default");
  const [workshop, setWorkshop] = useState<any>({});
  const [mastery, setMastery] = useState<any>({});
  const [workers, setWorkers] = useState<number>(0);
  const [factoryCount, setFactoryCount] = useState<number>(1);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const st = localStorage.getItem("cw.sessionToken") || "";
    const it = localStorage.getItem("cw.idToken") || "";
    setSessionToken(st);
    setIdToken(it);
  }, []);

  const load = async () => {
    const res = await fetch(`${API_BASE}/profiles`, {
      headers: { authorization: `Bearer ${sessionToken}` }
    });
    const json = await res.json();
    setProfiles(json.profiles || []);
  };

  const fetchWorkshop = async () => {
    setStatus("Fetching workshop levels from Craft World...");
    const res = await fetch(`${API_BASE}/cw/account/workshop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    const json = await res.json();
    const list = json?.data?.account?.workshop || [];
    // Convert to map {SYMBOL: level}
    const map: Record<string, number> = {};
    for (const w of list) map[w.symbol] = w.level;
    setWorkshop(map);
    setStatus(`Loaded workshop for ${list.length} symbols.`);
  };

  const fetchMastery = async () => {
    setStatus("Fetching mastery levels from Craft World...");
    const res = await fetch(`${API_BASE}/cw/account/mastery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    const json = await res.json();
    const list = json?.data?.account?.proficiencies || [];
    const map: Record<string, number> = {};
    for (const m of list) map[m.symbol] = m.claimedLevel;
    setMastery(map);
    setStatus(`Loaded proficiencies for ${list.length} symbols.`);
  };

  const save = async () => {
    const res = await fetch(`${API_BASE}/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ name, workers, factoryCount, workshop, mastery })
    });
    await res.json();
    await load();
  };

  const del = async (id: string) => {
    await fetch(`${API_BASE}/profiles/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${sessionToken}` }
    });
    await load();
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ marginTop: 0 }}>Profiles</h1>
      <p style={{ color: "#444" }}>
        Profiles are stored in Postgres (Render). You can pull Workshop/Mastery from Craft World using your logged-in <code>idToken</code>.
      </p>

      {!sessionToken || !idToken ? (
        <div style={{ marginTop: 12, color: "#a00" }}>
          You must sign in first (Login page) so we have both a <b>sessionToken</b> and a <b>Craft World idToken</b>.
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          Profile name:{" "}
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 8, minWidth: 220 }} />
        </label>
        <label>
          Workers (0–4):{" "}
          <input type="number" min={0} max={4} value={workers} onChange={(e) => setWorkers(Number(e.target.value))} style={{ padding: 8, width: 90 }} />
        </label>
        <label>
          Factory count:{" "}
          <input type="number" min={1} value={factoryCount} onChange={(e) => setFactoryCount(Number(e.target.value))} style={{ padding: 8, width: 110 }} />
        </label>
        <button onClick={fetchWorkshop} disabled={!idToken} style={{ padding: "10px 14px" }}>Pull Workshop</button>
        <button onClick={fetchMastery} disabled={!idToken} style={{ padding: "10px 14px" }}>Pull Mastery</button>
        <button onClick={save} disabled={!sessionToken} style={{ padding: "10px 14px" }}>Save/Update</button>
        <button onClick={load} disabled={!sessionToken} style={{ padding: "10px 14px" }}>Refresh</button>
      </div>

      {status && <div style={{ marginTop: 10, color: "#666" }}>{status}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <b>Workshop (map)</b>
          <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(workshop, null, 2)}
          </pre>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <b>Mastery (map)</b>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            Note: mastery query is a placeholder until we confirm Craft World’s exact schema.
          </div>
          <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(mastery, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        {profiles.map((p) => (
          <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <b>{p.name}</b>
                <div style={{ fontSize: 12, color: "#666" }}>workers: {p.workers} · factories: {p.factoryCount}</div>
              </div>
              <button onClick={() => del(p.id)} style={{ padding: "8px 10px" }}>Delete</button>
            </div>
            <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify({ workshop: p.workshop, mastery: p.mastery }, null, 2)}
            </pre>
          </div>
        ))}
        {profiles.length === 0 && <div style={{ color: "#666" }}>No profiles yet.</div>}
      </div>
    </div>
  );
}
