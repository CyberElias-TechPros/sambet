/**
 * End-to-end integration test for the Sambet API.
 *
 * Spawns a real `wrangler dev` (workerd) with local D1 + R2, applies the
 * migration, seeds the real 1669-row registry, then exercises the full API:
 * setup, auth, rate limiting, CRUD, filters, duplicate detection, import
 * (preview + execute + idempotency), export (CSV + XLSX), audit log, stats.
 *
 * Usage: npm run test:integration
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync as fsReadFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const BASE = 'http://127.0.0.1:8799';
const PORT = 8799;
const ADMIN = { name: 'Integration Tester', email: 'it@sambet.test', password: 'Sambet@1234' };

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

let cookie = '';

async function req(method, path, { body, headers = {} } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text.slice(0, 300) };
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: res.status, data, text, headers: res.headers };
}

/** Binary-safe GET (XLSX/CSV as raw bytes). */
async function reqBin(path) {
  const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {} });
  return { status: res.status, buf: new Uint8Array(await res.arrayBuffer()) };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + '/api/health');
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log('— Sambet API integration test —\n');

  console.log('[1/9] Clean local state, start wrangler dev…');
  const stateDir = '.wrangler/state';
  if (existsSync(stateDir)) rmSync(stateDir, { recursive: true, force: true });

  // Kill any stale workerd from a previous crashed run.
  try {
    execSync('pkill -x workerd 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(300);
  } catch {
    /* best effort */
  }

  const worker = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    detached: true, // own process group → we can kill the whole tree (incl. workerd)
  });
  let workerLog = '';
  worker.stdout.on('data', (d) => (workerLog += d));
  worker.stderr.on('data', (d) => (workerLog += d));

  const killTree = (sig = 'SIGTERM') => {
    try {
      if (worker.pid) process.kill(-worker.pid, sig);
    } catch {
      /* already gone */
    }
    try {
      execSync('pkill -x workerd 2>/dev/null || true', { stdio: 'ignore' });
    } catch {
      /* best effort */
    }
  };
  const dumpWorkerLog = () => {
    try {
      writeFileSync('/tmp/sambet-worker-log.txt', workerLog.slice(-20000));
    } catch {
      /* ignore */
    }
  };
  process.on('exit', () => {
    dumpWorkerLog();
    killTree('SIGKILL');
  });

  const up = await waitForHealth();
  if (!up) {
    console.error('Worker did not start. Log tail:\n', workerLog.slice(-3000));
    killTree();
    process.exit(1);
  }
  console.log('  worker up\n');

  try {
    console.log('[2/9] Fresh DB: status + auth guard');
    let r = await req('GET', '/api/auth/status');
    check('health ok', (await req('GET', '/api/health')).data.ok === true);
    check('not initialized', r.status === 200 && r.data.initialized === false);
    r = await req('GET', '/api/organizations');
    check('unauthenticated list → 401', r.status === 401);
    r = await req('GET', '/api/stats');
    check('unauthenticated stats → 401', r.status === 401);

    console.log('\n[3/9] First-run setup');
    r = await req('POST', '/api/auth/setup', { body: { name: 'A B', email: 'a@b.co', password: 'short' } });
    check('weak password rejected (400)', r.status === 400);
    r = await req('POST', '/api/auth/setup', { body: { name: 'A B', email: 'a@b.co', password: 'abcdefgh' } });
    check('no-digit password rejected (400)', r.status === 400);
    r = await req('POST', '/api/auth/setup', { body: ADMIN });
    check('setup succeeds (201)', r.status === 201, JSON.stringify(r.data));
    const setupCookie = r.headers.get('set-cookie') ?? '';
    check('session cookie is HttpOnly', /httponly/i.test(setupCookie));
    r = await req('GET', '/api/auth/me');
    check('me returns admin', r.status === 200 && r.data.user.email === ADMIN.email);
    r = await req('GET', '/api/auth/status');
    check('now initialized', r.data.initialized === true);
    r = await req('POST', '/api/auth/setup', { body: ADMIN });
    check('second setup → 409', r.status === 409);

    console.log('\n[4/9] Migrate the real legacy workbook through the import API');
    // The schema self-bootstraps on first request (already exercised above).
    // Seeding goes through the production import pipeline with the actual
    // 2000-row file — if this works, the user's real migration works.
    const legacyPath = fileURLToPath(new URL('../../SAMBET GRASSROOT PROJECT 1.xlsx', import.meta.url));
    const legacyBytes = new Uint8Array(fsReadFileSync(legacyPath));
    const legacyForm = new FormData();
    legacyForm.append('file', new File([legacyBytes], 'SAMBET GRASSROOT PROJECT 1.xlsx'));
    legacyForm.append('strategy', 'update');
    r = await req('POST', '/api/imports/preview', { body: legacyForm });
    check('legacy preview ok', r.status === 200 && !!r.data?.data?.uploadId, JSON.stringify(r.data).slice(0, 200));
    check('legacy preview: 1669 rows, 0 errors', r.data?.data?.total === 1669 && r.data?.data?.errorTotal === 0, `total=${r.data?.data?.total} errors=${r.data?.data?.errorTotal}`);
    r = await req('POST', '/api/imports/execute', { body: { uploadId: r.data?.data?.uploadId, strategy: 'update' } });
    check('legacy import executed', r.status === 201, JSON.stringify(r.data).slice(0, 200));
    check('legacy import: 1669 created', r.data?.data?.created === 1669, JSON.stringify(r.data?.data));
    r = await req('GET', '/api/organizations?pageSize=1');
    check('seed loaded: 1669 organizations', r.data?.meta?.total === 1669, `got ${r.data?.meta?.total}`);
    r = await req('GET', '/api/organizations?search=AYMAN%20T%20MPCSL&pageSize=5');
    check('search finds legacy row', r.data?.data?.some((o) => o.sn === 1), JSON.stringify(r.data?.data?.map((o) => o.sn)));
    r = await req('GET', '/api/organizations?state=Rivers&pageSize=1');
    check('state filter works (Rivers)', r.status === 200 && r.data.meta.total > 30, `total=${r.data?.meta?.total}`);
    r = await req('GET', '/api/organizations?category=Energy%20%26%20Lighting&pageSize=1');
    check('category filter works (Energy & Lighting)', r.status === 200 && r.data.meta.total > 300, `total=${r.data?.meta?.total}`);
    r = await req('GET', '/api/organizations?bank=Zenith%20Bank&pageSize=1');
    check('bank filter works (Zenith Bank)', r.status === 200 && r.data.meta.total > 200, `total=${r.data?.meta?.total}`);
    r = await req('GET', '/api/organizations?sort=name&order=asc&pageSize=3');
    check('sort by name works', r.status === 200 && r.data.data.length === 3);
    const dupTotal = (await req('GET', '/api/organizations?duplicate=1&pageSize=1')).data?.meta?.total ?? 0;
    check('duplicate filter finds legacy dupes', dupTotal > 40, `dupes=${dupTotal}`);
    const incTotal = (await req('GET', '/api/organizations?incomplete=1&pageSize=1')).data?.meta?.total ?? 0;
    check('incomplete filter finds partial rows', incTotal > 100, `incomplete=${incTotal}`);

    console.log('\n[5/9] Stats + audit');
    r = await req('GET', '/api/stats');
    check('stats.total = 1669', r.data?.total === 1669, `got ${r.data?.total}`);
    check('stats.statesCovered between 25 and 37', r.data?.statesCovered >= 25 && r.data?.statesCovered <= 37, `got ${r.data?.statesCovered}`);
    check('stats.byState non-empty', Array.isArray(r.data?.byState) && r.data.byState.length > 5);
    check('stats.byCategory has 13 categories', r.data?.byCategory?.length === 13, `got ${r.data?.byCategory?.length}`);
    check('stats.duplicates > 40', (r.data?.duplicates ?? 0) > 40, `got ${r.data?.duplicates}`);
    check('stats.recent has rows', r.data?.recent?.length === 6);

    console.log('\n[6/9] CRUD + validation');
    r = await req('POST', '/api/organizations', {
      body: { name: '  IT Test Org  ', ceo_name: 'Jane Doe', phone: 'O8031112222', email: 'JANE@IT.CO', state: 'RIVRES STATE', bank: 'U B A', account_number: ',0123456789', lga: 'Mushin', project_type: 'Road and Borehole', sn: 9001 },
    });
    check('create org (201)', r.status === 201, JSON.stringify(r.data).slice(0, 200));
    const createdId = r.data?.data?.id;
    check('phone normalized to E.164', r.data?.data?.phone === '+2348031112222', r.data?.data?.phone);
    check('email lowercased', r.data?.data?.email === 'jane@it.co');
    check('state raw kept + normalized', r.data?.data?.state === 'RIVRES STATE' && r.data?.data?.state_norm === 'Rivers');
    check('bank raw kept + normalized', r.data?.data?.bank === 'U B A' && r.data?.data?.bank_norm === 'United Bank for Africa (UBA)');
    check('account digits only', r.data?.data?.account_number === '0123456789');
    check('category inferred', r.data?.data?.project_category === 'Roads & Infrastructure');

    r = await req('POST', '/api/organizations', { body: { name: 'IT Test Org', state: 'Rivers' } });
    check('exact duplicate create → 409', r.status === 409, JSON.stringify(r.data).slice(0, 150));
    r = await req('POST', '/api/organizations', { body: { name: '   ' } });
    check('create without name → 400', r.status === 400);

    r = await req('GET', `/api/organizations/${createdId}`);
    check('get org detail', r.status === 200 && r.data.data.id === createdId);
    check('detail lists missing fields', Array.isArray(r.data?.data?.missing) && r.data.data.missing.length >= 0);

    r = await req('PATCH', `/api/organizations/${createdId}`, { body: { status: 'approved', phone: '09031112222' } });
    check('update org', r.status === 200 && r.data?.data?.status === 'approved');
    check('update reports changed fields', r.data?.data?.changed?.includes('status') && r.data?.data?.changed?.includes('phone'), JSON.stringify(r.data?.data?.changed));
    check('partial update does not report unchanged fields', !r.data?.data?.changed?.includes('sn') && !r.data?.data?.changed?.includes('ceo_name'), JSON.stringify(r.data?.data?.changed));
    r = await req('GET', `/api/organizations/${createdId}`);
    check('partial update preserved untouched fields', r.data?.data?.sn === 9001 && r.data?.data?.ceo_name === 'Jane Doe' && r.data?.data?.email === 'jane@it.co', JSON.stringify({ sn: r.data?.data?.sn, ceo: r.data?.data?.ceo_name, email: r.data?.data?.email }));

    r = await req('DELETE', `/api/organizations/${createdId}`);
    check('delete org (soft)', r.status === 200);
    r = await req('GET', `/api/organizations/${createdId}`);
    check('deleted org → 404', r.status === 404);
    r = await req('GET', '/api/organizations?pageSize=1');
    check('total back to 1669', r.data?.meta?.total === 1669, `got ${r.data?.meta?.total}`);

    // S/N of a soft-deleted record is still held by the UNIQUE index → clean 409, not a 500
    r = await req('POST', '/api/organizations', { body: { name: 'IT Test Org Reuse', state: 'Rivers', sn: 9001 } });
    check('reusing deleted S/N → 409 (not 500)', r.status === 409, `got ${r.status}`);

    // bulk delete
    r = await req('POST', '/api/organizations', { body: { name: 'Bulk One', state: 'Oyo' } });
    const bulk1 = r.data?.data?.id;
    r = await req('POST', '/api/organizations', { body: { name: 'Bulk Two', state: 'Oyo' } });
    const bulk2 = r.data?.data?.id;
    r = await req('POST', '/api/organizations/bulk-delete', { body: { ids: [bulk1, bulk2, 999999] } });
    check('bulk delete removes 2', r.status === 200 && r.data?.deleted === 2, JSON.stringify(r.data));

    console.log('\n[7/9] Import: preview → execute → idempotent re-run');
    const ws = XLSX.utils.aoa_to_sheet([
      ['S/N', 'NAME OF ORGANIZATION', 'NAME OF CEO', 'PHONE NUMBER', 'BANK', 'ACCOUNT NUMBER', 'EMAIL', 'LOCAL GOVERNMENT', 'STATE', 'PROJECT TYPE'],
      [1, 'AYMAN T MPCSL', 'SHEIKH MUHAMMAD TEQQIYYUAH', '08039189574', 'ZENITH BANK', '1312841464', 'aymantmpcsl@gmail.com', 'AKOKO NORTHEASTH LG', 'ONDO STATE', "ELECTRICITY'S"],
      [9100, 'INTEGRATION IMPORT ORG', 'CHINEDU OKAFOR', '08037776655', 'UBA', '1011223344', 'ii@sambet.test', 'OGBARU', 'Anambra', 'SOLAR STREET LIGHTS'],
      [9101, '', '', '08030000001', '', '', '', '', '', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const xlsxBytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));

    const form = () => {
      const fd = new FormData();
      fd.append('file', new File([xlsxBytes], 'integration-test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      fd.append('strategy', 'update');
      return fd;
    };
    r = await req('POST', '/api/imports/preview', { body: form() });
    check('import preview ok', r.status === 200 && !!r.data?.data?.uploadId, JSON.stringify(r.data).slice(0, 300));
    check('preview: 1 create', r.data?.data?.create === 1, `create=${r.data?.data?.create}`);
    check('preview: 1 update (sn match)', r.data?.data?.update === 1, `update=${r.data?.data?.update}`);
    check('preview: 1 error (no name)', r.data?.data?.errorTotal === 1);
    const uploadId = r.data?.data?.uploadId;

    r = await req('POST', '/api/imports/execute', { body: { uploadId, strategy: 'update' } });
    check('import execute ok (201)', r.status === 201, JSON.stringify(r.data).slice(0, 300));
    check('execute: 1 created / 1 updated', r.data?.data?.created === 1 && r.data?.data?.updated === 1, JSON.stringify(r.data?.data));
    r = await req('GET', '/api/organizations?search=INTEGRATION%20IMPORT%20ORG&pageSize=3');
    check('imported org is queryable', r.data?.data?.some((o) => o.sn === 9100));
    r = await req('POST', '/api/imports/execute', { body: { uploadId, strategy: 'update' } });
    check('second execute of same upload → 410', r.status === 410);

    // idempotency: preview + execute again → nothing created, 2 updates
    r = await req('POST', '/api/imports/preview', { body: form() });
    const uploadId2 = r.data?.data?.uploadId;
    check('re-preview: 0 create / 2 update', r.data?.data?.create === 0 && r.data?.data?.update === 2, `create=${r.data?.data?.create} update=${r.data?.data?.update}`);
    r = await req('POST', '/api/imports/execute', { body: { uploadId: uploadId2, strategy: 'skip' } });
    check('re-execute with skip: 0 created / 0 updated / 2 skipped', r.data?.data?.created === 0 && r.data?.data?.updated === 0 && r.data?.data?.skipped === 2, JSON.stringify(r.data?.data));
    r = await req('GET', '/api/organizations?pageSize=1');
    check('total still 1669 + 1 new = 1670', r.data?.meta?.total === 1670, `got ${r.data?.meta?.total}`);

    // bad file types
    r = await req('POST', '/api/imports/preview', {
      body: (() => { const fd = new FormData(); fd.append('file', new File([new Uint8Array([1, 2, 3])], 'evil.exe')); return fd; })(),
    });
    check('unsupported file type → 400', r.status === 400);

    console.log('\n[8/9] Export + template + audit');
    const csv = await reqBin('/api/organizations/export?format=csv&search=AYMAN%20T%20MPCSL');
    check('csv export 200', csv.status === 200);
    const csvText = new TextDecoder().decode(csv.buf);
    check('csv export contains row', csvText.includes('AYMAN T MPCSL') && csvText.includes('S/N'));
    const xlsxRes = await reqBin('/api/organizations/export?format=xlsx&state=Ondo');
    check('xlsx export 200', xlsxRes.status === 200);
    const xlsxOut = XLSX.read(xlsxRes.buf, { type: 'array' });
    const sheetOut = xlsxOut.Sheets[xlsxOut.SheetNames[0]];
    const outRows = XLSX.utils.sheet_to_json(sheetOut, { defval: '' });
    check('xlsx export has rows (Ondo state)', outRows.length > 20, `rows=${outRows.length}`);
    check('xlsx export has standardized columns', outRows[0] && 'State (standardized)' in outRows[0]);

    const tpl = await reqBin('/api/organizations/template');
    check('template xlsx 200', tpl.status === 200);
    check('template starts with PK', tpl.buf[0] === 80 && tpl.buf[1] === 75);

    r = await req('GET', '/api/stats/audit?pageSize=50');
    const actions = (r.data?.data ?? []).map((a) => a.action);
    check('audit has account.setup', actions.includes('account.setup'));
    check('audit has import.completed', actions.includes('import.completed'));
    check('audit has org.create + org.delete', actions.includes('org.create') && actions.includes('org.delete'));
    check('audit has org.update', actions.includes('org.update'));
    r = await req('GET', '/api/stats/audit?action=import.completed');
    check('audit filter by action', r.data?.data?.every((a) => a.action === 'import.completed'));

    // imports history
    r = await req('GET', '/api/imports?pageSize=5');
    check('import history has 3 completed', r.data?.data?.filter((i) => i.status === 'completed').length === 3, JSON.stringify(r.data?.data?.map((i) => i.status)));

    console.log('\n[9/9] Login/logout + rate limiting (run last — burns the 5/min budget)');
    // current cookie is from setup; log out and log back in
    r = await req('POST', '/api/auth/login', { body: { email: ADMIN.email, password: 'WrongPass1' } });
    check('wrong password → 401', r.status === 401);
    r = await req('POST', '/api/auth/logout');
    check('logout ok', r.status === 200);
    r = await req('GET', '/api/auth/me');
    check('me after logout → 401', r.status === 401);
    r = await req('POST', '/api/auth/login', { body: { email: 'nobody@sambet.test', password: 'WrongPass1' } });
    check('unknown user → 401 (same shape)', r.status === 401);
    r = await req('POST', '/api/auth/login', { body: { email: ADMIN.email, password: ADMIN.password } });
    check('login ok (200)', r.status === 200);
    // Login budget is 5/min. Used so far in this section: wrong(1) unknown(2)
    // good(3). Two more wrong → (5), next → 429.
    await req('POST', '/api/auth/login', { body: { email: ADMIN.email, password: 'WrongPass2' } });
    await req('POST', '/api/auth/login', { body: { email: ADMIN.email, password: 'WrongPass3' } });
    const rl = await req('POST', '/api/auth/login', { body: { email: ADMIN.email, password: 'WrongPass4' } });
    check('6th attempt in a minute → 429', rl.status === 429, `got ${rl.status}`);
  } finally {
    try {
      if (worker.pid) process.kill(-worker.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
    try {
      execSync('pkill -x workerd 2>/dev/null || true', { stdio: 'ignore' });
    } catch {
      /* best effort */
    }
  }

  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('Failures:');
    for (const f of failures) console.log('  -', f);
    process.exit(1);
  }
  console.log('\nALL INTEGRATION CHECKS PASSED ✅');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
