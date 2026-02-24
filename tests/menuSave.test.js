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
  if (!window.URL) window.URL = {};
  window.URL.createObjectURL = jest.fn(() => 'blob:mock');
  window.URL.revokeObjectURL = jest.fn();
  let lastDownload = null;
  const downloads = [];
  const originalCreate = window.document.createElement.bind(window.document);
  window.document.createElement = tagName => {
    const el = originalCreate(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      el.click = () => {
        const payload = { download: el.download, href: el.href };
        downloads.push(payload);
        lastDownload = payload;
      };
    }
    return el;
  };
  window.prompt = jest.fn();
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return {
    window,
    getLastDownload: () => lastDownload,
    getDownloads: () => downloads.slice()
  };
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

  test('save-as cancellation keeps title and download state unchanged', () => {
    const { window, getLastDownload } = setupDom();
    const menuItem = window.document.querySelector('.menu-item[data-window="prompts"]');
    menuItem.click();

    const saveAsItem = window.document.querySelector('.app-window:not(.window-template) .prompt-menu-item[data-action="save-as"]');
    const titleEl = window.document.querySelector('.app-window:not(.window-template) .window-header .box-title');
    expect(saveAsItem).not.toBeNull();
    expect(titleEl?.textContent).toBe('Prompt Enhancer');
    expect(getLastDownload()).toBeNull();

    window.prompt.mockReturnValueOnce('');
    saveAsItem.click();

    expect(getLastDownload()).toBeNull();
    expect(titleEl?.textContent).toBe('Prompt Enhancer');
  });

  test('save names stay isolated per prompt window instance', () => {
    const { window, getDownloads } = setupDom();
    const menuItem = window.document.querySelector('.menu-item[data-window="prompts"]');
    menuItem.click();
    menuItem.click();

    const promptWindows = Array.from(window.document.querySelectorAll('.app-window[data-window="prompts"]'));
    expect(promptWindows.length).toBe(2);
    const firstWindow = promptWindows[0];
    const secondWindow = promptWindows[1];
    const firstSaveAs = firstWindow.querySelector('.prompt-menu-item[data-action="save-as"]');
    const secondSaveAs = secondWindow.querySelector('.prompt-menu-item[data-action="save-as"]');
    const firstTitle = firstWindow.querySelector('.window-header .box-title');
    const secondTitle = secondWindow.querySelector('.window-header .box-title');

    window.prompt.mockReturnValueOnce('alpha');
    firstSaveAs.click();
    expect(firstTitle?.textContent).toBe('alpha');
    expect(secondTitle?.textContent).toBe('Prompt Enhancer');

    window.prompt.mockReturnValueOnce('beta');
    secondSaveAs.click();
    expect(firstTitle?.textContent).toBe('alpha');
    expect(secondTitle?.textContent).toBe('beta');

    const downloadNames = getDownloads().map(item => item.download);
    expect(downloadNames).toEqual(['alpha.json', 'beta.json']);
  });
});
// Centralized JSDOM teardown keeps tests from leaking handles.
registerDomCleanup();
