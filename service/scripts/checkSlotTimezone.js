/**
 * Read-only check: how does the Armenia database store organization and
 * campaign slot times, and can the API parse them?
 *
 *   TZ=UTC node scripts/checkSlotTimezone.js
 *
 * Only runs SELECT / SHOW. Writes nothing.
 */
import { getDBPool } from "#utils/dbConfig";
import { getSlotTimestamp } from "#utils/slotDuration";

const pii = getDBPool("piiDb", "AM");

const REQUIRED_ENV = ["PII_DB_URL_AM"];

// pg silently falls back to localhost when a connection string is undefined, so
// a missing variable would point this script at whatever Postgres runs locally.
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `Missing ${missingEnv.join(
      ", "
    )} in the environment / provider/service/.env. Refusing to fall back to localhost.`
  );
  process.exit(1);
}

const printTarget = async (label, pool) => {
  const t = (
    await pool.query(
      `SELECT current_database() AS db, coalesce(host(inet_server_addr()), 'local socket') AS host, current_user AS who`
    )
  ).rows[0];
  console.log(`${label}: database "${t.db}" on ${t.host} as ${t.who}`);
};

const run = async () => {
  await printTarget("PII", pii);
  const one = async (sql) => (await pii.query(sql)).rows[0];

  const session = await one(`SHOW timezone`);
  const source = await one(
    `SELECT setting, source FROM pg_settings WHERE name = 'TimeZone'`
  );
  console.log(
    `Session time zone: ${session.TimeZone} (set by: ${source.source})`
  );

  const overrides = await pii
    .query(
      `SELECT coalesce(d.datname, '*') AS database, coalesce(r.rolname, '*') AS role, s.setconfig
       FROM pg_db_role_setting s
       LEFT JOIN pg_database d ON d.oid = s.setdatabase
       LEFT JOIN pg_roles r ON r.oid = s.setrole`
    )
    .then((res) => res.rows)
    .catch(() => []);
  overrides
    .filter((o) => (o.setconfig || []).some((c) => /timezone/i.test(c)))
    .forEach((o) =>
      console.log(
        `  override: database=${o.database} role=${o.role} ${o.setconfig.join(
          " "
        )}`
      )
    );

  // Every organization/campaign entry: what zone text it carries, and whether
  // the API (getSlotTimestamp) can read it.
  const { rows } = await pii.query(`
    SELECT 'organization' AS pool, e->>'time' AS time, a.start_date >= now() - INTERVAL '7 days' AS current
    FROM availability a, jsonb_array_elements(
      CASE WHEN jsonb_typeof(a.organization_slots) = 'array' THEN a.organization_slots ELSE '[]' END) e
    UNION ALL
    SELECT 'campaign', e->>'time', a.start_date >= now() - INTERVAL '7 days'
    FROM availability a, jsonb_array_elements(
      CASE WHEN jsonb_typeof(a.campaign_slots) = 'array' THEN a.campaign_slots ELSE '[]' END) e`);

  const summary = {};
  for (const row of rows) {
    const zone = row.time
      ? row.time.split(" ").slice(2).join(" ") || "(none)"
      : "NO TIME (null / missing)";
    const key = `${row.pool.padEnd(12)} zone "${zone}"`;
    summary[key] ??= { total: 0, current: 0, unreadable: 0, example: row.time };
    summary[key].total++;
    if (row.current) summary[key].current++;
    if (!row.time || Number.isNaN(getSlotTimestamp(row.time)))
      summary[key].unreadable++;
  }

  console.log(
    `\nStored organization/campaign slot times (${rows.length} entries):`
  );
  Object.entries(summary).forEach(([key, s]) =>
    console.log(
      `  ${key}: ${s.total} total, ${s.current} current/future, ${s.unreadable} unreadable by the API   e.g. "${s.example}"`
    )
  );
  if (!rows.length) console.log("  (none)");
};

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
