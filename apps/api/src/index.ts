import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import { EnvSchema } from "./env.js";
import { PrismaClient } from "@prisma/client";
import { loadAssets } from "@craftworld/data";
import { cwGraphql, nonceQuery, customTokenMutation, NonceResponse, CustomTokenResponse } from "@craftworld/cw";
import { firebaseLookupUid, firebaseSignInWithCustomToken } from "./firebase.js";
import { z } from "zod";

const prisma = new PrismaClient();
const assets = loadAssets();

const env = EnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  WEB_ORIGIN: process.env.WEB_ORIGIN,
  DATABASE_URL: process.env.DATABASE_URL,
  CW_GRAPHQL_URL: process.env.CW_GRAPHQL_URL,
  CW_APP_VERSION: process.env.CW_APP_VERSION,
  CW_FIREBASE_WEB_API_KEY: process.env.CW_FIREBASE_WEB_API_KEY,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  JWT_SECRET: process.env.JWT_SECRET
});

const server = Fastify({ logger: true, trustProxy: true });

const allowedOrigins = (env.WEB_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    if (
      allowedOrigins.includes(origin) ||
      (env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    ) {
      return cb(null, true);
    }

    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true
});
await server.register(cookie);
await server.register(sensible);
await server.register(jwt, { secret: env.JWT_SECRET });

const sessionCookieName = "cw_session";
const sessionCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 60 * 60 * 24 * 7
};

server.get("/health", async () => ({ ok: true, service: "craftworld-calculator-api" }));
server.get("/data/factories", async () => ({ ok: true, rows: assets.factories }));
server.get("/data/mines", async () => ({ ok: true, rows: assets.mines }));

server.get("/cw/prices", async () => {
  const body = {
    query: `
      query {
        exchangePriceList {
          baseSymbol
          prices { referenceSymbol amount recommendation }
        }
      }
    `,
    variables: null
  };
  return await cwGraphql<any>(env.CW_GRAPHQL_URL, env.CW_APP_VERSION, body);
});

server.post("/auth/nonce", async (req) => {
  const Body = z.object({ walletAddress: z.string().min(6) });
  const { walletAddress } = Body.parse(req.body);

  const raw = await cwGraphql<any>(
    env.CW_GRAPHQL_URL,
    env.CW_APP_VERSION,
    nonceQuery(walletAddress)
  );
  const parsed = NonceResponse.parse(raw);
  return { ok: true, nonce: parsed.data.getNonce.nonce };
});

server.post("/auth/login", async (req, reply) => {
  const Body = z.object({
    walletAddress: z.string().min(6),
    signature: z.string().min(10)
  });
  const { walletAddress, signature } = Body.parse(req.body);

  const raw = await cwGraphql<any>(
    env.CW_GRAPHQL_URL,
    env.CW_APP_VERSION,
    customTokenMutation(walletAddress, signature)
  );
  const parsed = CustomTokenResponse.parse(raw);
  const customToken = parsed.data.loginForCustomToken.customToken;

  const apiKey = env.CW_FIREBASE_WEB_API_KEY || env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing CW_FIREBASE_WEB_API_KEY (Firebase Web API key used for Identity Toolkit).");
  }

  const signIn = await firebaseSignInWithCustomToken(apiKey, customToken);
  const expiresIn = Number(signIn.expiresIn ?? 0);
  const expiresAt = Date.now() + Math.max(0, expiresIn) * 1000;

  const uid = await firebaseLookupUid(apiKey, signIn.idToken);

  const user = await prisma.user.upsert({
    where: { wallet: walletAddress.toLowerCase() },
    create: { wallet: walletAddress.toLowerCase(), cwUid: uid ?? undefined },
    update: { cwUid: uid ?? undefined }
  });

  const token = await reply.jwtSign({ sub: user.id, wallet: user.wallet });
  reply.setCookie(sessionCookieName, token, sessionCookieOptions);

  return {
    ok: true,
    walletAddress: user.wallet,
    uid,
    idToken: signIn.idToken,
    refreshToken: signIn.refreshToken,
    expiresAt,
    sessionToken: token
  };
});

server.post("/auth/logout", async (_req, reply) => {
  reply.clearCookie(sessionCookieName, sessionCookieOptions);
  return { ok: true };
});

server.get("/auth/me", async (req, reply) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice("Bearer ".length)
    : "";
  const cookieToken = req.cookies[sessionCookieName] ?? "";
  const token = bearer || cookieToken;

  if (!token) return reply.code(401).send({ ok: false });

  try {
    const decoded = await server.jwt.verify<{ sub: string; wallet: string }>(token);
    return { ok: true, user: { id: decoded.sub, wallet: decoded.wallet } };
  } catch {
    return reply.code(401).send({ ok: false });
  }
});

server.addHook("preHandler", async (req) => {
  if (req.url.startsWith("/profiles")) {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : "";
    const cookieToken = req.cookies[sessionCookieName] ?? "";
    const token = bearer || cookieToken;

    if (!token) throw server.httpErrors.unauthorized();

    req.headers.authorization = `Bearer ${token}`;
    await req.jwtVerify();
  }
});

server.get("/profiles", async (req: any) => {
  const userId = req.user.sub as string;
  const profiles = await prisma.profile.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  return { ok: true, profiles };
});

server.post("/profiles", async (req: any) => {
  const userId = req.user.sub as string;
  const Body = z.object({
    name: z.string().min(1).max(64),
    workshop: z.any().optional(),
    mastery: z.any().optional(),
    workers: z.number().int().min(0).max(4).optional(),
    factoryCount: z.number().int().min(1).max(999999).optional()
  });
  const b = Body.parse(req.body);

  const created = await prisma.profile.upsert({
    where: { userId_name: { userId, name: b.name } },
    create: {
      userId,
      name: b.name,
      workshop: b.workshop ?? {},
      mastery: b.mastery ?? {},
      workers: b.workers ?? 0,
      factoryCount: b.factoryCount ?? 1
    },
    update: {
      workshop: b.workshop ?? undefined,
      mastery: b.mastery ?? undefined,
      workers: b.workers ?? undefined,
      factoryCount: b.factoryCount ?? undefined
    }
  });

  return { ok: true, profile: created };
});

server.delete("/profiles/:id", async (req: any) => {
  const userId = req.user.sub as string;
  const Params = z.object({ id: z.string() });
  const { id } = Params.parse(req.params);

  await prisma.profile.delete({ where: { id, userId } as any });
  return { ok: true };
});

server.post("/cw/account/workshop", async (req) => {
  const Body = z.object({ idToken: z.string().min(10) });
  const { idToken } = Body.parse(req.body);
  const body = {
    query: `
      query {
        account {
          workshop { symbol level }
        }
      }
    `,
    variables: null
  };
  return await cwGraphql<any>(env.CW_GRAPHQL_URL, env.CW_APP_VERSION, body, idToken);
});

server.post("/cw/account/mastery", async (req) => {
  const Body = z.object({ idToken: z.string().min(10) });
  const { idToken } = Body.parse(req.body);
  const body = {
    query: `
      query {
        account {
          proficiencies {
            symbol
            collectedAmount
            claimedLevel
          }
        }
      }
    `,
    variables: null
  };
  return await cwGraphql<any>(env.CW_GRAPHQL_URL, env.CW_APP_VERSION, body, idToken);
});

server.post("/cw/graphql", async (req) => {
  const Body = z.object({ query: z.string(), variables: z.any().optional(), idToken: z.string().optional() });
  const { query, variables, idToken } = Body.parse(req.body);

  const out = await cwGraphql<any>(
    env.CW_GRAPHQL_URL,
    env.CW_APP_VERSION,
    { query, variables },
    idToken
  );
  return out;
});

server.listen({ port: env.PORT, host: "0.0.0.0" });
