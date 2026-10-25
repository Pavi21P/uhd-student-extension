// Run with Node and an installed Playwright module. See docs/evidence/11a-professor-badges.md.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const channel = process.argv[2] || 'chrome';
assert(['chrome', 'msedge'].includes(channel));
const out = '.local/qa'; await mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const report = { channel, version: browser.version(), checks: [], errors: [], profileRequests: [] };
page.on('pageerror', error => report.errors.push(error.message));
context.on('request', request => { if(request.url().includes('ratemyprofessors.com')) report.profileRequests.push(request.url()); });
await context.route('https://www.ratemyprofessors.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Synthetic navigation target</title><p>Intercepted test only</p>' }));
const row = index => page.locator('[data-fixture-row="' + index + '"]');
const summary = index => row(index).locator('summary');
const selected = () => page.locator('input:checked').evaluateAll(nodes => nodes.map(node => node.value));
const check = text => { report.checks.push(text); console.log(channel + ': ' + text); };
try {
  await page.goto(server.resolvedUrls.local[0] + 'tests/fixtures/professor-badges.html');
  await summary(10).waitFor();
  await page.evaluate(() => { window.fixtureControls = [...document.querySelectorAll('input, #fixture-submit')]; window.fixtureControlHTML = window.fixtureControls.map(node => node.outerHTML); });
  assert.equal(await page.locator('.uhdx-professor').count(), 11);
  assert.equal(await page.locator('.uhdx-professor input, .uhdx-professor button, .uhdx-professor form').count(), 0);
  assert.match(await summary(0).getAttribute('aria-label'), /Alex Sample: Sample 4.2 \/ 5/);
  assert.equal(await row(10).locator('.instructor b').count(), 0);
  await page.getByLabel('Select 2', { exact: true }).check();
  const before = await selected();
  await page.getByLabel('Select 1', { exact: true }).focus(); await page.keyboard.press('Tab');
  assert.equal(await summary(0).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter'); assert.equal(await row(0).locator('details').getAttribute('open'), '');
  await page.keyboard.press('Escape'); assert.equal(await row(0).locator('details').getAttribute('open'), null);
  assert.equal(await summary(0).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Space'); assert.equal(await row(0).locator('details').getAttribute('open'), '');
  await row(0).getByText('Review count', { exact: true }).click();
  await summary(1).click(); await summary(1).click();
  assert.deepEqual(await selected(), before);
  assert.equal(await page.locator('#fixture-outcome').innerText(), 'No sample submission');
  assert.deepEqual(report.profileRequests, []);
  check('native Tab/Enter/Space/Escape disclosure and detail clicks preserve selected boxes and never submit or request ratings');
  await summary(0).focus(); await page.keyboard.press('Tab');
  const link = row(0).getByRole('link'); assert.equal(await link.evaluate(node => node === document.activeElement), true);
  assert.equal(await link.getAttribute('href'), 'https://www.ratemyprofessors.com/professor/12345');
  const next = context.waitForEvent('page'); await page.keyboard.press('Enter'); const target = await next;
  await target.waitForURL('https://www.ratemyprofessors.com/professor/12345'); await target.waitForLoadState('domcontentloaded');
  assert.equal(await target.evaluate(() => window.opener), null); await target.close();
  assert.deepEqual(await selected(), before); assert.equal(await page.locator('#fixture-outcome').innerText(), 'No sample submission');
  assert.equal(report.profileRequests.length, 1);
  check('keyboard source link opens canonical address in a separate noopener tab; target intercepted, no live source fetched');
  for(let index = 1; index < 11; index++) {
    await summary(index).click();
    assert.match(await row(index).locator('details').innerText(), /Sample data only/);
    if([1,5,6,7,8,9,10].includes(index)) assert.equal(await row(index).getByRole('link').count(), 0);
    if(index === 2) { assert.match(await summary(index).innerText(), /Not rated/); assert.equal(await row(index).locator('dd').first().innerText(), '0'); }
    if(index === 3) assert.match(await summary(index).innerText(), /Stale/);
    if(index === 6) assert.match(await summary(index).innerText(), /Identity unverified/);
    await summary(index).click();
  }
  assert.deepEqual(await selected(), before);
  check('all eleven fixtures preserve sample/identity/expiry/missing-value states and reject unsafe or ambiguous navigation');
  assert.equal(await page.evaluate(() => window.fixtureControls.every((node,index) => node.isConnected && node === document.querySelectorAll('input, #fixture-submit')[index] && node.outerHTML === window.fixtureControlHTML[index])), true);
  await row(0).locator('.instructor').click(); // Original delegated page behavior still works.
  assert.deepEqual(await selected(), ['sample-0','sample-1']);
  await page.getByLabel('Select 2', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Submit sample selection' }).click();
  assert.equal(await page.locator('#fixture-outcome').innerText(), 'Sample submissions: 1; selected: sample-0');
  check('original control nodes/attributes retained; row selection, checkbox labels and explicit submit still work exactly once');
  for(const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow at ' + width);
    const box = await summary(0).boundingBox(); assert(box.height >= 32);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: out + '/11a-' + channel + '-desktop.png' });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: out + '/11a-' + channel + '-narrow.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await summary(0).focus(); await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
  assert.equal(await row(0).locator('details').getAttribute('open'), '');
  // Browser zoom via keyboard is unreliable headless; double text size tests reflow explicitly.
  await page.addStyleTag({ content: 'body { font-size:32px } .uhdx-professor { font-size:28px }' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  check('five widths, 200% text enlargement and reduced motion preserve readable in-flow details without document overflow');
  assert.deepEqual(report.errors, []); report.ok = true;
} catch(error) { report.failure = error.stack; await page.screenshot({ path: out + '/11a-' + channel + '-failure.png', fullPage: true }).catch(() => {}); throw error; }
finally { await writeFile(out + '/11a-' + channel + '-report.json', JSON.stringify(report, null, 2)); await context.close(); await browser.close(); await server.close(); }