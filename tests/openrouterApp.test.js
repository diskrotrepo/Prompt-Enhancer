/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { createDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const OPENROUTER_APP_PATH = path.join(ROOT, 'src', 'apps', 'openrouter-completions', 'app.js');

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function waitFor(predicate, attempts = 120) {
  for (let i = 0; i < attempts; i += 1) {
    const result = predicate();
    if (result) return result;
    // Give async handlers and crypto operations time to settle.
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return null;
}

async function blobToText(window, blob) {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob text'));
    reader.readAsText(blob);
  });
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
  try {
    window.crypto = webcrypto;
  } catch (err) {
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      configurable: true
    });
  }
  if (!window.crypto.getRandomValues) {
    window.crypto.getRandomValues = (...args) => webcrypto.getRandomValues(...args);
  }
  if (!window.crypto.subtle) {
    window.crypto.subtle = webcrypto.subtle;
  }
  if (!window.URL) window.URL = {};
  const downloadedBlobs = [];
  const downloads = [];
  window.URL.createObjectURL = jest.fn(blob => {
    downloadedBlobs.push(blob);
    return `blob:mock-${downloadedBlobs.length}`;
  });
  window.URL.revokeObjectURL = jest.fn();
  const originalCreate = window.document.createElement.bind(window.document);
  window.document.createElement = tagName => {
    const el = originalCreate(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      el.click = () => {
        downloads.push({ download: el.download, href: el.href });
      };
    }
    return el;
  };
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
  return { window, clipboardWrites, downloadedBlobs, downloads };
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

  test('encrypts settings to a file and loads them back with password', async () => {
    const { window, downloadedBlobs, downloads } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    expect(appWindow).not.toBeNull();

    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const modelInput = appWindow.querySelector('.openrouter-model');
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const temperatureInput = appWindow.querySelector('.openrouter-temperature');
    const apiKeyInput = appWindow.querySelector('.openrouter-api-key');
    const titleInput = appWindow.querySelector('.openrouter-title');
    const passwordInput = appWindow.querySelector('.openrouter-settings-password');
    const saveButton = appWindow.querySelector('.openrouter-save-settings');
    const loadButton = appWindow.querySelector('.openrouter-load-settings');
    const loadFileInput = appWindow.querySelector('.openrouter-load-settings-file');

    endpointInput.value = 'https://openrouter.ai/api/v1/completions';
    modelInput.value = 'anthropic/claude-3.5-haiku';
    maxTokensInput.value = '777';
    temperatureInput.value = '1.4';
    apiKeyInput.value = 'sk-live-secret-value';
    titleInput.value = 'Encrypted Settings Test';
    passwordInput.value = 'correct horse battery staple';

    saveButton.click();
    await waitFor(() => downloads.length > 0);
    expect(downloads.length).toBeGreaterThan(0);
    expect(downloads[downloads.length - 1].download).toBe('openrouter-encrypted-settings.json');
    expect(downloadedBlobs.length).toBeGreaterThan(0);
    const encryptedRaw = await blobToText(window, downloadedBlobs[downloadedBlobs.length - 1]);
    expect(encryptedRaw).not.toContain('sk-live-secret-value');

    endpointInput.value = '';
    modelInput.value = '';
    maxTokensInput.value = '1';
    temperatureInput.value = '0';
    apiKeyInput.value = '';
    titleInput.value = '';

    loadButton.click();
    const encryptedFile = new window.File(
      [encryptedRaw],
      'openrouter-encrypted-settings.json',
      { type: 'application/json' }
    );
    Object.defineProperty(loadFileInput, 'files', {
      value: [encryptedFile],
      configurable: true
    });
    loadFileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => apiKeyInput.value === 'sk-live-secret-value');

    expect(endpointInput.value).toBe('https://openrouter.ai/api/v1/completions');
    expect(modelInput.value).toBe('anthropic/claude-3.5-haiku');
    expect(maxTokensInput.value).toBe('777');
    expect(temperatureInput.value).toBe('1.4');
    expect(apiKeyInput.value).toBe('sk-live-secret-value');
    expect(titleInput.value).toBe('Encrypted Settings Test');
  });
});

registerDomCleanup();
