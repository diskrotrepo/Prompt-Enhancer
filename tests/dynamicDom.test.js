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
});
