const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();

describe('New mixing layout', () => {
  test('mix and chunk templates exist', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = createDom(html);
    expect(dom.window.document.getElementById('mix-box-template')).not.toBeNull();
    expect(dom.window.document.getElementById('chunk-box-template')).not.toBeNull();
    expect(dom.window.document.getElementById('variable-box-template')).not.toBeNull();
  });

  test('tab buttons exist', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = createDom(html);
    const menu = dom.window.document.getElementById('menu-bar');
    const glyph = dom.window.document.getElementById('menu-start');
    const prompts = dom.window.document.getElementById('window-prompts-template');
    const audio = dom.window.document.getElementById('window-audio-template');
    const openrouter = dom.window.document.getElementById('window-openrouter-template');
    const about = dom.window.document.getElementById('window-about-template');
    expect(menu).not.toBeNull();
    expect(glyph).not.toBeNull();
    expect(prompts).not.toBeNull();
    expect(audio).not.toBeNull();
    expect(openrouter).not.toBeNull();
    expect(about).not.toBeNull();
  });
});
