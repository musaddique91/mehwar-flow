import 'reflect-metadata';
import { createApp } from './bootstrap';
import { loadConfig } from './config';

async function main() {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.PORT, '0.0.0.0');
  console.log(`Mehwar Flow API listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
