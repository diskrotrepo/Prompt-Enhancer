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

async function clickOpenRouterFileAction(window, appWindow, action) {
  const toggle = appWindow.querySelector('.openrouter-menu-start');
  toggle.click();
  await flush();
  const item = appWindow.querySelector(`.openrouter-menu-dropdown .prompt-menu-item[data-action="${action}"]`);
  if (item) item.click();
  await flush();
}

function setupDom() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.alert = () => {};
  window.prompt = jest.fn(() => 'test-password');
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
    if (target.includes('fireworks.ai/v1/models') || target.includes('fireworks.ai/inference/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'accounts/fireworks/models/minimax-m2p5',
              name: 'MiniMax M2.5',
              context_length: 131072,
              supported_parameters: ['prompt', 'max_tokens', 'temperature']
            },
            {
              id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
              name: 'Llama v3.1 70B Instruct',
              context_length: 131072,
              supported_parameters: ['prompt', 'max_tokens', 'temperature']
            }
          ]
        })
      });
    }
    if (target.includes('hyperbolic.xyz/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'meta-llama/Meta-Llama-3.1-405B-Base',
              name: 'Llama 3.1 405B Base',
              context_length: 131072
            }
          ]
        })
      });
    }
    if (target.includes('fireworks.ai/inference/v1/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'fw-gen-test-1',
          choices: [{ text: 'result text' }],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 80,
            total_tokens: 200,
            cost: 0.0042,
            prompt_tokens_details: { cached_tokens: 20 },
            completion_tokens_details: { reasoning_tokens: 0 }
          }
        })
      });
    }
    if (target.includes('hyperbolic.xyz/v1/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'hb-gen-test-1',
          choices: [{ text: 'hyperbolic result text' }],
          usage: {
            prompt_tokens: 60,
            completion_tokens: 20,
            total_tokens: 80,
            cost: 0.0015
          }
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
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const copyButton = appWindow.querySelector('.openrouter-copy-output');
    const output = appWindow.querySelector('.openrouter-output-text');
    const status = appWindow.querySelector('.openrouter-status');
    expect(providerSelect.value).toBe('fireworks');
    expect(topKInput.max).toBe('100');
    await flush();
    await flush();
    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    expect(modelPicker?.querySelectorAll('option').length).toBeGreaterThan(1);
    expect(modelPicker?.textContent || '').toContain('accounts/fireworks/models/minimax-m2p5');
    expect(modelPicker?.textContent || '').toContain('accounts/fireworks/models/llama-v3p1-70b-instruct');
    expect(modelPicker.value).toBe('accounts/fireworks/models/llama-v3p1-70b-instruct');
    promptInput.value = 'finish this sentence';

    sendButton.click();
    await flush();
    await flush();

    const completionCall = window.fetch.mock.calls.find(call => String(call[0] || '').includes('/completions'));
    expect(completionCall).toBeDefined();
    const [requestUrl, requestInit] = completionCall;
    const payload = JSON.parse(requestInit.body);
    expect(requestUrl).toBe('https://api.fireworks.ai/inference/v1/completions');
    expect(requestInit.headers.Authorization).toBe('Bearer fw-test-key');
    expect(requestInit.headers['HTTP-Referer']).toBeUndefined();
    expect(requestInit.headers['X-Title']).toBeUndefined();
    expect(payload.model).toBe('accounts/fireworks/models/llama-v3p1-70b-instruct');
    expect(payload.prompt).toBe('finish this sentence');
    expect(payload.messages).toBeUndefined();
    expect(payload.max_tokens).toBe(300);
    expect(payload.top_p).toBe(1);
    expect(payload.top_k).toBe(40);
    expect(payload.presence_penalty).toBeUndefined();
    expect(payload.frequency_penalty).toBeUndefined();
    expect(payload.stop).toBeUndefined();
    expect(payload.provider).toBeUndefined();
    expect(payload.transforms).toBeUndefined();
    expect(payload.temperature).toBe(1);
    expect(payload.stream).toBe(false);
    expect(output.textContent).toBe('result text');
    expect(status.textContent).toContain('Completed');
    expect(status.textContent).toContain('Output tokens (billed output): 80');
    expect(status.textContent).toContain('Input tokens (billed input): 120');
    expect(status.textContent).toContain('Total tokens (input + output): 200');
    expect(status.textContent).toContain('Request cost (USD): $0.0042');

    copyButton.click();
    await flush();
    expect(clipboardWrites[clipboardWrites.length - 1]).toBe('result text');
  });

  test('switches to hyperbolic and sends a hyperbolic completions request', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const output = appWindow.querySelector('.openrouter-output-text');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(endpointInput.value).toBe('https://api.hyperbolic.xyz/v1/completions');

    keyInput.value = 'hb-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    expect(modelPicker?.textContent || '').toContain('meta-llama/Meta-Llama-3.1-405B-Base');

    promptInput.value = 'POEM 11';
    sendButton.click();
    await flush();
    await flush();

    const completionCalls = window.fetch.mock.calls.filter(call =>
      String(call[0] || '').includes('hyperbolic.xyz/v1/completions')
    );
    expect(completionCalls.length).toBeGreaterThan(0);
    const [requestUrl, requestInit] = completionCalls[completionCalls.length - 1];
    const payload = JSON.parse(requestInit.body);
    expect(requestUrl).toBe('https://api.hyperbolic.xyz/v1/completions');
    expect(requestInit.headers.Authorization).toBe('Bearer hb-test-key');
    expect(payload.model).toBe('meta-llama/Meta-Llama-3.1-405B-Base');
    expect(payload.prompt).toBe('POEM 11');
    expect(payload.max_tokens).toBe(300);
    expect(payload.temperature).toBe(1);
    expect(payload.top_p).toBe(1);
    expect(payload.top_k).toBeUndefined();
    expect(payload.presence_penalty).toBeUndefined();
    expect(payload.frequency_penalty).toBeUndefined();
    expect(payload.stop).toBeUndefined();
    expect(payload.messages).toBeUndefined();
    expect(output.textContent).toBe('hyperbolic result text');
  });

  test('falls back to top-level and estimated billing when usage cost is missing', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('fireworks.ai/v1/models') || target.includes('fireworks.ai/inference/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
                name: 'Llama v3.1 70B Instruct',
                context_length: 131072,
                pricing: {
                  prompt: '0.000001',
                  completion: '0.000002'
                }
              }
            ]
          })
        });
      }
      if (target.includes('fireworks.ai/inference/v1/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'fw-gen-test-billing-fallback',
            choices: [{ text: 'fallback billing text' }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 40,
              total_tokens: 140
            },
            cost: 0.0007
          })
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' })
      });
    });

    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    promptInput.value = 'test billing fallback';

    sendButton.click();
    await flush();
    await flush();

    expect(status.textContent).toContain('Request cost (USD): $0.0007');
    expect(status.textContent).toContain('Estimated request cost (USD): $0.00018');
  });

  test('filters fireworks models that do not advertise prompt completions support', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('fireworks.ai/v1/models') || target.includes('fireworks.ai/inference/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
                name: 'Llama v3.1 70B Instruct',
                context_length: 131072,
                supported_parameters: ['prompt', 'max_tokens', 'temperature']
              },
              {
                id: 'accounts/fireworks/models/chat-only-model',
                name: 'Chat Only Model',
                context_length: 131072,
                supported_parameters: ['messages', 'max_tokens', 'temperature']
              }
            ]
          })
        });
      }
      if (target.includes('fireworks.ai/inference/v1/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'fw-gen-filter-test',
            choices: [{ text: 'ok' }],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3, cost: 0.0001 }
          })
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' })
      });
    });

    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    expect(modelPicker?.textContent || '').toContain('accounts/fireworks/models/llama-v3p1-70b-instruct');
    expect(modelPicker?.textContent || '').not.toContain('accounts/fireworks/models/chat-only-model');
  });

  test('restricts hyperbolic model picker to curated 405B base model only', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('hyperbolic.xyz/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'meta-llama/Meta-Llama-3.1-405B-Base',
                name: 'Llama 3.1 405B Base',
                context_length: 131072
              },
              {
                id: 'vendor/unsupported-chat-model',
                name: 'Unsupported Chat Model',
                context_length: 131072
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' })
      });
    });

    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'hb-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    expect(modelPicker?.textContent || '').toContain('meta-llama/Meta-Llama-3.1-405B-Base');
    expect(modelPicker?.textContent || '').not.toContain('vendor/unsupported-chat-model');
    expect(status.textContent).toContain('Loaded 1 completion models');
  });

  test('omits disableable sampling params when sliders are set to zero', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const topPInput = appWindow.querySelector('.openrouter-top-p');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const presencePenaltyInput = appWindow.querySelector('.openrouter-presence-penalty');
    const frequencyPenaltyInput = appWindow.querySelector('.openrouter-frequency-penalty');
    const topPValue = appWindow.querySelector('.openrouter-top-p-value');
    const topKValue = appWindow.querySelector('.openrouter-top-k-value');
    const presencePenaltyValue = appWindow.querySelector('.openrouter-presence-penalty-value');
    const frequencyPenaltyValue = appWindow.querySelector('.openrouter-frequency-penalty-value');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    expect(modelPicker?.querySelectorAll('option').length).toBeGreaterThan(1);

    promptInput.value = 'continue this';
    topPInput.value = '0';
    topKInput.value = '0';
    presencePenaltyInput.value = '0';
    frequencyPenaltyInput.value = '0';
    topPInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    topKInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    presencePenaltyInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    frequencyPenaltyInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(topPValue.textContent).toBe('0 (disabled)');
    expect(topKValue.textContent).toBe('0 (disabled)');
    expect(presencePenaltyValue.textContent).toBe('0 (disabled)');
    expect(frequencyPenaltyValue.textContent).toBe('0 (disabled)');

    sendButton.click();
    await flush();
    await flush();

    const completionCall = window.fetch.mock.calls.find(call => String(call[0] || '').includes('/completions'));
    expect(completionCall).toBeDefined();
    const payload = JSON.parse(completionCall[1].body);
    expect(payload.top_p).toBeUndefined();
    expect(payload.top_k).toBeUndefined();
    expect(payload.presence_penalty).toBeUndefined();
    expect(payload.frequency_penalty).toBeUndefined();
    expect(payload.temperature).toBe(1);
  });

  test('keeps API key values separate per provider when switching', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'fw-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'hb-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(keyInput.value).toBe('fw-key');

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(keyInput.value).toBe('hb-key');
  });

  test('encrypts settings to a file and loads them back with password', async () => {
    const { window, downloadedBlobs, downloads } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    expect(appWindow).not.toBeNull();

    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const temperatureInput = appWindow.querySelector('.openrouter-temperature');
    const topPInput = appWindow.querySelector('.openrouter-top-p');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const presencePenaltyInput = appWindow.querySelector('.openrouter-presence-penalty');
    const frequencyPenaltyInput = appWindow.querySelector('.openrouter-frequency-penalty');
    const stopInput = appWindow.querySelector('.openrouter-stop');
    const apiKeyInput = appWindow.querySelector('.openrouter-api-key');
    const titleInput = appWindow.querySelector('.openrouter-title');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const loadFileInput = appWindow.querySelector('.openrouter-load-settings-file');

    endpointInput.value = 'https://api.fireworks.ai/inference/v1/completions';
    maxTokensInput.value = '777';
    temperatureInput.value = '1.4';
    topPInput.value = '0.92';
    topKInput.value = '77';
    presencePenaltyInput.value = '0.6';
    frequencyPenaltyInput.value = '0.2';
    stopInput.value = '###\nEND';
    apiKeyInput.value = 'fw-live-secret-value';
    apiKeyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (modelPicker?.textContent || '').includes('accounts/fireworks/models/minimax-m2p5'));
    modelPicker.value = 'accounts/fireworks/models/minimax-m2p5';
    titleInput.value = 'Encrypted Settings Test';
    promptInput.value = 'This prompt should be encrypted and restored.';
    window.prompt.mockReturnValue('correct horse battery staple');

    await clickOpenRouterFileAction(window, appWindow, 'save-settings');
    await waitFor(() => downloads.length > 0);
    expect(downloads.length).toBeGreaterThan(0);
    expect(downloads[downloads.length - 1].download).toBe('completion-providers-encrypted-settings.json');
    expect(downloadedBlobs.length).toBeGreaterThan(0);
    const encryptedRaw = await blobToText(window, downloadedBlobs[downloadedBlobs.length - 1]);
    expect(encryptedRaw).not.toContain('fw-live-secret-value');
    expect(encryptedRaw).not.toContain('This prompt should be encrypted and restored.');

    endpointInput.value = '';
    modelPicker.value = '';
    maxTokensInput.value = '1';
    temperatureInput.value = '0';
    topPInput.value = '1';
    topKInput.value = '1';
    presencePenaltyInput.value = '0';
    frequencyPenaltyInput.value = '0';
    stopInput.value = '';
    apiKeyInput.value = '';
    titleInput.value = '';
    promptInput.value = '';

    await clickOpenRouterFileAction(window, appWindow, 'load-settings');
    const encryptedFile = new window.File(
      [encryptedRaw],
      'completion-providers-encrypted-settings.json',
      { type: 'application/json' }
    );
    Object.defineProperty(loadFileInput, 'files', {
      value: [encryptedFile],
      configurable: true
    });
    loadFileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => apiKeyInput.value === 'fw-live-secret-value');

    expect(providerSelect.value).toBe('fireworks');
    expect(endpointInput.value).toBe('https://api.fireworks.ai/inference/v1/completions');
    expect(modelPicker.value).toBe('accounts/fireworks/models/minimax-m2p5');
    expect(maxTokensInput.value).toBe('777');
    expect(temperatureInput.value).toBe('1.4');
    expect(topPInput.value).toBe('0.92');
    expect(topKInput.value).toBe('77');
    expect(presencePenaltyInput.value).toBe('0.6');
    expect(frequencyPenaltyInput.value).toBe('0.2');
    expect(stopInput.value).toBe('###\nEND');
    expect(apiKeyInput.value).toBe('fw-live-secret-value');
    expect(titleInput.value).toBe('Encrypted Settings Test');
    expect(promptInput.value).toBe('This prompt should be encrypted and restored.');
  });

  test('encrypted settings persist separate API keys for both providers', async () => {
    const { window, downloadedBlobs, downloads } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    expect(appWindow).not.toBeNull();

    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const apiKeyInput = appWindow.querySelector('.openrouter-api-key');
    const loadFileInput = appWindow.querySelector('.openrouter-load-settings-file');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    apiKeyInput.value = 'fw-key-persisted';
    apiKeyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    apiKeyInput.value = 'hb-key-persisted';
    apiKeyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    window.prompt.mockReturnValue('dual-key-password');
    await clickOpenRouterFileAction(window, appWindow, 'save-settings');
    await waitFor(() => downloads.length > 0);
    expect(downloadedBlobs.length).toBeGreaterThan(0);
    const encryptedRaw = await blobToText(window, downloadedBlobs[downloadedBlobs.length - 1]);

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    apiKeyInput.value = '';

    await clickOpenRouterFileAction(window, appWindow, 'load-settings');
    const encryptedFile = new window.File(
      [encryptedRaw],
      'completion-providers-encrypted-settings.json',
      { type: 'application/json' }
    );
    Object.defineProperty(loadFileInput, 'files', {
      value: [encryptedFile],
      configurable: true
    });
    loadFileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => providerSelect.value === 'hyperbolic' && apiKeyInput.value === 'hb-key-persisted');

    expect(providerSelect.value).toBe('hyperbolic');
    expect(apiKeyInput.value).toBe('hb-key-persisted');

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(apiKeyInput.value).toBe('fw-key-persisted');

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(apiKeyInput.value).toBe('hb-key-persisted');
  });

  test('filters out models that require mandatory reasoning after first failure', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('fireworks.ai/v1/models') || target.includes('fireworks.ai/inference/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'minimax/minimax-m1',
                name: 'MiniMax M1',
                context_length: 1000000,
                supported_parameters: ['prompt', 'max_tokens', 'temperature']
              },
              {
                id: 'accounts/fireworks/models/minimax-m2p5',
                name: 'MiniMax M2.5',
                context_length: 131072,
                supported_parameters: ['prompt', 'max_tokens', 'temperature']
              }
            ]
          })
        });
      }
      if (target.includes('fireworks.ai/inference/v1/completions')) {
        const payload = JSON.parse(String(init?.body || '{}'));
        if (payload.model === 'minimax/minimax-m1') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: {
                message: 'reasoning is mandatory for this endpoint and cannot be disabled'
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'gen-test-2',
            choices: [{ text: 'ok' }],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3, cost: 0.0001 }
          })
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' })
      });
    });

    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    promptInput.value = 'finish this';
    modelPicker.value = 'minimax/minimax-m1';

    sendButton.click();
    await waitFor(() => (status.textContent || '').includes('Model filtered out for completions-only mode.'));
    await waitFor(() => !(modelPicker?.textContent || '').includes('minimax/minimax-m1'));

    expect(status.textContent).toContain('reasoning is mandatory for this endpoint and cannot be disabled');
    expect(modelPicker?.textContent || '').not.toContain('minimax/minimax-m1');
    expect(modelPicker?.textContent || '').toContain('accounts/fireworks/models/minimax-m2p5');
  });

  test('blocks chat/completions endpoints to keep requests as pure prompt completions', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    endpointInput.value = 'https://api.fireworks.ai/inference/v1/chat/completions';
    promptInput.value = 'autocomplete me';
    sendButton.click();
    await waitFor(() => (status.textContent || '').includes('completions-only'));

    const completionCall = window.fetch.mock.calls.find(call => String(call[0] || '').includes('/chat/completions'));
    expect(completionCall).toBeUndefined();
    expect(status.textContent).toContain('completions-only');
  });
});

registerDomCleanup();
