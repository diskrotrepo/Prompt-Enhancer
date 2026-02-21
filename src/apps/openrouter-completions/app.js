(() => {
  'use strict';

  // Table of contents:
  // - Registry + safe readers
  // - Request/response helpers (completions + model catalog)
  // - Window binding
  // - App registration

  const APP_KEY = 'openrouter-completions';
  const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/completions';
  const MODELS_PUBLIC_ENDPOINT = 'https://openrouter.ai/api/v1/models';
  const MODELS_USER_ENDPOINT = 'https://openrouter.ai/api/v1/models/user';
  const DEFAULT_MODEL = 'openai/gpt-4o-mini';

  function ensureAppRegistry() {
    if (typeof window === 'undefined') return null;
    if (!window.PromptEnhancerAppModules || typeof window.PromptEnhancerAppModules !== 'object') {
      window.PromptEnhancerAppModules = {};
    }
    return window.PromptEnhancerAppModules;
  }

  function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function readNumberInput(input, fallback, min, max) {
    const value = parseFloat(input?.value);
    if (!Number.isFinite(value)) return fallback;
    if (Number.isFinite(min) && value < min) return min;
    if (Number.isFinite(max) && value > max) return max;
    return value;
  }

  function normalizeEndpoint(value) {
    const raw = toTrimmedString(value);
    return raw || DEFAULT_ENDPOINT;
  }

  function writeStatus(statusEl, message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  // OpenRouter completions typically returns choices[0].text, but some compatible
  // routes may shape data closer to chat-style payloads, so we read both.
  function readCompletionText(payload) {
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    if (!choice || typeof choice !== 'object') return '';
    if (typeof choice.text === 'string') return choice.text;
    const messageContent = choice?.message?.content;
    if (Array.isArray(messageContent)) {
      return messageContent
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .join('');
    }
    if (typeof messageContent === 'string') return messageContent;
    return '';
  }

  function buildHeaders(apiKey, title) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
    if (title) headers['X-Title'] = title;
    return headers;
  }

  function buildOptionalAuthHeaders(apiKey) {
    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  async function readErrorMessage(response) {
    try {
      const payload = await response.json();
      const errorText = payload?.error?.message || payload?.message;
      if (typeof errorText === 'string' && errorText.trim()) return errorText.trim();
      return `HTTP ${response.status}`;
    } catch (err) {
      try {
        const text = await response.text();
        if (text && text.trim()) return text.trim();
      } catch (readErr) {
        /* ignore */
      }
      return `HTTP ${response.status}`;
    }
  }

  async function requestCompletion(config) {
    const {
      endpoint,
      apiKey,
      title,
      model,
      prompt,
      maxTokens,
      temperature
    } = config;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(apiKey, title),
      body: JSON.stringify({
        model,
        prompt,
        max_tokens: maxTokens,
        temperature,
        stream: false
      })
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message);
    }
    const payload = await response.json();
    const completion = readCompletionText(payload);
    return {
      text: completion,
      usage: payload?.usage || null
    };
  }

  function normalizeModelEntries(payload) {
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const unique = new Map();
    data.forEach(entry => {
      const id = toTrimmedString(entry?.id || entry?.slug || entry?.name);
      if (!id) return;
      if (unique.has(id)) return;
      unique.set(id, {
        id,
        name: toTrimmedString(entry?.name || ''),
        contextLength: Number.isFinite(entry?.context_length) ? entry.context_length : null
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  function formatModelOption(entry) {
    const namePart = entry.name && entry.name !== entry.id ? ` - ${entry.name}` : '';
    const ctxPart = Number.isFinite(entry.contextLength) ? ` (${entry.contextLength} ctx)` : '';
    return `${entry.id}${namePart}${ctxPart}`;
  }

  function renderModelPicker(modelPicker, entries, activeModel) {
    if (!modelPicker) return;
    modelPicker.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = entries.length ? `Select model (${entries.length} loaded)...` : 'No models loaded';
    modelPicker.appendChild(placeholder);
    entries.forEach(entry => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = formatModelOption(entry);
      modelPicker.appendChild(option);
    });
    const current = toTrimmedString(activeModel);
    if (current && entries.some(entry => entry.id === current)) {
      modelPicker.value = current;
    } else {
      modelPicker.value = '';
    }
  }

  async function requestModelCatalog(endpoint, apiKey) {
    const response = await fetch(endpoint, {
      headers: buildOptionalAuthHeaders(apiKey)
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    return normalizeModelEntries(payload);
  }

  // Pull live models from OpenRouter. If a key is present, try user catalog first,
  // then fall back to the public catalog to keep the picker usable.
  async function loadModels(config) {
    const {
      apiKey,
      modelInput,
      modelPicker,
      refreshButton,
      statusEl
    } = config;
    if (!modelPicker) return;
    if (typeof fetch !== 'function') {
      writeStatus(statusEl, 'Model list unavailable: fetch is not supported in this environment.', true);
      return;
    }
    if (refreshButton) refreshButton.disabled = true;
    const key = toTrimmedString(apiKey);
    writeStatus(statusEl, key ? 'Loading models for this API key...' : 'Loading public model list...');
    let entries = [];
    let source = '';
    let keyCatalogError = '';
    try {
      if (key) {
        entries = await requestModelCatalog(MODELS_USER_ENDPOINT, key);
        source = '/models/user';
      }
      if (!entries.length) {
        entries = await requestModelCatalog(MODELS_PUBLIC_ENDPOINT, key);
        source = '/models';
      }
      renderModelPicker(modelPicker, entries, modelInput?.value);
      writeStatus(statusEl, `Loaded ${entries.length} models from ${source}.`);
    } catch (err) {
      keyCatalogError = err && err.message ? err.message : 'request failed';
      renderModelPicker(modelPicker, [], modelInput?.value);
      if (!key && (err?.status === 401 || err?.status === 403)) {
        writeStatus(statusEl, 'Enter an API key to load models.', true);
      } else {
        writeStatus(statusEl, `Model list load failed: ${keyCatalogError}`, true);
      }
    } finally {
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  function copyToClipboard(text) {
    if (!text) return Promise.resolve(false);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
  }

  function initializeOpenRouterWindow(windowEl) {
    const root = windowEl?.querySelector?.('.openrouter-app');
    if (!root || root.dataset.bound === 'true') return;

    const endpointInput = root.querySelector('.openrouter-endpoint');
    const modelInput = root.querySelector('.openrouter-model');
    const modelPicker = root.querySelector('.openrouter-model-picker');
    const refreshModelsButton = root.querySelector('.openrouter-refresh-models');
    const maxTokensInput = root.querySelector('.openrouter-max-tokens');
    const temperatureInput = root.querySelector('.openrouter-temperature');
    const apiKeyInput = root.querySelector('.openrouter-api-key');
    const titleInput = root.querySelector('.openrouter-title');
    const promptInput = root.querySelector('.openrouter-prompt');
    const sendButton = root.querySelector('.openrouter-send');
    const copyButton = root.querySelector('.openrouter-copy-output');
    const outputEl = root.querySelector('.openrouter-output-text');
    const statusEl = root.querySelector('.openrouter-status');

    if (titleInput && !toTrimmedString(titleInput.value)) {
      titleInput.value = 'Prompt Enhancer';
    }

    if (modelPicker) {
      modelPicker.addEventListener('change', () => {
        const nextModel = toTrimmedString(modelPicker.value);
        if (!nextModel || !modelInput) return;
        modelInput.value = nextModel;
      });
    }

    if (refreshModelsButton) {
      refreshModelsButton.addEventListener('click', () => {
        loadModels({
          apiKey: apiKeyInput?.value,
          modelInput,
          modelPicker,
          refreshButton: refreshModelsButton,
          statusEl
        });
      });
    }

    if (apiKeyInput) {
      apiKeyInput.addEventListener('change', () => {
        loadModels({
          apiKey: apiKeyInput.value,
          modelInput,
          modelPicker,
          refreshButton: refreshModelsButton,
          statusEl
        });
      });
    }

    if (sendButton) {
      sendButton.addEventListener('click', async () => {
        const apiKey = toTrimmedString(apiKeyInput?.value);
        const model = toTrimmedString(modelInput?.value) || DEFAULT_MODEL;
        const prompt = promptInput?.value || '';
        const endpoint = normalizeEndpoint(endpointInput?.value);
        const title = toTrimmedString(titleInput?.value);
        const maxTokens = Math.round(readNumberInput(maxTokensInput, 300, 1, 200000));
        const temperature = readNumberInput(temperatureInput, 1, 0, 2);

        if (!apiKey) {
          writeStatus(statusEl, 'Enter an OpenRouter API key first.', true);
          return;
        }
        if (!prompt.trim()) {
          writeStatus(statusEl, 'Enter a prompt before sending.', true);
          return;
        }

        sendButton.disabled = true;
        writeStatus(statusEl, 'Sending request...');

        try {
          const result = await requestCompletion({
            endpoint,
            apiKey,
            title,
            model,
            prompt,
            maxTokens,
            temperature
          });
          if (outputEl) outputEl.textContent = result.text || '';
          const tokenSummary = result.usage?.total_tokens ? ` (${result.usage.total_tokens} tokens)` : '';
          writeStatus(statusEl, `Completed${tokenSummary}.`);
        } catch (err) {
          const message = err && err.message ? err.message : 'Request failed';
          writeStatus(statusEl, `Request failed: ${message}`, true);
        } finally {
          sendButton.disabled = false;
        }
      });
    }

    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const outputText = outputEl?.textContent || '';
        const copied = await copyToClipboard(outputText);
        writeStatus(
          statusEl,
          copied ? 'Output copied.' : 'Copy failed. Clipboard permission may be blocked.',
          !copied
        );
      });
    }

    root.dataset.bound = 'true';
    writeStatus(statusEl, 'Ready.');
    loadModels({
      apiKey: apiKeyInput?.value,
      modelInput,
      modelPicker,
      refreshButton: refreshModelsButton,
      statusEl
    });
  }

  function initialize(windowEl) {
    initializeOpenRouterWindow(windowEl);
  }

  const registry = ensureAppRegistry();
  if (registry) {
    registry[APP_KEY] = { initialize };
  }
})();
