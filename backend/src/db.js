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
export const defaultDocumentSubjects = [
  { id: "toan-hoc", name: "Toán học", desc: "Đại số, Giải tích, Hình học không gian & Oxyz", tone: "math", icon: "Calculator", active: true },
  { id: "vat-ly", name: "Vật lý", desc: "Dao động cơ, Sóng cơ, Dòng điện xoay chiều & Sóng ánh sáng", tone: "physics", icon: "Atom", active: true },
  { id: "hoa-hoc", name: "Hóa học", desc: "Hóa hữu cơ, Vô cơ, Kim loại & Phản ứng oxi hóa khử", tone: "chemistry", icon: "FlaskConical", active: true },
  { id: "sinh-hoc", name: "Sinh học", desc: "Di truyền học, Tiến hóa, Sinh thái học & Tế bào", tone: "biology", icon: "Dna", active: true },
  { id: "ngu-van", name: "Ngữ văn", desc: "Phân tích tác phẩm, Sơ đồ luận điểm & Đề cương nghị luận", tone: "literature", icon: "BookOpen", active: true },
  { id: "tieng-anh", name: "Tiếng Anh", desc: "Trọng tâm ngữ pháp, Từ vựng chuyên đề & Cấu trúc câu", tone: "english", icon: "Languages", active: true },
  { id: "lich-su", name: "Lịch sử", desc: "Lịch sử Việt Nam, Thế giới hiện đại & Mốc thời gian trọng tâm", tone: "history", icon: "Landmark", active: true },
  { id: "dia-ly", name: "Địa lý", desc: "Địa lý tự nhiên, Dân cư, Các vùng kinh tế & Kỹ năng Atlat", tone: "geography", icon: "Globe", active: true },
  { id: "tin-hoc", name: "Tin học", desc: "Lập trình, Thuật toán, Cơ sở dữ liệu & Kiến thức tin học", tone: "cs", icon: "Laptop", active: true },
  { id: "gdcd", name: "GDCD", desc: "Pháp luật và đời sống, Công dân với kinh tế", tone: "amber", icon: "Scale", active: true },
  { id: "dgnl", name: "ĐGNL - ĐGTD", desc: "Đề cương tổng hợp tư duy định lượng & định tính", tone: "purple", icon: "GraduationCap", active: true },
];

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
      version integer NOT NULL DEFAULT 1, author_id uuid REFERENCES users(id), owner_id uuid REFERENCES sessions(id),
      updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES sessions(id);
    CREATE INDEX IF NOT EXISTS exams_filter ON exams(status,subject,grade);
    CREATE INDEX IF NOT EXISTS exams_owner ON exams(owner_id,status);
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
      id uuid PRIMARY KEY, exam_id uuid REFERENCES exams(id), question_id uuid REFERENCES questions(id),
      reason text NOT NULL DEFAULT 'other', suggested_answer text, message text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS documents (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      subject text NOT NULL,
      grade text NOT NULL,
      category text NOT NULL DEFAULT 'theory',
      file_name text NOT NULL,
      mime_type text NOT NULL,
      file_size integer NOT NULL,
      data bytea NOT NULL,
      thumbnail_url text,
      views_count integer NOT NULL DEFAULT 0,
      downloads_count integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'published',
      author_name text NOT NULL DEFAULT 'Examsparty',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS documents_filter ON documents(status,subject,grade,category);
    CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL);
  `);
  await db.query(
    "INSERT INTO settings (key,value) VALUES ('policy','{\"contributions_enabled\":true}') ON CONFLICT (key) DO NOTHING",
  );
  const defaultDocumentSubjects = [
    { id: "toan-hoc", name: "Toán học", desc: "Đại số, Giải tích, Hình học không gian & Oxyz", tone: "math", icon: "Calculator", active: true },
    { id: "vat-ly", name: "Vật lý", desc: "Dao động cơ, Sóng cơ, Dòng điện xoay chiều & Sóng ánh sáng", tone: "physics", icon: "Atom", active: true },
    { id: "hoa-hoc", name: "Hóa học", desc: "Hóa hữu cơ, Vô cơ, Kim loại & Phản ứng oxi hóa khử", tone: "chemistry", icon: "FlaskConical", active: true },
    { id: "sinh-hoc", name: "Sinh học", desc: "Di truyền học, Tiến hóa, Sinh thái học & Tế bào", tone: "biology", icon: "Dna", active: true },
    { id: "ngu-van", name: "Ngữ văn", desc: "Phân tích tác phẩm, Sơ đồ luận điểm & Đề cương nghị luận", tone: "literature", icon: "BookOpen", active: true },
    { id: "tieng-anh", name: "Tiếng Anh", desc: "Trọng tâm ngữ pháp, Từ vựng chuyên đề & Cấu trúc câu", tone: "english", icon: "Languages", active: true },
    { id: "lich-su", name: "Lịch sử", desc: "Lịch sử Việt Nam, Thế giới hiện đại & Mốc thời gian trọng tâm", tone: "history", icon: "Landmark", active: true },
    { id: "dia-ly", name: "Địa lý", desc: "Địa lý tự nhiên, Dân cư, Các vùng kinh tế & Kỹ năng Atlat", tone: "geography", icon: "Globe", active: true },
    { id: "tin-hoc", name: "Tin học", desc: "Lập trình, Thuật toán, Cơ sở dữ liệu & Kiến thức tin học", tone: "cs", icon: "Laptop", active: true },
    { id: "gdcd", name: "GDCD", desc: "Pháp luật và đời sống, Công dân với kinh tế", tone: "amber", icon: "Scale", active: true },
    { id: "dgnl", name: "ĐGNL - ĐGTD", desc: "Đề cương tổng hợp tư duy định lượng & định tính", tone: "purple", icon: "GraduationCap", active: true },
  ];
  await db.query(
    "INSERT INTO settings (key,value) VALUES ('document_subjects', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify(defaultDocumentSubjects)],
  );
  try {
    await db.query(`
      ALTER TABLE reports ALTER COLUMN exam_id DROP NOT NULL;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES questions(id);
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'other';
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS suggested_answer text;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}';
    `);
  } catch (err) {
    console.warn("Reports migration notice:", err.message);
  }
  try {
    await db.query(`
      DELETE FROM exam_questions WHERE question_id IN (SELECT id FROM questions WHERE status = 'deleted');
      DELETE FROM exam_questions WHERE exam_id IN (SELECT id FROM exams WHERE status = 'deleted');
      DELETE FROM questions WHERE status = 'deleted';
    `);
  } catch (err) {
    console.warn("Cleanup warning in migrate:", err.message);
  }
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
