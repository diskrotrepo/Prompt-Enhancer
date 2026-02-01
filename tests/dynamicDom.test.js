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

describe('Dynamic mix DOM', () => {
  test('applyMixState builds default mix boxes', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState(null, root);
    const mixes = root.querySelectorAll('.mix-wrapper');
    expect(mixes.length).toBe(1);
  });

  test('applyMixState supports nested mixes', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Parent',
          children: [
            { type: 'chunk', text: 'a ' },
            {
              type: 'mix',
              title: 'Child',
              children: [ { type: 'chunk', text: 'b ' } ]
            }
          ]
        }
      ]
    });
    expect(root.querySelectorAll('.mix-box').length).toBe(2);
  });

  test('preserve chunks disables random-first toggle', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState(null, root);
    const toggle = root.querySelector('.mix-box .random-first-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.disabled).toBe(true);
    expect(toggle.classList.contains('active')).toBe(false);
  });

  test('new boxes default to exactly-once length mode', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({ mixes: [{ type: 'mix', title: 'Default', children: [{ type: 'chunk', text: 'a ' }] }] }, root);
    const mixMode = root.querySelector('.mix-box .length-mode');
    const chunkMode = root.querySelector('.chunk-box .length-mode');
    expect(mixMode?.value).toBe('exact-once');
    expect(chunkMode?.value).toBe('exact-once');
  });
});
