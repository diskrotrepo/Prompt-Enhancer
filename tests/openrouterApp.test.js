/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { createDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const OPENROUTER_APP_PATH = path.join(ROOT, 'src', 'apps', 'openrouter-completions', 'app.js');

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function setupDom() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.alert = () => {};
  const clipboardWrites = [];
  const clipboardShim = {
    writeText: text => {
      clipboardWrites.push(text);
      return Promise.resolve();
    }
  };
  try {
    window.navigator.clipboard = clipboardShim;
  } catch (err) {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: clipboardShim,
      configurable: true
    });
  }
  window.fetch = jest.fn((url, init) => {
    const target = String(url || '');
    if (target.includes('/models/user') || target.includes('/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128000 },
            { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000 }
          ]
        })
      });
    }
    if (target.includes('/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ text: 'result text' }],
          usage: { total_tokens: 42 }
        })
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' })
    });
  });
  window.eval(fs.readFileSync(OPENROUTER_APP_PATH, 'utf8'));
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return { window, clipboardWrites };
}

describe('OpenRouter app module', () => {
  test('opens from menu and sends completions request', async () => {
    const { window, clipboardWrites } = setupDom();
    const menuItem = window.document.querySelector('.menu-item[data-window="openrouter"]');
    expect(menuItem).not.toBeNull();
    menuItem.click();

    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    expect(appWindow).not.toBeNull();
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const copyButton = appWindow.querySelector('.openrouter-copy-output');
    const output = appWindow.querySelector('.openrouter-output-text');
    const status = appWindow.querySelector('.openrouter-status');
    await flush();
    await flush();
    expect(modelPicker?.querySelectorAll('option').length).toBeGreaterThan(1);
    expect(modelPicker?.textContent || '').toContain('openai/gpt-4o-mini');
    keyInput.value = 'test-openrouter-key';
    promptInput.value = 'finish this sentence';

    sendButton.click();
    await flush();
    await flush();

    const completionCall = window.fetch.mock.calls.find(call => String(call[0] || '').includes('/completions'));
    expect(completionCall).toBeDefined();
    const [requestUrl, requestInit] = completionCall;
    const payload = JSON.parse(requestInit.body);
    expect(requestUrl).toBe('https://openrouter.ai/api/v1/completions');
    expect(requestInit.headers.Authorization).toBe('Bearer test-openrouter-key');
    expect(requestInit.headers['HTTP-Referer']).toBeUndefined();
    expect(payload.model).toBe('openai/gpt-4o-mini');
    expect(payload.prompt).toBe('finish this sentence');
    expect(payload.temperature).toBe(1);
    expect(payload.stream).toBe(false);
    expect(output.textContent).toBe('result text');
    expect(status.textContent).toContain('Completed');

    copyButton.click();
    await flush();
    expect(clipboardWrites[clipboardWrites.length - 1]).toBe('result text');
  });
});

registerDomCleanup();
