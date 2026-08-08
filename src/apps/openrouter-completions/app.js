(() => {
  'use strict';

  // Table of contents:
  // - Registry + safe readers
  // - Provider capability matrix (raw prompt, FIM, and legacy routes)
  // - Request/response helpers (completions + provider model catalogs)
  // - Shared encrypted-settings adapter + app-specific settings mapping
  // - Window binding + shared copy feedback
  // - App registration

  const APP_KEY = 'openrouter-completions';
  const PROVIDER_KEYS = Object.freeze({
    OPENROUTER: 'openrouter',
    DEEPSEEK: 'deepseek',
    FIREWORKS: 'fireworks',
    TOGETHER: 'together',
    MISTRAL: 'mistral',
    OPENAI: 'openai',
    HYPERBOLIC: 'hyperbolic'
  });
  const PROVIDER_OPTIONS = Object.freeze({
    [PROVIDER_KEYS.OPENROUTER]: {
      label: 'OpenRouter',
      defaultEndpoint: 'https://openrouter.ai/api/v1/completions',
      modelsEndpoint: 'https://openrouter.ai/api/v1/models',
      catalogKind: 'openrouter',
      catalogLabel: '/api/v1/models',
      catalogRequiresKey: false,
      modelParameterGating: true,
      pricingScale: 1,
      temperatureMax: 2,
      maxStopSequences: 4,
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature',
        'top_p',
        'top_k',
        'presence_penalty',
        'frequency_penalty',
        'stop'
      ]),
      responseMode: 'text',
      capabilityNote: 'Prompt-only legacy route. OpenRouter accepts prompt instead of messages, but its router may adapt a chat-trained model upstream. The client omits parameters that the selected model does not advertise; choose a base model when tokenizer-level raw continuation matters.'
    },
    [PROVIDER_KEYS.DEEPSEEK]: {
      label: 'DeepSeek FIM',
      defaultEndpoint: 'https://api.deepseek.com/beta/completions',
      modelsEndpoint: 'https://api.deepseek.com/models',
      catalogKind: 'deepseek',
      catalogLabel: '/models',
      catalogRequiresKey: true,
      pricingScale: 1,
      temperatureMax: 2,
      maxStopSequences: 16,
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature',
        'top_p',
        'stop',
        'suffix'
      ]),
      responseMode: 'text',
      maxTokens: 4096,
      capabilityNote: 'Native beta FIM route. Sends prompt plus an optional suffix with no messages array; DeepSeek currently documents deepseek-v4-pro for this endpoint and caps output at 4K tokens.'
    },
    [PROVIDER_KEYS.FIREWORKS]: {
      label: 'Fireworks',
      defaultEndpoint: 'https://api.fireworks.ai/inference/v1/completions',
      modelsEndpoint: 'https://api.fireworks.ai/v1/accounts/fireworks/models?filter=supports_serverless%3Dtrue&pageSize=200',
      catalogKind: 'fireworks',
      catalogLabel: '/v1/accounts/fireworks/models',
      catalogRequiresKey: true,
      // Fireworks caps each list response at 200 and returns nextPageToken.
      // Keep pagination data beside the catalog URL so the request helper
      // remains provider-driven instead of recognizing URL substrings.
      catalogPagination: Object.freeze({
        itemsField: 'models',
        nextTokenField: 'nextPageToken',
        queryParameter: 'pageToken',
        maxPages: 50
      }),
      pricingScale: 1,
      temperatureMax: 2,
      maxStopSequences: 4,
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature',
        'top_p',
        'top_k',
        'presence_penalty',
        'frequency_penalty',
        'stop'
      ]),
      responseMode: 'text',
      capabilityNote: 'Native raw text generation. Fireworks documents this route as leaving the provided prompt unchanged, including for base-model, custom-template, and deployment use.'
    },
    [PROVIDER_KEYS.TOGETHER]: {
      label: 'Together AI',
      defaultEndpoint: 'https://api.together.ai/v1/completions',
      modelsEndpoint: 'https://api.together.ai/v1/models',
      catalogKind: 'together',
      catalogLabel: '/v1/models',
      catalogRequiresKey: true,
      pricingScale: 0.000001,
      temperatureMax: 1,
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature',
        'top_p',
        'top_k',
        'presence_penalty',
        'frequency_penalty',
        'stop'
      ]),
      responseMode: 'text',
      capabilityNote: 'Text-completion route. Together accepts one prompt string and returns choices[].text; the picker excludes catalog entries typed as chat and keeps language/code models only.'
    },
    [PROVIDER_KEYS.MISTRAL]: {
      label: 'Mistral FIM',
      defaultEndpoint: 'https://api.mistral.ai/v1/fim/completions',
      modelsEndpoint: 'https://api.mistral.ai/v1/models',
      catalogKind: 'mistral',
      catalogLabel: '/v1/models',
      catalogRequiresKey: true,
      pricingScale: 1,
      temperatureMax: 1.5,
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature',
        'top_p',
        'stop',
        'suffix'
      ]),
      responseMode: 'message-content',
      capabilityNote: 'Native prompt/suffix FIM generation. The picker requires capabilities.completion_fim from the live catalog. The request is not chat-formatted, although Mistral wraps returned text inside choices[].message.content.'
    },
    [PROVIDER_KEYS.OPENAI]: {
      label: 'OpenAI API (Legacy)',
      defaultEndpoint: 'https://api.openai.com/v1/completions',
      modelsEndpoint: 'https://api.openai.com/v1/models',
      catalogKind: 'openai',
      catalogLabel: '/v1/models',
      catalogRequiresKey: true,
      pricingScale: 1,
      temperatureMax: 2,
      maxStopSequences: 4,
      parameterModelIds: Object.freeze({
        suffix: Object.freeze(['gpt-3.5-turbo-instruct'])
      }),
      modelMaxTokens: Object.freeze({
        'gpt-3.5-turbo-instruct': 4096,
        'davinci-002': 16384,
        'babbage-002': 16384
      }),
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature',
        'top_p',
        'presence_penalty',
        'frequency_penalty',
        'stop',
        'suffix'
      ]),
      responseMode: 'text',
      capabilityNote: 'Legacy non-chat API using deprecated completion-only models. Only gpt-3.5-turbo-instruct supports suffix; davinci-002 and babbage-002 are forward-only base models. OpenAI Platform billing is separate from ChatGPT.'
    },
    [PROVIDER_KEYS.HYPERBOLIC]: {
      label: 'Hyperbolic (Sunset)',
      defaultEndpoint: 'https://api.hyperbolic.xyz/v1/completions',
      catalogKind: 'hyperbolic',
      pricingScale: 1,
      temperatureMax: 2,
      requestParameters: Object.freeze([
        'max_tokens',
        'temperature'
      ]),
      responseMode: 'text',
      capabilityNote: 'Documented raw base-model completion route with prompt and choices[].text. Hyperbolic marks its only documented base model, Llama 3.1 405B BASE, for removal; no instruct/chat model is substituted here.'
    }
  });
  const PROVIDER_KEY_LIST = Object.freeze(Object.keys(PROVIDER_OPTIONS));
  const DEFAULT_PROVIDER_KEY = PROVIDER_KEYS.FIREWORKS;
  const DEEPSEEK_FALLBACK_MODELS = Object.freeze([
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (FIM beta)', contextLength: 1000000 }
  ]);
  const MISTRAL_FALLBACK_MODELS = Object.freeze([
    { id: 'codestral-latest', name: 'Codestral Latest (FIM)', contextLength: null }
  ]);
  const OPENAI_COMPLETION_MODEL_IDS = new Set([
    'gpt-3.5-turbo-instruct',
    'davinci-002',
    'babbage-002'
  ]);
  const OPENAI_FALLBACK_MODELS = Object.freeze([
    { id: 'gpt-3.5-turbo-instruct', name: 'GPT-3.5 Turbo Instruct (deprecated)', contextLength: 4096 },
    { id: 'davinci-002', name: 'Davinci 002 base (deprecated)', contextLength: 16384 },
    { id: 'babbage-002', name: 'Babbage 002 base (deprecated)', contextLength: 16384 }
  ]);
  const HYPERBOLIC_FALLBACK_MODELS = Object.freeze([
    {
      id: 'meta-llama/Meta-Llama-3.1-405B',
      name: 'Llama 3.1 405B BASE (sunset)',
      contextLength: null
    }
  ]);
  const TOP_K_MAX = 100;
  const COMPLETION_SETTINGS_KIND = 'yolk-completion-api-settings';
  const COMPLETION_SETTINGS_VERSION = 1;
  const DEFAULT_SETTINGS_FILE_NAME = 'completion-providers-encrypted-settings.json';

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
      .filter(line => line.length > 0);
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
    return window.YolkEncryptedSettings?.promptForPassword?.(action) ?? null;
  }

  function getProviderOption(providerKey) {
    return PROVIDER_OPTIONS[providerKey] || PROVIDER_OPTIONS[DEFAULT_PROVIDER_KEY];
  }

  // Build provider-scoped state from one authoritative key list. New adapters
  // therefore inherit isolated credentials, exclusion sets, and pricing maps
  // without another hand-maintained branch elsewhere in the window binder.
  function createProviderMap(factory) {
    return PROVIDER_KEY_LIST.reduce((result, providerKey) => {
      result[providerKey] = typeof factory === 'function' ? factory(providerKey) : factory;
      return result;
    }, {});
  }

  function normalizeProviderKey(value) {
    const key = toTrimmedString(value).toLowerCase();
    return PROVIDER_OPTIONS[key] ? key : DEFAULT_PROVIDER_KEY;
  }

  function defaultEndpointForProvider(providerKey) {
    return getProviderOption(providerKey).defaultEndpoint;
  }

  // Provider records are the protocol allowlist. OpenRouter additionally
  // publishes parameter support per model, while OpenAI restricts suffix to
  // one completion model; both narrower declarations override provider scope.
  function providerSupportsRequestParameter(providerKey, parameter, modelEntry = null) {
    const provider = getProviderOption(providerKey);
    if (!provider.requestParameters?.includes(parameter)) return false;
    const modelAllowlist = provider.parameterModelIds?.[parameter];
    if (Array.isArray(modelAllowlist)) {
      const modelId = toTrimmedString(modelEntry?.id).toLowerCase();
      if (!modelId || !modelAllowlist.some(id => id.toLowerCase() === modelId)) return false;
    }
    const advertised = toLowerArray(modelEntry?.supportedParameters);
    if (provider.modelParameterGating) {
      // Missing router metadata is not permission. A restored or newly listed
      // model with no supported_parameters record still receives the required
      // prompt, while every optional sampling field stays omitted.
      return Array.isArray(modelEntry?.supportedParameters) &&
        advertised.includes(parameter.toLowerCase());
    }
    return true;
  }

  function getProviderTemperatureMax(providerKey) {
    return getProviderOption(providerKey).temperatureMax || 2;
  }

  function getModelMaxTokens(providerKey, modelEntry = null) {
    const provider = getProviderOption(providerKey);
    const modelId = toTrimmedString(modelEntry?.id);
    const modelSpecific = Number(provider.modelMaxTokens?.[modelId]);
    if (Number.isFinite(modelSpecific) && modelSpecific > 0) return modelSpecific;
    const advertised = Number(modelEntry?.maxCompletionTokens);
    if (Number.isFinite(advertised) && advertised > 0) return advertised;
    if (Number.isFinite(provider.maxTokens) && provider.maxTokens > 0) return provider.maxTokens;
    const contextLength = Number(modelEntry?.contextLength);
    if (Number.isFinite(contextLength) && contextLength > 0) return contextLength;
    return 200000;
  }

  function normalizeEndpoint(value, providerKey = DEFAULT_PROVIDER_KEY) {
    const raw = toTrimmedString(value);
    return raw || defaultEndpointForProvider(providerKey);
  }

  function isChatCompletionsEndpoint(endpoint) {
    const value = String(endpoint || '').toLowerCase();
    return /\/chat\/completions(?:$|[/?#])/.test(value);
  }

  // A custom proxy remains possible, but it must expose an absolute HTTP(S)
  // completions path. This rejects Responses, Messages, and accidental chat
  // URLs before any credential or prompt leaves the browser.
  function isHttpCompletionEndpoint(endpoint) {
    try {
      const parsed = new URL(String(endpoint || ''));
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      if (isChatCompletionsEndpoint(parsed.href)) return false;
      return /\/completions\/?$/i.test(parsed.pathname);
    } catch (err) {
      return false;
    }
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

  function readModelPricing(modelEntry, pricingScale = 1) {
    if (!modelEntry || typeof modelEntry !== 'object') return null;
    const scale = Number.isFinite(Number(pricingScale)) ? Number(pricingScale) : 1;
    const ambiguousInputPrice = readFirstPathNumber(modelEntry, [
      'pricing.input',
      'pricing.prompt'
    ]);
    const ambiguousOutputPrice = readFirstPathNumber(modelEntry, [
      'pricing.output',
      'pricing.completion'
    ]);
    const ambiguousCachedPrice = readFirstPathNumber(modelEntry, [
      'pricing.cached_input',
      'pricing.cache_read'
    ]);
    const inputUsdPerToken = readFirstPathNumber(modelEntry, [
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
    const ambiguousFlatPrice = readFirstPathNumber(modelEntry, [
      'pricing.token'
    ]);
    const flatUsdPerToken = readFirstPathNumber(modelEntry, [
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
      : ambiguousFlatPrice != null
        ? ambiguousFlatPrice * scale
        : flatUsdPerMillion != null
          ? flatUsdPerMillion / 1000000
          : null;
    const inputRate = inputUsdPerToken != null
      ? inputUsdPerToken
      : ambiguousInputPrice != null
        ? ambiguousInputPrice * scale
        : inputUsdPerMillion != null
          ? inputUsdPerMillion / 1000000
          : flatRate;
    const outputRate = outputUsdPerToken != null
      ? outputUsdPerToken
      : ambiguousOutputPrice != null
        ? ambiguousOutputPrice * scale
        : outputUsdPerMillion != null
          ? outputUsdPerMillion / 1000000
          : flatRate;
    const cachedRate = cachedInputUsdPerToken != null
      ? cachedInputUsdPerToken
      : ambiguousCachedPrice != null
        ? ambiguousCachedPrice * scale
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
  // Empty string text is still a valid completion, especially when stop sequences
  // end generation immediately, so the presence of the text field matters.
  function readCompletionChoice(payload) {
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    return choice && typeof choice === 'object' ? choice : null;
  }

  function hasCompletionText(payload, responseMode = 'text') {
    const choice = readCompletionChoice(payload);
    if (responseMode === 'message-content') {
      return typeof choice?.message?.content === 'string';
    }
    return typeof choice?.text === 'string';
  }

  function readCompletionText(payload, responseMode = 'text') {
    const choice = readCompletionChoice(payload);
    if (responseMode === 'message-content') {
      return typeof choice?.message?.content === 'string' ? choice.message.content : '';
    }
    return typeof choice?.text === 'string' ? choice.text : '';
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

  function hasCryptoSupport() {
    return window.YolkEncryptedSettings?.isSupported?.() === true;
  }

  async function encryptSettings(password, settings) {
    if (!window.YolkEncryptedSettings) throw new Error('Encrypted settings helper is unavailable.');
    return window.YolkEncryptedSettings.encrypt(password, settings);
  }

  async function decryptSettings(password, payload) {
    if (!window.YolkEncryptedSettings) throw new Error('Encrypted settings helper is unavailable.');
    return window.YolkEncryptedSettings.decrypt(password, payload);
  }

  function downloadEncryptedSettings(payload, fileName = DEFAULT_SETTINGS_FILE_NAME) {
    return window.YolkEncryptedSettings?.download?.(payload, fileName) === true;
  }

  async function readEncryptedSettingsFile(file) {
    if (!window.YolkEncryptedSettings) throw new Error('Encrypted settings helper is unavailable.');
    return window.YolkEncryptedSettings.readFile(file);
  }

  async function readErrorMessage(response) {
    if (typeof response?.text === 'function') {
      try {
        const raw = await response.text();
        if (raw && raw.trim()) {
          try {
            const payload = JSON.parse(raw);
            const errorText = payload?.error?.message || payload?.message || payload?.detail;
            if (typeof errorText === 'string' && errorText.trim()) return errorText.trim();
          } catch (parseErr) {
            return raw.trim();
          }
        }
      } catch (readErr) {
        /* fall through to mock/legacy response readers */
      }
    }
    try {
      const payload = await response.json();
      const errorText = payload?.error?.message || payload?.message || payload?.detail;
      if (typeof errorText === 'string' && errorText.trim()) return errorText.trim();
      return `HTTP ${response.status}`;
    } catch (err) {
      return `HTTP ${response.status}`;
    }
  }

  async function requestCompletion(config) {
    const {
      providerKey,
      endpoint,
      apiKey,
      model,
      modelEntry,
      prompt,
      suffix,
      maxTokens,
      temperature,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      stop
    } = config;
    const provider = getProviderOption(providerKey);
    if (!isHttpCompletionEndpoint(endpoint)) {
      throw new Error('Completion endpoint must be an absolute HTTP(S) URL ending in /completions.');
    }
    if (typeof prompt !== 'string' || !prompt.length) {
      throw new Error('A prompt string is required for every completion request.');
    }
    if (Array.isArray(stop) && provider.maxStopSequences && stop.length > provider.maxStopSequences) {
      throw new Error(`${provider.label} accepts at most ${provider.maxStopSequences} stop sequences.`);
    }
    const supports = parameter =>
      providerSupportsRequestParameter(providerKey, parameter, modelEntry);
    const includeTopP = supports('top_p') && Number.isFinite(topP) && topP > 0;
    const includeTopK = supports('top_k') && Number.isFinite(topK) && topK > 0;
    const includeMaxTokens = supports('max_tokens') && Number.isFinite(maxTokens) && maxTokens > 0;
    const includePresencePenalty =
      supports('presence_penalty') && Number.isFinite(presencePenalty) && presencePenalty !== 0;
    const includeFrequencyPenalty =
      supports('frequency_penalty') && Number.isFinite(frequencyPenalty) && frequencyPenalty !== 0;
    const includeTemperature = supports('temperature') && Number.isFinite(temperature);
    const includeStop = supports('stop') && stop;
    const includeSuffix =
      supports('suffix') && typeof suffix === 'string' && suffix.length > 0;
    // Every adapter starts with the same continuation contract: one prompt
    // string and no role-bearing messages. Capability flags only add fields
    // documented by that provider, preventing silent chat conversion in-client.
    const requestBody = {
      model,
      prompt,
      ...(includeSuffix ? { suffix } : {}),
      ...(includeMaxTokens ? { max_tokens: maxTokens } : {}),
      ...(includeTopP ? { top_p: topP } : {}),
      ...(includeTopK ? { top_k: topK } : {}),
      ...(includePresencePenalty ? { presence_penalty: presencePenalty } : {}),
      ...(includeFrequencyPenalty ? { frequency_penalty: frequencyPenalty } : {}),
      ...(includeTemperature ? { temperature } : {}),
      ...(includeStop ? { stop } : {}),
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
    const hasText = hasCompletionText(payload, provider.responseMode);
    const completion = hasText ? readCompletionText(payload, provider.responseMode) : '';
    if (!hasText) {
      const choice = readCompletionChoice(payload);
      if (provider.responseMode === 'text' && typeof choice?.message?.content === 'string') {
        throw new Error(
          'Model returned a chat-style response. Use a completion-capable model for pure continuation.'
        );
      }
      throw new Error(`${provider.label} did not return completion text in its documented response field.`);
    }
    return {
      id: toTrimmedString(payload?.id),
      text: completion,
      usage: normalizeCompletionUsage(payload)
    };
  }

  // Model-list responses are not actually OpenAI-uniform: Together returns a
  // top-level array, Fireworks uses camelCase under `models`, Mistral publishes
  // FIM capability flags, and OpenRouter prices per token. Normalize those
  // shapes once so rendering, capability gating, and cost math share one record.
  function normalizeSimpleModelEntries(payload, providerKey) {
    const provider = getProviderOption(providerKey);
    const data = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.models)
          ? payload.models
          : [];
    const unique = new Map();
    data.forEach(entry => {
      const id = toTrimmedString(entry?.id || entry?.name);
      if (!id || unique.has(id)) return;
      const contextLength = firstNumber([
        entry?.context_length,
        entry?.contextLength,
        entry?.max_context_length,
        entry?.top_provider?.context_length
      ]);
      const maxCompletionTokens = firstNumber([
        entry?.max_completion_tokens,
        entry?.maxCompletionTokens,
        entry?.top_provider?.max_completion_tokens
      ]);
      const fimCapability = entry?.capabilities?.completion_fim;
      const supportsServerless = entry?.supportsServerless ?? entry?.supports_serverless;
      unique.set(id, {
        id,
        name: toTrimmedString(entry?.display_name || entry?.displayName || entry?.name || ''),
        contextLength,
        maxCompletionTokens,
        pricing: readModelPricing(entry, provider.pricingScale),
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
        instructType: toTrimmedString(entry?.architecture?.instruct_type || entry?.instruct_type || ''),
        task: toTrimmedString(
          entry?.task ||
          entry?.type ||
          entry?.modality ||
          entry?.baseModelDetails?.modelType ||
          ''
        ),
        kind: toTrimmedString(entry?.kind || ''),
        fimCapable: typeof fimCapability === 'boolean' ? fimCapability : null,
        supportsServerless: typeof supportsServerless === 'boolean' ? supportsServerless : null,
        archived: entry?.archived === true,
        reasoningMandatory: entry?.reasoning?.mandatory === true
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  function formatModelOption(entry) {
    const namePart = entry.name && entry.name !== entry.id ? ` - ${entry.name}` : '';
    const ctxPart = Number.isFinite(entry.contextLength) ? ` (${entry.contextLength} ctx)` : '';
    return `${entry.id}${namePart}${ctxPart}`;
  }

  function isMistralFimModel(entry) {
    if (entry?.fimCapable === true) return true;
    if (entry?.fimCapable === false) return false;
    const identity = `${entry?.id || ''} ${entry?.name || ''}`.toLowerCase();
    return identity.includes('codestral');
  }

  function isOpenAICompletionModel(entry) {
    return OPENAI_COMPLETION_MODEL_IDS.has(toTrimmedString(entry?.id).toLowerCase());
  }

  function isLikelyTextCompletionModel(entry) {
    if (entry?.archived || entry?.reasoningMandatory) return false;
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

  // Read one native catalog completely. Most providers return one payload;
  // Fireworks uses Google-style page tokens, so its provider record supplies
  // the item/token paths and this loop merges every page before normalization.
  async function requestProviderModelCatalog(providerKey, apiKey) {
    const provider = getProviderOption(providerKey);
    if (!provider.modelsEndpoint) return [];
    const pagination = provider.catalogPagination;
    const maxPages = Math.max(1, Number(pagination?.maxPages) || 1);
    const mergedItems = [];
    const seenPageTokens = new Set();
    let pageToken = '';
    let lastPayload = null;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const requestUrl = new URL(provider.modelsEndpoint);
      if (pageToken && pagination?.queryParameter) {
        requestUrl.searchParams.set(pagination.queryParameter, pageToken);
      }
      const response = await fetch(requestUrl.href, {
        headers: buildOptionalAuthHeaders(apiKey)
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      lastPayload = await response.json();
      if (!pagination) break;

      const pageItems = readPath(lastPayload, pagination.itemsField);
      if (Array.isArray(pageItems)) mergedItems.push(...pageItems);
      const nextPageToken = toTrimmedString(
        readPath(lastPayload, pagination.nextTokenField)
      );
      // An absent or repeated token is the documented end condition plus a
      // defensive cycle break for malformed proxy/catalog responses.
      if (!nextPageToken || seenPageTokens.has(nextPageToken)) break;
      seenPageTokens.add(nextPageToken);
      pageToken = nextPageToken;
    }

    const payload = pagination
      ? { [pagination.itemsField]: mergedItems }
      : lastPayload;
    return normalizeSimpleModelEntries(payload, providerKey);
  }

  function getCuratedModels(providerKey) {
    if (providerKey === PROVIDER_KEYS.DEEPSEEK) return DEEPSEEK_FALLBACK_MODELS.slice();
    if (providerKey === PROVIDER_KEYS.MISTRAL) return MISTRAL_FALLBACK_MODELS.slice();
    if (providerKey === PROVIDER_KEYS.OPENAI) return OPENAI_FALLBACK_MODELS.slice();
    if (providerKey === PROVIDER_KEYS.HYPERBOLIC) return HYPERBOLIC_FALLBACK_MODELS.slice();
    return [];
  }

  // Catalogs describe products differently, so filtering is deliberately
  // provider-aware. The fallback rows are documentation-backed escape hatches,
  // not guesses that every chat model can honor raw continuation semantics.
  function filterModelsForProvider(providerKey, entries) {
    let filtered = entries.filter(isLikelyTextCompletionModel);
    if (providerKey === PROVIDER_KEYS.FIREWORKS) {
      filtered = filtered.filter(entry => entry.supportsServerless !== false);
    } else if (providerKey === PROVIDER_KEYS.DEEPSEEK) {
      // The general account catalog also contains chat-only V4 Flash. The FIM
      // schema currently names only V4 Pro, so intersect rather than infer.
      filtered = filtered.filter(entry => entry.id.toLowerCase() === 'deepseek-v4-pro');
    } else if (providerKey === PROVIDER_KEYS.TOGETHER) {
      filtered = filtered.filter(entry => ['language', 'code'].includes(entry.task.toLowerCase()));
    } else if (providerKey === PROVIDER_KEYS.MISTRAL) {
      filtered = filtered.filter(isMistralFimModel);
    } else if (providerKey === PROVIDER_KEYS.OPENAI) {
      filtered = filtered.filter(isOpenAICompletionModel);
    }
    return filtered;
  }

  // Pull live models from the active provider and render completion-capable options.
  async function loadModels(config) {
    const {
      providerKey,
      apiKey,
      modelPicker,
      statusEl,
      excludedModelIds,
      modelPricingById,
      activeModel,
      isRequestStale,
      onModelsLoaded
    } = config;
    const stale = typeof isRequestStale === 'function' ? isRequestStale : () => false;
    if (!modelPicker) return;
    if (stale()) return;
    if (typeof fetch !== 'function') {
      if (stale()) return;
      writeStatus(statusEl, 'Model list unavailable: fetch is not supported in this environment.', true);
      return;
    }
    const provider = normalizeProviderKey(providerKey);
    const providerOption = getProviderOption(provider);
    const providerLabel = providerOption.label;
    const curatedEntries = getCuratedModels(provider);
    const key = toTrimmedString(apiKey);
    const notifyModelsLoaded = entries => {
      if (typeof onModelsLoaded === 'function') onModelsLoaded(entries);
    };
    const commitEntries = entries => {
      if (modelPricingById) {
        modelPricingById.clear();
        entries.forEach(entry => {
          if (entry?.pricing) modelPricingById.set(entry.id, entry.pricing);
        });
      }
      renderModelPicker(modelPicker, entries, activeModel);
      notifyModelsLoaded(entries);
    };
    if (!key && providerOption.modelsEndpoint && providerOption.catalogRequiresKey !== false) {
      if (stale()) return;
      commitEntries(curatedEntries);
      if (curatedEntries.length) {
        writeStatus(
          statusEl,
          `Loaded ${curatedEntries.length} documented ${providerLabel} completion model${curatedEntries.length === 1 ? '' : 's'}. Enter an API key before sending.`
        );
      } else {
        writeStatus(statusEl, `Enter a ${providerLabel} API key to load models.`);
      }
      return;
    }
    if (stale()) return;
    writeStatus(
      statusEl,
      key
        ? `Loading ${providerLabel} models for this API key...`
        : `Loading the public ${providerLabel} model catalog...`
    );
    let entries = [];
    let source = '';
    let keyCatalogError = '';
    try {
      if (providerOption.modelsEndpoint) {
        entries = await requestProviderModelCatalog(provider, key);
        source = providerOption.catalogLabel || '/v1/models';
      } else {
        entries = curatedEntries;
        source = 'documented catalog';
      }
      entries = filterModelsForProvider(provider, entries);

      if (excludedModelIds && excludedModelIds.size) {
        entries = entries.filter(entry => !excludedModelIds.has(entry.id));
      }
      if (stale()) return;
      commitEntries(entries);
      const keyReminder = key ? '' : ' Enter an API key before sending.';
      writeStatus(
        statusEl,
        `Loaded ${entries.length} completion models from ${providerLabel} ${source}.${keyReminder}`
      );
    } catch (err) {
      if (stale()) return;
      if (curatedEntries.length && key && ![401, 403].includes(err?.status)) {
        const fallbackEntries = curatedEntries.filter(entry => !excludedModelIds?.has(entry.id));
        commitEntries(fallbackEntries);
        writeStatus(statusEl, `Loaded ${fallbackEntries.length} documented fallback ${providerLabel} models.`);
        return;
      }
      keyCatalogError = err && err.message ? err.message : 'request failed';
      commitEntries([]);
      writeStatus(statusEl, `${providerLabel} model list load failed: ${keyCatalogError}`, true);
    }
  }

  function collectOpenRouterSettings(
    inputs,
    providerApiKeys,
    providerEndpoints,
    providerModels
  ) {
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
      suffixInput,
      apiKeyInput,
      titleInput,
      promptInput
    } = inputs;
    const provider = normalizeProviderKey(providerSelect?.value);
    const apiKeys = createProviderMap(providerKey =>
      toTrimmedString(providerApiKeys?.[providerKey])
    );
    const endpoints = createProviderMap(providerKey =>
      normalizeEndpoint(providerEndpoints?.[providerKey], providerKey)
    );
    const models = createProviderMap(providerKey =>
      toTrimmedString(providerModels?.[providerKey])
    );
    apiKeys[provider] = toTrimmedString(apiKeyInput?.value);
    endpoints[provider] = normalizeEndpoint(endpointInput?.value, provider);
    models[provider] = toTrimmedString(modelPicker?.value);
    const activeModelEntry = models[provider] ? { id: models[provider] } : null;
    PROVIDER_KEY_LIST.forEach(providerKey => {
      if (!isHttpCompletionEndpoint(endpoints[providerKey])) {
        throw new Error(`${getProviderOption(providerKey).label} has an invalid completion endpoint.`);
      }
    });
    return {
      kind: COMPLETION_SETTINGS_KIND,
      version: COMPLETION_SETTINGS_VERSION,
      provider,
      endpoints,
      models,
      endpoint: endpoints[provider],
      model: models[provider],
      maxTokens: Math.round(
        readNumberInput(maxTokensInput, 0, 0, getModelMaxTokens(provider, activeModelEntry))
      ),
      temperature: readNumberInput(
        temperatureInput,
        1,
        0,
        getProviderTemperatureMax(provider)
      ),
      topP: readNumberInput(topPInput, 0, 0, 1),
      topK: Math.round(readNumberInput(topKInput, 0, 0, TOP_K_MAX)),
      presencePenalty: readNumberInput(presencePenaltyInput, 0, -2, 2),
      frequencyPenalty: readNumberInput(frequencyPenaltyInput, 0, -2, 2),
      stopText: String(stopInput?.value || ''),
      suffix: String(suffixInput?.value || ''),
      apiKeys,
      apiKey: apiKeys[provider],
      title: toTrimmedString(titleInput?.value),
      prompt: String(promptInput?.value || '')
    };
  }

  function applyOpenRouterSettings(
    inputs,
    settings,
    providerApiKeys,
    providerEndpoints,
    providerModels
  ) {
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
      suffixInput,
      apiKeyInput,
      titleInput,
      promptInput
    } = inputs;
    if (
      settings?.kind !== COMPLETION_SETTINGS_KIND ||
      settings?.version !== COMPLETION_SETTINGS_VERSION ||
      !PROVIDER_OPTIONS[settings?.provider] ||
      !settings?.apiKeys ||
      typeof settings.apiKeys !== 'object' ||
      Array.isArray(settings.apiKeys) ||
      !settings?.endpoints ||
      typeof settings.endpoints !== 'object' ||
      Array.isArray(settings.endpoints) ||
      !settings?.models ||
      typeof settings.models !== 'object' ||
      Array.isArray(settings.models)
    ) {
      throw new Error('This is not a supported Completion API settings file.');
    }
    const nextProvider = settings.provider;
    const loadedApiKeys = createProviderMap('');
    const loadedEndpoints = createProviderMap(providerKey => defaultEndpointForProvider(providerKey));
    const loadedModels = createProviderMap('');
    PROVIDER_KEY_LIST.forEach(providerKey => {
      loadedApiKeys[providerKey] = toTrimmedString(settings.apiKeys[providerKey]);
      loadedEndpoints[providerKey] = normalizeEndpoint(settings.endpoints[providerKey], providerKey);
      loadedModels[providerKey] = toTrimmedString(settings.models[providerKey]);
      if (!isHttpCompletionEndpoint(loadedEndpoints[providerKey])) {
        throw new Error(`${getProviderOption(providerKey).label} has an invalid completion endpoint.`);
      }
    });

    // Mutation begins only after every product, version, provider, and endpoint
    // check succeeds. A Terminal ciphertext or malformed provider map therefore
    // cannot partially overwrite the active Completion workspace.
    if (providerSelect) providerSelect.value = nextProvider;
    PROVIDER_KEY_LIST.forEach(providerKey => {
      if (providerApiKeys) providerApiKeys[providerKey] = loadedApiKeys[providerKey];
      if (providerEndpoints) providerEndpoints[providerKey] = loadedEndpoints[providerKey];
      if (providerModels) providerModels[providerKey] = loadedModels[providerKey];
    });
    if (endpointInput) endpointInput.value = loadedEndpoints[nextProvider];
    if (modelPicker) {
      const requestedModel = loadedModels[nextProvider];
      renderModelPicker(
        modelPicker,
        requestedModel ? [{ id: requestedModel, name: 'Saved selection', contextLength: null }] : [],
        requestedModel
      );
    }
    const restoredModelEntry = { id: loadedModels[nextProvider] };
    const restoredMaxTokens = getModelMaxTokens(nextProvider, restoredModelEntry);
    if (maxTokensInput) {
      maxTokensInput.value = String(
        Math.round(readNumberInput({ value: settings?.maxTokens }, 0, 0, restoredMaxTokens))
      );
    }
    if (temperatureInput) {
      temperatureInput.value = String(
        readNumberInput(
          { value: settings?.temperature },
          1,
          0,
          getProviderTemperatureMax(nextProvider)
        )
      );
    }
    if (topPInput) topPInput.value = String(readNumberInput({ value: settings?.topP }, 0, 0, 1));
    if (topKInput) topKInput.value = String(Math.round(readNumberInput({ value: settings?.topK }, 0, 0, TOP_K_MAX)));
    if (presencePenaltyInput) presencePenaltyInput.value = String(readNumberInput({ value: settings?.presencePenalty }, 0, -2, 2));
    if (frequencyPenaltyInput) frequencyPenaltyInput.value = String(readNumberInput({ value: settings?.frequencyPenalty }, 0, -2, 2));
    if (stopInput) stopInput.value = String(settings?.stopText || '');
    if (suffixInput) suffixInput.value = String(settings?.suffix || '');
    if (apiKeyInput) apiKeyInput.value = loadedApiKeys[nextProvider];
    if (titleInput) titleInput.value = toTrimmedString(settings?.title);
    if (promptInput) promptInput.value = String(settings?.prompt || '');
    return nextProvider;
  }

  // Mirror Prompt Enhancer copy controls: a successful write presses the
  // button green, swaps in a checkmark, then restores its original glyph.
  function showCopyFeedback(button) {
    if (!button) return;
    const originalLabel = button.dataset.originalLabel || button.textContent;
    const originalTitle = button.dataset.originalTitle || button.title;
    button.dataset.originalLabel = originalLabel;
    button.dataset.originalTitle = originalTitle;
    button.classList.add('copied');
    button.title = 'Copied!';
    button.textContent = '✓';
    clearTimeout(button._copyTimeout);
    button._copyTimeout = setTimeout(() => {
      button.classList.remove('copied');
      button.title = originalTitle;
      button.textContent = originalLabel;
    }, 900);
  }

  function copyToClipboard(text, button) {
    const value = String(text ?? '');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      // Empty completions are valid output; copy the exact panel text, even when blank.
      return navigator.clipboard.writeText(value)
        .then(() => {
          showCopyFeedback(button);
          return true;
        })
        .catch(() => false);
    }
    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
      return Promise.resolve(false);
    }
    // Legacy copy keeps the standalone file experience useful in older browsers.
    const textarea = document.createElement('textarea');
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy') !== false;
    } catch (err) {
      copied = false;
    }
    textarea.remove();
    if (copied) showCopyFeedback(button);
    return Promise.resolve(copied);
  }

  function initializeOpenRouterWindow(windowEl) {
    const root = windowEl?.querySelector?.('.openrouter-app');
    if (!root || root.dataset.bound === 'true') return;

    const providerSelect = root.querySelector('.openrouter-provider');
    const endpointInput = root.querySelector('.openrouter-endpoint');
    const providerNote = root.querySelector('.openrouter-provider-note');
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
    const suffixBlock = root.querySelector('.openrouter-suffix-block');
    const suffixInput = root.querySelector('.openrouter-suffix');
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
    const providerApiKeys = createProviderMap('');
    const providerEndpoints = createProviderMap(providerKey => defaultEndpointForProvider(providerKey));
    const providerModels = createProviderMap('');
    const modelEntriesByProvider = createProviderMap(() => new Map());
    const excludedModelIdsByProvider = createProviderMap(() => new Set());
    const modelPricingByProvider = createProviderMap(() => new Map());
    let activeProvider = normalizeProviderKey(providerSelect?.value);
    let modelLoadRequestToken = 0;

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
    const getModelEntriesMap = providerKey => {
      const key = normalizeProviderKey(providerKey);
      if (!modelEntriesByProvider[key]) modelEntriesByProvider[key] = new Map();
      return modelEntriesByProvider[key];
    };
    const getSelectedModelEntry = (providerKey = activeProvider) => {
      const key = normalizeProviderKey(providerKey);
      const modelId = key === activeProvider
        ? toTrimmedString(modelPicker?.value)
        : toTrimmedString(providerModels[key]);
      if (!modelId) return null;
      return getModelEntriesMap(key).get(modelId) || { id: modelId };
    };
    // Keep every provider's key, endpoint, and model together. Switching the
    // picker can no longer leak a custom endpoint or model choice into the next
    // adapter, and encrypted files serialize the same provider-scoped topology.
    const persistActiveProviderState = () => {
      providerApiKeys[activeProvider] = toTrimmedString(apiKeyInput?.value);
      providerEndpoints[activeProvider] = normalizeEndpoint(endpointInput?.value, activeProvider);
      providerModels[activeProvider] = toTrimmedString(modelPicker?.value);
    };
    const syncApiKeyInputFromProvider = () => {
      if (apiKeyInput) apiKeyInput.value = providerApiKeys[activeProvider] || '';
    };
    const syncEndpointInputFromProvider = () => {
      if (endpointInput) {
        endpointInput.value = normalizeEndpoint(providerEndpoints[activeProvider], activeProvider);
      }
    };
    const syncProviderCapabilities = () => {
      const provider = getProviderOption(activeProvider);
      const modelEntry = getSelectedModelEntry();
      const supports = parameter =>
        providerSupportsRequestParameter(activeProvider, parameter, modelEntry);
      if (providerNote) providerNote.textContent = provider.capabilityNote || '';
      if (suffixBlock) suffixBlock.classList.toggle('is-hidden', !supports('suffix'));
      if (suffixInput) suffixInput.disabled = !supports('suffix');
      if (temperatureInput) temperatureInput.disabled = !supports('temperature');
      if (topPInput) topPInput.disabled = !supports('top_p');
      if (topKInput) topKInput.disabled = !supports('top_k');
      if (presencePenaltyInput) presencePenaltyInput.disabled = !supports('presence_penalty');
      if (frequencyPenaltyInput) frequencyPenaltyInput.disabled = !supports('frequency_penalty');
      if (stopInput) stopInput.disabled = !supports('stop');
      if (maxTokensInput) {
        const maxTokens = getModelMaxTokens(activeProvider, modelEntry);
        maxTokensInput.disabled = !supports('max_tokens');
        maxTokensInput.max = String(maxTokens);
        const currentMax = Math.max(0, Number(maxTokensInput.value) || 0);
        if (currentMax > maxTokens) {
          maxTokensInput.value = String(maxTokens);
        }
      }
      if (temperatureInput) {
        const temperatureMax = getProviderTemperatureMax(activeProvider);
        temperatureInput.max = String(temperatureMax);
        const currentTemperature = Math.max(0, Number(temperatureInput.value) || 0);
        if (currentTemperature > temperatureMax) {
          temperatureInput.value = String(temperatureMax);
        }
      }
    };
    const loadModelsForProvider = (providerKey, apiKey) => {
      const requestedProvider = normalizeProviderKey(providerKey);
      const requestToken = ++modelLoadRequestToken;
      return loadModels({
        providerKey: requestedProvider,
        apiKey,
        modelPicker,
        statusEl,
        excludedModelIds: getExcludedModelIds(requestedProvider),
        modelPricingById: getModelPricingMap(requestedProvider),
        activeModel: providerModels[requestedProvider],
        isRequestStale: () => {
          if (requestToken !== modelLoadRequestToken) return true;
          const currentProvider = normalizeProviderKey(providerSelect?.value || activeProvider);
          return currentProvider !== requestedProvider;
        },
        onModelsLoaded: entries => {
          const entriesMap = new Map(entries.map(entry => [entry.id, entry]));
          modelEntriesByProvider[requestedProvider] = entriesMap;
          if (requestToken !== modelLoadRequestToken || requestedProvider !== activeProvider) return;
          providerModels[requestedProvider] = toTrimmedString(modelPicker?.value);
          syncProviderCapabilities();
          syncSliderValues();
        }
      });
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
          topPInput?.disabled || (Number.isFinite(topP) && topP <= 0)
        );
      }
      if (topKValue) {
        topKValue.textContent = formatDisableableSliderValue(
          topKInput?.value,
          0,
          topKInput?.disabled || (Number.isFinite(topK) && topK <= 0)
        );
      }
      if (presencePenaltyValue) {
        presencePenaltyValue.textContent = formatDisableableSliderValue(
          presencePenaltyInput?.value,
          1,
          presencePenaltyInput?.disabled ||
            (Number.isFinite(presencePenalty) && presencePenalty === 0)
        );
      }
      if (frequencyPenaltyValue) {
        frequencyPenaltyValue.textContent = formatDisableableSliderValue(
          frequencyPenaltyInput?.value,
          1,
          frequencyPenaltyInput?.disabled ||
            (Number.isFinite(frequencyPenalty) && frequencyPenalty === 0)
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
    if (titleInput && !toTrimmedString(titleInput.value)) {
      titleInput.value = 'Prompt Enhancer';
    }

    if (endpointInput && !toTrimmedString(endpointInput.value)) {
      endpointInput.value = defaultEndpointForProvider(activeProvider);
    }
    providerEndpoints[activeProvider] = normalizeEndpoint(endpointInput?.value, activeProvider);
    providerModels[activeProvider] = toTrimmedString(modelPicker?.value);
    syncProviderCapabilities();
    syncSliderValues();

    if (providerSelect) {
      providerSelect.addEventListener('change', () => {
        persistActiveProviderState();
        activeProvider = normalizeProviderKey(providerSelect.value);
        syncApiKeyInputFromProvider();
        syncEndpointInputFromProvider();
        const cachedEntries = Array.from(getModelEntriesMap(activeProvider).values());
        renderModelPicker(modelPicker, cachedEntries, providerModels[activeProvider]);
        syncProviderCapabilities();
        syncSliderValues();
        loadModelsForProvider(activeProvider, providerApiKeys[activeProvider]);
      });
    }

    if (modelPicker) {
      modelPicker.addEventListener('change', () => {
        providerModels[activeProvider] = toTrimmedString(modelPicker.value);
        syncProviderCapabilities();
        syncSliderValues();
      });
    }

    if (endpointInput) {
      endpointInput.addEventListener('change', () => {
        providerEndpoints[activeProvider] = normalizeEndpoint(endpointInput.value, activeProvider);
      });
    }

    if (apiKeyInput) {
      const refreshModelsFromKey = () => {
        providerApiKeys[activeProvider] = toTrimmedString(apiKeyInput.value);
        loadModelsForProvider(activeProvider, providerApiKeys[activeProvider]);
      };
      apiKeyInput.addEventListener('change', refreshModelsFromKey);
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
      suffixInput,
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
          persistActiveProviderState();
          const settings = collectOpenRouterSettings(
            settingsInputs,
            providerApiKeys,
            providerEndpoints,
            providerModels
          );
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
          const loadedProvider = applyOpenRouterSettings(
            settingsInputs,
            settings,
            providerApiKeys,
            providerEndpoints,
            providerModels
          );
          activeProvider = normalizeProviderKey(loadedProvider);
          const restoredModel = toTrimmedString(providerModels[activeProvider]);
          // The encrypted provider maps replace the prior workspace as one
          // transaction. Clear catalog-derived state for every adapter so an
          // old option, price, or runtime exclusion cannot bleed into it.
          PROVIDER_KEY_LIST.forEach(providerKey => {
            modelEntriesByProvider[providerKey] = new Map();
            getModelPricingMap(providerKey).clear();
            getExcludedModelIds(providerKey).clear();
          });
          modelEntriesByProvider[activeProvider] = new Map(
            restoredModel
              ? [[restoredModel, {
                  id: restoredModel,
                  name: 'Saved selection',
                  contextLength: null
                }]]
              : []
          );
          syncProviderCapabilities();
          syncSliderValues();
          // A complete encrypted restore is locally ready immediately. Catalog
          // refresh remains available by changing the key, but loading a saved
          // provider/model/key never depends on another network round trip.
          const needsCatalogRefresh = !restoredModel || !providerApiKeys[activeProvider];
          if (needsCatalogRefresh) {
            await loadModelsForProvider(activeProvider, providerApiKeys[activeProvider]);
          }
          if (!needsCatalogRefresh || !statusEl?.classList?.contains('is-error')) {
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
        persistActiveProviderState();
        const providerKey = activeProvider;
        const provider = getProviderOption(providerKey);
        const providerLabel = provider.label;
        const apiKey = toTrimmedString(apiKeyInput?.value);
        providerApiKeys[providerKey] = apiKey;
        const model = toTrimmedString(modelPicker?.value);
        providerModels[providerKey] = model;
        const modelEntry = getSelectedModelEntry(providerKey);
        const prompt = promptInput?.value || '';
        const suffix = providerSupportsRequestParameter(providerKey, 'suffix', modelEntry)
          ? String(suffixInput?.value || '')
          : '';
        const endpoint = normalizeEndpoint(endpointInput?.value, providerKey);
        providerEndpoints[providerKey] = endpoint;
        const modelMaxTokens = getModelMaxTokens(providerKey, modelEntry);
        const maxTokens = Math.round(readNumberInput(maxTokensInput, 0, 0, modelMaxTokens));
        const temperature = readNumberInput(
          temperatureInput,
          1,
          0,
          getProviderTemperatureMax(providerKey)
        );
        const topP = readNumberInput(topPInput, 0, 0, 1);
        const topK = Math.round(readNumberInput(topKInput, 0, 0, TOP_K_MAX));
        const presencePenalty = readNumberInput(presencePenaltyInput, 0, -2, 2);
        const frequencyPenalty = readNumberInput(frequencyPenaltyInput, 0, -2, 2);
        const stop = parseStopSequences(stopInput?.value);

        if (!isHttpCompletionEndpoint(endpoint)) {
          writeStatus(
            statusEl,
            'This completions-only app requires an absolute HTTP(S) endpoint ending in /completions. Chat, Responses, and Messages endpoints are not accepted.',
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
        if (!prompt.length) {
          writeStatus(statusEl, 'Enter a prompt before sending.', true);
          return;
        }
        if (stop && provider.maxStopSequences && stop.length > provider.maxStopSequences) {
          writeStatus(
            statusEl,
            `${providerLabel} accepts at most ${provider.maxStopSequences} stop sequences.`,
            true
          );
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
            modelEntry,
            prompt,
            suffix,
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
            await loadModelsForProvider(providerKey, providerApiKeys[providerKey]);
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
        const copied = await copyToClipboard(outputText, copyButton);
        // The button itself confirms success, preserving token and cost details in status.
        if (!copied) {
          writeStatus(statusEl, 'Copy failed. Clipboard permission may be blocked.', true);
        }
      });
    }

    root.dataset.bound = 'true';
    writeStatus(statusEl, 'Ready.');
    loadModelsForProvider(activeProvider, providerApiKeys[activeProvider]);
  }

  function initialize(windowEl) {
    initializeOpenRouterWindow(windowEl);
  }

  const registry = ensureAppRegistry();
  if (registry) {
    registry[APP_KEY] = { initialize };
  }
})();
