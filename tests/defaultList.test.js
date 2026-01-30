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

describe('Default mix layout', () => {
  test('applyMixState(null) seeds one empty mix', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState(null, root);
    const mixes = root.querySelectorAll('.mix-wrapper');
    expect(mixes.length).toBe(1);
    const chunks = mixes[0].querySelectorAll('.chunk-box');
    expect(chunks.length).toBe(0);
  });
});
