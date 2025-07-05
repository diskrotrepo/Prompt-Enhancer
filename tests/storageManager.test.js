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
});
