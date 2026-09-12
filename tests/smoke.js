const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('src/index.html');
const renderer = read('src/renderer.js');
const main = read('src/main.js');
const packageJson = JSON.parse(read('package.json'));

for (const match of renderer.matchAll(/querySelector\('#([^']+)'\)/g)) {
  assert.match(html, new RegExp(`id=["']${match[1]}["']`), `Missing DOM element #${match[1]}`);
}

for (const asset of ['assets/kitten-sprites.png', 'assets/puppy-sprites.png', 'assets/icon.ico', 'assets/tray.png']) {
  assert.ok(fs.statSync(path.join(root, asset)).size > 0, `Missing asset ${asset}`);
}

assert.deepEqual(packageJson.build.electronLanguages, ['en-US']);
assert.equal(packageJson.build.compression, 'maximum');
assert.match(main, /Deliberately discard the key code/);
assert.doesNotMatch(main, /event\.keycode|event\.keyCode|event\.rawcode/);
assert.match(renderer, /coat-(?:'\}|\$\{)/);

console.log('Smoke checks passed.');
