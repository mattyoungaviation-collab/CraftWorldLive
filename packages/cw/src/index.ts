import { z } from "zod";

export const GraphQLRequest = z.object({
  query: z.string(),
  variables: z.any().optional()
});
export type GraphQLRequest = z.infer<typeof GraphQLRequest>;

export const NonceResponse = z.object({
  data: z.object({
    getNonce: z.object({ nonce: z.string() })
  })
});

export const CustomTokenResponse = z.object({
  data: z.object({
    loginForCustomToken: z.object({ customToken: z.string() })
  })
});

export async function cwGraphql<T>(
  url: string,
  appVersion: string,
  body: GraphQLRequest,
  idToken?: string
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-app-version": appVersion,
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CraftWorld GraphQL HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export function nonceQuery(walletAddress: string) {
  return {
    query: "query($walletAddress: String!) { getNonce(walletAddress: $walletAddress) { nonce } }",
    variables: { walletAddress }
  };
}

export function customTokenMutation(walletAddress: string, signature: string) {
  return {
    query:
      "mutation LoginForCustomToken($signature: String!, $walletAddress: String!) { loginForCustomToken(signature: $signature, walletAddress: $walletAddress) { customToken } }",
    variables: { signature, walletAddress }
  };
}
