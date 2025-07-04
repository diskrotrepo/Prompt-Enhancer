/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

const lists = require('../src/listManager');
const ui = require('../src/uiControls');
const state = require('../src/stateManager');

function setupDOM() {
  document.body.innerHTML = `
    <select id="base-select"></select>
    <textarea id="base-input"></textarea>
    <input type="checkbox" id="base-shuffle">
    <select id="pos-select"></select>
    <textarea id="pos-input"></textarea>
    <input type="checkbox" id="pos-shuffle">
    <input type="checkbox" id="pos-stack">
    <select id="pos-stack-size"><option value="2">2</option></select>
    <select id="neg-select"></select>
    <textarea id="neg-input"></textarea>
    <input type="checkbox" id="neg-shuffle">
    <input type="checkbox" id="neg-stack">
    <select id="neg-stack-size"><option value="2">2</option></select>
    <input type="checkbox" id="neg-include-pos">
    <select id="divider-select"></select>
    <textarea id="divider-input"></textarea>
    <input type="checkbox" id="divider-shuffle">
    <select id="length-select"></select>
    <input id="length-input">
    <select id="lyrics-select"></select>
    <textarea id="lyrics-input"></textarea>
    <select id="lyrics-space"><option value="1">1</option><option value="2">2</option></select>
    <input type="checkbox" id="lyrics-remove-parens">
    <input type="checkbox" id="lyrics-remove-brackets">
    <pre id="positive-output"></pre>
    <pre id="negative-output"></pre>
    <pre id="lyrics-output"></pre>
    <button id="generate"></button>
  `;
}

function sampleLists() {
  return {
    presets: [
      { id: 'neg', title: 'neg', type: 'negative', items: ['bad'] },
      { id: 'pos', title: 'pos', type: 'positive', items: ['good'] },
      { id: 'len', title: 'len', type: 'length', items: ['20'] },
      { id: 'div', title: 'div', type: 'divider', items: ['\nfoo '] },
      { id: 'base', title: 'base', type: 'base', items: ['cat'] },
      { id: 'ly', title: 'ly', type: 'lyrics', items: ['la'] }
    ]
  };
}

describe('State manager integration', () => {
  beforeEach(() => {
    setupDOM();
    lists.importLists(sampleLists());
    ui.initializeUI();
    global.alert = jest.fn();
  });

  test('export and import round trip preserves generation', () => {
    ui.generate();
    const firstPos = document.getElementById('positive-output').textContent;
    const firstNeg = document.getElementById('negative-output').textContent;

    state.loadFromDOM();
    const json = state.exportState();

    document.getElementById('base-input').value = 'dog';
    ui.generate();
    expect(document.getElementById('positive-output').textContent).not.toBe(firstPos);

    state.importState(JSON.parse(json));
    ui.generate();
    expect(document.getElementById('positive-output').textContent).toBe(firstPos);
    expect(document.getElementById('negative-output').textContent).toBe(firstNeg);

    const again = state.exportState();
    expect(again).toBe(json);
  });
});
