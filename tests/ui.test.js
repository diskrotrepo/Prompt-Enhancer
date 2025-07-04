/** @jest-environment jsdom */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const fs = require('fs');
const { JSDOM } = require('jsdom');

function setupDOM() {
  const html = fs.readFileSync('src/index.html', 'utf8');
  const css = fs.readFileSync('src/style.css', 'utf8');
  const dom = new JSDOM(html);
  const style = dom.window.document.createElement('style');
  style.textContent = css;
  dom.window.document.head.appendChild(style);
  return dom.window;
}

describe('UI layout', () => {
  test('button columns use fixed grid layout', () => {
    const window = setupDOM();
    const cols = window.document.querySelectorAll('.button-col');
    expect(cols.length).toBeGreaterThan(0);
    cols.forEach(col => {
      const style = window.getComputedStyle(col);
      expect(style.display).toBe('grid');
      expect(style.gridTemplateColumns).toBe('repeat(4, 1.8rem)');
    });
  });

  test('icon buttons have uniform size', () => {
    const window = setupDOM();
    const buttons = window.document.querySelectorAll('.icon-button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(btn => {
      const style = window.getComputedStyle(btn);
      expect(style.width).toBe('1.8rem');
      expect(style.height).toBe('1.8rem');
    });
  });

  test('input-row children expand evenly', () => {
    const window = setupDOM();
    const elems = window.document.querySelectorAll('.input-row textarea, .input-row input[type="number"], .input-row pre');
    expect(elems.length).toBeGreaterThan(0);
    elems.forEach(el => {
      const style = window.getComputedStyle(el);
      expect(style.flexGrow).toBe('1');
    });
  });
});
