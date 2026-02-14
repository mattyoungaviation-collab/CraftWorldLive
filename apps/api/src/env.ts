import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(10000),
  WEB_ORIGIN: z.string().optional(),

  CW_GRAPHQL_URL: z.string().default("https://craft-world.gg/graphql"),
  CW_APP_VERSION: z.string().default("1.6.5"),

  // SAFE: web api key only (public). No Firebase Admin secrets.
  CW_FIREBASE_WEB_API_KEY: z.string().optional(),

  // Back-compat (optional). We won't require it anymore.
  FIREBASE_API_KEY: z.string().optional(),

  JWT_SECRET: z.string().default("dev-secret-change-me")
});

export type Env = z.infer<typeof EnvSchema>;
