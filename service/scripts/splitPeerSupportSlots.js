/**
 * Split Armenia's peer-support (U-Friend) availability into 30-minute slots.
 *
 * Every future hour-long slot of a peer-support provider becomes two half-hour
 * slots in the same pools: 16:00-17:00 becomes 16:00-16:30 and 16:30-17:00.
 * Slots that overlap a consultation are left as they are.
 *
 * Run from provider/service, with the AM and master database URLs in the env:
 *
 *   TZ=UTC node scripts/splitPeerSupportSlots.js                    dry run (default)
 *   TZ=UTC node scripts/splitPeerSupportSlots.js --provider=<uuid>  one provider
 *   TZ=UTC node scripts/splitPeerSupportSlots.js --apply            write, after saving a backup
 *   TZ=UTC node scripts/splitPeerSupportSlots.js --restore=<file>   put the backed-up rows back
 *
 * Safe to run more than once: a slot that is already 30 minutes, or whose
 * half-hour neighbour already exists, is skipped.
 */
import fs from "fs";

import { getDBPool } from "#utils/dbConfig";
import {
  DEFAULT_SLOT_MINUTES,
  SLOT_STEP_MINUTES,
  getSlotDuration,
  getSlotTimestamp,
  doSlotsOverlap,
} from "#utils/slotDuration";

const COUNTRY = "AM";
const HALF = SLOT_STEP_MINUTES * 60; // seconds
// Same statuses the API treats as occupying a slot when booking.
const OCCUPYING_STATUSES = ["pending", "suggested", "scheduled", "finished"];

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  }),
);

const pii = getDBPool("piiDb", COUNTRY);
const clinical = getDBPool("clinicalDb", COUNTRY);
const master = getDBPool("masterDb");

const REQUIRED_ENV = ["MASTER_DB_URL", "PII_DB_URL_AM", "CLINICAL_DB_URL_AM"];

// pg silently falls back to localhost when a connection string is undefined, so
// a missing variable would point this script at whatever Postgres runs locally.
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(
    `Missing ${missingEnv.join(", ")} in the environment / provider/service/.env. Refusing to fall back to localhost.`,
  );
  process.exit(1);
}

const printTarget = async (label, pool) => {
  const t = (
    await pool.query(
      `SELECT current_database() AS db, coalesce(host(inet_server_addr()), 'local socket') AS host, current_user AS who`,
    )
  ).rows[0];
  console.log(`${label}: database "${t.db}" on ${t.host} as ${t.who}`);
};

// Only real entries: some stored pools contain null or time-less leftovers.
// Those are skipped here and stay in the row untouched (the script only appends).
const asArray = (value) =>
  (Array.isArray(value) ? value : []).filter(
    (entry) => entry && typeof entry === "object" && entry.time,
  );

/** What splitting one availability row would do. Pure: reads, never writes. */
const planRow = (row, bookedByProvider, nowSeconds) => {
  const durations = row.slot_durations || {};
  const pools = {
    normal: (row.slots || []).map((slot) => ({ t: getSlotTimestamp(slot) })),
    campaign: asArray(row.campaign_slots).map((slot) => ({
      t: getSlotTimestamp(slot),
      id: slot.campaign_id,
    })),
    organization: asArray(row.organization_slots).map((slot) => ({
      t: getSlotTimestamp(slot),
      id: slot.organization_id,
    })),
  };

  const allStarts = new Set(
    Object.values(pools).flatMap((entries) => entries.map((e) => e.t)),
  );
  const booked = bookedByProvider.get(row.provider_detail_id) || [];

  const split = { normal: [], campaign: [], organization: [] };
  const skipped = { past: 0, booked: 0, notAnHour: 0, neighbourExists: 0 };
  const decided = new Map(); // start -> split? (a start can sit in several pools)

  const shouldSplit = (t) => {
    if (decided.has(t)) return decided.get(t);
    let result = true;
    if (t <= nowSeconds) {
      skipped.past++;
      result = false;
    } else if (getSlotDuration(t, durations) !== DEFAULT_SLOT_MINUTES) {
      skipped.notAnHour++;
      result = false;
    } else if (
      booked.some((c) =>
        doSlotsOverlap(t, DEFAULT_SLOT_MINUTES, c.t, c.duration_minutes),
      )
    ) {
      skipped.booked++;
      result = false;
    } else if (allStarts.has(t + HALF)) {
      skipped.neighbourExists++;
      result = false;
    }
    decided.set(t, result);
    return result;
  };

  for (const [pool, entries] of Object.entries(pools)) {
    for (const entry of entries) {
      if (Number.isNaN(entry.t)) continue;
      if (shouldSplit(entry.t)) split[pool].push(entry);
    }
  }

  const starts = [...decided].filter(([, yes]) => yes).map(([t]) => t);
  return { split, starts, skipped };
};

/**
 * Apply one row's plan in a single statement. Organization and campaign entries
 * are built with the same SQL the API uses, so the provider can remove them later.
 */
const applyRow = (client, availabilityId, { split, starts }) =>
  client.query(
    `
      UPDATE availability SET
        slots = CASE WHEN cardinality($2::bigint[]) = 0 THEN slots ELSE
          COALESCE(slots, ARRAY[]::timestamptz[])
          || (SELECT array_agg(to_timestamp(t + $5)) FROM unnest($2::bigint[]) AS t) END,
        -- A pool with nothing to add is left exactly as it is.
        campaign_slots = CASE WHEN cardinality($4::bigint[]) = 0 THEN campaign_slots ELSE
          (CASE WHEN jsonb_typeof(campaign_slots) = 'array' THEN campaign_slots ELSE '[]'::jsonb END)
          || (SELECT jsonb_agg(jsonb_build_object('campaign_id', c.id::uuid,
                     'time', to_char(to_timestamp(c.t + $5), 'YYYY-MM-DD HH24:MI:SS TZ')))
              FROM unnest($3::text[], $4::bigint[]) AS c(id, t)) END,
        organization_slots = CASE WHEN cardinality($7::bigint[]) = 0 THEN organization_slots ELSE
          (CASE WHEN jsonb_typeof(organization_slots) = 'array' THEN organization_slots ELSE '[]'::jsonb END)
          || (SELECT jsonb_agg(jsonb_build_object('organization_id', o.id::uuid,
                     'time', to_char(to_timestamp(o.t + $5), 'YYYY-MM-DD HH24:MI:SS TZ')))
              FROM unnest($6::text[], $7::bigint[]) AS o(id, t)) END,
        slot_durations = COALESCE(slot_durations, '{}'::jsonb) || COALESCE((
          SELECT jsonb_object_agg(k::text, $9::int)
          FROM unnest($8::bigint[]) AS s, LATERAL (VALUES (s), (s + $5)) AS v(k)), '{}'::jsonb),
        updated_at = now()
      WHERE availability_id = $1
    `,
    [
      availabilityId,
      split.normal.map((e) => e.t),
      split.campaign.map((e) => e.id),
      split.campaign.map((e) => e.t),
      HALF,
      split.organization.map((e) => e.id),
      split.organization.map((e) => e.t),
      starts,
      SLOT_STEP_MINUTES,
    ],
  );

const restore = async (file) => {
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  const client = await pii.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `UPDATE availability
         SET slots = $2::timestamptz[], campaign_slots = $3::jsonb,
             organization_slots = $4::jsonb, slot_durations = $5::jsonb, updated_at = now()
         WHERE availability_id = $1`,
        [
          row.availability_id,
          row.slots,
          JSON.stringify(row.campaign_slots),
          JSON.stringify(row.organization_slots),
          JSON.stringify(row.slot_durations),
        ],
      );
    }
    await client.query("COMMIT");
    console.log(`Restored ${rows.length} availability rows from ${file}.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const run = async () => {
  await printTarget("PII", pii);
  await printTarget("Clinical", clinical);
  await printTarget("Master", master);
  console.log();
  if (args.restore) return restore(args.restore);

  const apply = args.apply === true;
  if (process.env.TZ !== "UTC") {
    console.warn("Warning: run with TZ=UTC, as production does.\n");
  }

  // Organization and campaign times are stored as to_char text in the database
  // session's time zone. If that renders as something JS cannot parse ("EET",
  // "CEST"), every entry we write would be invisible to the API. Check first.
  const probe = (
    await pii.query(
      `SELECT to_char(to_timestamp(0), 'YYYY-MM-DD HH24:MI:SS TZ') AS text`,
    )
  ).rows[0].text;
  if (getSlotTimestamp(probe) !== 0) {
    throw new Error(
      `The database session renders times as "${probe}", which the API cannot parse. Expected a UTC session. Aborting.`,
    );
  }

  const country = await master.query(
    `SELECT has_30_min_slots FROM country WHERE alpha2 = $1`,
    [COUNTRY],
  );
  const flagOn = !!country.rows[0]?.has_30_min_slots;
  if (apply && !flagOn) {
    throw new Error(
      `has_30_min_slots is off for ${COUNTRY}. Turn it on before applying, or providers will see an hourly grid with half-hour data.`,
    );
  }

  const providers = (
    await pii.query(
      `SELECT provider_detail_id, name, surname FROM provider_detail
       WHERE 'peer_support' = ANY(specializations)
         AND ($1::uuid IS NULL OR provider_detail_id = $1::uuid)
       ORDER BY surname, name`,
      [typeof args.provider === "string" ? args.provider : null],
    )
  ).rows;
  if (!providers.length) {
    console.log("No peer-support providers found.");
    return;
  }
  const providerIds = providers.map((p) => p.provider_detail_id);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Consultations still in the future that occupy time, per provider.
  const bookedByProvider = new Map();
  (
    await clinical.query(
      `SELECT provider_detail_id, extract(epoch FROM time)::bigint AS t, duration_minutes
       FROM consultation
       WHERE provider_detail_id = ANY($1::uuid[])
         AND status = ANY($2::consultation_status[])
         AND time + (duration_minutes * INTERVAL '1 minute') > now()`,
      [providerIds, OCCUPYING_STATUSES],
    )
  ).rows.forEach((c) => {
    const list = bookedByProvider.get(c.provider_detail_id) || [];
    list.push({ t: Number(c.t), duration_minutes: c.duration_minutes });
    bookedByProvider.set(c.provider_detail_id, list);
  });

  const columns = `availability_id, provider_detail_id, start_date, slots,
    campaign_slots, organization_slots, slot_durations`;
  // This week's row onwards: a week row can start up to 7 days ago.
  const rows = (
    await pii.query(
      `SELECT ${columns} FROM availability
       WHERE provider_detail_id = ANY($1::uuid[])
         AND start_date > now() - INTERVAL '7 days'
       ORDER BY provider_detail_id, start_date`,
      [providerIds],
    )
  ).rows;

  const totals = { normal: 0, campaign: 0, organization: 0, past: 0, booked: 0, notAnHour: 0, neighbourExists: 0 };
  const touched = [];
  for (const row of rows) {
    const plan = planRow(row, bookedByProvider, nowSeconds);
    for (const pool of ["normal", "campaign", "organization"]) totals[pool] += plan.split[pool].length;
    for (const key of Object.keys(plan.skipped)) totals[key] += plan.skipped[key];
    if (plan.starts.length) touched.push({ row, plan });
  }

  const name = (id) => {
    const p = providers.find((x) => x.provider_detail_id === id);
    return `${p.name} ${p.surname} (${id})`;
  };
  console.log(`${apply ? "APPLY" : "DRY RUN"} - ${COUNTRY}, has_30_min_slots=${flagOn}`);
  console.log(`${providers.length} peer-support providers, ${rows.length} current/future availability rows\n`);
  for (const { row, plan } of touched) {
    const week = new Date(row.start_date).toISOString().slice(0, 10);
    const s = plan.split;
    console.log(
      `${name(row.provider_detail_id)}  week ${week}: split ${plan.starts.length} hours ` +
        `(normal ${s.normal.length}, campaign ${s.campaign.length}, organization ${s.organization.length}); ` +
        `skipped booked ${plan.skipped.booked}`,
    );
  }
  console.log(
    `\nTotal entries to split: normal ${totals.normal}, campaign ${totals.campaign}, organization ${totals.organization}` +
      `\nSkipped: ${totals.booked} booked, ${totals.past} past, ${totals.notAnHour} already 30 min, ${totals.neighbourExists} half-hour neighbour exists`,
  );

  if (!apply) {
    console.log("\nNothing written. Re-run with --apply to split.");
    return;
  }
  if (!touched.length) {
    console.log("\nNothing to split.");
    return;
  }

  const backupFile =
    typeof args.backup === "string"
      ? args.backup
      : `availability-backup-${COUNTRY}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      touched.map(({ row }) => ({
        availability_id: row.availability_id,
        provider_detail_id: row.provider_detail_id,
        start_date: row.start_date,
        slots: row.slots,
        campaign_slots: row.campaign_slots,
        organization_slots: row.organization_slots,
        slot_durations: row.slot_durations,
      })),
      null,
      2,
    ),
  );
  console.log(`\nBackup of ${touched.length} rows written to ${backupFile}`);

  let applied = 0;
  for (const { row } of touched) {
    const client = await pii.connect();
    try {
      await client.query("BEGIN");
      // Re-read under a row lock and re-plan, so a provider editing this week
      // between the dry pass and now is not overwritten.
      const locked = (
        await client.query(
          `SELECT ${columns} FROM availability WHERE availability_id = $1 FOR UPDATE`,
          [row.availability_id],
        )
      ).rows[0];
      if (locked) {
        const fresh = planRow(locked, bookedByProvider, Math.floor(Date.now() / 1000));
        if (fresh.starts.length) {
          await applyRow(client, row.availability_id, fresh);
          applied++;
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`Row ${row.availability_id} failed and was left unchanged:`, err.message);
    } finally {
      client.release();
    }
  }
  console.log(`Split applied to ${applied} rows. To undo: --restore=${backupFile}`);
};

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
