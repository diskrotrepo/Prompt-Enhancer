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
          randomFirst: false,
          color: '2',
          colorMode: 'preset',
          colorPreset: 'storm',
          colorValue: '#445566',
          preserve: true,
          randomize: false,
          delimiter: { mode: 'whitespace', size: 1 },
          children: [
            { type: 'chunk', text: 'a ', limit: 12, exact: true, singlePass: true, randomFirst: false, colorMode: 'custom', colorValue: '#112233', randomize: false, delimiter: { mode: 'whitespace', size: 1 } },
            { type: 'chunk', text: 'b ', limit: 12, exact: true, singlePass: true, randomFirst: false, randomize: false, delimiter: { mode: 'whitespace', size: 1 } }
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
    expect(exported.mixes[0].randomFirst).toBe(false);
    expect(exported.mixes[0].children[0].singlePass).toBe(true);
    expect(exported.mixes[0].children[0].randomFirst).toBe(false);
    const root = document.querySelector('.mix-root');
    main.applyMixState(exported, root);
    expect(root.querySelectorAll('.chunk-box').length).toBe(2);
  });
});
