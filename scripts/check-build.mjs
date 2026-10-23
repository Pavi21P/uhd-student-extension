import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3, 'Expected a Manifest V3 build');
assert.ok(!manifest.permissions?.length && !manifest.host_permissions?.length, 'Foundation must not request site or data access');
assert.ok(!manifest.content_scripts?.length, 'Foundation must not inject into pages');
const entrypoints = [manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons)];
for (const relative of entrypoints) await checkFile(relative);
for (const entry of [manifest.action.default_popup, manifest.options_page]) {
  const html = await readFile(path.join(dist, entry), 'utf8');
  assert.ok(!html.includes('/src/'), 'An entrypoint still references unbuilt source');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    assert.ok(!/^(?:https?:)?\/\//.test(target), 'Extension entrypoints must use bundled assets');
    await checkFile(target.replace(/^\.\//, ''));
  }
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(html), 'Inline scripts violate extension CSP');
}
console.log('Build verified: MV3 entries, bundled assets, and no page-access permissions.');

async function checkFile(relative) {
  assert.equal(typeof relative, 'string');
  const absolute = path.resolve(dist, relative);
  assert.ok(absolute.startsWith(dist + path.sep), 'Artifact path escapes dist');
  assert.ok((await stat(absolute)).isFile(), 'Missing artifact: ' + relative);
}
