/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

// Define default lists before loading script
global.DEFAULT_LIST = {
  presets: [{ id: 'b', title: 'Base', type: 'base', items: 'x' }]
};

delete global.DEFAULT_DATA;

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const main = require('../src/script');

const ui = main;
const lists = main;
const storage = main;

function setupDOM() {
  document.body.innerHTML = `
    <select id="neg-select"></select>
    <textarea id="neg-input"></textarea>
    <select id="pos-select"></select>
    <textarea id="pos-input"></textarea>
    <select id="length-select"></select>
    <input id="length-input">
    <select id="divider-select"></select>
    <textarea id="divider-input"></textarea>
    <select id="base-select"></select>
    <textarea id="base-input"></textarea>
    <select id="lyrics-select"></select>
    <textarea id="lyrics-input"></textarea>
    <select id="lyrics-insert-select"></select>
    <textarea id="lyrics-insert-input"></textarea>
  `;
}

function loadDefaultListFile() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'default_list.js'), 'utf8');
  return vm.runInNewContext(code + '\nDEFAULT_LIST', {}, { filename: 'default_list.js' });
}

describe('Default list integration', () => {
  test('loadLists populates default presets', () => {
    setupDOM();
    expect(document.querySelectorAll('#base-select option').length).toBe(0);
    main.loadLists();
    main.applyCurrentPresets();
    const opts = Array.from(document.querySelectorAll('#base-select option')).map(o => o.value);
    expect(opts).toEqual(['b']);
    expect(document.getElementById('base-input').value).toBe('x');
  });

  test('resetData falls back to DEFAULT_LIST', () => {
    setupDOM();
    lists.importLists({ presets: [{ id: 'c', title: 'Custom', type: 'base', items: 'y' }] });
    main.applyCurrentPresets();
    expect(document.getElementById('base-input').value).toBe('y');
    storage.resetData();
    main.applyCurrentPresets();
    const opts = Array.from(document.querySelectorAll('#base-select option')).map(o => o.value);
    expect(opts).toEqual(['b']);
    expect(document.getElementById('base-input').value).toBe('x');
  });

  test('loadLists sorts presets alphabetically', () => {
    setupDOM();
    // Provide intentionally unsorted presets
    lists.importLists({
      presets: [
        { id: 'b', title: 'Beta', type: 'base', items: '' },
        { id: 'a', title: 'Alpha', type: 'base', items: '' }
      ]
    });
    main.loadLists();
    const titles = Array.from(
      document.querySelectorAll('#base-select option')
    ).map(o => o.textContent);
    expect(titles).toEqual(['Alpha', 'Beta']);
  });

  test('default lists store items as strings and avoid double-comma separators', () => {
    const list = loadDefaultListFile();
    expect(list && Array.isArray(list.presets)).toBe(true);
    list.presets.forEach(preset => {
      expect(typeof preset.items).toBe('string');
      if (preset.type === 'divider') {
        expect(preset.items).not.toMatch(/,\s*,/);
      }
    });
  });
});
