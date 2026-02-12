"use client";

import EthereumProvider from "@walletconnect/ethereum-provider";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:10000";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!WC_PROJECT_ID) {
  throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
}

export default function Page() {
  const [provider, setProvider] = useState<any>(null);
  const [address, setAddress] = useState<string>("");
  const [status, setStatus] = useState<string>("Disconnected");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [idToken, setIdToken] = useState<string>("");

  const connect = async () => {
    setStatus("Connecting WalletConnect v2...");
    const p = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      chains: [2020], // Ronin mainnet chainId
      showQrModal: true,
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
      events: ["chainChanged", "accountsChanged", "disconnect"]
    });

    await p.connect();
    const accounts = (await p.request({ method: "eth_accounts" })) as string[];
    const addr = accounts?.[0] || "";
    setProvider(p);
    setAddress(addr);
    setStatus(addr ? "Connected" : "Connected (no account?)");
  };

  const login = async () => {
    if (!provider || !address) return;

    setStatus("Fetching nonce from API...");
    const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: address, signature: sig })
    });
    const loginJson = await loginRes.json();
    if (!loginJson.ok) throw new Error("Login failed");

    setSessionToken(loginJson.sessionToken);
    setIdToken(loginJson.idToken);
    setStatus(`Logged in. UID: ${loginJson.uid || "unknown"}`);

    localStorage.setItem("cw.sessionToken", loginJson.sessionToken);
    localStorage.setItem("cw.idToken", loginJson.idToken);
  };

  return (
    <div style={{ maxWidth: 840 }}>
      <h1 style={{ marginTop: 0 }}>Wallet Login</h1>
      <p style={{ color: "#444" }}>
        This uses WalletConnect v2 to connect your Ronin wallet, then performs the same Craft World nonce→signature→customToken→Firebase flow.
      </p>

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
