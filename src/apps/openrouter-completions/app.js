(() => {
  'use strict';

  // Table of contents:
  // - Registry + safe readers
  // - Request/response helpers (completions + model catalog)
  // - Window binding
  // - App registration

  const APP_KEY = 'openrouter-completions';
  const PROVIDER_KEYS = Object.freeze({
    FIREWORKS: 'fireworks',
    HYPERBOLIC: 'hyperbolic'
  });
  const PROVIDER_OPTIONS = Object.freeze({
    [PROVIDER_KEYS.FIREWORKS]: {
      label: 'Fireworks',
      defaultEndpoint: 'https://api.fireworks.ai/inference/v1/completions'
    },
    [PROVIDER_KEYS.HYPERBOLIC]: {
      label: 'Hyperbolic',
      defaultEndpoint: 'https://api.hyperbolic.xyz/v1/completions'
    }
  });
  const DEFAULT_PROVIDER_KEY = PROVIDER_KEYS.FIREWORKS;
  const FIREWORKS_MODELS_ENDPOINT = 'https://api.fireworks.ai/v1/models';
  const FIREWORKS_MODELS_FALLBACK_ENDPOINT = 'https://api.fireworks.ai/inference/v1/models';
  const HYPERBOLIC_MODELS_ENDPOINT = 'https://api.hyperbolic.xyz/v1/models';
  const HYPERBOLIC_COMPLETION_MODEL_IDS = new Set([
    'meta-llama/meta-llama-3.1-405b'
  ]);
  const HYPERBOLIC_FALLBACK_MODELS = Object.freeze([
    { id: 'meta-llama/Meta-Llama-3.1-405B', name: 'Llama 3.1 405B', contextLength: null }
  ]);
  const TOP_K_MAX = 100;
  const DEFAULT_SETTINGS_FILE_NAME = 'completion-providers-encrypted-settings.json';
  const PBKDF2_ITERATIONS = 250000;

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

  function formatSliderValue(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatDisableableSliderValue(value, digits, disabled) {
    const formatted = formatSliderValue(value, digits) || '0';
    return disabled ? `${formatted} (disabled)` : formatted;
  }

  function parseStopSequences(value) {
    const lines = String(value || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    return lines.length ? lines : undefined;
  }

  function toLowerArray(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => String(item || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function includesAny(text, patterns) {
    const target = String(text || '').toLowerCase();
    return patterns.some(pattern => pattern.test(target));
  }

  function promptForSettingsPassword(action) {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null;
    const message = action === 'save'
      ? 'Enter a password to encrypt settings:'
      : 'Enter the password to decrypt settings:';
    return window.prompt(message, '');
  }

  function getProviderOption(providerKey) {
    return PROVIDER_OPTIONS[providerKey] || PROVIDER_OPTIONS[DEFAULT_PROVIDER_KEY];
  }

  function normalizeProviderKey(value) {
    const key = toTrimmedString(value).toLowerCase();
    return PROVIDER_OPTIONS[key] ? key : DEFAULT_PROVIDER_KEY;
  }

  function defaultEndpointForProvider(providerKey) {
    return getProviderOption(providerKey).defaultEndpoint;
  }

  function normalizeEndpoint(value, providerKey = DEFAULT_PROVIDER_KEY) {
    const raw = toTrimmedString(value);
    return raw || defaultEndpointForProvider(providerKey);
  }

  function isChatCompletionsEndpoint(endpoint) {
    const value = String(endpoint || '').toLowerCase();
    return /\/chat\/completions(?:$|[/?#])/.test(value);
  }

  function writeStatus(statusEl, message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function toNumberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseNumberLoose(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const cleaned = value.trim().replace(/[$,_\s]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function firstNumber(values) {
    for (let i = 0; i < values.length; i += 1) {
      const parsed = parseNumberLoose(values[i]);
      if (parsed != null) return parsed;
    }
    return null;
  }

  function readPath(target, path) {
    if (!target || typeof target !== 'object') return undefined;
    return String(path)
      .split('.')
      .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), target);
  }

  function readFirstPathNumber(target, paths) {
    for (let i = 0; i < paths.length; i += 1) {
      const parsed = parseNumberLoose(readPath(target, paths[i]));
      if (parsed != null) return parsed;
    }
    return null;
  }

  function formatUsd(value) {
    const amount = toNumberOrNull(value);
    if (amount == null) return 'n/a';
    const fixed = amount < 0.01 ? amount.toFixed(8) : amount.toFixed(6);
    return fixed.replace(/0+$/, '').replace(/\.$/, '');
  }

  function readModelPricing(modelEntry) {
    if (!modelEntry || typeof modelEntry !== 'object') return null;
    const inputUsdPerToken = readFirstPathNumber(modelEntry, [
      'pricing.input',
      'pricing.prompt',
      'pricing.input_token',
      'pricing.prompt_token',
      'input_cost_per_token',
      'prompt_cost_per_token',
      'input_price_per_token',
      'prompt_price_per_token',
      'input_token_price',
      'prompt_token_price'
    ]);
    const outputUsdPerToken = readFirstPathNumber(modelEntry, [
      'pricing.output',
      'pricing.completion',
      'pricing.output_token',
      'pricing.completion_token',
      'output_cost_per_token',
      'completion_cost_per_token',
      'output_price_per_token',
      'completion_price_per_token',
      'output_token_price',
      'completion_token_price'
    ]);
    const cachedInputUsdPerToken = readFirstPathNumber(modelEntry, [
      'pricing.cached_input',
      'pricing.cache_read',
      'cached_input_cost_per_token',
      'cache_read_cost_per_token',
      'cached_input_price_per_token',
      'cache_read_price_per_token'
    ]);

    const inputUsdPerMillion = readFirstPathNumber(modelEntry, [
      'pricing.input_per_million',
      'pricing.prompt_per_million',
      'input_cost_per_million',
      'prompt_cost_per_million',
      'input_price_per_million',
      'prompt_price_per_million'
    ]);
    const outputUsdPerMillion = readFirstPathNumber(modelEntry, [
      'pricing.output_per_million',
      'pricing.completion_per_million',
      'output_cost_per_million',
      'completion_cost_per_million',
      'output_price_per_million',
      'completion_price_per_million'
    ]);
    const cachedInputUsdPerMillion = readFirstPathNumber(modelEntry, [
      'pricing.cached_input_per_million',
      'pricing.cache_read_per_million',
      'cached_input_cost_per_million',
      'cache_read_cost_per_million',
      'cached_input_price_per_million',
      'cache_read_price_per_million'
    ]);
    const flatUsdPerToken = readFirstPathNumber(modelEntry, [
      'pricing.token',
      'price_per_token',
      'token_price',
      'serverless_price_per_token'
    ]);
    const flatUsdPerMillion = readFirstPathNumber(modelEntry, [
      'pricing.token_per_million',
      'price_per_million',
      'price_per_million_tokens',
      'serverless_price_per_million',
      'serverless_price_per_million_tokens'
    ]);

    const flatRate = flatUsdPerToken != null
      ? flatUsdPerToken
      : flatUsdPerMillion != null
        ? flatUsdPerMillion / 1000000
        : null;
    const inputRate = inputUsdPerToken != null
      ? inputUsdPerToken
      : inputUsdPerMillion != null
        ? inputUsdPerMillion / 1000000
        : flatRate;
    const outputRate = outputUsdPerToken != null
      ? outputUsdPerToken
      : outputUsdPerMillion != null
        ? outputUsdPerMillion / 1000000
        : flatRate;
    const cachedRate = cachedInputUsdPerToken != null
      ? cachedInputUsdPerToken
      : cachedInputUsdPerMillion != null
        ? cachedInputUsdPerMillion / 1000000
        : inputRate;

    if (inputRate == null && outputRate == null) return null;
    return {
      inputUsdPerToken: inputRate != null ? inputRate : outputRate,
      outputUsdPerToken: outputRate != null ? outputRate : inputRate,
      cachedInputUsdPerToken: cachedRate
    };
  }

  function normalizeCompletionUsage(payload) {
    const source =
      payload?.usage ||
      payload?.token_usage ||
      payload?.usage_stats ||
      payload?.usage_metadata ||
      payload?.metrics?.usage ||
      null;
    const usage = source && typeof source === 'object' ? { ...source } : {};

    const promptTokens = firstNumber([
      usage.prompt_tokens,
      usage.input_tokens,
      payload?.prompt_tokens,
      payload?.input_tokens
    ]);
    const completionTokens = firstNumber([
      usage.completion_tokens,
      usage.output_tokens,
      payload?.completion_tokens,
      payload?.output_tokens
    ]);
    const totalTokens = firstNumber([
      usage.total_tokens,
      usage.tokens,
      payload?.total_tokens
    ]);
    const costUsd = firstNumber([
      usage.cost,
      usage.total_cost,
      usage.request_cost,
      usage.billing_cost,
      usage?.cost_details?.total_cost,
      usage?.cost_details?.upstream_inference_cost,
      payload?.cost,
      payload?.total_cost,
      payload?.request_cost,
      payload?.billing_cost,
      payload?.billing?.cost,
      payload?.cost_details?.total_cost,
      payload?.cost_details?.upstream_inference_cost
    ]);

    if (promptTokens != null) usage.prompt_tokens = promptTokens;
    if (completionTokens != null) usage.completion_tokens = completionTokens;
    if (totalTokens != null) usage.total_tokens = totalTokens;
    if (costUsd != null && usage.cost == null) usage.cost = costUsd;

    return Object.keys(usage).length ? usage : null;
  }

  function readUsageBreakdown(usage) {
    const completionTokens = toNumberOrNull(usage?.completion_tokens);
    const totalTokens = toNumberOrNull(usage?.total_tokens);
    const promptFromUsage = toNumberOrNull(usage?.prompt_tokens);
    const promptTokens =
      promptFromUsage != null
        ? promptFromUsage
        : totalTokens != null && completionTokens != null
          ? Math.max(0, totalTokens - completionTokens)
          : null;
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      reasoningTokens: toNumberOrNull(usage?.completion_tokens_details?.reasoning_tokens),
      cachedPromptTokens: toNumberOrNull(usage?.prompt_tokens_details?.cached_tokens),
      costUsd: firstNumber([
        usage?.cost,
        usage?.total_cost,
        usage?.request_cost,
        usage?.billing_cost
      ]),
      upstreamCostUsd: firstNumber([
        usage?.cost_details?.upstream_inference_cost,
        usage?.cost_details?.total_cost
      ])
    };
  }

  function estimateUsageCostUsd(usage, modelPricing) {
    if (!usage || !modelPricing) return null;
    const details = readUsageBreakdown(usage);
    if (details.promptTokens == null || details.completionTokens == null) return null;
    const inputRate = toNumberOrNull(modelPricing?.inputUsdPerToken);
    const outputRate = toNumberOrNull(modelPricing?.outputUsdPerToken);
    if (inputRate == null || outputRate == null) return null;
    const cachedTokensRaw = toNumberOrNull(details.cachedPromptTokens);
    const cachedTokens = cachedTokensRaw == null
      ? 0
      : Math.max(0, Math.min(details.promptTokens, cachedTokensRaw));
    const uncachedPromptTokens = Math.max(0, details.promptTokens - cachedTokens);
    const cachedInputRate = toNumberOrNull(modelPricing?.cachedInputUsdPerToken) ?? inputRate;
    return (
      uncachedPromptTokens * inputRate +
      cachedTokens * cachedInputRate +
      details.completionTokens * outputRate
    );
  }

  function buildBillingStatusMessage(usage, options = {}) {
    const details = readUsageBreakdown(usage);
    const estimatedCostUsd = toNumberOrNull(options.estimatedCostUsd);
    const lines = ['Completed.'];
    lines.push(`Output tokens (billed output): ${details.completionTokens ?? 'n/a'}`);
    lines.push(`Input tokens (billed input): ${details.promptTokens ?? 'n/a'}`);
    lines.push(`Total tokens (input + output): ${details.totalTokens ?? 'n/a'}`);
    if (details.reasoningTokens != null) {
      lines.push(`Reasoning tokens: ${details.reasoningTokens}`);
    }
    if (details.cachedPromptTokens != null) {
      lines.push(`Cached input tokens: ${details.cachedPromptTokens}`);
    }
    if (details.costUsd != null) {
      lines.push(`Request cost (USD): $${formatUsd(details.costUsd)}`);
    } else if (estimatedCostUsd != null) {
      lines.push(`Estimated request cost (USD): $${formatUsd(estimatedCostUsd)}`);
      lines.push('Billing source: token estimate from model pricing');
    } else {
      lines.push('Request cost (USD): n/a');
      lines.push('Billing source: provider did not return request cost');
    }
    if (details.upstreamCostUsd != null) {
      lines.push(`Upstream inference cost (USD): $${formatUsd(details.upstreamCostUsd)}`);
    }
    if (details.costUsd != null && estimatedCostUsd != null) {
      lines.push(`Estimated request cost (USD): $${formatUsd(estimatedCostUsd)}`);
    }
    if (options.costFromGeneration === true) {
      lines.push('Billing source: generation stats (native accounting)');
    }
    return lines.join('\n');
  }

  // This app is strict completions mode. We only accept text-completion payloads
  // so models that behave like chat responders are surfaced as unsupported here.
  function readCompletionText(payload) {
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    if (!choice || typeof choice !== 'object') return '';
    return typeof choice.text === 'string' ? choice.text : '';
  }

  function buildHeaders(apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
    return headers;
  }

  function buildOptionalAuthHeaders(apiKey) {
    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  function getWebCrypto() {
    if (typeof globalThis === 'undefined') return null;
    return globalThis.crypto || null;
  }

  function hasCryptoSupport() {
    const cryptoApi = getWebCrypto();
    return !!(cryptoApi && cryptoApi.subtle && typeof cryptoApi.getRandomValues === 'function');
  }

  function bytesToBase64(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < view.length; i += 1) {
      binary += String.fromCharCode(view[i]);
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function utf8ToBytes(text) {
    const encoded = unescape(encodeURIComponent(String(text)));
    const bytes = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i += 1) {
      bytes[i] = encoded.charCodeAt(i);
    }
    return bytes;
  }

  function bytesToUtf8(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return decodeURIComponent(escape(binary));
  }

  async function deriveAesKey(password, saltBytes, usages) {
    const cryptoApi = getWebCrypto();
    const keyMaterial = await cryptoApi.subtle.importKey(
      'raw',
      utf8ToBytes(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return cryptoApi.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
  }

  async function encryptSettings(password, settings) {
    const cryptoApi = getWebCrypto();
    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(password, salt, ['encrypt']);
    const plaintext = utf8ToBytes(JSON.stringify(settings));
    const encrypted = await cryptoApi.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );
    return {
      version: 1,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt)
      },
      cipher: {
        name: 'AES-GCM',
        iv: bytesToBase64(iv),
        data: bytesToBase64(encrypted)
      }
    };
  }

  async function decryptSettings(password, payload) {
    const salt = base64ToBytes(payload?.kdf?.salt);
    const iv = base64ToBytes(payload?.cipher?.iv);
    const encrypted = base64ToBytes(payload?.cipher?.data);
    const key = await deriveAesKey(password, salt, ['decrypt']);
    const cryptoApi = getWebCrypto();
    try {
      const decrypted = await cryptoApi.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      return JSON.parse(bytesToUtf8(new Uint8Array(decrypted)));
    } catch (err) {
      throw new Error('Invalid password or corrupted encrypted settings.');
    }
  }

  function downloadEncryptedSettings(payload, fileName = DEFAULT_SETTINGS_FILE_NAME) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = toTrimmedString(fileName) || DEFAULT_SETTINGS_FILE_NAME;
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      return false;
    }
  }

  async function readEncryptedSettingsFile(file) {
    if (!file) throw new Error('No file selected.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          if (!parsed || typeof parsed !== 'object') {
            reject(new Error('Selected file does not contain valid encrypted settings JSON.'));
            return;
          }
          resolve(parsed);
        } catch (err) {
          reject(new Error('Selected file does not contain valid JSON.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read selected settings file.'));
      reader.readAsText(file);
    });
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
      providerKey,
      endpoint,
      apiKey,
      model,
      prompt,
      maxTokens,
      temperature,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      stop
    } = config;
    const includeTopP = Number.isFinite(topP) && topP > 0;
    const includeTopK = Number.isFinite(topK) && topK > 0;
    const includePresencePenalty = Number.isFinite(presencePenalty) && presencePenalty !== 0;
    const includeFrequencyPenalty = Number.isFinite(frequencyPenalty) && frequencyPenalty !== 0;
    const requestBody =
      providerKey === PROVIDER_KEYS.HYPERBOLIC
        ? {
            model,
            prompt,
            max_tokens: maxTokens,
            ...(includeTopP ? { top_p: topP } : {}),
            ...(includePresencePenalty ? { presence_penalty: presencePenalty } : {}),
            ...(includeFrequencyPenalty ? { frequency_penalty: frequencyPenalty } : {}),
            temperature,
            ...(stop ? { stop } : {}),
            stream: false
          }
        : {
            model,
            prompt,
            max_tokens: maxTokens,
            ...(includeTopP ? { top_p: topP } : {}),
            ...(includeTopK ? { top_k: topK } : {}),
            ...(includePresencePenalty ? { presence_penalty: presencePenalty } : {}),
            ...(includeFrequencyPenalty ? { frequency_penalty: frequencyPenalty } : {}),
            temperature,
            ...(stop ? { stop } : {}),
            stream: false
          };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message);
    }
    const payload = await response.json();
    const completion = readCompletionText(payload);
    if (!completion && payload?.object !== 'text_completion') {
      throw new Error(
        'Model returned a chat-style response. Use a completion-capable model for pure continuation.'
      );
    }
    return {
      id: toTrimmedString(payload?.id),
      text: completion,
      usage: normalizeCompletionUsage(payload)
    };
  }

  function normalizeSimpleModelEntries(payload) {
    const data = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : [];
    const unique = new Map();
    data.forEach(entry => {
      const id = toTrimmedString(entry?.id || entry?.name);
      if (!id || unique.has(id)) return;
      unique.set(id, {
        id,
        name: toTrimmedString(entry?.display_name || entry?.name || ''),
        contextLength: Number.isFinite(entry?.context_length) ? entry.context_length : null,
        pricing: readModelPricing(entry),
        supportedParameters: Array.isArray(entry?.supported_parameters)
          ? entry.supported_parameters
          : null,
        inputModalities: Array.isArray(entry?.architecture?.input_modalities)
          ? entry.architecture.input_modalities
          : Array.isArray(entry?.input_modalities)
            ? entry.input_modalities
            : null,
        outputModalities: Array.isArray(entry?.architecture?.output_modalities)
          ? entry.architecture.output_modalities
          : Array.isArray(entry?.output_modalities)
            ? entry.output_modalities
            : null,
        task: toTrimmedString(entry?.task || entry?.type || entry?.modality || '')
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  function formatModelOption(entry) {
    const namePart = entry.name && entry.name !== entry.id ? ` - ${entry.name}` : '';
    const ctxPart = Number.isFinite(entry.contextLength) ? ` (${entry.contextLength} ctx)` : '';
    return `${entry.id}${namePart}${ctxPart}`;
  }

  function isHyperbolicCompletionModel(entry) {
    const id = toTrimmedString(entry?.id).toLowerCase();
    return HYPERBOLIC_COMPLETION_MODEL_IDS.has(id);
  }

  function isLikelyTextCompletionModel(entry) {
    const inputModalities = toLowerArray(entry?.inputModalities);
    const outputModalities = toLowerArray(entry?.outputModalities);
    if (inputModalities.length && !inputModalities.includes('text')) return false;
    if (outputModalities.length && !outputModalities.includes('text')) return false;

    const task = toTrimmedString(entry?.task).toLowerCase();
    if (
      includesAny(task, [
        /image/,
        /vision/,
        /audio/,
        /speech/,
        /embed/,
        /rerank/,
        /moderation/,
        /transcrib/
      ])
    ) {
      return false;
    }

    const identity = `${entry?.id || ''} ${entry?.name || ''}`;
    return !includesAny(identity, [
      /sdxl/,
      /stable[-\s]?diffusion/,
      /flux/,
      /controlnet/,
      /whisper/,
      /\btts\b/,
      /text[-\s]?to[-\s]?speech/,
      /speech[-\s]?to[-\s]?text/,
      /\bembedding(s)?\b/,
      /\brerank(er)?\b/,
      /\bvision\b/,
      /\bvl\b/,
      /\bimage\b/
    ]);
  }

  function supportsCompletionsByMetadata(entry) {
    const params = toLowerArray(entry?.supportedParameters);
    if (!params.length) return null;
    if (!params.includes('prompt')) return false;
    if (
      params.includes('max_tokens') ||
      params.includes('max_new_tokens') ||
      params.includes('max_completion_tokens')
    ) {
      return true;
    }
    return false;
  }

  function renderModelPicker(modelPicker, entries, activeModel) {
    if (!modelPicker) return;
    modelPicker.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = entries.length ? `Select model (${entries.length} loaded)...` : 'No completion models found';
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
    } else if (entries.length) {
      modelPicker.value = entries[0].id;
    } else {
      modelPicker.value = '';
    }
  }

  async function requestFireworksModelCatalog(apiKey) {
    const endpoints = [FIREWORKS_MODELS_ENDPOINT, FIREWORKS_MODELS_FALLBACK_ENDPOINT];
    let lastError = null;
    for (let i = 0; i < endpoints.length; i += 1) {
      const response = await fetch(endpoints[i], {
        headers: buildOptionalAuthHeaders(apiKey)
      });
      if (response.ok) {
        const payload = await response.json();
        return normalizeSimpleModelEntries(payload);
      }
      const message = await readErrorMessage(response);
      const error = new Error(message);
      error.status = response.status;
      lastError = error;
      if (![404, 405].includes(response.status)) {
        throw error;
      }
    }
    throw lastError || new Error('Model list load failed');
  }

  async function requestHyperbolicModelCatalog(apiKey) {
    const response = await fetch(HYPERBOLIC_MODELS_ENDPOINT, {
      headers: buildOptionalAuthHeaders(apiKey)
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    return normalizeSimpleModelEntries(payload);
  }

  // Pull live models from the active provider and render completion-capable options.
  async function loadModels(config) {
    const {
      providerKey,
      apiKey,
      modelPicker,
      statusEl,
      excludedModelIds,
      modelPricingById
    } = config;
    if (!modelPicker) return;
    if (typeof fetch !== 'function') {
      writeStatus(statusEl, 'Model list unavailable: fetch is not supported in this environment.', true);
      return;
    }
    const provider = normalizeProviderKey(providerKey);
    const providerLabel = getProviderOption(provider).label;
    const key = toTrimmedString(apiKey);
    if (!key) {
      if (modelPricingById) modelPricingById.clear();
      renderModelPicker(modelPicker, [], modelPicker.value);
      writeStatus(statusEl, `Enter a ${providerLabel} API key to load models.`, true);
      return;
    }
    writeStatus(statusEl, `Loading ${providerLabel} models for this API key...`);
    let entries = [];
    let source = '';
    let keyCatalogError = '';
    try {
      if (provider === PROVIDER_KEYS.HYPERBOLIC) {
        entries = await requestHyperbolicModelCatalog(key);
        source = '/v1/models';
        entries = entries.filter(isHyperbolicCompletionModel);
        if (!entries.length) {
          entries = HYPERBOLIC_FALLBACK_MODELS.slice();
          source = 'curated catalog';
        }
      } else {
        entries = await requestFireworksModelCatalog(key);
        source = '/v1/models';
        entries = entries.filter(isLikelyTextCompletionModel);
        entries = entries.filter(entry => supportsCompletionsByMetadata(entry) !== false);
      }

      if (excludedModelIds && excludedModelIds.size) {
        entries = entries.filter(entry => !excludedModelIds.has(entry.id));
      }
      if (modelPricingById) {
        modelPricingById.clear();
        entries.forEach(entry => {
          if (entry?.pricing) modelPricingById.set(entry.id, entry.pricing);
        });
      }
      renderModelPicker(modelPicker, entries, modelPicker.value);
      writeStatus(statusEl, `Loaded ${entries.length} completion models from ${providerLabel} ${source}.`);
    } catch (err) {
      if (provider === PROVIDER_KEYS.HYPERBOLIC && key && ![401, 403].includes(err?.status)) {
        const fallbackEntries = HYPERBOLIC_FALLBACK_MODELS.filter(entry => !excludedModelIds?.has(entry.id));
        if (modelPricingById) modelPricingById.clear();
        renderModelPicker(modelPicker, fallbackEntries, modelPicker.value);
        writeStatus(statusEl, `Loaded ${fallbackEntries.length} fallback Hyperbolic models.`);
        return;
      }
      keyCatalogError = err && err.message ? err.message : 'request failed';
      if (modelPricingById) modelPricingById.clear();
      renderModelPicker(modelPicker, [], modelPicker.value);
      writeStatus(statusEl, `${providerLabel} model list load failed: ${keyCatalogError}`, true);
    }
  }

  function collectOpenRouterSettings(inputs, providerApiKeys) {
    const {
      providerSelect,
      endpointInput,
      modelPicker,
      maxTokensInput,
      temperatureInput,
      topPInput,
      topKInput,
      presencePenaltyInput,
      frequencyPenaltyInput,
      stopInput,
      apiKeyInput,
      titleInput,
      promptInput
    } = inputs;
    const provider = normalizeProviderKey(providerSelect?.value);
    const apiKeys = {
      [PROVIDER_KEYS.FIREWORKS]: toTrimmedString(providerApiKeys?.[PROVIDER_KEYS.FIREWORKS]),
      [PROVIDER_KEYS.HYPERBOLIC]: toTrimmedString(providerApiKeys?.[PROVIDER_KEYS.HYPERBOLIC])
    };
    apiKeys[provider] = toTrimmedString(apiKeyInput?.value);
    return {
      provider,
      endpoint: normalizeEndpoint(endpointInput?.value, provider),
      model: toTrimmedString(modelPicker?.value),
      maxTokens: Math.round(readNumberInput(maxTokensInput, 300, 1, 200000)),
      temperature: readNumberInput(temperatureInput, 1, 0, 2),
      topP: readNumberInput(topPInput, 1, 0, 1),
      topK: Math.round(readNumberInput(topKInput, 40, 0, TOP_K_MAX)),
      presencePenalty: readNumberInput(presencePenaltyInput, 0, -2, 2),
      frequencyPenalty: readNumberInput(frequencyPenaltyInput, 0, -2, 2),
      stopText: String(stopInput?.value || ''),
      apiKeys,
      apiKey: apiKeys[provider],
      title: toTrimmedString(titleInput?.value),
      prompt: String(promptInput?.value || '')
    };
  }

  function applyOpenRouterSettings(inputs, settings, providerApiKeys) {
    const {
      providerSelect,
      endpointInput,
      modelPicker,
      maxTokensInput,
      temperatureInput,
      topPInput,
      topKInput,
      presencePenaltyInput,
      frequencyPenaltyInput,
      stopInput,
      apiKeyInput,
      titleInput,
      promptInput
    } = inputs;
    const nextProvider = providerSelect
      ? normalizeProviderKey(settings?.provider)
      : DEFAULT_PROVIDER_KEY;
    if (providerSelect) providerSelect.value = nextProvider;
    const loadedApiKeys = {
      [PROVIDER_KEYS.FIREWORKS]: '',
      [PROVIDER_KEYS.HYPERBOLIC]: ''
    };
    if (settings?.apiKeys && typeof settings.apiKeys === 'object') {
      loadedApiKeys[PROVIDER_KEYS.FIREWORKS] = toTrimmedString(settings.apiKeys[PROVIDER_KEYS.FIREWORKS]);
      loadedApiKeys[PROVIDER_KEYS.HYPERBOLIC] = toTrimmedString(settings.apiKeys[PROVIDER_KEYS.HYPERBOLIC]);
    }
    const legacyApiKey = toTrimmedString(settings?.apiKey);
    if (legacyApiKey && !loadedApiKeys[nextProvider]) {
      loadedApiKeys[nextProvider] = legacyApiKey;
    }
    if (providerApiKeys) {
      providerApiKeys[PROVIDER_KEYS.FIREWORKS] = loadedApiKeys[PROVIDER_KEYS.FIREWORKS];
      providerApiKeys[PROVIDER_KEYS.HYPERBOLIC] = loadedApiKeys[PROVIDER_KEYS.HYPERBOLIC];
    }
    if (endpointInput) endpointInput.value = normalizeEndpoint(settings?.endpoint, nextProvider);
    if (modelPicker) {
      const requestedModel = toTrimmedString(settings?.model);
      const hasOption = Array.from(modelPicker.options || []).some(option => option.value === requestedModel);
      modelPicker.value = hasOption ? requestedModel : '';
    }
    if (maxTokensInput) maxTokensInput.value = String(Math.round(readNumberInput({ value: settings?.maxTokens }, 300, 1, 200000)));
    if (temperatureInput) temperatureInput.value = String(readNumberInput({ value: settings?.temperature }, 1, 0, 2));
    if (topPInput) topPInput.value = String(readNumberInput({ value: settings?.topP }, 1, 0, 1));
    if (topKInput) topKInput.value = String(Math.round(readNumberInput({ value: settings?.topK }, 40, 0, TOP_K_MAX)));
    if (presencePenaltyInput) presencePenaltyInput.value = String(readNumberInput({ value: settings?.presencePenalty }, 0, -2, 2));
    if (frequencyPenaltyInput) frequencyPenaltyInput.value = String(readNumberInput({ value: settings?.frequencyPenalty }, 0, -2, 2));
    if (stopInput) stopInput.value = String(settings?.stopText || '');
    if (apiKeyInput) apiKeyInput.value = loadedApiKeys[nextProvider];
    if (titleInput) titleInput.value = toTrimmedString(settings?.title);
    if (promptInput) promptInput.value = String(settings?.prompt || '');
    return nextProvider;
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

    const providerSelect = root.querySelector('.openrouter-provider');
    const endpointInput = root.querySelector('.openrouter-endpoint');
    const modelPicker = root.querySelector('.openrouter-model-picker');
    const maxTokensInput = root.querySelector('.openrouter-max-tokens');
    const temperatureInput = root.querySelector('.openrouter-temperature');
    const temperatureValue = root.querySelector('.openrouter-temperature-value');
    const topPInput = root.querySelector('.openrouter-top-p');
    const topPValue = root.querySelector('.openrouter-top-p-value');
    const topKInput = root.querySelector('.openrouter-top-k');
    const topKValue = root.querySelector('.openrouter-top-k-value');
    const presencePenaltyInput = root.querySelector('.openrouter-presence-penalty');
    const presencePenaltyValue = root.querySelector('.openrouter-presence-penalty-value');
    const frequencyPenaltyInput = root.querySelector('.openrouter-frequency-penalty');
    const frequencyPenaltyValue = root.querySelector('.openrouter-frequency-penalty-value');
    const stopInput = root.querySelector('.openrouter-stop');
    const apiKeyInput = root.querySelector('.openrouter-api-key');
    const titleInput = root.querySelector('.openrouter-title');
    const promptInput = root.querySelector('.openrouter-prompt');
    const sendButton = root.querySelector('.openrouter-send');
    const copyButton = root.querySelector('.openrouter-copy-output');
    const fileMenuToggle = root.querySelector('.openrouter-menu-start');
    const fileMenuDropdown = root.querySelector('.openrouter-menu-dropdown');
    const loadSettingsFileInput = root.querySelector('.openrouter-load-settings-file');
    const outputEl = root.querySelector('.openrouter-output-text');
    const statusEl = root.querySelector('.openrouter-status');
    const providerApiKeys = {
      [PROVIDER_KEYS.FIREWORKS]: '',
      [PROVIDER_KEYS.HYPERBOLIC]: ''
    };
    const excludedModelIdsByProvider = {
      [PROVIDER_KEYS.FIREWORKS]: new Set(),
      [PROVIDER_KEYS.HYPERBOLIC]: new Set()
    };
    const modelPricingByProvider = {
      [PROVIDER_KEYS.FIREWORKS]: new Map(),
      [PROVIDER_KEYS.HYPERBOLIC]: new Map()
    };
    let activeProvider = normalizeProviderKey(providerSelect?.value);

    const getExcludedModelIds = providerKey => {
      const key = normalizeProviderKey(providerKey);
      if (!excludedModelIdsByProvider[key]) excludedModelIdsByProvider[key] = new Set();
      return excludedModelIdsByProvider[key];
    };
    const getModelPricingMap = providerKey => {
      const key = normalizeProviderKey(providerKey);
      if (!modelPricingByProvider[key]) modelPricingByProvider[key] = new Map();
      return modelPricingByProvider[key];
    };
    const syncApiKeyInputFromProvider = () => {
      if (apiKeyInput) apiKeyInput.value = providerApiKeys[activeProvider] || '';
    };
    const syncEndpointForProvider = previousProvider => {
      if (!endpointInput) return;
      const current = toTrimmedString(endpointInput.value);
      const previousDefault = defaultEndpointForProvider(previousProvider);
      if (!current || current === previousDefault) {
        endpointInput.value = defaultEndpointForProvider(activeProvider);
      }
    };

    const syncSliderValues = () => {
      const topP = Number(topPInput?.value);
      const topK = Number(topKInput?.value);
      const presencePenalty = Number(presencePenaltyInput?.value);
      const frequencyPenalty = Number(frequencyPenaltyInput?.value);
      if (temperatureValue) temperatureValue.textContent = formatSliderValue(temperatureInput?.value, 2);
      if (topPValue) {
        topPValue.textContent = formatDisableableSliderValue(
          topPInput?.value,
          2,
          Number.isFinite(topP) && topP <= 0
        );
      }
      if (topKValue) {
        topKValue.textContent = formatDisableableSliderValue(
          topKInput?.value,
          0,
          Number.isFinite(topK) && topK <= 0
        );
      }
      if (presencePenaltyValue) {
        presencePenaltyValue.textContent = formatDisableableSliderValue(
          presencePenaltyInput?.value,
          1,
          Number.isFinite(presencePenalty) && presencePenalty === 0
        );
      }
      if (frequencyPenaltyValue) {
        frequencyPenaltyValue.textContent = formatDisableableSliderValue(
          frequencyPenaltyInput?.value,
          1,
          Number.isFinite(frequencyPenalty) && frequencyPenalty === 0
        );
      }
    };
    const bindSliderValue = input => {
      if (!input) return;
      input.addEventListener('input', syncSliderValues);
      input.addEventListener('change', syncSliderValues);
    };
    bindSliderValue(temperatureInput);
    bindSliderValue(topPInput);
    bindSliderValue(topKInput);
    bindSliderValue(presencePenaltyInput);
    bindSliderValue(frequencyPenaltyInput);
    syncSliderValues();

    if (titleInput && !toTrimmedString(titleInput.value)) {
      titleInput.value = 'Prompt Enhancer';
    }

    if (endpointInput && !toTrimmedString(endpointInput.value)) {
      endpointInput.value = defaultEndpointForProvider(activeProvider);
    }

    if (providerSelect) {
      providerSelect.addEventListener('change', () => {
        const previousProvider = activeProvider;
        providerApiKeys[previousProvider] = toTrimmedString(apiKeyInput?.value);
        activeProvider = normalizeProviderKey(providerSelect.value);
        syncApiKeyInputFromProvider();
        syncEndpointForProvider(previousProvider);
        renderModelPicker(modelPicker, [], '');
        loadModels({
          providerKey: activeProvider,
          apiKey: providerApiKeys[activeProvider],
          modelPicker,
          statusEl,
          excludedModelIds: getExcludedModelIds(activeProvider),
          modelPricingById: getModelPricingMap(activeProvider)
        });
      });
    }

    if (apiKeyInput) {
      const refreshModelsFromKey = () => {
        providerApiKeys[activeProvider] = toTrimmedString(apiKeyInput.value);
        loadModels({
          providerKey: activeProvider,
          apiKey: providerApiKeys[activeProvider],
          modelPicker,
          statusEl,
          excludedModelIds: getExcludedModelIds(activeProvider),
          modelPricingById: getModelPricingMap(activeProvider)
        });
      };
      apiKeyInput.addEventListener('change', refreshModelsFromKey);
      apiKeyInput.addEventListener('blur', refreshModelsFromKey);
    }

    const settingsInputs = {
      providerSelect,
      endpointInput,
      modelPicker,
      maxTokensInput,
      temperatureInput,
      topPInput,
      topKInput,
      presencePenaltyInput,
      frequencyPenaltyInput,
      stopInput,
      apiKeyInput,
      titleInput,
      promptInput
    };

    let settingsBusy = false;
    const runSettingsTask = async task => {
      if (settingsBusy) return;
      settingsBusy = true;
      try {
        await task();
      } finally {
        settingsBusy = false;
      }
    };

    const handleSaveEncryptedSettings = async () => {
      const passwordRaw = promptForSettingsPassword('save');
      if (passwordRaw == null) {
        writeStatus(statusEl, 'Encrypted save cancelled.', true);
        return;
      }
      const password = String(passwordRaw);
      if (!password) {
        writeStatus(statusEl, 'Password is required to save encrypted settings.', true);
        return;
      }
      if (!hasCryptoSupport()) {
        writeStatus(statusEl, 'Encrypted save is unavailable: browser crypto support is missing.', true);
        return;
      }
      await runSettingsTask(async () => {
        try {
          providerApiKeys[activeProvider] = toTrimmedString(apiKeyInput?.value);
          const settings = collectOpenRouterSettings(settingsInputs, providerApiKeys);
          const payload = await encryptSettings(password, settings);
          const stored = downloadEncryptedSettings(payload);
          writeStatus(
            statusEl,
            stored ? 'Encrypted settings file downloaded.' : 'Failed to download encrypted settings file.',
            !stored
          );
        } catch (err) {
          writeStatus(statusEl, `Encrypted save failed: ${err?.message || 'unknown error'}`, true);
        }
      });
    };

    const handleLoadEncryptedSettings = async file => {
      const passwordRaw = promptForSettingsPassword('load');
      if (passwordRaw == null) {
        writeStatus(statusEl, 'Encrypted load cancelled.', true);
        return;
      }
      const password = String(passwordRaw);
      if (!password) {
        writeStatus(statusEl, 'Password is required to load encrypted settings.', true);
        return;
      }
      if (!hasCryptoSupport()) {
        writeStatus(statusEl, 'Encrypted load is unavailable: browser crypto support is missing.', true);
        return;
      }
      if (!file) return;
      await runSettingsTask(async () => {
        try {
          const payload = await readEncryptedSettingsFile(file);
          const settings = await decryptSettings(password, payload);
          const loadedProvider = applyOpenRouterSettings(settingsInputs, settings, providerApiKeys);
          syncSliderValues();
          activeProvider = normalizeProviderKey(loadedProvider);
          await loadModels({
            providerKey: activeProvider,
            apiKey: providerApiKeys[activeProvider],
            modelPicker,
            statusEl,
            excludedModelIds: getExcludedModelIds(activeProvider),
            modelPricingById: getModelPricingMap(activeProvider)
          });
          if (modelPicker) {
            const requestedModel = toTrimmedString(settings?.model);
            const hasOption = Array.from(modelPicker.options || []).some(option => option.value === requestedModel);
            if (requestedModel && hasOption) modelPicker.value = requestedModel;
          }
          if (!statusEl?.classList?.contains('is-error')) {
            writeStatus(statusEl, 'Encrypted settings loaded from file.');
          }
        } catch (err) {
          writeStatus(statusEl, err?.message || 'Encrypted settings could not be loaded.', true);
        }
      });
    };

    if (fileMenuToggle && fileMenuDropdown && !fileMenuToggle.dataset.bound) {
      const closeFileMenu = () => {
        fileMenuDropdown.classList.remove('open');
        fileMenuDropdown.setAttribute('aria-hidden', 'true');
        fileMenuToggle.setAttribute('aria-expanded', 'false');
      };
      const openFileMenu = () => {
        fileMenuDropdown.classList.add('open');
        fileMenuDropdown.setAttribute('aria-hidden', 'false');
        fileMenuToggle.setAttribute('aria-expanded', 'true');
      };
      fileMenuToggle.addEventListener('click', event => {
        event.stopPropagation();
        if (fileMenuDropdown.classList.contains('open')) {
          closeFileMenu();
        } else {
          openFileMenu();
        }
      });
      root.addEventListener('click', event => {
        if (event.target.closest('.openrouter-file-menu')) return;
        closeFileMenu();
      });
      fileMenuDropdown.addEventListener('click', async event => {
        const item = event.target.closest('.prompt-menu-item[data-action]');
        if (!item) return;
        const action = item.dataset.action;
        if (action === 'save-settings') {
          await handleSaveEncryptedSettings();
        } else if (action === 'load-settings') {
          loadSettingsFileInput?.click();
        }
        closeFileMenu();
      });
      fileMenuToggle.dataset.bound = 'true';
    }

    if (loadSettingsFileInput) {
      loadSettingsFileInput.addEventListener('change', async event => {
        const file = event?.target?.files?.[0] || null;
        loadSettingsFileInput.value = '';
        await handleLoadEncryptedSettings(file);
      });
    }

    if (sendButton) {
      sendButton.addEventListener('click', async () => {
        const providerKey = activeProvider;
        const providerLabel = getProviderOption(providerKey).label;
        const apiKey = toTrimmedString(apiKeyInput?.value);
        providerApiKeys[providerKey] = apiKey;
        const model = toTrimmedString(modelPicker?.value);
        const prompt = promptInput?.value || '';
        const endpoint = normalizeEndpoint(endpointInput?.value, providerKey);
        const maxTokens = Math.round(readNumberInput(maxTokensInput, 300, 1, 200000));
        const temperature = readNumberInput(temperatureInput, 1, 0, 2);
        const topP = readNumberInput(topPInput, 1, 0, 1);
        const topK = Math.round(readNumberInput(topKInput, 40, 0, TOP_K_MAX));
        const presencePenalty = readNumberInput(presencePenaltyInput, 0, -2, 2);
        const frequencyPenalty = readNumberInput(frequencyPenaltyInput, 0, -2, 2);
        const stop = parseStopSequences(stopInput?.value);

        if (isChatCompletionsEndpoint(endpoint)) {
          writeStatus(
            statusEl,
            'This app is completions-only. Use /completions (prompt), not /chat/completions.',
            true
          );
          return;
        }
        if (!apiKey) {
          writeStatus(statusEl, `Enter a ${providerLabel} API key first.`, true);
          return;
        }
        if (!model) {
          writeStatus(statusEl, 'Select a completion model first.', true);
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
            providerKey,
            endpoint,
            apiKey,
            model,
            prompt,
            maxTokens,
            temperature,
            topP,
            topK,
            presencePenalty,
            frequencyPenalty,
            stop
          });
          if (outputEl) outputEl.textContent = result.text || '';
          const modelPricing = getModelPricingMap(providerKey).get(model) || null;
          const estimatedCostUsd = estimateUsageCostUsd(result.usage, modelPricing);
          writeStatus(
            statusEl,
            buildBillingStatusMessage(result.usage || null, { estimatedCostUsd }),
            false
          );
        } catch (err) {
          const message = err && err.message ? err.message : 'Request failed';
          if (/reasoning is mandatory for this endpoint and cannot be disabled/i.test(message)) {
            const excludedModelIds = getExcludedModelIds(providerKey);
            if (model) excludedModelIds.add(model);
            await loadModels({
              providerKey,
              apiKey: providerApiKeys[providerKey],
              modelPicker,
              statusEl,
              excludedModelIds,
              modelPricingById: getModelPricingMap(providerKey)
            });
            writeStatus(
              statusEl,
              `Request failed: ${message}\nModel filtered out for completions-only mode.`,
              true
            );
            return;
          }
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
      providerKey: activeProvider,
      apiKey: providerApiKeys[activeProvider],
      modelPicker,
      statusEl,
      excludedModelIds: getExcludedModelIds(activeProvider),
      modelPricingById: getModelPricingMap(activeProvider)
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
