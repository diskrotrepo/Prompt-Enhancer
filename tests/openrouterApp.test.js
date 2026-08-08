/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { createDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const ENCRYPTED_SETTINGS_PATH = path.join(ROOT, 'src', 'apps', 'shared', 'encrypted-settings.js');
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
    if (target.includes('openrouter.ai/api/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: 'example/base-model',
            name: 'Example Base Model',
            context_length: 32768,
            architecture: { input_modalities: ['text'], output_modalities: ['text'] },
            supported_parameters: [
              'max_tokens',
              'temperature',
              'top_p',
              'top_k',
              'presence_penalty',
              'frequency_penalty',
              'stop'
            ],
            reasoning: { mandatory: false }
          }]
        })
      });
    }
    if (target.includes('api.together.ai/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ([{
            id: 'example/together-base',
            display_name: 'Together Base',
            context_length: 32768,
            type: 'language',
            pricing: { input: 0.3, output: 0.6 }
          }, {
            id: 'example/together-chat',
            display_name: 'Together Chat',
            context_length: 32768,
            type: 'chat'
          }])
      });
    }
    if (target.includes('api.deepinfra.com/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{
            id: 'deepseek-ai/DeepSeek-V4-Pro',
            object: 'model',
            owned_by: 'deepseek-ai',
            metadata: {
              description: 'DeepSeek V4 Pro',
              pricing: { input: 1.3, output: 2.6, cached_input: 0.1 },
              tags: ['text-generation'],
              context_length: 1048576,
              max_tokens: 16384
            }
          }, {
            id: 'black-forest-labs/FLUX-2',
            object: 'model',
            owned_by: 'black-forest-labs',
            metadata: {
              tags: ['text-to-image'],
              default_width: 1024,
              default_height: 1024
            }
          }]
        })
      });
    }
    if (target.includes('api.deepseek.com/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{
            id: 'deepseek-v4-flash',
            object: 'model',
            owned_by: 'deepseek'
          }, {
            id: 'deepseek-v4-pro',
            object: 'model',
            owned_by: 'deepseek'
          }]
        })
      });
    }
    if (target.includes('api.mistral.ai/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: 'codestral-latest',
            name: 'Codestral Latest',
            max_context_length: 32768,
            capabilities: { completion_fim: true }
          }, {
            id: 'mistral-chat-only',
            name: 'Mistral Chat Only',
            max_context_length: 32768,
            capabilities: { completion_fim: false }
          }]
        })
      });
    }
    if (target.includes('api.openai.com/v1/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'gpt-3.5-turbo-instruct',
              owned_by: 'openai'
            },
            {
              id: 'davinci-002',
              owned_by: 'openai'
            },
            {
              id: 'babbage-002',
              owned_by: 'openai'
            },
            {
              id: 'gpt-5.6-chat',
              owned_by: 'openai'
            }
          ]
        })
      });
    }
    if (target.includes('api.fireworks.ai/v1/accounts/fireworks/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'accounts/fireworks/models/minimax-m2p5',
              displayName: 'MiniMax M2.5',
              contextLength: 131072,
              supportsServerless: true,
              baseModelDetails: { modelType: 'text' }
            },
            {
              name: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
              displayName: 'Llama v3.1 70B Instruct',
              contextLength: 131072,
              supportsServerless: true,
              baseModelDetails: { modelType: 'text' }
            },
            {
              name: 'accounts/example/models/not-serverless',
              displayName: 'Not Serverless',
              contextLength: 131072,
              supportsServerless: false,
              baseModelDetails: { modelType: 'text' }
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
    if (target.includes('openrouter.ai/api/v1/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'or-gen-test-1',
          choices: [{ text: 'openrouter raw result' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        })
      });
    }
    if (target.includes('api.hyperbolic.xyz/v1/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'hyperbolic-raw-test-1',
          choices: [{ text: 'hyperbolic raw result' }],
          usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 }
        })
      });
    }
    if (target.includes('api.deepinfra.com/v1/openai/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'deepinfra-raw-test-1',
          choices: [{ text: 'deepinfra raw result' }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            estimated_cost: 0.000026
          }
        })
      });
    }
    if (target.includes('api.deepseek.com/beta/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'deepseek-fim-test-1',
          choices: [{ text: 'deepseek middle' }],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 }
        })
      });
    }
    if (target.includes('api.together.ai/v1/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'together-gen-test-1',
          choices: [{ text: 'together raw result' }],
          usage: { prompt_tokens: 9, completion_tokens: 3, total_tokens: 12 }
        })
      });
    }
    if (target.includes('api.mistral.ai/v1/fim/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'mistral-fim-test-1',
          choices: [{ message: { role: 'assistant', content: 'mistral middle' } }],
          usage: { prompt_tokens: 14, completion_tokens: 6, total_tokens: 20 }
        })
      });
    }
    if (target.includes('api.openai.com/v1/completions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'openai-legacy-test-1',
          choices: [{ text: 'openai legacy result' }],
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 }
        })
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' })
    });
  });
  window.eval(fs.readFileSync(ENCRYPTED_SETTINGS_PATH, 'utf8'));
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
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const copyButton = appWindow.querySelector('.openrouter-copy-output');
    const helpButton = appWindow.querySelector('.help-toggle');
    const output = appWindow.querySelector('.openrouter-output-text');
    const status = appWindow.querySelector('.openrouter-status');
    const fileActions = Array.from(
      appWindow.querySelectorAll('.openrouter-menu-dropdown .prompt-menu-item[data-action]')
    ).map(item => item.dataset.action);
    expect(providerSelect.value).toBe('fireworks');
    expect(topKInput.max).toBe('100');
    expect(fileActions).toEqual(['load-settings', 'save-settings']);
    expect(helpButton).not.toBeNull();
    expect(appWindow.dataset.helpReady).toBe('true');
    helpButton.click();
    expect(appWindow.classList.contains('help-active')).toBe(true);
    helpButton.click();
    expect(appWindow.classList.contains('help-active')).toBe(false);
    expect(copyButton.classList.contains('copy-output')).toBe(true);
    expect(copyButton.closest('.openrouter-output-header')).not.toBeNull();
    await flush();
    await flush();
    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    expect(modelPicker?.querySelectorAll('option').length).toBeGreaterThan(1);
    expect(modelPicker?.textContent || '').toContain('accounts/fireworks/models/minimax-m2p5');
    expect(modelPicker?.textContent || '').toContain('accounts/fireworks/models/llama-v3p1-70b-instruct');
    expect(modelPicker?.textContent || '').not.toContain('accounts/example/models/not-serverless');
    expect(modelPicker.value).toBe('accounts/fireworks/models/llama-v3p1-70b-instruct');
    expect(maxTokensInput.max).toBe('131072');
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
    expect(payload.max_tokens).toBeUndefined();
    expect(payload.top_p).toBeUndefined();
    expect(payload.top_k).toBeUndefined();
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

    const completedStatus = status.textContent;
    copyButton.click();
    await flush();
    expect(clipboardWrites[clipboardWrites.length - 1]).toBe('result text');
    expect(copyButton.classList.contains('copied')).toBe(true);
    expect(copyButton.textContent).toBe('✓');
    expect(status.textContent).toBe(completedStatus);
  });

  test.each([
    {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/completions',
      model: 'example/base-model',
      output: 'openrouter raw result',
      supportsTopK: true
    },
    {
      provider: 'together',
      endpoint: 'https://api.together.ai/v1/completions',
      model: 'example/together-base',
      output: 'together raw result',
      supportsTopK: true
    },
    {
      provider: 'deepinfra',
      endpoint: 'https://api.deepinfra.com/v1/openai/completions',
      model: 'deepseek-ai/DeepSeek-V4-Pro',
      output: 'deepinfra raw result',
      supportsTopK: false
    },
    {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/completions',
      model: 'gpt-3.5-turbo-instruct',
      output: 'openai legacy result',
      supportsTopK: false
    },
    {
      provider: 'hyperbolic',
      endpoint: 'https://api.hyperbolic.xyz/v1/completions',
      model: 'meta-llama/Meta-Llama-3.1-405B',
      output: 'hyperbolic raw result',
      supportsTopK: false
    }
  ])('sends $provider as prompt-only completion data', async providerCase => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = providerCase.provider;
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(endpointInput.value).toBe(providerCase.endpoint);
    keyInput.value = `${providerCase.provider}-test-key`;
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => status.textContent.includes('Loaded'));
    expect(modelPicker.value).toBe(providerCase.model);
    expect(topKInput.disabled).toBe(!providerCase.supportsTopK);
    topKInput.value = '17';
    promptInput.value = 'continue directly from this prefix';
    appWindow.querySelector('.openrouter-send').click();

    await waitFor(() => appWindow.querySelector('.openrouter-output-text').textContent === providerCase.output);
    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '') === providerCase.endpoint && call[1]?.method === 'POST'
    );
    expect(completionCall).toBeDefined();
    const payload = JSON.parse(completionCall[1].body);
    expect(payload.model).toBe(providerCase.model);
    expect(payload.prompt).toBe('continue directly from this prefix');
    expect(payload.messages).toBeUndefined();
    expect(payload.suffix).toBeUndefined();
    if (providerCase.supportsTopK) {
      expect(payload.top_k).toBe(17);
    } else {
      expect(payload.top_k).toBeUndefined();
    }
  });

  test.each([
    {
      provider: 'deepseek',
      endpoint: 'https://api.deepseek.com/beta/completions',
      model: 'deepseek-v4-pro',
      output: 'deepseek middle',
      maxTokens: 4096,
      temperatureMax: 2
    },
    {
      provider: 'mistral',
      endpoint: 'https://api.mistral.ai/v1/fim/completions',
      model: 'codestral-latest',
      output: 'mistral middle',
      maxTokens: 9000,
      temperatureMax: 1.5
    }
  ])('sends $provider FIM prefix and suffix without chat request fields', async providerCase => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const suffixBlock = appWindow.querySelector('.openrouter-suffix-block');
    const suffixInput = appWindow.querySelector('.openrouter-suffix');
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const temperatureInput = appWindow.querySelector('.openrouter-temperature');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const presenceInput = appWindow.querySelector('.openrouter-presence-penalty');
    const frequencyInput = appWindow.querySelector('.openrouter-frequency-penalty');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = providerCase.provider;
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = `${providerCase.provider}-test-key`;
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => status.textContent.includes('Loaded'));
    expect(modelPicker.value).toBe(providerCase.model);
    expect(suffixBlock.classList.contains('is-hidden')).toBe(false);
    expect(topKInput.disabled).toBe(true);
    expect(presenceInput.disabled).toBe(true);
    expect(frequencyInput.disabled).toBe(true);
    expect(temperatureInput.max).toBe(String(providerCase.temperatureMax));

    maxTokensInput.value = '9000';
    temperatureInput.value = '2';
    topKInput.value = '31';
    presenceInput.value = '1';
    frequencyInput.value = '1';
    appWindow.querySelector('.openrouter-prompt').value = 'function greet() {';
    suffixInput.value = '\n}';
    appWindow.querySelector('.openrouter-send').click();

    await waitFor(() => appWindow.querySelector('.openrouter-output-text').textContent === providerCase.output);
    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '') === providerCase.endpoint && call[1]?.method === 'POST'
    );
    expect(completionCall).toBeDefined();
    const payload = JSON.parse(completionCall[1].body);
    expect(payload.model).toBe(providerCase.model);
    expect(payload.prompt).toBe('function greet() {');
    expect(payload.suffix).toBe('\n}');
    expect(payload.messages).toBeUndefined();
    expect(payload.max_tokens).toBe(providerCase.maxTokens);
    expect(payload.temperature).toBe(providerCase.temperatureMax);
    expect(payload.top_k).toBeUndefined();
    expect(payload.presence_penalty).toBeUndefined();
    expect(payload.frequency_penalty).toBeUndefined();
  });

  test('gates OpenAI suffix and output cap to the selected legacy completion model', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const suffixBlock = appWindow.querySelector('.openrouter-suffix-block');
    const suffixInput = appWindow.querySelector('.openrouter-suffix');
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'openai';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'openai-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() =>
      (status.textContent || '').includes('OpenAI') && modelPicker.value === 'gpt-3.5-turbo-instruct'
    );

    expect(suffixBlock.classList.contains('is-hidden')).toBe(false);
    maxTokensInput.value = '9000';
    suffixInput.value = ' after-gap';
    promptInput.value = 'before-gap ';
    sendButton.click();
    await waitFor(() => window.fetch.mock.calls.filter(call =>
      String(call[0] || '') === 'https://api.openai.com/v1/completions'
    ).length === 1);
    const firstPayload = JSON.parse(window.fetch.mock.calls.find(call =>
      String(call[0] || '') === 'https://api.openai.com/v1/completions'
    )[1].body);
    expect(firstPayload.suffix).toBe(' after-gap');
    expect(firstPayload.max_tokens).toBe(4096);
    expect(firstPayload.messages).toBeUndefined();
    await waitFor(() => sendButton.disabled === false);

    modelPicker.value = 'davinci-002';
    modelPicker.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(suffixBlock.classList.contains('is-hidden')).toBe(true);
    maxTokensInput.value = '9000';
    promptInput.value = 'forward only';
    sendButton.click();
    await waitFor(() => window.fetch.mock.calls.filter(call =>
      String(call[0] || '') === 'https://api.openai.com/v1/completions'
    ).length === 2);
    const completionCalls = window.fetch.mock.calls.filter(call =>
      String(call[0] || '') === 'https://api.openai.com/v1/completions'
    );
    const secondPayload = JSON.parse(completionCalls[1][1].body);
    expect(secondPayload.model).toBe('davinci-002');
    expect(secondPayload.suffix).toBeUndefined();
    expect(secondPayload.max_tokens).toBe(9000);
    expect(secondPayload.messages).toBeUndefined();
  });

  test('honors OpenRouter per-model parameter metadata and mandatory-reasoning flags', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('openrouter.ai/api/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{
              id: 'example/minimal-completion-model',
              name: 'Minimal Completion Model',
              architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              supported_parameters: ['max_tokens', 'temperature'],
              reasoning: { mandatory: false }
            }, {
              id: 'example/mandatory-reasoning-model',
              name: 'Mandatory Reasoning Model',
              architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              supported_parameters: ['max_tokens', 'temperature', 'top_p'],
              reasoning: { mandatory: true }
            }]
          })
        });
      }
      if (target.includes('openrouter.ai/api/v1/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ text: 'minimal continuation' }],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 }
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
    const topPInput = appWindow.querySelector('.openrouter-top-p');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const stopInput = appWindow.querySelector('.openrouter-stop');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'openrouter';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'openrouter-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => modelPicker.value === 'example/minimal-completion-model');
    expect(modelPicker?.textContent || '').not.toContain('mandatory-reasoning-model');
    expect(topPInput.disabled).toBe(true);
    expect(topKInput.disabled).toBe(true);
    expect(stopInput.disabled).toBe(true);

    topPInput.value = '0.8';
    topKInput.value = '25';
    stopInput.value = 'END';
    appWindow.querySelector('.openrouter-prompt').value = 'raw prefix';
    appWindow.querySelector('.openrouter-send').click();
    await waitFor(() => (status.textContent || '').includes('Completed.'));
    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '') === 'https://openrouter.ai/api/v1/completions'
    );
    const payload = JSON.parse(completionCall[1].body);
    expect(payload.prompt).toBe('raw prefix');
    expect(payload.messages).toBeUndefined();
    expect(payload.top_p).toBeUndefined();
    expect(payload.top_k).toBeUndefined();
    expect(payload.stop).toBeUndefined();
  });

  test('omits all optional OpenRouter fields when supported_parameters is absent', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('openrouter.ai/api/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{
              id: 'example/metadata-opaque-base',
              name: 'Metadata Opaque Base',
              architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              reasoning: { mandatory: false }
            }]
          })
        });
      }
      if (target.includes('openrouter.ai/api/v1/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ text: 'opaque continuation' }],
            usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 }
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
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const temperatureInput = appWindow.querySelector('.openrouter-temperature');
    const topPInput = appWindow.querySelector('.openrouter-top-p');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'openrouter';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'openrouter-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => modelPicker.value === 'example/metadata-opaque-base');
    expect(maxTokensInput.disabled).toBe(true);
    expect(temperatureInput.disabled).toBe(true);
    expect(topPInput.disabled).toBe(true);

    maxTokensInput.value = '99';
    temperatureInput.value = '1.2';
    topPInput.value = '0.8';
    promptInput.value = 'opaque prefix';
    appWindow.querySelector('.openrouter-send').click();
    await waitFor(() => (status.textContent || '').includes('Completed.'));

    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '') === 'https://openrouter.ai/api/v1/completions'
    );
    const payload = JSON.parse(completionCall[1].body);
    expect(payload).toEqual({
      model: 'example/metadata-opaque-base',
      prompt: 'opaque prefix',
      stream: false
    });
  });

  test('offers only providers with a currently documented prompt or FIM completions route', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const status = appWindow.querySelector('.openrouter-status');

    expect(Array.from(providerSelect.options).map(option => option.value)).toEqual([
      'openrouter',
      'deepseek',
      'deepinfra',
      'fireworks',
      'together',
      'mistral',
      'openai',
      'hyperbolic'
    ]);

    keyInput.value = 'fw-catalog-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.dispatchEvent(new window.Event('blur', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    const catalogCalls = window.fetch.mock.calls.filter(call =>
      String(call[0] || '').startsWith(
        'https://api.fireworks.ai/v1/accounts/fireworks/models?filter=supports_serverless%3Dtrue'
      )
    );
    const catalogCall = catalogCalls[0];
    expect(catalogCalls).toHaveLength(1);
    expect(catalogCall).toBeDefined();
    expect(catalogCall[1].headers.Authorization).toBe('Bearer fw-catalog-key');
  });

  test('uses DeepInfra raw completions and admits only text-generation catalog metadata', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const maxTokensInput = appWindow.querySelector('.openrouter-max-tokens');
    const temperatureInput = appWindow.querySelector('.openrouter-temperature');
    const topPInput = appWindow.querySelector('.openrouter-top-p');
    const topKInput = appWindow.querySelector('.openrouter-top-k');
    const presenceInput = appWindow.querySelector('.openrouter-presence-penalty');
    const frequencyInput = appWindow.querySelector('.openrouter-frequency-penalty');
    const stopInput = appWindow.querySelector('.openrouter-stop');
    const suffixBlock = appWindow.querySelector('.openrouter-suffix-block');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const output = appWindow.querySelector('.openrouter-output-text');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'deepinfra';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(endpointInput.value).toBe('https://api.deepinfra.com/v1/openai/completions');
    keyInput.value = 'deepinfra-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded 1 completion models'));

    expect(Array.from(modelPicker.options).map(option => option.value)).toEqual([
      '',
      'deepseek-ai/DeepSeek-V4-Pro'
    ]);
    expect(modelPicker.textContent).toContain('(1048576 ctx)');
    expect(modelPicker.textContent).not.toContain('FLUX-2');
    expect(maxTokensInput.max).toBe('16384');
    expect(temperatureInput.max).toBe('2');
    expect(topPInput.disabled).toBe(false);
    expect(topKInput.disabled).toBe(true);
    expect(presenceInput.disabled).toBe(true);
    expect(frequencyInput.disabled).toBe(true);
    expect(stopInput.disabled).toBe(false);
    expect(suffixBlock.classList.contains('is-hidden')).toBe(true);

    maxTokensInput.value = '99999';
    temperatureInput.value = '1.7';
    topPInput.value = '0.75';
    topKInput.value = '25';
    presenceInput.value = '1';
    frequencyInput.value = '1';
    stopInput.value = 'one\ntwo\nthree\nfour';
    promptInput.value = '<raw-prefix><assistant>';
    appWindow.querySelector('.openrouter-send').click();

    await waitFor(() => output.textContent === 'deepinfra raw result');
    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '') === 'https://api.deepinfra.com/v1/openai/completions' &&
      call[1]?.method === 'POST'
    );
    expect(completionCall).toBeDefined();
    expect(completionCall[1].headers.Authorization).toBe('Bearer deepinfra-test-key');
    expect(JSON.parse(completionCall[1].body)).toEqual({
      model: 'deepseek-ai/DeepSeek-V4-Pro',
      prompt: '<raw-prefix><assistant>',
      max_tokens: 16384,
      top_p: 0.75,
      temperature: 1.7,
      stop: ['one', 'two', 'three', 'four'],
      stream: false
    });
    expect(status.textContent).toContain('Request cost (USD): $0.000026');
    expect(status.textContent).toContain('Estimated request cost (USD): $0.000026');
  });

  test('follows every documented Fireworks nextPageToken before populating models', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = new URL(String(url || ''));
      if (target.hostname === 'api.fireworks.ai' && target.pathname.endsWith('/models')) {
        const pageToken = target.searchParams.get('pageToken');
        return Promise.resolve({
          ok: true,
          json: async () => pageToken
            ? {
                models: [{
                  name: 'accounts/fireworks/models/page-two-base',
                  displayName: 'Page Two Base',
                  contextLength: 8192,
                  supportsServerless: true,
                  baseModelDetails: { modelType: 'text' }
                }]
              }
            : {
                models: [{
                  name: 'accounts/fireworks/models/page-one-base',
                  displayName: 'Page One Base',
                  contextLength: 4096,
                  supportsServerless: true,
                  baseModelDetails: { modelType: 'text' }
                }],
                nextPageToken: 'page-two-token'
              }
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

    keyInput.value = 'fw-pagination-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded 2 completion models'));

    const catalogCalls = window.fetch.mock.calls.filter(call =>
      String(call[0] || '').includes('api.fireworks.ai/v1/accounts/fireworks/models')
    );
    expect(catalogCalls).toHaveLength(2);
    expect(new URL(catalogCalls[0][0]).searchParams.get('pageToken')).toBeNull();
    expect(new URL(catalogCalls[1][0]).searchParams.get('pageToken')).toBe('page-two-token');
    expect(catalogCalls.every(call =>
      call[1]?.headers?.Authorization === 'Bearer fw-pagination-key'
    )).toBe(true);
    expect(modelPicker.textContent).toContain('page-one-base');
    expect(modelPicker.textContent).toContain('page-two-base');
  });

  test('keeps Hyperbolic on its one documented sunset base model and conservative fields', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const providerNote = appWindow.querySelector('.openrouter-provider-note');

    providerSelect.value = 'hyperbolic';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();

    expect(Array.from(modelPicker.options).map(option => option.value)).toEqual([
      '',
      'meta-llama/Meta-Llama-3.1-405B'
    ]);
    expect(providerNote.textContent).toContain('for removal');
    expect(appWindow.querySelector('.openrouter-top-p').disabled).toBe(true);
    expect(appWindow.querySelector('.openrouter-top-k').disabled).toBe(true);
    expect(appWindow.querySelector('.openrouter-presence-penalty').disabled).toBe(true);
    expect(appWindow.querySelector('.openrouter-frequency-penalty').disabled).toBe(true);
    expect(appWindow.querySelector('.openrouter-stop').disabled).toBe(true);
  });

  test('normalizes Together per-million pricing and top-level request cost', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('api.together.ai/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ([{
            id: 'example/together-priced-language',
            display_name: 'Together Priced Language',
            context_length: 131072,
            type: 'language',
            pricing: { input: 0.3, output: 0.6 }
          }])
        });
      }
      if (target.includes('api.together.ai/v1/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'together-gen-test-billing-fallback',
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
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const temperatureInput = appWindow.querySelector('.openrouter-temperature');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'together-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    promptInput.value = 'test billing fallback';
    temperatureInput.value = '1.8';

    sendButton.click();
    await flush();
    await flush();

    expect(status.textContent).toContain('Request cost (USD): $0.0007');
    expect(status.textContent).toContain('Estimated request cost (USD): $0.000054');
    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '') === 'https://api.together.ai/v1/completions'
    );
    expect(JSON.parse(completionCall[1].body).temperature).toBe(1);
  });

  test('uses Together top-level catalog shape and excludes chat-typed models', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'together-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    expect(modelPicker?.textContent || '').toContain('example/together-base');
    expect(modelPicker?.textContent || '').not.toContain('example/together-chat');
  });

  test('intersects DeepSeek FIM, Mistral FIM, and OpenAI legacy catalog capabilities', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = 'deepseek';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'deepseek-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() =>
      (status.textContent || '').includes('DeepSeek') &&
      (status.textContent || '').includes('Loaded')
    );
    expect(Array.from(modelPicker.options).map(option => option.value)).toEqual([
      '',
      'deepseek-v4-pro'
    ]);
    expect(modelPicker.textContent).not.toContain('deepseek-v4-flash');

    providerSelect.value = 'mistral';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'mistral-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() =>
      (status.textContent || '').includes('Mistral') &&
      (status.textContent || '').includes('Loaded')
    );
    expect(modelPicker?.textContent || '').toContain('codestral-latest');
    expect(modelPicker?.textContent || '').not.toContain('mistral-chat-only');

    providerSelect.value = 'openai';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'openai-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() =>
      (status.textContent || '').includes('OpenAI') &&
      (status.textContent || '').includes('Loaded')
    );
    expect(Array.from(modelPicker.options).map(option => option.value)).toEqual([
      '',
      'babbage-002',
      'davinci-002',
      'gpt-3.5-turbo-instruct'
    ]);
    expect(modelPicker?.textContent || '').not.toContain('gpt-5.6-chat');
  });

  test('does not revive a curated Mistral model after a successful zero-FIM catalog', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn(url => {
      const target = String(url || '');
      if (target.includes('api.mistral.ai/v1/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{
              id: 'mistral-chat-only',
              name: 'Mistral Chat Only',
              capabilities: { completion_fim: false }
            }]
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

    providerSelect.value = 'mistral';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(modelPicker?.textContent || '').toContain('codestral-latest');
    keyInput.value = 'mistral-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded 0 completion models'));

    expect(modelPicker.value).toBe('');
    expect(modelPicker?.textContent || '').toBe('No completion models found');
    expect(modelPicker?.textContent || '').not.toContain('codestral-latest');
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

  test('keeps API key, endpoint, and model values separate per provider', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const endpointInput = appWindow.querySelector('.openrouter-endpoint');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Fireworks') && modelPicker.value);
    endpointInput.value = 'https://proxy.example/fireworks/completions';
    modelPicker.value = 'accounts/fireworks/models/minimax-m2p5';
    modelPicker.dispatchEvent(new window.Event('change', { bubbles: true }));

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'together-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Together') && modelPicker.value);
    endpointInput.value = 'https://proxy.example/together/completions';
    modelPicker.value = 'example/together-base';
    modelPicker.dispatchEvent(new window.Event('change', { bubbles: true }));

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(keyInput.value).toBe('fw-key');
    expect(endpointInput.value).toBe('https://proxy.example/fireworks/completions');
    expect(modelPicker.value).toBe('accounts/fireworks/models/minimax-m2p5');

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(keyInput.value).toBe('together-key');
    expect(endpointInput.value).toBe('https://proxy.example/together/completions');
    expect(modelPicker.value).toBe('example/together-base');
  });

  test('ignores stale provider model responses when switching providers quickly', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn(url => {
      const target = String(url || '');
      if (target.includes('api.fireworks.ai/v1/accounts/fireworks/models')) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                models: [
                  {
                    name: 'accounts/fireworks/models/fw-stale',
                    displayName: 'Fireworks Stale',
                    contextLength: 123,
                    supportsServerless: true,
                    baseModelDetails: { modelType: 'text' }
                  }
                ]
              })
            });
          }, 80);
        });
      }
      if (target.includes('api.together.ai/v1/models')) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ([{
                id: 'example/together-fresh',
                display_name: 'Together Fresh',
                context_length: 456,
                type: 'language'
              }])
            });
          }, 10);
        });
      }
      if (target.includes('/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'gen-test-race',
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
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const modelPicker = appWindow.querySelector('.openrouter-model-picker');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-race-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = 'together-race-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 140));

    expect(providerSelect.value).toBe('together');
    expect(status.textContent || '').toContain('Together');
    expect(modelPicker?.textContent || '').toContain('example/together-fresh');
    expect(modelPicker?.textContent || '').not.toContain('accounts/fireworks/models/fw-stale');
  });

  test('preserves stop sequence leading and trailing spaces in completions payload', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const stopInput = appWindow.querySelector('.openrouter-stop');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const status = appWindow.querySelector('.openrouter-status');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    promptInput.value = 'continue';
    stopInput.value = ' END\nEND ';
    sendButton.click();
    await flush();
    await flush();

    const completionCall = window.fetch.mock.calls.find(call =>
      String(call[0] || '').includes('fireworks.ai/inference/v1/completions')
    );
    expect(completionCall).toBeDefined();
    const payload = JSON.parse(completionCall[1].body);
    expect(payload.stop).toEqual([' END', 'END ']);
  });

  test.each([
    {
      provider: 'fireworks',
      endpoint: 'https://api.fireworks.ai/inference/v1/completions'
    },
    {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/completions'
    },
    {
      provider: 'deepinfra',
      endpoint: 'https://api.deepinfra.com/v1/openai/completions'
    }
  ])('validates $provider four-stop limit before sending', async providerCase => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const keyInput = appWindow.querySelector('.openrouter-api-key');
    const promptInput = appWindow.querySelector('.openrouter-prompt');
    const stopInput = appWindow.querySelector('.openrouter-stop');
    const status = appWindow.querySelector('.openrouter-status');

    providerSelect.value = providerCase.provider;
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    keyInput.value = `${providerCase.provider}-test-key`;
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));
    promptInput.value = 'continue';
    stopInput.value = 'one\ntwo\nthree\nfour\nfive';
    appWindow.querySelector('.openrouter-send').click();
    await flush();

    expect(status.textContent).toContain('at most 4 stop sequences');
    expect(window.fetch.mock.calls.filter(call =>
      String(call[0] || '') === providerCase.endpoint
    )).toHaveLength(0);
  });

  test('accepts successful empty completion text when stop sequences halt immediately', async () => {
    const { window, clipboardWrites } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('api.fireworks.ai/v1/accounts/fireworks/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            models: [
              {
                name: 'accounts/fireworks/models/empty-stop-model',
                displayName: 'Empty Stop Model',
                supportsServerless: true,
                baseModelDetails: { modelType: 'text' }
              }
            ]
          })
        });
      }
      if (target.includes('fireworks.ai/inference/v1/completions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'fw-empty-stop',
            choices: [{ text: '' }],
            usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3, cost: 0 }
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
    const stopInput = appWindow.querySelector('.openrouter-stop');
    const sendButton = appWindow.querySelector('.openrouter-send');
    const output = appWindow.querySelector('.openrouter-output-text');
    const status = appWindow.querySelector('.openrouter-status');
    const copyButton = appWindow.querySelector('.openrouter-copy-output');

    keyInput.value = 'fw-test-key';
    keyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    promptInput.value = 'STOP';
    stopInput.value = 'STOP';
    sendButton.click();
    await waitFor(() => (status.textContent || '').includes('Completed.'));

    expect(output.textContent).toBe('');
    expect(status.textContent).toContain('Output tokens (billed output): 0');
    expect(status.textContent).not.toContain('chat-style response');

    copyButton.click();
    await flush();
    expect(clipboardWrites[clipboardWrites.length - 1]).toBe('');
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
    const catalogCallsBeforeRestore = window.fetch.mock.calls.filter(call =>
      String(call[0] || '').includes('api.fireworks.ai/v1/accounts/fireworks/models')
    ).length;

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
    expect(window.fetch.mock.calls.filter(call =>
      String(call[0] || '').includes('api.fireworks.ai/v1/accounts/fireworks/models')
    ).length).toBe(catalogCallsBeforeRestore);
  });

  test('encrypted settings persist separate API keys across provider adapters', async () => {
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

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    apiKeyInput.value = 'together-key-persisted';
    apiKeyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('Loaded'));

    providerSelect.value = 'deepinfra';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    apiKeyInput.value = 'deepinfra-key-persisted';
    apiKeyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() =>
      (status.textContent || '').includes('DeepInfra') &&
      (status.textContent || '').includes('Loaded')
    );

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
    await waitFor(() =>
      providerSelect.value === 'deepinfra' && apiKeyInput.value === 'deepinfra-key-persisted'
    );

    expect(providerSelect.value).toBe('deepinfra');
    expect(apiKeyInput.value).toBe('deepinfra-key-persisted');

    providerSelect.value = 'fireworks';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(apiKeyInput.value).toBe('fw-key-persisted');

    providerSelect.value = 'together';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(apiKeyInput.value).toBe('together-key-persisted');

    providerSelect.value = 'deepinfra';
    providerSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(apiKeyInput.value).toBe('deepinfra-key-persisted');
  });

  test('encrypted settings save reports cancellation when password prompt is dismissed', async () => {
    const { window, downloads } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const status = appWindow.querySelector('.openrouter-status');

    window.prompt.mockReturnValueOnce(null);
    await clickOpenRouterFileAction(window, appWindow, 'save-settings');
    await flush();

    expect(status.textContent).toContain('Encrypted save cancelled.');
    expect(downloads.length).toBe(0);
  });

  test('encrypted settings load surfaces wrong-password errors and keeps current values', async () => {
    const { window, downloadedBlobs, downloads } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');

    const apiKeyInput = appWindow.querySelector('.openrouter-api-key');
    const titleInput = appWindow.querySelector('.openrouter-title');
    const loadFileInput = appWindow.querySelector('.openrouter-load-settings-file');
    const status = appWindow.querySelector('.openrouter-status');

    apiKeyInput.value = 'secret-key-before-save';
    titleInput.value = 'Saved Title';

    window.prompt.mockReturnValueOnce('correct-password');
    await clickOpenRouterFileAction(window, appWindow, 'save-settings');
    await waitFor(() => downloads.length > 0);
    expect(downloadedBlobs.length).toBeGreaterThan(0);
    const encryptedRaw = await blobToText(window, downloadedBlobs[downloadedBlobs.length - 1]);

    apiKeyInput.value = '';
    titleInput.value = '';
    window.prompt.mockReturnValueOnce('wrong-password');
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
    await waitFor(() => (status.textContent || '').includes('Invalid password or corrupted encrypted settings.'));

    expect(status.textContent).toContain('Invalid password or corrupted encrypted settings.');
    expect(apiKeyInput.value).toBe('');
    expect(titleInput.value).toBe('');
  });

  test('rejects a decrypted settings file belonging to another product before mutation', async () => {
    const { window } = setupDom();
    window.document.querySelector('.menu-item[data-window="openrouter"]').click();
    const appWindow = window.document.querySelector('.openrouter-window:not(.window-template)');
    const providerSelect = appWindow.querySelector('.openrouter-provider');
    const apiKeyInput = appWindow.querySelector('.openrouter-api-key');
    const titleInput = appWindow.querySelector('.openrouter-title');
    const loadFileInput = appWindow.querySelector('.openrouter-load-settings-file');
    const status = appWindow.querySelector('.openrouter-status');

    apiKeyInput.value = 'keep-current-key';
    titleInput.value = 'Keep Current Title';
    const foreignPayload = await window.YolkEncryptedSettings.encrypt('schema-password', {
      kind: 'yolk-terminal-settings',
      version: 1,
      provider: 'fireworks',
      apiKeys: {},
      endpoints: {},
      models: {}
    });
    window.prompt.mockReturnValueOnce('schema-password');
    await clickOpenRouterFileAction(window, appWindow, 'load-settings');
    const foreignFile = new window.File(
      [JSON.stringify(foreignPayload)],
      'terminal-encrypted-settings.json',
      { type: 'application/json' }
    );
    Object.defineProperty(loadFileInput, 'files', {
      value: [foreignFile],
      configurable: true
    });
    loadFileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => (status.textContent || '').includes('not a supported Completion API'));

    expect(providerSelect.value).toBe('fireworks');
    expect(apiKeyInput.value).toBe('keep-current-key');
    expect(titleInput.value).toBe('Keep Current Title');
  });

  test('filters out models that require mandatory reasoning after first failure', async () => {
    const { window } = setupDom();
    window.fetch = jest.fn((url, init) => {
      const target = String(url || '');
      if (target.includes('api.fireworks.ai/v1/accounts/fireworks/models')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            models: [
              {
                name: 'minimax/minimax-m1',
                displayName: 'MiniMax M1',
                contextLength: 1000000,
                supportsServerless: true,
                baseModelDetails: { modelType: 'text' }
              },
              {
                name: 'accounts/fireworks/models/minimax-m2p5',
                displayName: 'MiniMax M2.5',
                contextLength: 131072,
                supportsServerless: true,
                baseModelDetails: { modelType: 'text' }
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

  test('blocks chat, Responses, Messages, relative, and non-HTTP endpoints', async () => {
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
    promptInput.value = 'autocomplete me';
    const rejectedEndpoints = [
      'https://api.fireworks.ai/inference/v1/chat/completions',
      'https://api.openai.com/v1/responses',
      'https://api.anthropic.com/v1/messages',
      '/v1/completions',
      'ftp://proxy.example/v1/completions'
    ];
    for (const endpoint of rejectedEndpoints) {
      endpointInput.value = endpoint;
      sendButton.click();
      await flush();
      expect(status.textContent).toContain('completions-only');
    }

    const postCalls = window.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});

registerDomCleanup();
