/** @jest-environment jsdom */

const lists = require('../src/listManager');
const state = require('../src/stateManager');
const storage = require('../src/storageManager');
const ui = require('../src/uiControls');

function setupDOM() {
  document.body.innerHTML = `
    <select id="base-select"></select>
    <textarea id="base-input"></textarea>
    <select id="pos-depth-select"></select>
    <textarea id="pos-depth-input"></textarea>
  `;
}

describe('Storage manager', () => {
  beforeEach(() => {
    setupDOM();
    lists.importLists({ presets: [{ id: 'b', title: 'b', type: 'base', items: ['x'] }] });
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

  test('depth input preserved through exportData/importData', () => {
    document.getElementById('pos-depth-input').value = '4';
    const json = storage.exportData();
    document.getElementById('pos-depth-input').value = '';
    storage.importData(json);
    expect(document.getElementById('pos-depth-input').value).toBe('4');
  });

  test('importData keeps builtin depth options', () => {
    lists.importLists({
      presets: [
        { id: 'ord', title: 'ord', type: 'order', items: ['0'] },
        { id: 'b', title: 'b', type: 'base', items: ['x'] }
      ]
    });
    const json = storage.exportData();
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
      <select id="pos-depth-select"></select>
      <textarea id="pos-depth-input"></textarea>
    `;
    lists.importLists({ presets: [] });
    storage.importData(json);
    const opts = Array.from(
      document.querySelectorAll('#pos-depth-select option')
    ).map(o => o.value);
    expect(opts).toEqual(
      expect.arrayContaining(['prepend', 'append', 'random', 'ord'])
    );
  });

  test('loadPersisted prefers localStorage data', () => {
    const saved = {
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: ['y'] }] },
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
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: ['z'] }] },
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
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: ['d'] }] },
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
            <div class="input-row"><textarea id="pos-order-input"></textarea></div>
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
            <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
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
