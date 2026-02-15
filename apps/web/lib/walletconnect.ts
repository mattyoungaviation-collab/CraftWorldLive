import EthereumProvider from "@walletconnect/ethereum-provider";

const LS_ADDR_KEY = "cw.walletAddress";

// Singleton cache to prevent “Core already initialized”
let providerPromise: Promise<any> | null = null;
let providerInstance: any | null = null;

export function getStoredWalletAddress(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LS_ADDR_KEY) || "";
}

export function saveWalletAddress(addr: string) {
  if (typeof window === "undefined") return;
  if (!addr) return;
  window.localStorage.setItem(LS_ADDR_KEY, addr);
}

export async function getWalletConnectProvider(projectId: string) {
  if (typeof window === "undefined") {
    throw new Error("WalletConnect provider can only be created in the browser.");
  }

  if (providerInstance) return providerInstance;
  if (providerPromise) return providerPromise;

  providerPromise = (async () => {
    const p = await EthereumProvider.init({
      projectId,
      // Ronin chainId = 2020. (If you use testnet too, add it in optionalChains.)
      chains: [2020],
      optionalChains: [2020],
      showQrModal: true,
      methods: ["personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
      events: ["accountsChanged", "chainChanged", "disconnect"],
      metadata: {
        name: "CraftWorldLive",
        description: "Craft World calculator + profiles",
        url: window.location.origin,
        icons: ["https://walletconnect.com/walletconnect-logo.png"]
      }
    });

    // Keep localStorage in sync
    p.on?.("accountsChanged", (accounts: string[]) => {
      const a = (accounts?.[0] || "").toLowerCase();
      if (a) saveWalletAddress(a);
    });

    providerInstance = p;
    return p;
  })();

  return providerPromise;
}

export async function getConnectedAddress(provider: any): Promise<string> {
  if (!provider) return getStoredWalletAddress();

  // Most providers expose accounts
  const acc = provider.accounts?.[0];
  if (typeof acc === "string" && acc.length > 0) {
    const addr = acc.toLowerCase();
    saveWalletAddress(addr);
    return addr;
  }

  // Fallback to persisted address (helps after route changes)
  return getStoredWalletAddress();
}

/**
 * Connect only when needed.
 * If a session exists, init() should restore without re-opening the modal.
 */
export async function connectWallet(provider: any) {
  if (!provider) throw new Error("Missing provider");

  // Some implementations expose `connected`
  if (provider.connected) return;

  // If there’s already a session, this should be silent; otherwise it opens QR
  await provider.connect();
}
