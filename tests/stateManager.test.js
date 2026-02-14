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

describe('Mix state roundtrip', () => {
  test('exportMixState and applyMixState preserve structure', () => {
    loadBody();
    const inputState = {
      colorPresets: [
        { id: 'storm', name: 'Storm', color: '#445566' }
      ],
      mixes: [
        {
          type: 'mix',
          title: 'One',
          limit: 12,
          exact: true,
          singlePass: true,
          firstChunkBehavior: 'size',
          color: '2',
          colorMode: 'preset',
          colorPreset: 'storm',
          colorValue: '#445566',
          preserve: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            { type: 'chunk', text: 'a ', limit: 12, exact: true, singlePass: true, firstChunkBehavior: 'size', colorMode: 'custom', colorValue: '#112233', randomize: false, delimiter: { mode: 'whitespace', size: 1 } },
            { type: 'chunk', text: 'b ', limit: 12, exact: true, singlePass: true, firstChunkBehavior: 'size', randomize: false, delimiter: { mode: 'whitespace', size: 1 } }
          ]
        }
      ]
    };
    main.applyMixState(inputState);
    const exported = main.exportMixState();
    expect(exported.mixes.length).toBe(1);
    expect(exported.mixes[0].children.length).toBe(2);
    expect(exported.colorPresets.length).toBe(1);
    expect(exported.colorPresets[0].name).toBe('Storm');
    expect(exported.mixes[0].colorMode).toBe('preset');
    expect(exported.mixes[0].colorPreset).toBe('storm');
    expect(exported.mixes[0].children[0].colorMode).toBe('custom');
    expect(exported.mixes[0].singlePass).toBe(true);
    expect(exported.mixes[0].firstChunkBehavior).toBe('size');
    expect(exported.mixes[0].children[0].singlePass).toBe(true);
    expect(exported.mixes[0].children[0].firstChunkBehavior).toBe('size');
    const root = document.querySelector('.mix-root');
    main.applyMixState(exported, root);
    expect(root.querySelectorAll('.chunk-box').length).toBe(2);
  });

  test('dropout length mode roundtrips through export and re-apply', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'mix',
          title: 'Dropout',
          limit: 9,
          lengthMode: 'dropout',
          preserve: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            { type: 'chunk', text: 'a b c ', limit: 1000, exact: true, singlePass: true, delimiter: { mode: 'whitespace', size: 1 } },
            { type: 'chunk', text: 'x y ', limit: 1000, exact: true, singlePass: true, delimiter: { mode: 'whitespace', size: 1 } }
          ]
        }
      ]
    }, root);
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].lengthMode).toBe('dropout');
    main.applyMixState(exported, root);
    expect(root.querySelector('.mix-box .length-mode')?.value).toBe('dropout');
  });

  test('string dropout length mode roundtrips through export and re-apply', () => {
    loadBody();
    const root = document.querySelector('.mix-root');
    main.applyMixState({
      mixes: [
        {
          type: 'chunk',
          title: 'Dropout String',
          text: 'a b c x y ',
          limit: 6,
          lengthMode: 'dropout',
          exact: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 }
        }
      ]
    }, root);
    const exported = main.exportMixState(root);
    expect(exported.mixes[0].type).toBe('chunk');
    expect(exported.mixes[0].lengthMode).toBe('dropout');
    main.applyMixState(exported, root);
    expect(root.querySelector('.chunk-box .length-mode')?.value).toBe('dropout');
  });
});
