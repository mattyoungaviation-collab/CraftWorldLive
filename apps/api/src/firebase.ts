import { z } from "zod";

const SignInRes = z.object({
  idToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.string().or(z.number()),
  localId: z.string().optional()
});

const LookupRes = z.object({
  users: z.array(z.object({ localId: z.string() }))
});

export async function firebaseSignInWithCustomToken(apiKey: string, customToken: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firebase signInWithCustomToken HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  return SignInRes.parse(json);
}

export async function firebaseLookupUid(apiKey: string, idToken: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firebase accounts:lookup HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  const parsed = LookupRes.parse(json);
  return parsed.users[0]?.localId ?? null;
}
