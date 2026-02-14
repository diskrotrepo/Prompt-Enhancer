/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');

function setupDom() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.alert = () => {};
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return { window };
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('Prompt preset menu', () => {
  test('load preset submenu reads global catalog and applies selected state', async () => {
    const { window } = setupDom();
    window.PromptEnhancerPresetCatalog = {
      presets: [
        {
          id: 'demo',
          name: 'Demo Preset',
          file: 'demo.json',
          state: {
            mixes: [
              {
                type: 'mix',
                title: 'Preset Root',
                preserve: true,
                children: [{ type: 'chunk', text: 'a b ' }]
              }
            ]
          }
        }
      ]
    };

    window.document.querySelector('.menu-item[data-window="prompts"]').click();
    const loadPresetItem = window.document.querySelector(
      '.app-window:not(.window-template) .prompt-menu-item[data-action="load-preset"]'
    );
    expect(loadPresetItem).not.toBeNull();

    loadPresetItem.click();
    await flush();
    await flush();

    const presetRows = window.document.querySelectorAll(
      '.app-window:not(.window-template) .prompt-menu-subitem[data-action="load-preset-file"]'
    );
    expect(presetRows.length).toBe(1);
    expect(presetRows[0].textContent.trim()).toBe('Demo Preset');

    presetRows[0].click();
    await flush();
    await flush();

    const rootMixTitle = window.document.querySelector(
      '.app-window:not(.window-template) .mix-root .mix-box .box-title'
    );
    const windowTitle = window.document.querySelector(
      '.app-window:not(.window-template) .window-header .box-title'
    );
    expect(rootMixTitle?.value).toBe('Preset Root');
    expect(windowTitle?.textContent).toBe('demo');
  });

  test('load preset submenu shows explicit empty state when catalog has no presets', async () => {
    const { window } = setupDom();
    window.PromptEnhancerPresetCatalog = { presets: [] };

    window.document.querySelector('.menu-item[data-window="prompts"]').click();
    const loadPresetItem = window.document.querySelector(
      '.app-window:not(.window-template) .prompt-menu-item[data-action="load-preset"]'
    );
    loadPresetItem.click();
    await flush();
    await flush();

    const statusRow = window.document.querySelector(
      '.app-window:not(.window-template) .prompt-menu-subitem.disabled'
    );
    expect(statusRow?.textContent.trim()).toBe('No presets in catalog');
  });
});

registerDomCleanup();
