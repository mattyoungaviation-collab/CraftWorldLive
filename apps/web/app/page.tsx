"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { getIdToken, getSessionToken, saveAuthTokens } from "../lib/auth";
import {
  connectWallet,
  getConnectedAddress,
  getStoredWalletAddress,
  getWalletConnectProvider,
  saveWalletAddress
} from "../lib/walletconnect";

export default function Page() {
  const [provider, setProvider] = useState<any>(null);
  const [address, setAddress] = useState<string>("");
  const [status, setStatus] = useState<string>("Disconnected");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [idToken, setIdToken] = useState<string>("");

  useEffect(() => {
    // Show persisted address immediately (prevents “Address: —” after navigation)
    setAddress(getStoredWalletAddress());

    setSessionToken(getSessionToken());
    setIdToken(getIdToken());

    (async () => {
      // Validate existing session cookie / bearer compatibility
      const meRes = await apiFetch("/auth/me");
      if (meRes.ok) {
        const me = await meRes.json();
        setStatus(`Authenticated as ${me?.user?.wallet || "wallet"}`);
      }

      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) return;

      try {
        const p = await getWalletConnectProvider(projectId);
        setProvider(p);

        const addr = await getConnectedAddress(p);
        if (addr) setAddress(addr);
      } catch {
        // ignore
      }
    })();
  }, []);

  const connect = async () => {
    setStatus("Connecting WalletConnect v2...");

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
      setStatus("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (Render env var not set).");
      return;
    }

    const p = await getWalletConnectProvider(projectId);
    await connectWallet(p);

    const addr = await getConnectedAddress(p);
    setProvider(p);
    setAddress(addr);
    if (addr) saveWalletAddress(addr);

    setStatus(addr ? "Connected" : "Connected (no account?)");
  };

  const login = async () => {
    if (!provider || !address) return;

    setStatus("Fetching nonce from API...");
    const nonceRes = await apiFetch("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ walletAddress: address })
    });
    const nonceJson = await nonceRes.json();
    if (!nonceJson.ok) throw new Error("Failed to get nonce");
    const message = nonceJson.nonce as string;

    setStatus("Signing nonce...");
    const sig = (await provider.request({
      method: "personal_sign",
      params: [message, address]
    })) as string;

    setStatus("Exchanging signature for tokens...");
    const loginRes = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ walletAddress: address, signature: sig })
    });
    const loginJson = await loginRes.json();
    if (!loginJson.ok) throw new Error("Login failed");

    setSessionToken(loginJson.sessionToken);
    setIdToken(loginJson.idToken);
    saveAuthTokens(loginJson.sessionToken, loginJson.idToken);

    // Persist wallet address too (UI survives navigation)
    if (address) saveWalletAddress(address);

    setStatus(`Logged in. UID: ${loginJson.uid || "unknown"}`);
  };

  return (
    <div style={{ maxWidth: 840 }}>
      <h1 style={{ marginTop: 0 }}>Wallet Login</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={connect} style={{ padding: "10px 14px" }}>
          Connect Wallet
        </button>
        <button onClick={login} disabled={!address} style={{ padding: "10px 14px" }}>
          Sign in
        </button>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div><b>Status:</b> {status}</div>
        <div><b>Address:</b> {address || "—"}</div>
        <div><b>Session token:</b> {sessionToken ? sessionToken.slice(0, 24) + "…" : "—"}</div>
        <div><b>CraftWorld idToken:</b> {idToken ? idToken.slice(0, 24) + "…" : "—"}</div>
      </div>
    </div>
  );
}
