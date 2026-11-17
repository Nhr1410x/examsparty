import pg from "pg";

export function createDatabase(url, ssl = false) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: ssl
      ? {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        }
      : undefined,
  });

  pool.on("error", (err) => {
    console.warn(
      "PostgreSQL idle client error (auto-reconnecting):",
      err.message,
    );
  });

  return pool;
}
export async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'contributor', status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY, token_hash text UNIQUE NOT NULL, user_id uuid REFERENCES users(id),
      expires_at timestamptz NOT NULL, auth_expires_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS exams (
      id uuid PRIMARY KEY, title text NOT NULL, subject text NOT NULL, grade text NOT NULL,
      description text NOT NULL DEFAULT '', content jsonb NOT NULL, status text NOT NULL DEFAULT 'draft',
      version integer NOT NULL DEFAULT 1, author_id uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS exams_filter ON exams(status,subject,grade);
    CREATE TABLE IF NOT EXISTS questions (
      id uuid PRIMARY KEY, content jsonb NOT NULL, status text NOT NULL DEFAULT 'draft', version integer NOT NULL DEFAULT 1,
      author_id uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS exam_questions (
      exam_id uuid REFERENCES exams(id), question_id uuid REFERENCES questions(id), position integer NOT NULL,
      PRIMARY KEY(exam_id,question_id)
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id uuid PRIMARY KEY, exam_id uuid REFERENCES exams(id), owner_id uuid NOT NULL REFERENCES sessions(id),
      mode text NOT NULL, snapshot jsonb NOT NULL, responses jsonb NOT NULL DEFAULT '{}',
      checked jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'active', result jsonb,
      started_at timestamptz NOT NULL, expires_at timestamptz, submitted_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS attempts_owner ON attempts(owner_id,status);
    CREATE TABLE IF NOT EXISTS submissions (
      id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES sessions(id), contact text NOT NULL,
      tracking_hash text UNIQUE NOT NULL, content jsonb NOT NULL, status text NOT NULL DEFAULT 'pending',
      review_note text, reviewer_id uuid REFERENCES users(id), reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS assets (
      id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES sessions(id), mime_type text NOT NULL,
      size integer NOT NULL, data bytea NOT NULL, published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
      target_type text NOT NULL, target_id uuid, summary text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS asset_access (
      asset_id uuid REFERENCES assets(id), session_id uuid REFERENCES sessions(id),
      PRIMARY KEY(asset_id,session_id)
    );
    CREATE TABLE IF NOT EXISTS reports (
      id uuid PRIMARY KEY, exam_id uuid NOT NULL REFERENCES exams(id), message text NOT NULL,
      status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL);
  `);
  await db.query(
    "INSERT INTO settings (key,value) VALUES ('policy','{\"contributions_enabled\":true}') ON CONFLICT (key) DO NOTHING",
  );
}

export async function transaction(db, fn) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
