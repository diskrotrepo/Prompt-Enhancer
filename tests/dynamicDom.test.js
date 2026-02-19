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

  test('new chunk boxes default first-chunk behavior to fixed size', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({ mixes: [{ type: 'chunk', text: 'a b c d ' }] }, root);
    const firstChunk = root.querySelector('.chunk-box .first-chunk-select');
    expect(firstChunk?.value).toBe('size');
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

  test('canonical mix output stays deterministic across repeated generate clicks', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Stable Canonical',
          limit: 40,
          lengthMode: 'allow',
          preserve: true,
          orderMode: 'canonical',
          children: [
            { type: 'chunk', text: 'a b c d e f g h ', lengthMode: 'allow', orderMode: 'canonical' },
            { type: 'chunk', text: '1 2 3 4 5 6 7 8 ', lengthMode: 'allow', orderMode: 'canonical' }
          ]
        }
      ]
    }, root);
    main.generate(root);
    const first = root.querySelector('.mix-box .mix-output-text')?.textContent || '';
    main.generate(root);
    const second = root.querySelector('.mix-box .mix-output-text')?.textContent || '';
    expect(second).toBe(first);
  });

  test('loaded ids are reserved so generated child ids stay unique and do not leak cached output', () => {
    loadBody();
    const root = document.querySelector('.mix-root');

    // Seed the global counter first, then load state that mixes explicit ids with a generated child id.
    main.applyMixState(null, root);
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          id: 'mix-1',
          title: 'space insertions',
          preserve: true,
          orderMode: 'canonical',
          lengthMode: 'fit-largest',
          children: [
            {
              type: 'chunk',
              id: 'chunk-2',
              text: 'LYRIC_A ',
              lengthMode: 'exact-once',
              orderMode: 'canonical',
              firstChunkBehavior: 'size',
              delimiter: { mode: 'whitespace', custom: '', size: 1 }
            },
            {
              type: 'chunk',
              text: '\n',
              lengthMode: 'exact-once',
              orderMode: 'canonical',
              firstChunkBehavior: 'size',
              delimiter: { mode: 'newline', custom: '', size: 1 }
            }
          ]
        }
      ]
    }, root);

    main.generate(root);

    const ids = Array.from(root.querySelectorAll('.chunk-box')).map(box => box.dataset.boxId);
    expect(new Set(ids).size).toBe(ids.length);

    const output = root.querySelector('.mix-box .mix-output-text')?.textContent || '';
    expect(output.includes('\n')).toBe(true);
    expect((output.match(/LYRIC_A/g) || []).length).toBe(1);
  });
});
