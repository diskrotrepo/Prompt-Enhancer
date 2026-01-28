/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== "undefined") window.__TEST__ = true;
const main = require("../src/script");
const lists = main;
const state = main;
const storage = main;
const ui = main;
function setupDOM() {
  document.body.innerHTML = `
    <select id="base-select"></select>
    <textarea id="base-input"></textarea>
    <select id="pos-depth-select"></select>
  `;
}

describe('Storage manager', () => {
  beforeEach(() => {
    setupDOM();
    lists.importLists({ presets: [{ id: 'b', title: 'b', type: 'base', items: 'x' }] });
    state.loadFromDOM();
  });

  test('exportData and importData round trip', () => {
    const json = storage.exportData();
    lists.importLists({ presets: [] });
    document.getElementById('base-input').value = 'y';
    storage.importData(json);
    const after = storage.exportData();
    expect(after).toBe(json);
  });

  test('importData keeps builtin depth options', () => {
    lists.importLists({
      presets: [
        { id: 'b', title: 'b', type: 'base', items: 'x' }
      ]
    });
    const json = storage.exportData();
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
      <select id="pos-depth-select"></select>
    `;
    lists.importLists({ presets: [] });
    storage.importData(json);
    const opts = Array.from(
      document.querySelectorAll('#pos-depth-select option')
    ).map(o => o.value);
    expect(opts).toEqual(
      expect.arrayContaining(['prepend', 'append', 'random'])
    );
  });

  test('importData merges lists by default', () => {
    const json = {
      lists: {
        presets: [
          { id: 'b', title: 'b', type: 'base', items: 'z' },
          { id: 'c', title: 'c', type: 'base', items: 'y' }
        ]
      },
      state: {}
    };
    storage.importData(json);
    const data = JSON.parse(lists.exportLists());
    const original = data.presets.find(
      p => p.title === 'b' && p.type === 'base'
    );
    const renamed = data.presets.find(
      p => p.title === 'b (1)' && p.type === 'base'
    );
    expect(original.items).toBe('x');
    expect(renamed.items).toBe('z');
    expect(
      data.presets.some(p => p.title === 'c' && p.type === 'base')
    ).toBe(true);
  });

  test('loadPersisted prefers localStorage data', () => {
    const saved = {
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: 'y' }] },
      state: { 'base-input': 'y', 'base-select': 'b' }
    };
    localStorage.setItem('promptEnhancerData', JSON.stringify(saved));
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
    `;
    storage.loadPersisted();
    const txt = document.getElementById('base-input').value;
    expect(txt).toBe('y');
  });

  test('loadPersisted falls back to DEFAULT_DATA', () => {
    localStorage.removeItem('promptEnhancerData');
    global.DEFAULT_DATA = {
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: 'z' }] },
      state: { 'base-input': 'z', 'base-select': 'b' }
    };
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
    `;
    storage.loadPersisted();
    const txt = document.getElementById('base-input').value;
    expect(txt).toBe('z');
  });

  test('resetData clears storage and loads defaults', () => {
    localStorage.setItem('promptEnhancerData', JSON.stringify({ state: { 'base-input': 'x' } }));
    global.DEFAULT_DATA = {
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: 'd' }] },
      state: { 'base-input': 'd', 'base-select': 'b' }
    };
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
    `;
    lists.importLists({ presets: [] });
    storage.resetData();
    const txt = document.getElementById('base-input').value;
    expect(txt).toBe('d');
    expect(localStorage.getItem('promptEnhancerData')).not.toBeNull();
  });

  test('importData populates stacked inputs', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"><option value="2">2</option></select>
      <input type="checkbox" id="pos-shuffle">
      <div id="pos-stack-container">
        <div class="stack-block" id="pos-stack-1">
          <select id="pos-select"></select>
          <div class="input-row"><textarea id="pos-input"></textarea></div>
          <div id="pos-order-container">
            <select id="pos-order-select"><option value="canonical">c</option><option value="random">r</option></select>
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
          </div>
        </div>
      </div>
    `;
    ui.setupStackControls();
    state.loadFromDOM();
    const saved = {
      lists: { presets: [] },
      state: { 'pos-stack': true, 'pos-stack-size': '2', 'pos-input-2': 'extra' }
    };
    storage.importData(saved);
    expect(document.getElementById('pos-input-2').value).toBe('extra');
  });
});
