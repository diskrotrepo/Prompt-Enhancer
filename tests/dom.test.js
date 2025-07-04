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
});
