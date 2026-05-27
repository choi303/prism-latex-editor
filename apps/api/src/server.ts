import { env } from "./config/env.js";
import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({
    port: env.PORT,
    host: env.API_HOST
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}