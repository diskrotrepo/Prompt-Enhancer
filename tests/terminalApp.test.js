/** @jest-environment node */

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { createDom, registerDomCleanup } = require('./helpers/dom');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', 'index.html');
const SCRIPT_PATH = path.join(ROOT, 'src', 'script.js');
const ENCRYPTED_SETTINGS_PATH = path.join(ROOT, 'src', 'apps', 'shared', 'encrypted-settings.js');
const TERMINAL_APP_PATH = path.join(ROOT, 'src', 'apps', 'terminal', 'app.js');

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function blobToText(window, blob) {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob text'));
    reader.readAsText(blob);
  });
}

async function clickTerminalFileAction(terminalWindow, action) {
  terminalWindow.querySelector('.terminal-menu-start').click();
  await flush();
  terminalWindow
    .querySelector(`.terminal-menu-dropdown .prompt-menu-item[data-action="${action}"]`)
    ?.click();
  await flush();
}

async function waitFor(predicate, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    const result = predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return null;
}

function jsonResponse(payload) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => payload
  });
}

function modelCatalogPayload(url) {
  const href = String(url || '');
  if (href.startsWith('https://openrouter.ai/api/v1/models')) {
    return {
      data: [
        { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', supported_parameters: ['tools'] },
        { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', supported_parameters: ['tools'] },
        { id: 'openrouter/auto', name: 'Auto Router', supported_parameters: ['tools'] },
        { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', supported_parameters: ['tools'] },
        { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', supported_parameters: ['tools'] }
      ]
    };
  }
  if (href === 'https://api.deepseek.com/models') {
    return { data: [{ id: 'deepseek-v4-pro' }, { id: 'deepseek-v4-flash' }] };
  }
  if (href === 'https://api.openai.com/v1/models') {
    return {
      data: [
        { id: 'gpt-5.6-sol' },
        { id: 'gpt-5.6-terra' },
        { id: 'gpt-5.6-luna' },
        { id: 'whisper-1' }
      ]
    };
  }
  if (href.startsWith('https://api.anthropic.com/v1/models')) {
    return {
      data: [
        { id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' },
        { id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5' },
        { id: 'claude-fable-5', display_name: 'Claude Fable 5' },
        { id: 'claude-opus-4-8', display_name: 'Claude Opus 4.8' }
      ]
    };
  }
  if (href === 'https://api.mistral.ai/v1/models') {
    return {
      data: [
        { id: 'mistral-small-latest', capabilities: { completion_chat: true, function_calling: true } },
        { id: 'mistral-large-latest', capabilities: { completion_chat: true, function_calling: true } }
      ]
    };
  }
  if (href === 'https://api.fireworks.ai/inference/v1/models') {
    return { data: [{ id: 'accounts/fireworks/models/kimi-k2-instruct-0905' }] };
  }
  if (href === 'https://api.together.ai/v1/models') {
    return [{ id: 'Qwen/Qwen3.5-9B' }, { id: 'moonshotai/Kimi-K2.5' }];
  }
  return null;
}

function isCatalogRequest(url, options = {}) {
  return String(options.method || 'GET').toUpperCase() === 'GET' && modelCatalogPayload(url) !== null;
}

function installFakeAudio(window) {
  const log = {
    filters: [],
    oscillatorStarts: [],
    oscillatorStops: [],
    ramps: [],
    resumes: 0
  };
  class FakeParam {
    constructor(value = 0) {
      this.value = value;
    }

    cancelScheduledValues() {}

    setValueAtTime(value, time) {
      this.value = value;
      log.ramps.push({ method: 'set', value, time });
    }

    linearRampToValueAtTime(value, time) {
      this.value = value;
      log.ramps.push({ method: 'linear', value, time });
    }

    exponentialRampToValueAtTime(value, time) {
      this.value = value;
      log.ramps.push({ method: 'exponential', value, time });
    }
  }
  class FakeNode {
    connect(target) {
      return target;
    }
  }
  class FakeOscillator extends FakeNode {
    constructor() {
      super();
      this.type = 'sine';
      this.frequency = new FakeParam();
      this.detune = new FakeParam();
    }

    start(time) {
      log.oscillatorStarts.push({ type: this.type, time });
    }

    stop(time) {
      log.oscillatorStops.push({ type: this.type, time });
    }
  }
  class FakeAudioContext {
    constructor() {
      this.currentTime = 1;
      this.destination = new FakeNode();
      this.state = 'running';
    }

    resume() {
      log.resumes += 1;
      return Promise.resolve();
    }

    createOscillator() {
      return new FakeOscillator();
    }

    createGain() {
      const node = new FakeNode();
      node.gain = new FakeParam();
      return node;
    }

    createBiquadFilter() {
      const node = new FakeNode();
      node.type = 'allpass';
      node.frequency = new FakeParam();
      node.Q = new FakeParam();
      log.filters.push(node);
      return node;
    }
  }
  window.AudioContext = FakeAudioContext;
  return log;
}

function setupDom() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = createDom(html, { runScripts: 'dangerously', url: 'http://localhost' });
  const { window } = dom;
  window.alert = () => {};
  window.prompt = jest.fn(() => 'test-password');
  try {
    window.crypto = webcrypto;
  } catch (err) {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  }
  if (!window.crypto.getRandomValues) {
    window.crypto.getRandomValues = (...args) => webcrypto.getRandomValues(...args);
  }
  if (!window.crypto.subtle) window.crypto.subtle = webcrypto.subtle;
  const downloadedBlobs = [];
  const downloads = [];
  window.URL.createObjectURL = jest.fn(blob => {
    downloadedBlobs.push(blob);
    return `blob:terminal-${downloadedBlobs.length}`;
  });
  window.URL.revokeObjectURL = jest.fn();
  const originalCreate = window.document.createElement.bind(window.document);
  window.document.createElement = tagName => {
    const element = originalCreate(tagName);
    if (String(tagName).toLowerCase() === 'a') {
      element.click = () => downloads.push({ download: element.download, href: element.href });
    }
    return element;
  };
  window.__terminalTestDownloads = { downloadedBlobs, downloads };
  window.fetch = jest.fn((url, options = {}) => {
    if (isCatalogRequest(url, options)) return jsonResponse(modelCatalogPayload(url));
    return jsonResponse({ choices: [{ message: { content: 'Ready.' } }] });
  });
  window.eval(fs.readFileSync(ENCRYPTED_SETTINGS_PATH, 'utf8'));
  window.eval(fs.readFileSync(TERMINAL_APP_PATH, 'utf8'));
  window.eval(fs.readFileSync(SCRIPT_PATH, 'utf8'));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  return window;
}

function openTerminal(window) {
  window.document.querySelector('.menu-item[data-window="terminal"]').click();
  return window.document.querySelector('.terminal-window:not(.window-template)');
}

function pressEnter(input) {
  const KeyboardEvent = input.ownerDocument.defaultView.KeyboardEvent;
  input.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true
  }));
}

function submitTerminalText(terminalWindow, value) {
  const input = terminalWindow.querySelector('.terminal-message');
  input.value = value;
  pressEnter(input);
}

function submitTerminalSecret(terminalWindow, value) {
  const input = terminalWindow.querySelector('.terminal-secret-input');
  input.value = value;
  pressEnter(input);
}

describe('Terminal app module', () => {
  test('queues a plain-language request through guided OpenRouter setup and runs its tool loop', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    expect(terminalWindow).not.toBeNull();
    expect(terminalWindow.querySelector('.terminal-surface')).not.toBeNull();
    expect(terminalWindow.querySelector('.terminal-connection-panel')).toBeNull();
    expect(terminalWindow.querySelector('select')).toBeNull();
    expect(terminalWindow.querySelectorAll('.terminal-app button')).toHaveLength(1);
    expect(terminalWindow.querySelector('.terminal-menu-start')).not.toBeNull();
    expect(terminalWindow.querySelector('.terminal-app .help-toggle')).toBeNull();
    expect(terminalWindow.querySelector('.terminal-send')).toBeNull();
    expect(terminalWindow.querySelector('.terminal-session-readout')).toBeNull();
    expect(terminalWindow.querySelector('.terminal-app').dataset.setupStage).toBe('provider');
    const openingTranscript = terminalWindow.querySelector('.terminal-transcript').textContent;
    expect(openingTranscript).toContain('Choose a provider:');
    expect(openingTranscript).not.toMatch(/SECURITY>|tools ·|docs ·|harness|browser-only/i);

    let requestNumber = 0;
    window.fetch.mockImplementation((url, options = {}) => {
      if (isCatalogRequest(url, options)) return jsonResponse(modelCatalogPayload(url));
      requestNumber += 1;
      if (requestNumber === 1) {
        return jsonResponse({
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call-open-prompts',
                type: 'function',
                function: {
                  name: 'desktop_open_application',
                  arguments: JSON.stringify({ application: 'prompts' })
                }
              }]
            }
          }],
          usage: { prompt_tokens: 25, completion_tokens: 8, total_tokens: 33 }
        });
      }
      return jsonResponse({
        choices: [{ message: { role: 'assistant', content: 'Prompt Enhancer is open.' } }],
        usage: { prompt_tokens: 40, completion_tokens: 7, total_tokens: 47 }
      });
    });

    // The task may come first: Terminal holds it, completes guided setup,
    // and automatically resumes without asking the user to type it again.
    submitTerminalText(terminalWindow, 'Open Prompt Enhancer for me.');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Choose a provider to continue:');
    submitTerminalText(terminalWindow, 'OpenRouter');
    expect(terminalWindow.querySelector('.terminal-app').dataset.setupStage).toBe('key');
    expect(terminalWindow.querySelector('.terminal-message').hidden).toBe(true);
    expect(terminalWindow.querySelector('.terminal-secret-input').hidden).toBe(false);
    submitTerminalSecret(terminalWindow, 'or-test-key-1234');
    await waitFor(() => terminalWindow.querySelector('.terminal-app').dataset.setupStage === 'model');
    const modelTranscript = terminalWindow.querySelector('.terminal-transcript').textContent;
    expect(modelTranscript.indexOf('DeepSeek V4 Flash')).toBeLessThan(modelTranscript.indexOf('GPT-5.6 Luna'));
    expect(modelTranscript.indexOf('GPT-5.6 Luna')).toBeLessThan(modelTranscript.indexOf('Auto Router'));
    expect(modelTranscript).toContain('recommended');
    submitTerminalText(terminalWindow, '1');

    await waitFor(() => terminalWindow.querySelector('.terminal-status').textContent === 'Done.');
    expect(window.fetch).toHaveBeenCalledTimes(3);
    const catalogCall = window.fetch.mock.calls.find(call => call[1]?.method === 'GET');
    const postCalls = window.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
    const firstBody = JSON.parse(postCalls[0][1].body);
    const secondBody = JSON.parse(postCalls[1][1].body);
    expect(catalogCall[0]).toContain('https://openrouter.ai/api/v1/models?');
    expect(catalogCall[1].headers.Authorization).toBe('Bearer or-test-key-1234');
    expect(postCalls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(postCalls[0][1].headers.Authorization).toBe('Bearer or-test-key-1234');
    expect(firstBody.model).toBe('deepseek/deepseek-v4-flash');
    expect(firstBody.messages[0].role).toBe('system');
    expect(firstBody.messages[0].content).toContain('Keep implementation instructions');
    expect(firstBody.messages[0].content).not.toContain('Completion API is the separate raw prompt/FIM surface');
    expect(firstBody.tools.map(tool => tool.function.name)).toContain('desktop_open_application');
    expect(secondBody.messages.some(message =>
      message.role === 'tool' && message.tool_call_id === 'call-open-prompts'
    )).toBe(true);
    expect(window.document.querySelectorAll('.app-window[data-window="prompts"]:not(.window-template)')).toHaveLength(1);
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Prompt Enhancer is open.');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain('desktop_open_application');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain('CALL');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain('TOOL');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain('or-test-key-1234');
    expect(terminalWindow.querySelector('.terminal-face').dataset.emote).toBe('happy');
    expect(terminalWindow.querySelector('.terminal-app').dataset.provider).toBe('openrouter');
    expect(terminalWindow.querySelector('.terminal-app').dataset.model).toBe('deepseek/deepseek-v4-flash');
    expect(terminalWindow.querySelector('.terminal-app').dataset.modelCatalog).toBe('live');
    expect(terminalWindow.querySelector('.terminal-app').dataset.connectionReady).toBe('true');

    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    submitTerminalText(terminalWindow, '/copy');
    await waitFor(() => writeText.mock.calls.length === 1);
    expect(writeText).toHaveBeenCalledWith('Prompt Enhancer is open.');
  });

  test('keeps DeepSeek setup in the correct decision state until a complete key is entered', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    const root = terminalWindow.querySelector('.terminal-app');
    const messageInput = terminalWindow.querySelector('.terminal-message');
    const secretInput = terminalWindow.querySelector('.terminal-secret-input');

    expect(root.dataset.keyValidation).toBe('required');
    expect(root.dataset.modelSelection).toBe('required');
    submitTerminalText(terminalWindow, 'DeepSeek API');
    expect(root.dataset.provider).toBe('deepseek');
    expect(root.dataset.setupStage).toBe('key');

    // A numbered menu choice is not a credential. It stays masked, is never
    // echoed, and cannot move the local configuration into its ready state.
    const visibleUserLineCount = terminalWindow.querySelectorAll(
      '.terminal-line-user .terminal-line-body'
    ).length;
    submitTerminalSecret(terminalWindow, '1');
    expect(root.dataset.setupStage).toBe('key');
    expect(root.dataset.connectionReady).toBe('false');
    expect(secretInput.hidden).toBe(false);
    expect(window.fetch).not.toHaveBeenCalled();
    expect(terminalWindow.querySelector('.terminal-status').textContent).toBe('A complete API key is required.');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain(
      "That doesn't look like a complete DeepSeek API key."
    );
    expect(terminalWindow.querySelectorAll('.terminal-line-user .terminal-line-body')).toHaveLength(
      visibleUserLineCount
    );

    // `/providers` is a state transition, not a decorative printout. The next
    // number is now consumed by the provider selector, including range errors.
    submitTerminalSecret(terminalWindow, '/providers');
    expect(root.dataset.setupStage).toBe('provider');
    expect(messageInput.hidden).toBe(false);
    expect(secretInput.hidden).toBe(true);
    submitTerminalText(terminalWindow, '10');
    expect(root.dataset.setupStage).toBe('provider');
    expect(terminalWindow.querySelector('.terminal-status').textContent).toBe(
      'That provider number is not in the list.'
    );
    submitTerminalText(terminalWindow, '2');
    expect(root.dataset.provider).toBe('deepseek');
    expect(root.dataset.setupStage).toBe('key');

    submitTerminalSecret(terminalWindow, 'sk-deepseek-terminal-test-123456');
    await waitFor(() => root.dataset.setupStage === 'model');
    expect(root.dataset.modelCatalog).toBe('live');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain(
      '1. DeepSeek V4 Flash'
    );
    submitTerminalText(terminalWindow, '1');
    expect(root.dataset.setupStage).toBe('ready');
    expect(root.dataset.connectionReady).toBe('true');
    expect(terminalWindow.querySelector('.terminal-status').textContent).toBe('Ready with DeepSeek.');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain(
      'Ready. What would you like to do?'
    );
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain(
      'Connected. What would you like to do?'
    );
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain(
      'sk-deepseek-terminal-test-123456'
    );
  });

  test('returns a rejected catalog credential to the masked key step', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    const root = terminalWindow.querySelector('.terminal-app');
    window.fetch.mockImplementation((url, options = {}) => {
      if (isCatalogRequest(url, options)) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'invalid key' } })
        });
      }
      return jsonResponse({ choices: [{ message: { content: 'unused' } }] });
    });

    submitTerminalText(terminalWindow, 'DeepSeek');
    submitTerminalSecret(terminalWindow, 'sk-deepseek-rejected-key');
    await waitFor(() => terminalWindow.querySelector('.terminal-transcript').textContent.includes(
      'That API key was not accepted.'
    ));

    expect(root.dataset.setupStage).toBe('key');
    expect(root.dataset.connectionReady).toBe('false');
    expect(root.dataset.modelCatalog).toBe('fallback');
    expect(terminalWindow.querySelector('.terminal-secret-input').hidden).toBe(false);
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).not.toContain(
      'sk-deepseek-rejected-key'
    );
  });

  test('keeps the key and offers economical fallbacks when live discovery is unavailable', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    const root = terminalWindow.querySelector('.terminal-app');
    window.fetch.mockImplementation((url, options = {}) => {
      if (isCatalogRequest(url, options)) return Promise.reject(new Error('network unavailable'));
      return jsonResponse({ choices: [{ message: { content: 'Ready.' } }] });
    });

    submitTerminalText(terminalWindow, 'OpenRouter');
    submitTerminalSecret(terminalWindow, 'or-fallback-test-key');
    await waitFor(() => root.dataset.setupStage === 'model');

    const transcript = terminalWindow.querySelector('.terminal-transcript').textContent;
    expect(root.dataset.modelCatalog).toBe('fallback');
    expect(transcript).toContain('I couldn’t refresh the live list');
    expect(transcript.indexOf('DeepSeek V4 Flash')).toBeLessThan(transcript.indexOf('GPT-5.6 Luna'));
    expect(transcript).not.toContain('GPT-5.6 Sol');
    expect(transcript).not.toContain('Claude Sonnet 5');
    submitTerminalText(terminalWindow, '1');
    expect(root.dataset.model).toBe('deepseek/deepseek-v4-flash');
    expect(root.dataset.connectionReady).toBe('true');
  });

  test('confirms a close model typo and ranks several matches for a broad search', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    const root = terminalWindow.querySelector('.terminal-app');

    submitTerminalText(terminalWindow, 'Anthropic');
    expect(root.dataset.setupStage).toBe('key');
    submitTerminalSecret(terminalWindow, 'anthropic-model-search-key');
    await waitFor(() => root.dataset.setupStage === 'model');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Claude Sonnet 5');
    submitTerminalText(terminalWindow, 'sonet');
    expect(root.dataset.setupStage).toBe('model-confirm');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain(
      'Did you mean Claude Sonnet 5  ·  claude-sonnet-5?'
    );
    submitTerminalText(terminalWindow, '1');
    expect(root.dataset.model).toBe('claude-sonnet-5');
    expect(root.dataset.setupStage).toBe('ready');

    submitTerminalText(terminalWindow, '/providers');
    submitTerminalText(terminalWindow, 'OpenAI');
    expect(root.dataset.setupStage).toBe('key');
    submitTerminalSecret(terminalWindow, 'openai-model-search-key');
    await waitFor(() => root.dataset.setupStage === 'model');
    submitTerminalText(terminalWindow, 'gpt');
    expect(root.dataset.setupStage).toBe('model-match');
    const transcript = terminalWindow.querySelector('.terminal-transcript').textContent;
    expect(transcript).toContain('Closest matches for "gpt":');
    expect(transcript).toContain('GPT-5.6 Sol');
    expect(transcript).toContain('GPT-5.6 Terra');
    expect(transcript).toContain('GPT-5.6 Luna');
    expect(transcript).toContain('Use "gpt" exactly');
    submitTerminalText(terminalWindow, '2');
    expect(root.dataset.model).toBe('gpt-5.6-terra');
    expect(root.dataset.setupStage).toBe('ready');
  });

  test('saves and restores provider models and API keys through the encrypted File menu', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    const root = terminalWindow.querySelector('.terminal-app');
    const status = terminalWindow.querySelector('.terminal-status');
    const loadFileInput = terminalWindow.querySelector('.terminal-load-settings-file');
    const { downloadedBlobs, downloads } = window.__terminalTestDownloads;

    expect(terminalWindow.querySelector('.terminal-file-menu')).not.toBeNull();
    expect(terminalWindow.querySelector('.terminal-app .help-toggle')).toBeNull();
    submitTerminalText(terminalWindow, 'DeepSeek');
    expect(root.dataset.setupStage).toBe('key');
    submitTerminalSecret(terminalWindow, 'sk-deepseek-saved-terminal-key');
    await waitFor(() => root.dataset.setupStage === 'model');
    submitTerminalText(terminalWindow, 'flash');
    expect(root.dataset.model).toBe('deepseek-v4-flash');
    expect(root.dataset.connectionReady).toBe('true');
    const catalogCallCount = window.fetch.mock.calls.filter(call => call[1]?.method === 'GET').length;

    window.prompt.mockReturnValue('terminal-file-password');
    await clickTerminalFileAction(terminalWindow, 'save-settings');
    await waitFor(() => downloads.length === 1);
    expect(downloads[0].download).toBe('yolk-terminal-encrypted-settings.json');
    const encryptedRaw = await blobToText(window, downloadedBlobs[0]);
    expect(encryptedRaw).not.toContain('sk-deepseek-saved-terminal-key');
    expect(encryptedRaw).not.toContain('deepseek-v4-flash');
    expect(encryptedRaw).not.toContain('deepseek');

    submitTerminalText(terminalWindow, '/disconnect');
    expect(root.dataset.connectionReady).toBe('false');
    await clickTerminalFileAction(terminalWindow, 'load-settings');
    const encryptedFile = new window.File(
      [encryptedRaw],
      'yolk-terminal-encrypted-settings.json',
      { type: 'application/json' }
    );
    Object.defineProperty(loadFileInput, 'files', {
      value: [encryptedFile],
      configurable: true
    });
    loadFileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await waitFor(() => status.textContent === 'Encrypted settings loaded from file.');

    expect(root.dataset.provider).toBe('deepseek');
    expect(root.dataset.model).toBe('deepseek-v4-flash');
    expect(root.dataset.connectionReady).toBe('true');
    expect(root.dataset.setupStage).toBe('ready');
    expect(window.fetch.mock.calls.filter(call => call[1]?.method === 'GET')).toHaveLength(catalogCallCount);
    submitTerminalText(terminalWindow, 'Say hello.');
    await waitFor(() => status.textContent === 'Done.');
    const agentCall = window.fetch.mock.calls.find(call => call[1]?.method === 'POST');
    expect(agentCall[1].headers.Authorization).toBe(
      'Bearer sk-deepseek-saved-terminal-key'
    );
    expect(JSON.parse(agentCall[1].body).model).toBe('deepseek-v4-flash');
  });

  test('pairs assistant copy with text-shaped mouth frames and an optional nonverbal murmur', () => {
    const window = setupDom();
    const audioLog = installFakeAudio(window);
    const terminalWindow = openTerminal(window);
    const root = terminalWindow.querySelector('.terminal-app');
    const face = terminalWindow.querySelector('.terminal-face');
    const art = terminalWindow.querySelector('.terminal-face-art');
    const vector = terminalWindow.querySelector('.terminal-face-vector');
    const frame = terminalWindow.querySelector('.terminal-face-frame');
    const leftEye = terminalWindow.querySelector('.terminal-face-eye-left');
    const mouth = terminalWindow.querySelector('.terminal-face-mouth');
    const rightEye = terminalWindow.querySelector('.terminal-face-eye-right');
    const expectedEmotes = {
      idle: '[ ._. ]',
      smile: '[ ^_^ ]',
      happy: '[ ^v^ ]',
      thinking: '[ o~o ]',
      surprised: '[ OoO ]',
      sad: '[ ;_; ]',
      cry: '[ T_T ]',
      sinister: '[ >v- ]'
    };
    const expectedStaticMouthPaths = {
      _: 'M 38.5 12 H 45.5',
      v: 'M 38.8 10 L 42 14 L 45.2 10',
      '~': 'M 38.5 12 Q 40.25 9.8 42 12 T 45.5 12',
      o: 'M 39.8 12 A 2.2 2.2 0 1 0 44.2 12 A 2.2 2.2 0 1 0 39.8 12'
    };

    expect(root.dataset.soundEnabled).toBe('true');
    expect(face.dataset.speaking).toBe('true');
    expect(art.textContent).toMatch(/^\[ .+\. \]$/);
    expect(vector.getAttribute('viewBox')).toBe('0 0 84 20');
    expect(frame.getAttribute('d')).toBe('M 8 2 H 4 V 18 H 8 M 76 2 H 80 V 18 H 76');

    // The readable ASCII stays seven cells, while three separate vector paths
    // keep visible eyes and mouth off the font baseline. An explicit face
    // command cancels speech before applying the corresponding stable paths.
    Object.entries(expectedEmotes).forEach(([emote, expectedArt]) => {
      submitTerminalText(terminalWindow, `/face ${emote}`);
      expect(face.dataset.emote).toBe(emote);
      expect(face.dataset.speaking).toBe('false');
      expect(art.textContent).toBe(expectedArt);
      expect(art.dataset.ascii).toBe(expectedArt);
      expect(art.textContent).toHaveLength(7);
      expect(leftEye.dataset.glyph).toBe(expectedArt[2]);
      expect(mouth.dataset.glyph).toBe(expectedArt[3]);
      expect(rightEye.dataset.glyph).toBe(expectedArt[4]);
      expect(leftEye.getAttribute('d')).toBeTruthy();
      expect(mouth.getAttribute('d')).toBe(expectedStaticMouthPaths[expectedArt[3]]);
      expect(rightEye.getAttribute('d')).toBeTruthy();
      expect(frame.getAttribute('d')).toBe('M 8 2 H 4 V 18 H 8 M 76 2 H 80 V 18 H 76');
    });

    const css = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');
    const faceCss = css.slice(css.indexOf('.terminal-face {'), css.indexOf('.terminal-transcript {'));
    expect(faceCss).toContain('inline-size: 7.5ch;');
    expect(faceCss).not.toContain('terminal-mouth-flick');
    expect(faceCss).not.toMatch(/(^|[\s{;])transform\s*:/m);

    // Enter unlocks Web Audio, then the next assistant setup line supplies a
    // deterministic vowel-shaped face plan and quiet filtered oscillator pair.
    submitTerminalText(terminalWindow, 'OpenRouter');
    expect(root.dataset.setupStage).toBe('key');
    expect(root.dataset.soundAvailable).toBe('true');
    expect(face.dataset.speaking).toBe('true');
    expect(face.dataset.mouth).toMatch(/^[Oo~_-]$/);
    expect(mouth.dataset.glyph).toBe(face.dataset.mouth);
    expect(mouth.getAttribute('d')).toContain('12');
    expect(audioLog.oscillatorStarts.map(entry => entry.type)).toEqual(['triangle', 'square']);
    expect(audioLog.filters[0].type).toBe('lowpass');
    expect(audioLog.ramps.some(entry =>
      entry.method === 'linear' && Math.abs(entry.value - 0.026) < 0.0001
    )).toBe(true);
    expect(audioLog.ramps.filter(entry =>
      entry.method === 'linear' && Math.abs(entry.value - 0.026) < 0.0001
    ).length).toBeLessThanOrEqual(18);
    expect(fs.readFileSync(TERMINAL_APP_PATH, 'utf8')).not.toContain('speechSynthesis');

    submitTerminalSecret(terminalWindow, '/sound off');
    expect(root.dataset.soundEnabled).toBe('false');
    expect(audioLog.oscillatorStops.length).toBeGreaterThanOrEqual(4);
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Sound off.');

    submitTerminalSecret(terminalWindow, '/sound on');
    expect(root.dataset.soundEnabled).toBe('true');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Sound on.');
  });

  test('translates OpenAI Responses function calls and preserves response context', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);

    let requestNumber = 0;
    window.fetch.mockImplementation((url, options = {}) => {
      if (isCatalogRequest(url, options)) return jsonResponse(modelCatalogPayload(url));
      requestNumber += 1;
      if (requestNumber === 1) {
        return jsonResponse({
          id: 'resp-tool-1',
          output: [{
            type: 'function_call',
            call_id: 'face-call-1',
            name: 'terminal_set_face',
            arguments: JSON.stringify({ emote: 'sinister' })
          }]
        });
      }
      return jsonResponse({
        id: 'resp-final-2',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: 'A tiny grin, as requested.' }]
        }],
        usage: { input_tokens: 19, output_tokens: 6, total_tokens: 25 }
      });
    });

    submitTerminalText(terminalWindow, '/login openai');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('ChatGPT sign-in does not connect third-party apps');
    expect(terminalWindow.querySelector('.terminal-app').dataset.setupStage).toBe('key');
    submitTerminalSecret(terminalWindow, 'openai-test-key');
    await waitFor(() => terminalWindow.querySelector('.terminal-app').dataset.setupStage === 'model');
    submitTerminalText(terminalWindow, '1');
    submitTerminalText(terminalWindow, 'Give me your mischievous face.');

    await waitFor(() => terminalWindow.querySelector('.terminal-status').textContent === 'Done.');
    expect(window.fetch).toHaveBeenCalledTimes(3);
    const postCalls = window.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
    const firstBody = JSON.parse(postCalls[0][1].body);
    const secondBody = JSON.parse(postCalls[1][1].body);
    expect(postCalls[0][0]).toBe('https://api.openai.com/v1/responses');
    expect(firstBody.model).toBe('gpt-5.6-luna');
    expect(firstBody.input).toBe('Give me your mischievous face.');
    expect(firstBody.messages).toBeUndefined();
    expect(firstBody.tools.map(tool => tool.name)).toContain('terminal_set_face');
    expect(secondBody.previous_response_id).toBe('resp-tool-1');
    expect(secondBody.input).toEqual([expect.objectContaining({
      type: 'function_call_output',
      call_id: 'face-call-1'
    })]);
    expect(terminalWindow.querySelector('.terminal-face').dataset.emote).toBe('sinister');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('A tiny grin, as requested.');
  });

  test('uses Anthropic Messages headers and native tool_result content blocks', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    let requestNumber = 0;
    window.fetch.mockImplementation((url, options = {}) => {
      if (isCatalogRequest(url, options)) return jsonResponse(modelCatalogPayload(url));
      requestNumber += 1;
      if (requestNumber === 1) {
        return jsonResponse({
          id: 'msg-tool-1',
          role: 'assistant',
          stop_reason: 'tool_use',
          content: [{
            type: 'tool_use',
            id: 'toolu-face-1',
            name: 'terminal_set_face',
            input: { emote: 'surprised' }
          }],
          usage: { input_tokens: 20, output_tokens: 5 }
        });
      }
      return jsonResponse({
        id: 'msg-final-2',
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Claude is connected to the Yolk tools.' }],
        usage: { input_tokens: 32, output_tokens: 9 }
      });
    });

    submitTerminalText(terminalWindow, '/login anthropic');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Claude account sign-in does not connect third-party apps');
    submitTerminalSecret(terminalWindow, 'anthropic-test-key');
    await waitFor(() => terminalWindow.querySelector('.terminal-app').dataset.setupStage === 'model');
    submitTerminalText(terminalWindow, '3');
    submitTerminalText(terminalWindow, 'Look surprised and confirm the connection.');

    await waitFor(() => terminalWindow.querySelector('.terminal-status').textContent === 'Done.');
    expect(window.fetch).toHaveBeenCalledTimes(3);
    const postCalls = window.fetch.mock.calls.filter(call => call[1]?.method === 'POST');
    const firstRequest = postCalls[0];
    const firstBody = JSON.parse(firstRequest[1].body);
    const secondBody = JSON.parse(postCalls[1][1].body);
    expect(firstRequest[0]).toBe('https://api.anthropic.com/v1/messages');
    expect(firstRequest[1].headers['x-api-key']).toBe('anthropic-test-key');
    expect(firstRequest[1].headers['anthropic-version']).toBe('2023-06-01');
    expect(firstRequest[1].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(firstRequest[1].headers.Authorization).toBeUndefined();
    expect(firstBody.model).toBe('claude-sonnet-5');
    expect(firstBody.system).toContain('Yolk Terminal');
    expect(firstBody.messages).toEqual([{
      role: 'user',
      content: 'Look surprised and confirm the connection.'
    }]);
    expect(firstBody.tools).toContainEqual(expect.objectContaining({
      name: 'terminal_set_face',
      input_schema: expect.objectContaining({ type: 'object' })
    }));
    expect(secondBody.messages[1]).toEqual(expect.objectContaining({
      role: 'assistant',
      content: expect.arrayContaining([expect.objectContaining({ id: 'toolu-face-1' })])
    }));
    expect(secondBody.messages[2]).toEqual(expect.objectContaining({
      role: 'user',
      content: [expect.objectContaining({
        type: 'tool_result',
        tool_use_id: 'toolu-face-1'
      })]
    }));
    expect(terminalWindow.querySelector('.terminal-face').dataset.emote).toBe('surprised');
    expect(terminalWindow.querySelector('.terminal-transcript').textContent).toContain('Claude is connected to the Yolk tools.');
  });

  test('exposes Prompt Enhancer adapters and an empty-but-ready knowledge seam', async () => {
    const window = setupDom();
    const terminalWindow = openTerminal(window);
    const toolNames = window.YolkToolRegistry.list().map(tool => tool.name);
    expect(toolNames).toEqual(expect.arrayContaining([
      'desktop_list_applications',
      'desktop_open_application',
      'prompt_get_state',
      'prompt_replace_state',
      'prompt_generate',
      'prompt_read_outputs',
      'knowledge_search',
      'terminal_set_face'
    ]));
    expect(window.YolkDesktop.listApplications().map(app => app.key)).toContain('terminal');
    expect(window.YolkTerminalKnowledge.status()).toEqual({ documentCount: 0 });

    const replaceResult = await window.YolkToolRegistry.invoke('prompt_replace_state', {
      state: {
        mixes: [{
          type: 'mix',
          title: 'Terminal Mix',
          lengthMode: 'fit-smallest',
          preserve: true,
          children: [{
            type: 'chunk',
            title: 'Terminal String',
            text: 'hello from tools ',
            lengthMode: 'exact-once',
            orderMode: 'canonical',
            delimiter: { mode: 'whitespace', size: 1 }
          }]
        }]
      }
    });
    expect(replaceResult.ok).toBe(true);
    expect(replaceResult.instanceId).toBe('prompts-1');
    const generation = await window.YolkToolRegistry.invoke('prompt_generate', {
      instance_id: replaceResult.instanceId
    });
    expect(generation.ok).toBe(true);
    expect(generation.outputs.some(output => output.output === 'hello from tools ')).toBe(true);

    expect(window.YolkTerminalKnowledge.registerDocument({
      id: 'guide-1',
      title: 'Prompt Guide',
      text: 'Use canonical ordering when exact sequence matters.',
      tags: ['prompting']
    })).toBe(true);
    const search = await window.YolkToolRegistry.invoke('knowledge_search', {
      query: 'canonical sequence'
    });
    expect(search.documentCount).toBe(1);
    expect(search.results[0].id).toBe('guide-1');

    await window.YolkToolRegistry.invoke('terminal_set_face', { emote: 'cry' }, {
      terminalRoot: terminalWindow.querySelector('.terminal-app')
    });
    expect(terminalWindow.querySelector('.terminal-face').dataset.emote).toBe('cry');
    await flush();
  });
});

registerDomCleanup();
