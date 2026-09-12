const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('src/index.html');
const renderer = read('src/renderer.js');
const pixelPet = read('src/pixel-pet.js');
const main = read('src/main.js');
const preload = read('src/preload.js');
const packageJson = JSON.parse(read('package.json'));

for (const match of renderer.matchAll(/querySelector\('#([^']+)'\)/g)) {
  assert.match(html, new RegExp(`id=["']${match[1]}["']`), `Missing DOM element #${match[1]}`);
}

assert.equal(packageJson.version, '2.0.0');
assert.match(html, /id="pixel-pet"/);
assert.match(html, /id="base-color"/);
assert.match(html, /id="pet-pattern"/);
assert.match(pixelPet, /class PixelPet/);
for (const pattern of ['mask','tuxedo','socks','spots','calico','tabby','solid']) {
  assert.match(pixelPet + html + main, new RegExp(pattern), `Missing pattern ${pattern}`);
}
assert.match(renderer, /typingSide/);
assert.match(preload, /onReminder/);
assert.match(main, /Water reminders \(45 min\)/);
assert.match(main, /webContents\.send\('typing-pulse', \{ side: typingSide \}\)/);
assert.match(main, /Deliberately discard the key code/);
assert.doesNotMatch(main, /event\.keycode|event\.keyCode|event\.rawcode/);

console.log('Smoke checks passed.');
