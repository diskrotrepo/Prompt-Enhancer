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
    expect(dom.window.document.querySelector('.append-save-file')).not.toBeNull();
    expect(dom.window.document.getElementById('mix-box-template').content.querySelector('.add-save-child')).not.toBeNull();
    expect(dom.window.document.querySelector('.add-root-save')).not.toBeNull();
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

  test('Help-enabled controls have specific copy and accessible icon labels', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const dom = createDom(html);
    const document = dom.window.document;
    const surfaces = [
      document.getElementById('window-prompts-template'),
      document.getElementById('window-openrouter-template'),
      document.getElementById('mix-box-template').content,
      document.getElementById('chunk-box-template').content,
      document.getElementById('variable-box-template').content
    ];
    const helpTargets = surfaces.flatMap(surface => Array.from(surface.querySelectorAll(
      'button, input:not([type="file"]), select, textarea, [role="menuitem"], .resize-handle'
    )));
    const missingCopy = helpTargets
      .filter(target => !target.dataset.help?.trim() || !target.dataset.helpDetail?.trim())
      .map(target => target.className || target.tagName);

    expect(missingCopy).toEqual([]);
    expect(helpTargets.some(target => target.dataset.helpDetail.includes('More detail coming soon'))).toBe(false);

    const iconButtons = surfaces.flatMap(surface => Array.from(surface.querySelectorAll('.icon-button')));
    expect(iconButtons.length).toBeGreaterThan(0);
    expect(iconButtons.every(button => button.getAttribute('aria-label')?.trim())).toBe(true);
    expect(iconButtons.every(button => button.dataset.help?.trim() && button.dataset.helpDetail?.trim())).toBe(true);

    const mixLengthHelp = document.getElementById('mix-box-template').content.querySelector('.length-mode');
    const mixOrderHelp = document.getElementById('mix-box-template').content.querySelector('.order-mode');
    expect(mixLengthHelp.dataset.helpDetail).toContain('Proportional Dropout');
    expect(mixLengthHelp.dataset.helpDetail).toContain('without changing child chunks');
    expect(mixOrderHelp.dataset.helpDetail).toContain('local progress window');

    const titleHelp = document.querySelector('.openrouter-title');
    const encryptedOpenHelp = document.querySelector('[data-action="load-settings"]');
    const encryptedSaveHelp = document.querySelector('[data-action="save-settings"]');
    expect(titleHelp.dataset.helpDetail).toContain('not included');
    expect(encryptedOpenHelp.dataset.helpDetail).toContain('asks for its password');
    expect(encryptedOpenHelp.dataset.helpDetail).not.toContain('password field');
    expect(encryptedSaveHelp.dataset.helpDetail).toContain('all sampling controls');
  });
});
