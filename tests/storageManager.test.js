/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

const main = require('../src/script');

function loadBody() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  document.documentElement.innerHTML = html;
}

describe('Mix state serialization', () => {
  test('exportMixState returns mixes array', () => {
    loadBody();
    main.applyMixState(null);
    const data = main.exportMixState();
    expect(Array.isArray(data.mixes)).toBe(true);
    expect(data.mixes.length).toBeGreaterThan(0);
  });
});
