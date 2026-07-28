import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const POLL_MS = 5000;
const MAX_ATTEMPTS = 180;
const OUTPUT = new URL('./scan-sweep-results.json', import.meta.url).pathname;

const sites = [
  { name: 'GradLoom', url: 'https://gradloom.app', persona: 'SaaS Founder', platform: 'Lovable' },
  { name: 'WellnestAI', url: 'https://wellnestai.com', persona: 'AI/Tech Startup', platform: 'Replit' },
  { name: 'Jukebox Burgers', url: 'https://jukeboxburgers.com', persona: 'Local Business', platform: 'Lovable' },
  { name: 'Consile', url: 'https://consile.app', persona: 'SaaS Founder', platform: 'Lovable' },
];

const results = [];

async function scan(site) {
  process.stdout.write(`\n${site.name} (${site.platform}, ${site.persona}) → ${site.url}\n`);

  const submit = await fetch(`${BASE}/api/checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: site.url }),
  });
  const body = await submit.json();
  if (!submit.ok || !body.reportId) {
    process.stdout.write(`  FAIL submit: ${submit.status} ${JSON.stringify(body)}\n`);
    results.push({ ...site, status: 'SUBMIT_FAILED', error: body.error || body });
    return;
  }
  const reportId = body.reportId;
  process.stdout.write(`  reportId=${reportId} queue=${body.queue?.state || '?'}\n`);

  let lastStatus = '?';
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${BASE}/api/reports/${reportId}`);
    const r = await res.json();
    const st = r.status ?? 'ERROR';
    const p = r.progress ?? null;
    const sc = r.score ?? null;
    const err = r.error ? String(r.error.message || JSON.stringify(r.error)).slice(0, 120) : '';
    if (st !== lastStatus) {
      lastStatus = st;
      process.stdout.write(`  [${i}] ${st} progress=${p ?? '-'} score=${sc ?? '-'}${err ? ` error=${err}` : ''}\n`);
    }
    if (['COMPLETED', 'ERROR', 'FAILED'].includes(st)) {
      const rubricScores = {};
      if (r.rubrics) {
        for (const rb of r.rubrics) rubricScores[rb.name ?? '?'] = rb.score ?? null;
      }
      const entry = {
        ...site,
        reportId,
        status: st,
        score: sc,
        progress: p,
        totalFlags: r.totalFlags ?? null,
        rubricScores,
        technologyProfile: r.technologyProfile?.insight ?? null,
        queue: r.queue?.state ?? '?',
        error: err || null,
      };
      results.push(entry);
      process.stdout.write(`  DONE score=${sc} MESSAGE=${rubricScores.MESSAGE ?? '-'} EXPERIENCE=${rubricScores.EXPERIENCE ?? '-'} REACH=${rubricScores.REACH ?? '-'}\n`);
      return;
    }
  }
  results.push({ ...site, status: 'TIMEOUT' });
  process.stdout.write(`  TIMEOUT after ${MAX_ATTEMPTS} attempts\n`);
}

for (const site of sites) {
  const t0 = Date.now();
  await scan(site);
  process.stdout.write(`  wall=${Math.round((Date.now() - t0) / 1000)}s\n`);
  writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
}

process.stdout.write(`\nDone. ${results.filter((r) => r.status === 'COMPLETED').length}/${sites.length} completed.\n`);
process.stdout.write(`Results: ${OUTPUT}\n`);
