const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('New mixing layout', () => {
  test('mix and chunk templates exist', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    expect(dom.window.document.getElementById('mix-box-template')).not.toBeNull();
    expect(dom.window.document.getElementById('chunk-box-template')).not.toBeNull();
  });

  test('tab buttons exist', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = new JSDOM(html);
    const menu = dom.window.document.getElementById('menu-bar');
    const glyph = dom.window.document.getElementById('menu-start');
    const prompts = dom.window.document.getElementById('window-prompts-template');
    const about = dom.window.document.getElementById('window-about-template');
    expect(menu).not.toBeNull();
    expect(glyph).not.toBeNull();
    expect(prompts).not.toBeNull();
    expect(about).not.toBeNull();
  });
});
