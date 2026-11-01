import postgres from 'postgres';
import { loadEnvFile } from '../src/lib/load-env.js';

loadEnvFile();
const url = process.env.DATABASE_URL!;
const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  const rows = await client`select current_user as role, current_database() as db`;
  console.log(rows);
  const userCount = await client`select count(*)::int as total from users`;
  console.log(userCount);
  await client.begin(async (tx) => {
    await tx`select set_config('app.church_id', '00000000-0000-0000-0000-000000000000', true)`;
    console.log('set_config ok');
  });
} catch (error) {
  console.error(error);
} finally {
  await client.end();
}
