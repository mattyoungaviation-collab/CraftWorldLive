"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getIdToken, getSessionToken } from "../../lib/auth";

async function safeReadJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text().catch(() => "");
  return { _nonJson: true, text };
}

function snippet(s: string, n = 400) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

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
    // Restore tokens on mount
    const st = getSessionToken();
    const it = getIdToken();
    setSessionToken(st);
    setIdToken(it);

    (async () => {
      // Only load profiles if session is valid
      try {
        const meRes = await apiFetch("/auth/me");
        if (!meRes.ok) {
          setStatus("Session not valid. Go to Login and sign in again.");
          return;
        }
        await load();
      } catch (e: any) {
        setStatus(`Failed to validate session: ${e?.message || String(e)}`);
      }
    })();
  }, []);

  const load = async () => {
    setStatus("Loading profiles...");
    try {
      const res = await apiFetch("/profiles");
      if (!res.ok) {
        const body = await safeReadJson(res);
        setStatus(
          `Failed to load profiles (${res.status}). ${
            body?._nonJson ? snippet(body.text) : snippet(JSON.stringify(body))
          }`
        );
        return;
      }
      const json = await res.json();
      setProfiles(json.profiles || []);
      setStatus(`Loaded ${json.profiles?.length || 0} profiles.`);
    } catch (e: any) {
      setStatus(`Failed to load profiles: ${e?.message || String(e)}`);
    }
  };

  const fetchWorkshop = async () => {
    const it = getIdToken(); // always the latest token
    setIdToken(it);

    if (!it) {
      setStatus("Missing CraftWorld idToken. Go to Login and Sign in again.");
      return;
    }

    setStatus("Fetching workshop levels from Craft World...");
    try {
      const res = await apiFetch("/cw/account/workshop", {
        method: "POST",
        body: JSON.stringify({ idToken: it })
      });

      if (!res.ok) {
        const body = await safeReadJson(res);
        setStatus(
          `Workshop fetch failed (${res.status}). ${
            body?._nonJson ? snippet(body.text) : snippet(JSON.stringify(body))
          }\n\nIf this is 401/403/500, your CraftWorld idToken may be expired — re-login to refresh it.`
        );
        return;
      }

      const json = await res.json();
      const list = json?.data?.account?.workshop || [];
      const map: Record<string, number> = {};
      for (const w of list) map[w.symbol] = w.level;

      setWorkshop(map);
      setStatus(`Loaded workshop for ${list.length} symbols.`);
    } catch (e: any) {
      setStatus(
        `Workshop fetch crashed: ${e?.message || String(e)}\n\nThis usually means the API returned non-JSON (500 HTML/text).`
      );
    }
  };

  const fetchMastery = async () => {
    const it = getIdToken(); // always the latest token
    setIdToken(it);

    if (!it) {
      setStatus("Missing CraftWorld idToken. Go to Login and Sign in again.");
      return;
    }

    setStatus("Fetching mastery/proficiencies from Craft World...");
    try {
      const res = await apiFetch("/cw/account/mastery", {
        method: "POST",
        body: JSON.stringify({ idToken: it })
      });

      if (!res.ok) {
        const body = await safeReadJson(res);
        setStatus(
          `Mastery fetch failed (${res.status}). ${
            body?._nonJson ? snippet(body.text) : snippet(JSON.stringify(body))
          }\n\nIf this is 401/403/500, your CraftWorld idToken may be expired — re-login to refresh it.`
        );
        return;
      }

      const json = await res.json();
      const list = json?.data?.account?.proficiencies || [];
      const map: Record<string, number> = {};
      for (const m of list) map[m.symbol] = m.claimedLevel;

      setMastery(map);
      setStatus(`Loaded proficiencies for ${list.length} symbols.`);
    } catch (e: any) {
      setStatus(
        `Mastery fetch crashed: ${e?.message || String(e)}\n\nThis usually means the API returned non-JSON (500 HTML/text).`
      );
    }
  };

  const save = async () => {
    setStatus("Saving profile...");
    try {
      const res = await apiFetch("/profiles", {
        method: "POST",
        body: JSON.stringify({ name, workers, factoryCount, workshop, mastery })
      });

      if (!res.ok) {
        const body = await safeReadJson(res);
        setStatus(
          `Save failed (${res.status}). ${
            body?._nonJson ? snippet(body.text) : snippet(JSON.stringify(body))
          }`
        );
        return;
      }

      await load();
      setStatus("Saved.");
    } catch (e: any) {
      setStatus(`Save failed: ${e?.message || String(e)}`);
    }
  };

  const del = async (id: string) => {
    setStatus("Deleting...");
    try {
      const res = await apiFetch(`/profiles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await safeReadJson(res);
        setStatus(
          `Delete failed (${res.status}). ${
            body?._nonJson ? snippet(body.text) : snippet(JSON.stringify(body))
          }`
        );
        return;
      }
      await load();
      setStatus("Deleted.");
    } catch (e: any) {
      setStatus(`Delete failed: ${e?.message || String(e)}`);
    }
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ marginTop: 0 }}>Profiles</h1>
      <p style={{ color: "#444" }}>
        Profiles are stored in Postgres (Render). You can pull Workshop/Mastery from Craft World using your logged-in{" "}
        <code>idToken</code>.
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
          <input
            type="number"
            min={0}
            max={4}
            value={workers}
            onChange={(e) => setWorkers(Number(e.target.value))}
            style={{ padding: 8, width: 90 }}
          />
        </label>
        <label>
          Factory count:{" "}
          <input
            type="number"
            min={1}
            value={factoryCount}
            onChange={(e) => setFactoryCount(Number(e.target.value))}
            style={{ padding: 8, width: 110 }}
          />
        </label>

        <button onClick={fetchWorkshop} disabled={!getIdToken()} style={{ padding: "10px 14px" }}>
          Pull Workshop
        </button>
        <button onClick={fetchMastery} disabled={!getIdToken()} style={{ padding: "10px 14px" }}>
          Pull Mastery
        </button>

        <button onClick={save} disabled={!getSessionToken()} style={{ padding: "10px 14px" }}>
          Save/Update
        </button>
        <button onClick={load} disabled={!getSessionToken()} style={{ padding: "10px 14px" }}>
          Refresh
        </button>
      </div>

      {status && <div style={{ marginTop: 10, color: "#666", whiteSpace: "pre-wrap" }}>{status}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <b>Workshop (map)</b>
          <pre style={{ marginTop: 10, fontSize: 12, background: "#fafafa", padding: 10, borderRadius: 8, overflow: "auto" }}>
            {JSON.stringify(workshop, null, 2)}
          </pre>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <b>Mastery (map)</b>
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
                <div style={{ fontSize: 12, color: "#666" }}>
                  workers: {p.workers} · factories: {p.factoryCount}
                </div>
              </div>
              <button onClick={() => del(p.id)} style={{ padding: "8px 10px" }}>
                Delete
              </button>
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
