// The thread a test database runs in (see database.ts). PGlite loads its
// Postgres build with a dynamic import, which Jest's sandbox refuses, so it
// runs out here in plain Node and the tests send it one statement at a time.

import { parentPort, workerData } from 'node:worker_threads';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ROLES = ['anon', 'authenticated', 'service_role'];

/** Runs one request from the tests; the rows it gave, or why it failed. */
async function run({ op, sql, params, as }) {
  if (op === 'close') return db.close();
  if (op === 'exec') {
    await db.exec(sql);
    return [];
  }
  // As a signed-in player, a signed-out visitor or the app's server with its
  // own key: one transaction with the role set and `auth.uid()` answering
  // with their id, the way a request from the app reaches the database.
  if (as) {
    return db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [as.userId ?? '']);
      await tx.exec(`set local role ${ROLES.includes(as.role) ? as.role : 'anon'}`);
      // A direct caller of the API can ask for any time zone.
      if (as.timeZone) await tx.query(`select set_config('TimeZone', $1, true)`, [as.timeZone]);
      return (await tx.query(sql, params ?? [])).rows;
    });
  }
  return (await db.query(sql, params ?? [])).rows;
}

parentPort.on('message', async (request) => {
  try {
    parentPort.postMessage({ id: request.id, rows: await run(request) });
  } catch (error) {
    parentPort.postMessage({ id: request.id, error: String(error?.message ?? error) });
  }
});

try {
  for (const sql of workerData.setup) await db.exec(sql);
  parentPort.postMessage({ ready: true });
} catch (error) {
  parentPort.postMessage({ ready: false, error: String(error?.message ?? error) });
}
