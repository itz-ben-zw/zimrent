/* E2E test for the Homify verification workflow.
   Run: node _e2e_test.js   (server must be running on :3001)
   Creates test users/listing, exercises the full lifecycle, then cleans up.
   SAFETY: refuses to run against the production database. Set E2E_ALLOW_PROD=1
   only if you truly mean to test production (not recommended). */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';

// Guard: never run E2E tests against production unless explicitly allowed.
if ((process.env.NODE_ENV === 'production' || /onrender\.com/i.test(BASE)) && process.env.E2E_ALLOW_PROD !== '1') {
  console.error('E2E REFUSED: target looks like production (' + BASE + ').');
  console.error('Run against a local/dev server or a separate test database instead,');
  console.error('or set E2E_ALLOW_PROD=1 to override.');
  process.exit(2);
}
let passed = 0, failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + ' ' + extra); }
}

async function req(method, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  const res = await fetch(BASE + path, {
    method, headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { res, data };
}

async function main() {
  const stamp = Date.now();
  const llEmail = `e2e-landlord-${stamp}@test.io`;
  const stEmail = `e2e-student-${stamp}@test.io`;

  // 1. accounts
  let r = await req('POST', '/api/auth/register', { body: {
    fullName: 'E2E Test Landlord', email: llEmail, password: 'Test1234!', role: 'landlord' } });
  check('register landlord', r.res.status === 201 || r.res.status === 200, JSON.stringify(r.data));
  const llToken = r.data && r.data.token;
  const llId = r.data && r.data.user && r.data.user.id;

  r = await req('POST', '/api/auth/register', { body: {
    fullName: 'E2E Test Student', email: stEmail, password: 'Test1234!', role: 'tenant' } });
  check('register student', r.res.status === 201 || r.res.status === 200, JSON.stringify(r.data));
  const stToken = r.data && r.data.token;

  r = await req('POST', '/api/auth/login', { body: {
    email: process.env.ADMIN_EMAIL || 'admin@homify.co.zw',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345' } });
  check('admin login', !!(r.data && r.data.token), JSON.stringify(r.data));
  const admToken = r.data && r.data.token;
  if (!llToken || !stToken || !admToken) throw new Error('aborting: missing tokens');

  // 2. create listing -> pending
  r = await req('POST', '/api/properties', { token: llToken, body: {
    title: 'E2E TEST listing - verification lifecycle', city: 'Bulawayo',
    suburb: 'Selbourne Park', type: 'Room', bedrooms: 1, price: 55, currency: 'USD' } });
  check('create listing returns 201', r.res.status === 201, JSON.stringify(r.data));
  const pid = r.data && r.data.property && r.data.property.id;
  check('new listing is pending', r.data && r.data.property && r.data.property.status === 'pending');
  check('create message mentions verification',
        r.data && /verification/i.test(r.data.message || ''));
  if (!pid) throw new Error('aborting: no property id');

  // 3. visibility while pending
  r = await req('GET', `/api/properties/${pid}`);
  check('anonymous cannot see pending listing (404)', r.res.status === 404);
  r = await req('GET', `/api/properties/${pid}`, { token: llToken });
  check('owner can see pending listing', r.res.status === 200 && r.data.property.status === 'pending');
  r = await req('GET', `/api/properties?landlordId=${llId}`, { token: llToken });
  check('owner list includes pending listing',
        r.res.status === 200 && r.data.properties.some(p => p.id === pid && p.status === 'pending'));
  r = await req('GET', `/api/properties?landlordId=${llId}`);

  const anonList = (r.data && r.data.properties) || [];
  check('public list excludes pending listing', !anonList.some(p => p.id === pid));

  // 4. admin queue + approve
  r = await req('GET', '/api/admin/properties?status=pending', { token: admToken });
  check('admin pending queue contains listing',
        r.res.status === 200 && r.data.properties.some(p => p.id === pid),
        JSON.stringify(r.data).slice(0, 200));
  r = await req('PUT', `/api/admin/properties/${pid}/verify`,
                { token: admToken, body: { decision: 'approve' } });
  check('admin approve', r.res.status === 200);
  r = await req('GET', `/api/properties/${pid}`);
  check('approved listing public with status approved',
        r.res.status === 200 && r.data.property.status === 'approved');
  r = await req('GET', '/api/properties');
  check('public list now includes listing',
        ((r.data && r.data.properties) || []).some(p => p.id === pid));

  // 5. reject then landlord edit re-queues
  r = await req('PUT', `/api/admin/properties/${pid}/verify`,
                { token: admToken, body: { decision: 'reject', notes: 'E2E reject reason' } });
  check('admin reject', r.res.status === 200);
  r = await req('GET', `/api/properties/${pid}`, { token: llToken });
  check('rejected listing shows reason to owner',
        r.res.status === 200 && r.data.property.status === 'rejected'
        && r.data.property.rejectReason === 'E2E reject reason',
        JSON.stringify(r.data && r.data.property && { s: r.data.property.status, rr: r.data.property.rejectReason }));
  r = await req('PUT', `/api/properties/${pid}`,
                { token: llToken, body: { title: 'E2E TEST listing - verification lifecycle' } });
  check('owner edit re-submits rejected listing', r.res.status === 200);
  r = await req('GET', `/api/properties/${pid}`, { token: llToken });
  check('listing back to pending after edit',
        r.res.status === 200 && r.data.property.status === 'pending'
        && !r.data.property.rejectReason);
  r = await req('PUT', `/api/admin/properties/${pid}/verify`,
                { token: admToken, body: { decision: 'approve' } });
  check('admin re-approve', r.res.status === 200);

  // 6. report flow
  r = await req('POST', `/api/properties/${pid}/report`,
                { token: llToken, body: { reason: 'own' } });
  check('cannot report own listing (400)', r.res.status === 400);
  r = await req('POST', `/api/properties/${pid}/report`, { body: { reason: 'x' } });
  check('report requires auth (401)', r.res.status === 401);
  r = await req('POST', `/api/properties/${pid}/report`, { token: stToken, body: {
    reason: 'E2E scam suspicion', evidence: 'test evidence' } });
  check('student reports listing (201)', r.res.status === 201, JSON.stringify(r.data));
  r = await req('GET', `/api/properties/${pid}`);
  check('reported listing hidden from public (404)', r.res.status === 404);
  r = await req('GET', '/api/admin/properties?status=flagged', { token: admToken });
  check('admin flagged queue contains listing',
        r.res.status === 200 && r.data.properties.some(p => p.id === pid));
  r = await req('GET', '/api/admin/reports?status=open', { token: admToken });
  const rep = r.res.status === 200 && r.data.reports.find(x => x.propertyId === pid);
  check('admin sees open report with reporter name',
        !!rep && rep.reporterName === 'E2E Test Student',
        JSON.stringify(r.data).slice(0, 300));

  // 7. restore + resolve
  r = await req('PUT', `/api/admin/properties/${pid}/verify`,
                { token: admToken, body: { decision: 'restore' } });
  check('admin restore flagged listing', r.res.status === 200);
  r = await req('GET', `/api/properties/${pid}`);
  check('restored listing public again', r.res.status === 200);
  if (rep) {
    r = await req('PUT', `/api/admin/reports/${rep.id}/resolve`, { token: admToken });
    check('resolve report', r.res.status === 200);
    r = await req('GET', '/api/admin/reports?status=open', { token: admToken });
    check('resolved report leaves open queue',
          r.res.status === 200 && !r.data.reports.some(x => x.id === rep.id));
  }

  // 8. RBAC + stats + pages
  r = await req('GET', '/api/admin/stats', { token: stToken });
  check('student blocked from admin stats (403)', r.res.status === 403);
  r = await req('GET', '/api/admin/stats', { token: llToken });
  check('landlord blocked from admin stats (403)', r.res.status === 403);
  r = await req('GET', '/api/admin/stats', { token: admToken });
  check('admin stats include new counters',
        r.res.status === 200 && typeof r.data.stats.pendingVerifications === 'number'
        && typeof r.data.stats.openReports === 'number', JSON.stringify(r.data));

  for (const [name, path, needle] of [
    ['admin page', '/admin.html', 'Admin Console'],
    ['home page updated FAQ', '/', 'reviewed by the Homify team'],
    ['admin console script', '/js/admin.js', 'loadPending'],
    ['property page report form', '/property.html', 'report-submit']
  ]) {
    const res = await fetch(BASE + path);
    const html = await res.text();
    check(name + ' serves 200 + expected content',
          res.status === 200 && html.includes(needle), 'status=' + res.status);
  }

  // 9. cleanup: delete property + test users (reports cascade with property)
  r = await req('DELETE', `/api/properties/${pid}`, { token: admToken });
  check('cleanup: delete test property', r.res.status === 200);
  r = await req('GET', '/api/admin/users', { token: admToken });
  const victims = r.data.users.filter(u => /e2e-(landlord|student)-/.test(u.email));
  let removed = 0;
  for (const v of victims) {
    const d = await req('DELETE', `/api/admin/users/${v.id}`, { token: admToken });
    if (d.res.status === 200) removed++;
    else console.log('  FAIL  cleanup user ' + v.email + ' status=' + d.res.status);
  }
  check('cleanup: test users removed', removed >= 2, 'removed=' + removed);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('E2E fatal:', e); process.exit(1); });

