/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');

function setupDom() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.alert = () => {};
  if (!window.URL) window.URL = {};
  window.URL.createObjectURL = jest.fn(() => 'blob:mock');
  window.URL.revokeObjectURL = jest.fn();
  let lastDownload = null;
  const originalCreate = window.document.createElement.bind(window.document);
  window.document.createElement = tagName => {
    const el = originalCreate(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      el.click = () => {
        lastDownload = { download: el.download, href: el.href };
      };
    }
    return el;
  };
  window.prompt = jest.fn();
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return { window, getLastDownload: () => lastDownload };
}

describe('Prompt menu save flows', () => {
  test('save uses save-as when unnamed and updates the window title', () => {
    const { window, getLastDownload } = setupDom();
    const menuItem = window.document.querySelector('.menu-item[data-window="prompts"]');
    menuItem.click();
    const saveItem = window.document.querySelector('.app-window:not(.window-template) .prompt-menu-item[data-action="save"]');
    const saveAsItem = window.document.querySelector('.app-window:not(.window-template) .prompt-menu-item[data-action="save-as"]');
    const titleEl = window.document.querySelector('.app-window:not(.window-template) .window-header .box-title');
    expect(saveItem).not.toBeNull();
    expect(saveAsItem).not.toBeNull();
    expect(titleEl?.textContent).toBe('Prompt Enhancer');

    window.prompt.mockReturnValueOnce('first');
    saveItem.click();
    expect(window.prompt).toHaveBeenCalledTimes(1);
    expect(getLastDownload()?.download).toBe('first.json');
    expect(titleEl?.textContent).toBe('first');

    window.prompt.mockReturnValueOnce('second');
    saveItem.click();
    expect(window.prompt).toHaveBeenCalledTimes(1);
    expect(getLastDownload()?.download).toBe('first.json');
    expect(titleEl?.textContent).toBe('first');

    window.prompt.mockReturnValueOnce('second');
    saveAsItem.click();
    expect(window.prompt).toHaveBeenCalledTimes(2);
    expect(getLastDownload()?.download).toBe('second.json');
    expect(titleEl?.textContent).toBe('second');
  });
});
