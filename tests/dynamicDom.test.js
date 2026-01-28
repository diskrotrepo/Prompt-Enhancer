/** @jest-environment jsdom */

global.__TEST__ = true;
if (typeof window !== 'undefined') window.__TEST__ = true;

const main = require('../src/script');
const ui = main;

describe('Dynamic DOM updates', () => {
  test('updateStackBlocks adds and removes stacked controls', () => {
    document.body.innerHTML = `
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
    ui.updateStackBlocks('pos', 2);
    expect(document.getElementById('pos-order-container-2')).not.toBeNull();
    expect(document.getElementById('pos-depth-container-2')).not.toBeNull();
    ui.updateStackBlocks('pos', 1);
    expect(document.getElementById('pos-order-container-2')).toBeNull();
    expect(document.getElementById('pos-depth-container-2')).toBeNull();
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
          </div>
          <div id="pos-depth-container">
            <select id="pos-depth-select"><option value="prepend">p</option><option value="random">r</option></select>
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
