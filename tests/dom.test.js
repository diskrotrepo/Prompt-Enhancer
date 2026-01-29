const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Button layout', () => {
  test('random button precedes copy button in all button columns', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    const cols = dom.window.document.querySelectorAll('.button-col');
    cols.forEach(col => {
      const random = col.querySelector('.random-button');
      const copy = col.querySelector('.copy-button');
      if (random && copy) {
        const nodes = Array.from(col.children);
        expect(nodes.indexOf(random)).toBeLessThan(nodes.indexOf(copy));
      }
    });
  });

  test('save button precedes copy button in all button columns', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    const cols = dom.window.document.querySelectorAll('.button-col');
    cols.forEach(col => {
      const save = col.querySelector('.save-button');
      const copy = col.querySelector('.copy-button');
      if (save && copy) {
        const nodes = Array.from(col.children);
        expect(nodes.indexOf(save)).toBeLessThan(nodes.indexOf(copy));
      }
    });
  });

  test('load/save section includes reset button', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    const reset = dom.window.document.getElementById('reset-data');
    expect(reset).not.toBeNull();
  });

  test('hide toggles include expected targets', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    const baseHide = dom.window.document.getElementById('base-hide');
    const posHide = dom.window.document.getElementById('pos-hide-1');
    const negHide = dom.window.document.getElementById('neg-hide-1');
    expect(baseHide.dataset.targets).toContain('base-input');
    expect(baseHide.dataset.targets).toContain('base-delimiter-label');
    expect(baseHide.dataset.targets).toContain('base-delimiter-select');
    expect(baseHide.dataset.targets).toContain('base-delimiter-size-label');
    expect(baseHide.dataset.targets).toContain('base-delimiter-size');
    expect(posHide.dataset.targets).toContain('pos-input');
    expect(posHide.dataset.targets).toContain('pos-delimiter-label');
    expect(posHide.dataset.targets).toContain('pos-delimiter-select');
    expect(posHide.dataset.targets).toContain('pos-delimiter-size-label');
    expect(posHide.dataset.targets).toContain('pos-delimiter-size');
    expect(negHide.dataset.targets).toContain('neg-input');
    expect(negHide.dataset.targets).toContain('neg-delimiter-label');
    expect(negHide.dataset.targets).toContain('neg-delimiter-select');
    expect(negHide.dataset.targets).toContain('neg-delimiter-size-label');
    expect(negHide.dataset.targets).toContain('neg-delimiter-size');
  });

  // Layout adaptation: label rows should wrap so buttons never overflow their container
  test('label-row flex container wraps buttons onto a new line', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'style.css'), 'utf8');
    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const { window } = dom;
    const styleEl = window.document.createElement('style');
    styleEl.textContent = css;
    window.document.head.appendChild(styleEl); // load stylesheet so computed style reflects flex-wrap
    const row = window.document.querySelector('.label-row');
    const computed = window.getComputedStyle(row);
    expect(computed.flexWrap).toBe('wrap');
  });
});
