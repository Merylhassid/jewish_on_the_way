'use strict';

/*
 * Pilot: verify kosher certification via LLM + web search for a handful of
 * restaurants flagged by the Shabbat-hours audit. READ-ONLY — no DB writes.
 *
 * Usage: node scripts/pilot-kosher-cert-check.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5-20251001';

const CANDIDATES = [
  { id: 7599, name: "Erin McKenna's Bakery LA", city: 'Los Angeles', country: 'United States' },
  { id: 7820, name: 'Dough Doughnuts - Rockefeller Center', city: 'New York', country: 'United States' },
  { id: 8030, name: 'Gare 18', city: 'Montreal', country: 'Canada' },
  { id: 7471, name: 'In & Out Bagels', city: 'Miami', country: 'United States' },
  { id: 4067, name: 'מאפיית הכפר', city: 'Rosh HaAyin', country: 'Israel' },
];

async function checkOne(client, r) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    system: [
      'You verify whether a specific restaurant currently holds a valid kosher certification (any recognized kashrut authority — rabbanut, OU, OK, Kof-K, local vaad, etc).',
      'Search the web for the restaurant name + city to find its official kosher certification status, not general "kosher-style" branding.',
      'Be skeptical: a restaurant serving Jewish-style food (bagels, deli, falafel) is NOT automatically kosher-certified. Many famous "Jewish deli" restaurants are explicitly NOT kosher.',
      'After searching, answer in strict JSON only, no other text:',
      '{"kosher_certified":"yes"|"no"|"unclear","certifying_body":string|null,"confidence":0-1,"evidence":"short reason in Hebrew","source_url":string|null}',
    ].join('\n'),
    messages: [{
      role: 'user',
      content: `Restaurant: "${r.name}", ${r.city}, ${r.country}. Does it currently hold a valid kosher certification?`,
    }],
  });

  const textBlocks = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const match = textBlocks.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : { kosher_certified: 'unclear', evidence: 'unparseable: ' + textBlocks.slice(0, 200) };

  const usage = resp.usage || {};
  const searchCalls = resp.content.filter((b) => b.type === 'server_tool_use' && b.name === 'web_search').length;
  return { parsed, usage, searchCalls };
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let totalIn = 0, totalOut = 0, totalSearches = 0;
  for (const r of CANDIDATES) {
    console.log(`\n=== #${r.id} ${r.name} (${r.city}, ${r.country}) ===`);
    try {
      const { parsed, usage, searchCalls } = await checkOne(client, r);
      console.log('  result:', JSON.stringify(parsed, null, 2));
      console.log(`  tokens: in=${usage.input_tokens} out=${usage.output_tokens} | web_search calls=${searchCalls}`);
      totalIn += usage.input_tokens || 0;
      totalOut += usage.output_tokens || 0;
      totalSearches += searchCalls;
    } catch (e) {
      console.log('  FAILED:', e.message);
    }
  }
  // Haiku 4.5 pricing: $1/M in, $5/M out. Web search: $10/1000 searches (per Anthropic pricing).
  const llmCost = (totalIn / 1e6) * 1 + (totalOut / 1e6) * 5;
  const searchCost = (totalSearches / 1000) * 10;
  console.log(`\n=== PILOT DONE ===`);
  console.log(`total tokens: in=${totalIn} out=${totalOut} | total web_search calls=${totalSearches}`);
  console.log(`estimated cost: LLM ~$${llmCost.toFixed(4)} + search ~$${searchCost.toFixed(4)} = ~$${(llmCost + searchCost).toFixed(4)} for ${CANDIDATES.length} restaurants`);
  console.log(`projected for 244 restaurants: ~$${(((llmCost + searchCost) / CANDIDATES.length) * 244).toFixed(2)}`);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
