import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { logger } from "./shared/logger.js";

// Validate env at boot — fails clearly in production, warns in development
const env = getEnv();

const app = createApp();

const port = env.PORT;
app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, `DealFlow360 foundation on :${port}`);
  // Keep console for environments without pino-pretty
   
  console.log(`DealFlow360 foundation on :${port} (NODE_ENV=${env.NODE_ENV})`);
});
