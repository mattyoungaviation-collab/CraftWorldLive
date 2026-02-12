import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(10000),
  DATABASE_URL: z.string(),
  CW_GRAPHQL_URL: z.string().default("https://craft-world.gg/graphql"),
  CW_APP_VERSION: z.string().default("1.6.5"),
  FIREBASE_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().default("dev-secret-change-me")
});

export type Env = z.infer<typeof EnvSchema>;
