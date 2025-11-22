/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

const main = require('../src/script');
const ui = main;

describe('Dynamic DOM updates', () => {
  beforeEach(() => {
    ui.updateListSplitSettings(',', 1);
  });

  test('updateDepthContainers refreshes watchers without duplicating controls', () => {
    document.body.innerHTML = `
      <textarea id="base-input">foo</textarea>
      <div id="pos-depth-container">
        <select id="pos-depth-select"><option value="prepend">p</option><option value="append">a</option></select>
        <div class="input-row"><textarea id="pos-depth-input"></textarea></div>
      </div>
      <div id="pos-depth-container-2">
        <select id="pos-depth-select-2"><option value="prepend">p</option></select>
        <div class="input-row"><textarea id="pos-depth-input-2"></textarea></div>
      </div>
    `;
    ui.updateDepthContainers('pos', 2, true);
    expect(document.querySelectorAll('#pos-depth-container select').length).toBe(1);
    const sel = document.getElementById('pos-depth-select');
    sel.value = 'append';
    sel.dispatchEvent(new Event('change'));
    const base = document.getElementById('base-input');
    base.value = 'foo bar';
    base.dispatchEvent(new Event('input'));
    expect(document.getElementById('pos-depth-input').value).toBe('2');
  });

  test('rerollRandomOrders handles added and removed stacks', () => {
    document.body.innerHTML = `
      <select id="base-select"></select>
      <textarea id="base-input">foo bar</textarea>
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
    ui.updateStackBlocks('pos', 2);
    document.getElementById('pos-input').value = 'a,b';
    document.getElementById('pos-input-2').value = 'c,d';
    ui.setupOrderControl('pos-order-select', 'pos-order-input', () => ['a', 'b']);
    ui.setupOrderControl('pos-order-select-2', 'pos-order-input-2', () => ['c', 'd']);
    document.getElementById('pos-order-select').value = 'random';
    document.getElementById('pos-order-select-2').value = 'random';
    ui.rerollRandomOrders();
    expect(document.getElementById('pos-order-input').value).not.toBe('');
    expect(document.getElementById('pos-order-input-2').value).not.toBe('');
    ui.updateStackBlocks('pos', 1);
    ui.rerollRandomOrders();
    expect(document.getElementById('pos-order-input').value).not.toBe('');
    expect(document.getElementById('pos-order-input-2')).toBeNull();
  });

  test('setupShuffleAll toggles newly added selects', () => {
    document.body.innerHTML = `
      <input type="checkbox" id="all-random">
      <button class="toggle-button" data-target="all-random"></button>
      <input type="checkbox" id="pos-order-random">
      <button class="toggle-button" data-target="pos-order-random"></button>
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
    ui.setupSectionOrder('pos');
    ui.setupShuffleAll();
    ui.updateStackBlocks('pos', 2);
    ui.setupSectionOrder('pos');
    ui.setupShuffleAll();
    const cb = document.getElementById('all-random');
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-select').value).toBe('random');
    expect(document.getElementById('pos-order-select-2').value).toBe('random');
    expect(document.getElementById('pos-depth-select').value).toBe('random');
    expect(document.getElementById('pos-depth-select-2').value).toBe('random');
    ui.updateStackBlocks('pos', 1);
    ui.setupShuffleAll();
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(document.getElementById('pos-order-select').value).toBe('canonical');
    expect(document.getElementById('pos-order-select-2')).toBeNull();
  });
});
