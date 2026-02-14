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

describe('Remove box behavior', () => {
  test('removing a variable only removes the variable wrapper', () => {
    const { window } = setupDom();
    const menuItem = window.document.querySelector('.menu-item[data-window="prompts"]');
    menuItem.click();

    const promptWindow = window.document.querySelector('.app-window:not(.window-template)');
    const root = promptWindow?.querySelector('.mix-root');
    expect(root).not.toBeNull();

    window.PromptMixer.applyMixState(
      {
        mixes: [
          {
            type: 'mix',
            id: 'mix-parent',
            title: 'Parent',
            limit: 20,
            exact: true,
            singlePass: true,
            preserve: true,
            randomize: false,
            delimiter: { mode: 'whitespace', size: 1 },
            children: [
              {
                type: 'chunk',
                id: 'chunk-a',
                text: 'a ',
                limit: 20,
                exact: true,
                singlePass: true,
                randomize: false,
                delimiter: { mode: 'whitespace', size: 1 }
              },
              {
                type: 'variable',
                id: 'var-a',
                targetId: 'chunk-a'
              }
            ]
          }
        ]
      },
      root
    );

    window.PromptMixer.generate(root);
    expect(root.querySelectorAll('.mix-box').length).toBe(1);
    expect(root.querySelectorAll('.variable-box').length).toBe(1);

    const removeBtn = root.querySelector('.variable-box .remove-box');
    expect(removeBtn).not.toBeNull();
    removeBtn.click();

    expect(root.querySelectorAll('.mix-box').length).toBe(1);
    expect(root.querySelectorAll('.variable-box').length).toBe(0);

    window.PromptMixer.generate(root);
    expect(root.querySelector('.mix-box .mix-output-text')?.textContent).toBe('a ');
  });
});

// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();
