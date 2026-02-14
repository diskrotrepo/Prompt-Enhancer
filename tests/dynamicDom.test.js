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

  test('preserve chunks disables first-chunk select', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState(null, root);
    const select = root.querySelector('.mix-box .first-chunk-select');
    expect(select).not.toBeNull();
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('size');
  });

  test('new boxes default to fit-smallest for mixes and exactly-once for chunks', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({ mixes: [{ type: 'mix', title: 'Default', children: [{ type: 'chunk', text: 'a ' }] }] }, root);
    const mixMode = root.querySelector('.mix-box .length-mode');
    const chunkMode = root.querySelector('.chunk-box .length-mode');
    expect(mixMode?.value).toBe('fit-smallest');
    expect(chunkMode?.value).toBe('exact-once');
  });

  test('blank chunk input enters empty chunk mode and locks delimiter controls', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({ mixes: [{ type: 'chunk', text: '' }] }, root);
    const chunkBox = root.querySelector('.chunk-box');
    const delimiter = chunkBox?.querySelector('.delimiter-select');
    const size = chunkBox?.querySelector('.delimiter-size');
    const firstChunk = chunkBox?.querySelector('.first-chunk-select');
    expect(delimiter?.value).toBe('empty-chunk');
    expect(delimiter?.disabled).toBe(true);
    expect(size?.disabled).toBe(true);
    expect(firstChunk?.disabled).toBe(true);
  });

  test('non-empty chunk input keeps delimiter controls active', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({ mixes: [{ type: 'chunk', text: 'a b ' }] }, root);
    const chunkBox = root.querySelector('.chunk-box');
    const delimiter = chunkBox?.querySelector('.delimiter-select');
    expect(delimiter?.disabled).toBe(false);
    expect(delimiter?.value).toBe('whitespace');
  });
});
