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
    <select id="neg-depth-select"></select>
    <textarea id="neg-depth-input"></textarea>
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

  test('exportData preserves depth inputs', () => {
    document.getElementById('pos-depth-input').value = '1,2';
    document.getElementById('neg-depth-input').value = '3,4';
    state.loadFromDOM();
    const json = storage.exportData();
    document.getElementById('pos-depth-input').value = '';
    document.getElementById('neg-depth-input').value = '';
    storage.importData(json);
    expect(document.getElementById('pos-depth-input').value).toBe('1,2');
    expect(document.getElementById('neg-depth-input').value).toBe('3,4');
  });
});
