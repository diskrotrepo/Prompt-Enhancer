/** @jest-environment jsdom */
const state = require('../src/state');
const ui = require('../src/uiControls');
const utils = require('../src/promptUtils');


describe('State persistence', () => {
  test('save and load restore same output with fixed random', () => {
    document.body.innerHTML = `
      <textarea id="base-input"></textarea>
      <textarea id="pos-input"></textarea>
      <textarea id="neg-input"></textarea>
      <textarea id="divider-input"></textarea>
      <textarea id="lyrics-input"></textarea>
      <select id="base-select"></select>
      <select id="pos-select"></select>
      <select id="neg-select"></select>
      <select id="divider-select"></select>
      <select id="length-select"></select>
      <input id="length-input">
      <input type="checkbox" id="base-shuffle">
      <input type="checkbox" id="pos-shuffle">
      <input type="checkbox" id="neg-shuffle">
      <input type="checkbox" id="divider-shuffle">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"></select>
      <input type="checkbox" id="neg-stack">
      <select id="neg-stack-size"></select>
      <input type="checkbox" id="neg-include-pos">
      <pre id="positive-output"></pre>
      <pre id="negative-output"></pre>
    `;
    document.getElementById('base-input').value = 'a,b';
    document.getElementById('pos-input').value = 'p1,p2';
    document.getElementById('neg-input').value = 'n1,n2';
    document.getElementById('length-input').value = '100';
    document.getElementById('base-shuffle').checked = true;
    document.getElementById('pos-shuffle').checked = true;
    document.getElementById('neg-shuffle').checked = true;
    const rand = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    ui.generate();
    const out1 = {
      pos: document.getElementById('positive-output').textContent,
      neg: document.getElementById('negative-output').textContent
    };
    const saved = state.exportState();
    document.body.innerHTML = `
      <textarea id="base-input"></textarea>
      <textarea id="pos-input"></textarea>
      <textarea id="neg-input"></textarea>
      <textarea id="divider-input"></textarea>
      <textarea id="lyrics-input"></textarea>
      <select id="base-select"></select>
      <select id="pos-select"></select>
      <select id="neg-select"></select>
      <select id="divider-select"></select>
      <select id="length-select"></select>
      <input id="length-input">
      <input type="checkbox" id="base-shuffle">
      <input type="checkbox" id="pos-shuffle">
      <input type="checkbox" id="neg-shuffle">
      <input type="checkbox" id="divider-shuffle">
      <input type="checkbox" id="pos-stack">
      <select id="pos-stack-size"></select>
      <input type="checkbox" id="neg-stack">
      <select id="neg-stack-size"></select>
      <input type="checkbox" id="neg-include-pos">
      <pre id="positive-output"></pre>
      <pre id="negative-output"></pre>
    `;
    state.importState(saved);
    ui.generate();
    const out2 = {
      pos: document.getElementById('positive-output').textContent,
      neg: document.getElementById('negative-output').textContent
    };
    rand.mockRestore();
    expect(out2).toEqual(out1);
  });
});
