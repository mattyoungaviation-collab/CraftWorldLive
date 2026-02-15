export const WALLET_ADDR_KEY = "cw.wallet.address";

export function getWalletAddress(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(WALLET_ADDR_KEY) || "";
}

export function setWalletAddress(addr: string) {
  if (typeof window === "undefined") return;
  if (!addr) return;
  localStorage.setItem(WALLET_ADDR_KEY, addr);
}

export function clearWalletAddress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WALLET_ADDR_KEY);
}
