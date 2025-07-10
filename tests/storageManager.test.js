/** @jest-environment jsdom */

const lists = require('../src/listManager');
const state = require('../src/stateManager');
const storage = require('../src/storageManager');

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

  test('reset loads DEFAULT_DATA', () => {
    global.DEFAULT_DATA = {
      lists: { presets: [{ id: 'b', title: 'b', type: 'base', items: ['d'] }] },
      state: { 'base-input': 'd', 'base-select': 'b' }
    };
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input"></textarea>
    `;
    storage.reset();
    const txt = document.getElementById('base-input').value;
    expect(txt).toBe('d');
    const stored = JSON.parse(localStorage.getItem('promptEnhancerData'));
    expect(stored.state['base-input']).toBe('d');
  });
});
