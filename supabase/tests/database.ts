import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

// A real Postgres, in memory, with the app's schema loaded: for testing what
// lives in the database (functions, triggers, row-level security) before a
// migration is applied to the live one. It is PGlite, Postgres built to run
// inside Node, so there is no server to start. It runs in a thread of its own
// (database-worker.mjs), since Jest's sandbox can't load it.

const SUPABASE = join(__dirname, '..');

/** A file under supabase/, as text. */
export const sqlFile = (...path: string[]) => readFileSync(join(SUPABASE, ...path), 'utf8');

/**
 * What Supabase provides around the app's schema, as little of it as the
 * schema needs: its three roles (with the rights it gives them on new
 * tables), the users table, `auth.uid()` and the storage buckets table.
 */
const SUPABASE_PLATFORM = `
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public
    grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    encrypted_password text
  );
  -- The signed-in user's id, as each test sets it (see asUser).
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
`;

type Row = Record<string, unknown>;

interface Request {
  op: 'exec' | 'query' | 'close';
  sql?: string;
  params?: unknown[];
  as?: { role: 'authenticated' | 'anon' | 'service_role'; userId?: string; timeZone?: string };
}

export interface TestDatabase {
  /** Runs any number of statements, as the database's owner. */
  exec(sql: string): Promise<void>;
  /** Runs one statement as the database's owner (no row-level security). */
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /**
   * Runs one statement as a signed-in player, the way a request from the app
   * reaches the database: the `authenticated` role, with row-level security
   * on and `auth.uid()` answering with their id.
   */
  asUser<T = Row>(
    userId: string,
    sql: string,
    params?: unknown[],
    /** The session's time zone, which a direct caller of the API can choose. */
    timeZone?: string,
  ): Promise<T[]>;
  /** Runs one statement as a signed-out visitor. */
  asVisitor<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /**
   * Runs one statement as the app's server does with its own key: the
   * `service_role` role, which row-level security doesn't apply to.
   */
  asServer<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** A fresh database with supabase/schema.sql loaded, as a new project would have it. */
export async function createDatabase(): Promise<TestDatabase> {
  const worker = new Worker(join(__dirname, 'database-worker.mjs'), {
    workerData: { setup: [SUPABASE_PLATFORM, sqlFile('schema.sql')] },
  });
  const waiting = new Map<number, { resolve: (rows: Row[]) => void; reject: (e: Error) => void }>();
  let lastId = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      worker.once('error', reject);
      worker.once('message', (message: { ready: boolean; error?: string }) =>
        message.ready ? resolve() : reject(new Error(`The schema did not load: ${message.error}`)),
      );
    });
  } catch (error) {
    // A thread left running would keep the test run from ending.
    await worker.terminate();
    throw error;
  }
  worker.on('message', (answer: { id: number; rows?: Row[]; error?: string }) => {
    const request = waiting.get(answer.id);
    waiting.delete(answer.id);
    if (answer.error !== undefined) request?.reject(new Error(answer.error));
    else request?.resolve(answer.rows ?? []);
  });

  const send = (request: Request) =>
    new Promise<Row[]>((resolve, reject) => {
      const id = ++lastId;
      waiting.set(id, { resolve, reject });
      worker.postMessage({ id, ...request });
    });

  return {
    exec: async (sql) => void (await send({ op: 'exec', sql })),
    query: <T>(sql: string, params?: unknown[]) =>
      send({ op: 'query', sql, params }) as Promise<T[]>,
    asUser: <T>(userId: string, sql: string, params?: unknown[], timeZone?: string) =>
      send({
        op: 'query',
        sql,
        params,
        as: { role: 'authenticated', userId, timeZone },
      }) as Promise<T[]>,
    asVisitor: <T>(sql: string, params?: unknown[]) =>
      send({ op: 'query', sql, params, as: { role: 'anon' } }) as Promise<T[]>,
    asServer: <T>(sql: string, params?: unknown[]) =>
      send({ op: 'query', sql, params, as: { role: 'service_role' } }) as Promise<T[]>,
    close: async () => {
      await send({ op: 'close' });
      await worker.terminate();
    },
  };
}

/** A new account (its profile is made by the schema's own trigger); returns its id. */
export async function createUser(db: TestDatabase): Promise<string> {
  const [user] = await db.query<{ id: string }>(
    'insert into auth.users default values returning id',
  );
  return user.id;
}

/** Empties every account, and with them every row the app keeps. */
export async function clearDatabase(db: TestDatabase): Promise<void> {
  await db.exec('truncate auth.users cascade');
}
