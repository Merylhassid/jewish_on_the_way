import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

interface SourceRow {
  source: string | null;
  count: string;
}

interface MetricRow {
  parsed_count: string;
  changed_count: string;
  explicit_destination_null_count: string;
  avg_latency_ms: string | null;
}

interface ChangedRow {
  query: string;
  legacy_category: string | null;
  parsed_category: string | null;
  legacy_type: string | null;
  parsed_type: string | null;
  legacy_kashrut: string | null;
  parsed_kashrut: string | null;
  resolved_destination_id: number | null;
  source: string | null;
  latency_ms: number | null;
}

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  if (required.some((key) => !process.env[key])) {
    console.log('Shadow report skipped. Database env vars are missing.');
    return;
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    const sinceHours = Number(process.env.SHADOW_REPORT_HOURS ?? 24);
    const sourceRows = await client.query<SourceRow>(
      `SELECT source, COUNT(*)::text AS count
       FROM search_feedback
       WHERE created_at >= NOW() - ($1::text || ' hours')::interval
       GROUP BY source
       ORDER BY COUNT(*) DESC`,
      [sinceHours],
    );
    const metricRows = await client.query<MetricRow>(
      `SELECT
         COUNT(*) FILTER (WHERE parsed_json IS NOT NULL)::text AS parsed_count,
         COUNT(*) FILTER (
           WHERE parsed_json IS NOT NULL
             AND (
               COALESCE("detectedKeyword", '') IS DISTINCT FROM COALESCE(parsed_json->>'category', '')
               OR COALESCE("detectedType", '') IS DISTINCT FROM COALESCE(parsed_json #>> '{restaurant,type}', '')
               OR COALESCE("detectedKashrut", '') IS DISTINCT FROM COALESCE(parsed_json #>> '{restaurant,kashrut}', '')
             )
         )::text AS changed_count,
         COUNT(*) FILTER (
           WHERE parsed_json->>'explicitDestination' = 'true'
             AND resolved_destination_id IS NULL
         )::text AS explicit_destination_null_count,
         ROUND(AVG(latency_ms))::text AS avg_latency_ms
       FROM search_feedback
       WHERE created_at >= NOW() - ($1::text || ' hours')::interval`,
      [sinceHours],
    );
    const changedRows = await client.query<ChangedRow>(
      `SELECT
         query,
         "detectedKeyword" AS legacy_category,
         parsed_json->>'category' AS parsed_category,
         "detectedType" AS legacy_type,
         parsed_json #>> '{restaurant,type}' AS parsed_type,
         "detectedKashrut" AS legacy_kashrut,
         parsed_json #>> '{restaurant,kashrut}' AS parsed_kashrut,
         resolved_destination_id,
         source,
         latency_ms
       FROM search_feedback
       WHERE created_at >= NOW() - ($1::text || ' hours')::interval
         AND parsed_json IS NOT NULL
         AND (
           COALESCE("detectedKeyword", '') IS DISTINCT FROM COALESCE(parsed_json->>'category', '')
           OR COALESCE("detectedType", '') IS DISTINCT FROM COALESCE(parsed_json #>> '{restaurant,type}', '')
           OR COALESCE("detectedKashrut", '') IS DISTINCT FROM COALESCE(parsed_json #>> '{restaurant,kashrut}', '')
         )
       ORDER BY created_at DESC
       LIMIT 20`,
      [sinceHours],
    );

    const metrics = metricRows.rows[0];
    console.log(`Search shadow report (${sinceHours}h)`);
    console.log('Sources:');
    for (const row of sourceRows.rows) {
      console.log(`- ${row.source ?? 'null'}: ${row.count}`);
    }
    console.log(`Parsed rows: ${metrics?.parsed_count ?? '0'}`);
    console.log(`Changed from legacy: ${metrics?.changed_count ?? '0'}`);
    console.log(`explicitDestination=true with unresolved destination: ${metrics?.explicit_destination_null_count ?? '0'}`);
    console.log(`Average parser latency ms: ${metrics?.avg_latency_ms ?? 'n/a'}`);

    if (changedRows.rows.length > 0) {
      console.log('\nRecent changed rows:');
      for (const row of changedRows.rows) {
        console.log(
          `- ${row.query} | legacy=${row.legacy_category}/${row.legacy_type}/${row.legacy_kashrut} ` +
            `parsed=${row.parsed_category}/${row.parsed_type}/${row.parsed_kashrut} ` +
            `dest=${row.resolved_destination_id ?? 'null'} source=${row.source ?? 'null'} latency=${row.latency_ms ?? 'n/a'}`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
