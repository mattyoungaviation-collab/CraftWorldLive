import EthereumProvider from "@walletconnect/ethereum-provider";

type WCProvider = InstanceType<typeof EthereumProvider>;

declare global {
  // eslint-disable-next-line no-var
  var __cw_wc_provider_promise: Promise<WCProvider> | undefined;
}

export async function getWalletConnectProvider(projectId: string): Promise<WCProvider> {
  if (!globalThis.__cw_wc_provider_promise) {
    globalThis.__cw_wc_provider_promise = EthereumProvider.init({
      projectId,
      chains: [2020],
      showQrModal: true,
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
      events: ["chainChanged", "accountsChanged", "disconnect"]
    });
  }
  return globalThis.__cw_wc_provider_promise;
}

export async function getConnectedAddress(p: WCProvider): Promise<string> {
  const accounts = (await p.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] || "";
}
