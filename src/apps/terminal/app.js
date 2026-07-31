(() => {
  'use strict';

  // Table of contents:
  // - Provider, model-catalog, face, setup, and loop contracts
  // - Shared tool + future knowledge registries
  // - Built-in desktop and Prompt Enhancer tool adapters
  // - Chat Completions + OpenAI Responses + Anthropic transports
  // - Transcript, fixed-anchor vector face, mouth paths, and procedural murmur helpers
  // - Fuzzy model resolution, commands, and guided-login helpers
  // - Shared encrypted-settings file workflow
  // - Terminal window binding + app registration

  const APP_KEY = 'terminal';
  const MAX_TOOL_ROUNDS = 8;
  const MAX_TOOL_OUTPUT_CHARS = 60000;
  const MAX_SPEECH_FRAMES = 18;
  const MAX_VISIBLE_MODEL_CHOICES = 8;
  const MIN_API_KEY_CHARS = 12;
  const TERMINAL_MURMUR_VOLUME = 0.026;
  const TERMINAL_SETTINGS_KIND = 'yolk-terminal-settings';
  const TERMINAL_SETTINGS_VERSION = 1;
  const DEFAULT_SETTINGS_FILE_NAME = 'yolk-terminal-encrypted-settings.json';
  const terminalSpeechSessions = new WeakMap();

  // Terminal is intentionally a chat/tool surface. Raw perspective-controlled
  // continuation remains in Completion API, whose payload never uses messages.
  // Keeping those contracts separate avoids a hidden conversion between modes.
  const PROVIDER_KEYS = Object.freeze({
    OPENROUTER: 'openrouter',
    DEEPSEEK: 'deepseek',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    FIREWORKS: 'fireworks',
    TOGETHER: 'together',
    MISTRAL: 'mistral',
    HYPERBOLIC: 'hyperbolic',
    CUSTOM: 'custom'
  });

  const PROVIDER_OPTIONS = Object.freeze({
    [PROVIDER_KEYS.OPENROUTER]: {
      label: 'OpenRouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      modelsEndpoint: 'https://openrouter.ai/api/v1/models?supported_parameters=tools&sort=pricing-low-to-high',
      models: Object.freeze([
        { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', aliases: ['deepseek flash', 'flash'], recommended: true },
        { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', aliases: ['gpt luna', 'luna'], recommended: true },
        { id: 'openrouter/auto', name: 'Auto Router', aliases: ['auto', 'router'] },
        { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', aliases: ['haiku'] }
      ]),
      transport: 'chat',
      requiresKey: true,
      keyUrl: 'https://openrouter.ai/settings/keys',
      note: 'OpenAI-compatible tool calling through an OpenRouter API key and OpenRouter credits. Automatic routing keeps first-time setup to one pasted key.'
    },
    [PROVIDER_KEYS.DEEPSEEK]: {
      label: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      modelsEndpoint: 'https://api.deepseek.com/models',
      models: Object.freeze([
        { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', aliases: ['flash'], recommended: true },
        { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', aliases: ['pro'] }
      ]),
      transport: 'chat',
      requiresKey: true,
      keyUrl: 'https://platform.deepseek.com/api_keys',
      note: 'DeepSeek V4 chat tool calls. This is separate from the raw beta FIM route in Completion API.'
    },
    [PROVIDER_KEYS.OPENAI]: {
      label: 'OpenAI API',
      endpoint: 'https://api.openai.com/v1/responses',
      modelsEndpoint: 'https://api.openai.com/v1/models',
      models: Object.freeze([
        { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', aliases: ['luna', 'gpt-5.6'], recommended: true },
        { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', aliases: ['terra'] },
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', aliases: ['sol'] }
      ]),
      transport: 'responses',
      requiresKey: true,
      keyUrl: 'https://platform.openai.com/api-keys',
      note: 'OpenAI Responses tool loop. ChatGPT plans and flexible Codex credits are not general API billing; use an OpenAI Platform API key.'
    },
    [PROVIDER_KEYS.ANTHROPIC]: {
      label: 'Anthropic API',
      endpoint: 'https://api.anthropic.com/v1/messages',
      modelsEndpoint: 'https://api.anthropic.com/v1/models?limit=1000',
      models: Object.freeze([
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', aliases: ['haiku'], recommended: true },
        { id: 'claude-fable-5', name: 'Claude Fable 5', aliases: ['fable'] },
        { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', aliases: ['sonnet'] },
        { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', aliases: ['opus'] }
      ]),
      transport: 'anthropic',
      requiresKey: true,
      keyUrl: 'https://console.anthropic.com/settings/keys',
      note: 'Native Claude Messages tool loop. Claude subscription OAuth is reserved for Anthropic applications such as Claude Code; third-party products use a Console API key.'
    },
    [PROVIDER_KEYS.FIREWORKS]: {
      label: 'Fireworks',
      endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
      modelsEndpoint: 'https://api.fireworks.ai/inference/v1/models',
      models: Object.freeze([
        { id: 'accounts/fireworks/models/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct', aliases: ['instruct'], recommended: true },
        { id: 'accounts/fireworks/models/kimi-k2p5', name: 'Kimi K2.5', aliases: ['kimi'] }
      ]),
      transport: 'chat',
      requiresKey: true,
      keyUrl: 'https://fireworks.ai/account/api-keys',
      note: 'OpenAI-compatible chat tool calling. Enter a Fireworks model that advertises function tools.'
    },
    [PROVIDER_KEYS.TOGETHER]: {
      label: 'Together AI',
      endpoint: 'https://api.together.ai/v1/chat/completions',
      modelsEndpoint: 'https://api.together.ai/v1/models',
      models: Object.freeze([
        { id: 'Qwen/Qwen3.5-9B', name: 'Qwen 3.5 9B', aliases: ['qwen'], recommended: true },
        { id: 'zai-org/GLM-5.1', name: 'GLM-5.1', aliases: ['glm'] },
        { id: 'moonshotai/Kimi-K2.5', name: 'Kimi K2.5', aliases: ['kimi'] },
        { id: 'MiniMaxAI/MiniMax-M2.7', name: 'MiniMax M2.7', aliases: ['minimax'] },
        { id: 'deepseek-ai/DeepSeek-V4-Pro', name: 'DeepSeek V4 Pro', aliases: ['deepseek'] }
      ]),
      transport: 'chat',
      requiresKey: true,
      keyUrl: 'https://api.together.ai/settings/api-keys',
      note: 'Together chat completions and function calling. Tool quality depends on the selected model.'
    },
    [PROVIDER_KEYS.MISTRAL]: {
      label: 'Mistral',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      modelsEndpoint: 'https://api.mistral.ai/v1/models',
      models: Object.freeze([
        { id: 'mistral-small-latest', name: 'Mistral Small', aliases: ['small'], recommended: true },
        { id: 'mistral-medium-latest', name: 'Mistral Medium', aliases: ['medium'] },
        { id: 'mistral-large-latest', name: 'Mistral Large', aliases: ['large'] }
      ]),
      transport: 'chat',
      requiresKey: true,
      keyUrl: 'https://console.mistral.ai/api-keys',
      note: 'Mistral chat tool calling. Its raw Codestral FIM route lives separately in Completion API.'
    },
    [PROVIDER_KEYS.HYPERBOLIC]: {
      label: 'Hyperbolic',
      endpoint: 'https://api.hyperbolic.xyz/v1/chat/completions',
      models: Object.freeze([
        { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B Instruct', aliases: ['llama'] },
        { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B', aliases: ['qwen', 'coder'] }
      ]),
      transport: 'chat',
      requiresKey: true,
      note: 'Hyperbolic OpenAI-compatible chat tool calling on a supported instruct model.'
    },
    [PROVIDER_KEYS.CUSTOM]: {
      label: 'Custom Compatible',
      endpoint: '',
      models: Object.freeze([]),
      transport: 'chat',
      requiresKey: false,
      note: 'Bring an OpenAI-compatible /chat/completions endpoint. Local servers may leave API Key blank.'
    }
  });

  // One stable order powers both numbered onboarding choices and `/providers`.
  // The first four are the low-friction paths; custom-compatible endpoints stay
  // available without turning the normal Terminal view into a settings screen.
  const PROVIDER_ORDER = Object.freeze([
    PROVIDER_KEYS.OPENROUTER,
    PROVIDER_KEYS.DEEPSEEK,
    PROVIDER_KEYS.OPENAI,
    PROVIDER_KEYS.ANTHROPIC,
    PROVIDER_KEYS.MISTRAL,
    PROVIDER_KEYS.FIREWORKS,
    PROVIDER_KEYS.TOGETHER,
    PROVIDER_KEYS.HYPERBOLIC,
    PROVIDER_KEYS.CUSTOM
  ]);

  // Every pose occupies the same seven monospace cells: bracket, space, three
  // face glyphs, space, bracket. Speech can therefore replace only the center
  // glyph without changing the mascot's measured width or visual anchor.
  // The full `art` remains canonical for static and reduced-motion rendering.
  const FACE_EMOTES = Object.freeze({
    idle: { art: '[ ._. ]', label: 'IDLE', eyes: ['.', '.'], mouth: '_' },
    smile: { art: '[ ^_^ ]', label: 'SMILE', eyes: ['^', '^'], mouth: '_' },
    happy: { art: '[ ^v^ ]', label: 'HAPPY', eyes: ['^', '^'], mouth: 'v' },
    thinking: { art: '[ o~o ]', label: 'THINK', eyes: ['o', 'o'], mouth: '~' },
    surprised: { art: '[ OoO ]', label: 'WOW', eyes: ['O', 'O'], mouth: 'o' },
    sad: { art: '[ ;_; ]', label: 'SAD', eyes: [';', ';'], mouth: '_' },
    cry: { art: '[ T_T ]', label: 'CRY', eyes: ['T', 'T'], mouth: '_' },
    sinister: { art: '[ >v- ]', label: 'HEH', eyes: ['>', '-'], mouth: 'v' }
  });

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

  // This is a local completeness guard, not provider authentication. Major
  // provider keys are substantially longer than a menu choice, contain no
  // whitespace, and include letters; the first real request remains the only
  // authoritative confirmation that a provider accepts the credential.
  function hasCompleteApiKey(value) {
    const key = toTrimmedString(value);
    return key.length >= MIN_API_KEY_CHARS && !/\s/.test(key) && /[a-z]/i.test(key);
  }

  function normalizeProviderKey(value) {
    const key = toTrimmedString(value).toLowerCase();
    return PROVIDER_OPTIONS[key] ? key : PROVIDER_KEYS.OPENROUTER;
  }

  function safeJsonParse(value) {
    if (value && typeof value === 'object') return value;
    try {
      const parsed = JSON.parse(String(value || '{}'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function serializeToolResult(value) {
    let text;
    try {
      text = JSON.stringify(value == null ? null : value);
    } catch (err) {
      text = JSON.stringify({ ok: false, error: 'Tool result was not serializable.' });
    }
    if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
    return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n...[tool result truncated]`;
  }

  // ======== Shared registries ========

  // A small global registry is the harness seam: future apps can register a
  // schema plus handler, while Terminal owns provider translation and looping.
  // Handlers receive a context object so per-window tools (such as face emotes)
  // still target the Terminal instance that initiated the request.
  function ensureToolRegistry() {
    if (
      window.YolkToolRegistry?.register &&
      window.YolkToolRegistry?.list &&
      window.YolkToolRegistry?.toChatTools &&
      window.YolkToolRegistry?.toResponsesTools &&
      window.YolkToolRegistry?.toAnthropicTools &&
      window.YolkToolRegistry?.invoke
    ) {
      return window.YolkToolRegistry;
    }
    const tools = new Map();
    const registry = {
      register(definition, handler) {
        const name = toTrimmedString(definition?.name);
        if (!name || typeof handler !== 'function') return false;
        const parameters = definition.parameters && typeof definition.parameters === 'object'
          ? definition.parameters
          : { type: 'object', properties: {} };
        tools.set(name, {
          definition: {
            name,
            description: toTrimmedString(definition.description),
            parameters
          },
          handler
        });
        return true;
      },
      list() {
        return Array.from(tools.values()).map(entry => ({ ...entry.definition }));
      },
      toChatTools() {
        return registry.list().map(definition => ({
          type: 'function',
          function: definition
        }));
      },
      toResponsesTools() {
        return registry.list().map(definition => ({
          type: 'function',
          name: definition.name,
          description: definition.description,
          parameters: definition.parameters
        }));
      },
      toAnthropicTools() {
        return registry.list().map(definition => ({
          name: definition.name,
          description: definition.description,
          input_schema: definition.parameters
        }));
      },
      async invoke(name, args, context = {}) {
        const entry = tools.get(toTrimmedString(name));
        if (!entry) return { ok: false, error: `Unknown tool: ${name}` };
        try {
          const result = await entry.handler(args && typeof args === 'object' ? args : {}, context);
          return result && typeof result === 'object' ? result : { ok: true, result };
        } catch (err) {
          return { ok: false, error: err?.message || 'Tool execution failed.' };
        }
      }
    };
    window.YolkToolRegistry = registry;
    return registry;
  }

  // Knowledge documents arrive later. This lexical registry gives that future
  // corpus a stable insertion and query contract today, without pretending an
  // empty repository already contains Patreon material or tool instructions.
  function ensureKnowledgeRegistry() {
    if (
      window.YolkTerminalKnowledge?.registerDocument &&
      window.YolkTerminalKnowledge?.status &&
      window.YolkTerminalKnowledge?.search
    ) {
      return window.YolkTerminalKnowledge;
    }
    const documents = new Map();
    const registry = {
      registerDocument(documentEntry) {
        const id = toTrimmedString(documentEntry?.id);
        const text = String(documentEntry?.text || '');
        if (!id || !text.trim()) return false;
        documents.set(id, {
          id,
          title: toTrimmedString(documentEntry?.title) || id,
          text,
          tags: Array.isArray(documentEntry?.tags)
            ? documentEntry.tags.map(toTrimmedString).filter(Boolean)
            : []
        });
        return true;
      },
      status() {
        return { documentCount: documents.size };
      },
      search(query, limit = 5) {
        const cleanQuery = toTrimmedString(query).toLowerCase();
        if (!cleanQuery) return [];
        const terms = Array.from(new Set(cleanQuery.split(/\s+/).filter(term => term.length > 1)));
        const safeLimit = Math.max(1, Math.min(10, Number(limit) || 5));
        return Array.from(documents.values())
          .map(documentEntry => {
            const haystack = `${documentEntry.title} ${documentEntry.tags.join(' ')} ${documentEntry.text}`.toLowerCase();
            const score = terms.reduce((total, term) => {
              const matches = haystack.split(term).length - 1;
              return total + matches;
            }, 0);
            const firstTerm = terms.find(term => haystack.includes(term)) || '';
            const textLower = documentEntry.text.toLowerCase();
            const hitIndex = firstTerm ? textLower.indexOf(firstTerm) : 0;
            const start = Math.max(0, hitIndex - 180);
            return {
              id: documentEntry.id,
              title: documentEntry.title,
              tags: documentEntry.tags,
              score,
              snippet: documentEntry.text.slice(start, start + 700)
            };
          })
          .filter(result => result.score > 0)
          .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
          .slice(0, safeLimit);
      }
    };
    window.YolkTerminalKnowledge = registry;
    return registry;
  }

  // ======== Built-in application adapters ========

  function getRuntimeWindows(windowType = '') {
    return Array.from(document.querySelectorAll('.app-window:not(.window-template)'))
      .filter(windowEl => !windowType || windowEl.dataset.window === windowType);
  }

  function findRuntimeWindow(instanceId, windowType = '') {
    const cleanInstance = toTrimmedString(instanceId);
    const candidates = getRuntimeWindows(windowType);
    if (cleanInstance) {
      return candidates.find(windowEl => windowEl.dataset.instance === cleanInstance) || null;
    }
    return candidates.find(windowEl => windowEl.classList.contains('is-focused')) || candidates.at(-1) || null;
  }

  function readPromptOutputs(promptWindow) {
    const root = promptWindow?.querySelector('.mix-root');
    if (!root) return [];
    return Array.from(root.querySelectorAll('.mix-box, .chunk-box')).map(box => {
      const isMix = box.classList.contains('mix-box');
      const titleInput = box.querySelector(':scope > .box-header .box-title');
      const output = box.querySelector(isMix ? '.mix-output-text' : '.chunk-output-text');
      return {
        id: box.dataset.boxId || '',
        type: isMix ? 'mix' : 'string',
        title: titleInput?.value || titleInput?.textContent || (isMix ? 'Mix' : 'String'),
        output: output?.textContent || ''
      };
    });
  }

  function registerBuiltinTools(toolRegistry, knowledgeRegistry) {
    toolRegistry.register({
      name: 'desktop_list_applications',
      description: 'List Yolk desktop applications and currently open runtime windows. Returns application keys plus window instance IDs, labels, visibility, and focus state.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }, () => ({
      ok: true,
      applications: window.YolkDesktop?.listApplications?.() || [],
      windows: getRuntimeWindows().map(windowEl => ({
        instanceId: windowEl.dataset.instance || '',
        application: windowEl.dataset.window || '',
        label: windowEl.dataset.windowLabel || '',
        hidden: windowEl.classList.contains('is-hidden'),
        focused: windowEl.classList.contains('is-focused')
      }))
    }));

    toolRegistry.register({
      name: 'desktop_open_application',
      description: 'Open one Yolk application in a new desktop window. Returns the created instance ID or an error for an unknown application key.',
      parameters: {
        type: 'object',
        properties: {
          application: {
            type: 'string',
            enum: ['prompts', 'audio', 'openrouter', 'terminal', 'diskrot', 'about'],
            description: 'Application key from desktop_list_applications.'
          }
        },
        required: ['application'],
        additionalProperties: false
      }
    }, args => {
      const application = toTrimmedString(args.application);
      const instanceId = window.YolkDesktop?.openApplication?.(application) || '';
      return instanceId
        ? { ok: true, application, instanceId }
        : { ok: false, error: `Application could not be opened: ${application}` };
    });

    toolRegistry.register({
      name: 'desktop_focus_window',
      description: 'Restore and focus an existing Yolk desktop window by exact instance ID. Returns whether the instance was found.',
      parameters: {
        type: 'object',
        properties: {
          instance_id: { type: 'string', description: 'Exact instance ID returned by desktop_list_applications.' }
        },
        required: ['instance_id'],
        additionalProperties: false
      }
    }, args => ({
      ok: window.YolkDesktop?.focusApplication?.(toTrimmedString(args.instance_id)) === true,
      instanceId: toTrimmedString(args.instance_id)
    }));

    toolRegistry.register({
      name: 'prompt_get_state',
      description: 'Read the complete serializable Prompt Enhancer box tree from one prompt window. Opens nothing and makes no changes.',
      parameters: {
        type: 'object',
        properties: {
          instance_id: { type: 'string', description: 'Optional Prompt Enhancer window instance ID.' }
        },
        additionalProperties: false
      }
    }, args => {
      const promptWindow = findRuntimeWindow(args.instance_id, 'prompts');
      const root = promptWindow?.querySelector('.mix-root');
      if (!root || !window.PromptMixer?.exportMixState) {
        return { ok: false, error: 'No open Prompt Enhancer window is available.' };
      }
      return {
        ok: true,
        instanceId: promptWindow.dataset.instance,
        state: window.PromptMixer.exportMixState(root)
      };
    });

    toolRegistry.register({
      name: 'prompt_replace_state',
      description: 'Replace one Prompt Enhancer window with a supplied state object. This is a mutating operation: existing unsaved boxes in that window are discarded.',
      parameters: {
        type: 'object',
        properties: {
          instance_id: { type: 'string', description: 'Optional existing Prompt Enhancer window instance ID.' },
          state: {
            type: 'object',
            description: 'Prompt Enhancer state with a top-level mixes array and optional colorPresets.'
          }
        },
        required: ['state'],
        additionalProperties: false
      }
    }, args => {
      if (!args.state || typeof args.state !== 'object' || !Array.isArray(args.state.mixes)) {
        return { ok: false, error: 'state.mixes must be an array.' };
      }
      let promptWindow = findRuntimeWindow(args.instance_id, 'prompts');
      if (!promptWindow) {
        const openedId = window.YolkDesktop?.openApplication?.('prompts') || '';
        promptWindow = findRuntimeWindow(openedId, 'prompts');
      }
      const root = promptWindow?.querySelector('.mix-root');
      if (!root || !window.PromptMixer?.applyMixState) {
        return { ok: false, error: 'Prompt Enhancer state adapter is unavailable.' };
      }
      window.PromptMixer.applyMixState(args.state, root);
      return {
        ok: true,
        instanceId: promptWindow.dataset.instance,
        boxCount: root.querySelectorAll('.mix-box, .chunk-box, .variable-box').length
      };
    });

    toolRegistry.register({
      name: 'prompt_generate',
      description: 'Run Generate in an open Prompt Enhancer window and return every visible Mix and String output with IDs and titles.',
      parameters: {
        type: 'object',
        properties: {
          instance_id: { type: 'string', description: 'Optional Prompt Enhancer window instance ID.' }
        },
        additionalProperties: false
      }
    }, args => {
      const promptWindow = findRuntimeWindow(args.instance_id, 'prompts');
      const root = promptWindow?.querySelector('.mix-root');
      if (!root || !window.PromptMixer?.generate) {
        return { ok: false, error: 'No open Prompt Enhancer window is available.' };
      }
      window.PromptMixer.generate(root);
      return {
        ok: true,
        instanceId: promptWindow.dataset.instance,
        outputs: readPromptOutputs(promptWindow)
      };
    });

    toolRegistry.register({
      name: 'prompt_read_outputs',
      description: 'Read the currently displayed Prompt Enhancer outputs without regenerating or changing any settings.',
      parameters: {
        type: 'object',
        properties: {
          instance_id: { type: 'string', description: 'Optional Prompt Enhancer window instance ID.' }
        },
        additionalProperties: false
      }
    }, args => {
      const promptWindow = findRuntimeWindow(args.instance_id, 'prompts');
      if (!promptWindow) return { ok: false, error: 'No open Prompt Enhancer window is available.' };
      return {
        ok: true,
        instanceId: promptWindow.dataset.instance,
        outputs: readPromptOutputs(promptWindow)
      };
    });

    toolRegistry.register({
      name: 'knowledge_search',
      description: 'Search installed Terminal knowledge documents and return ranked title, tag, score, and excerpt records. An empty result means the requested corpus has not been installed or no text matched.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terms describing the instruction or subject to retrieve.' },
          limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Maximum result count.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }, args => ({
      ok: true,
      documentCount: knowledgeRegistry.status().documentCount,
      results: knowledgeRegistry.search(args.query, args.limit)
    }));

    toolRegistry.register({
      name: 'terminal_set_face',
      description: 'Set the small Terminal bot face to one emotional emote. Returns the applied emote and display label.',
      parameters: {
        type: 'object',
        properties: {
          emote: {
            type: 'string',
            enum: Object.keys(FACE_EMOTES),
            description: 'Face emotion to display.'
          }
        },
        required: ['emote'],
        additionalProperties: false
      }
    }, (args, context) => {
      const terminalRoot = context.terminalRoot || findRuntimeWindow('', 'terminal')?.querySelector('.terminal-app');
      const emote = setTerminalFace(terminalRoot, args.emote);
      if (terminalRoot) terminalRoot.dataset.faceSetByTool = 'true';
      return { ok: !!terminalRoot, emote, label: FACE_EMOTES[emote].label };
    });
  }

  // ======== Provider transports ========

  function buildHeaders(apiKey, providerKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (providerKey === PROVIDER_KEYS.ANTHROPIC) {
      if (apiKey) headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      // Anthropic deliberately requires this opt-in for direct browser calls.
      // Yolk also labels the whole BYOK path as local/private-use only.
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (providerKey === PROVIDER_KEYS.OPENROUTER) {
      headers['X-OpenRouter-Title'] = 'Yolk Terminal';
    }
    return headers;
  }

  async function readErrorMessage(response) {
    try {
      const payload = await response.json();
      return toTrimmedString(payload?.error?.message || payload?.message) || `HTTP ${response.status}`;
    } catch (err) {
      try {
        return toTrimmedString(await response.text()) || `HTTP ${response.status}`;
      } catch (readErr) {
        return `HTTP ${response.status}`;
      }
    }
  }

  async function postJson(endpoint, apiKey, providerKey, body) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(apiKey, providerKey),
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(await readErrorMessage(response));
    return response.json();
  }

  // ======== Live model discovery ========

  function readCatalogItems(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.models)) return payload.models;
    return [];
  }

  function matchesCuratedModel(option, modelId) {
    const id = toTrimmedString(modelId).toLowerCase();
    return (Array.isArray(option?.models) ? option.models : []).some(model => {
      const curatedId = toTrimmedString(model.id).toLowerCase();
      return id === curatedId || id.startsWith(`${curatedId}-`);
    });
  }

  function readExplicitToolSupport(item) {
    const capabilities = item?.capabilities && typeof item.capabilities === 'object'
      ? item.capabilities
      : {};
    const candidates = [
      item?.supportsTools,
      item?.supports_tools,
      item?.supportsToolCalling,
      item?.supports_tool_calling,
      capabilities.function_calling,
      capabilities.functionCalling,
      capabilities.tool_calling,
      capabilities.tools
    ];
    const explicit = candidates.find(value => typeof value === 'boolean');
    return typeof explicit === 'boolean' ? explicit : null;
  }

  // Provider catalog records are not uniform. Keep the filter conservative:
  // accept explicit tool capability metadata, use OpenRouter's server-side
  // tools filter, and otherwise restrict capability-opaque catalogs to the
  // curated tool-tested IDs instead of presenting every text or media model.
  function catalogItemSupportsTerminal(providerKey, option, item, modelId) {
    if (item?.archived === true) return false;
    const explicitTools = readExplicitToolSupport(item);
    if (explicitTools === false) return false;
    if (providerKey === PROVIDER_KEYS.OPENROUTER) {
      const parameters = Array.isArray(item?.supported_parameters)
        ? item.supported_parameters.map(value => String(value).toLowerCase())
        : [];
      return explicitTools === true || !parameters.length || parameters.includes('tools');
    }
    if (providerKey === PROVIDER_KEYS.MISTRAL) {
      if (item?.capabilities?.completion_chat === false) return false;
      return explicitTools === true || matchesCuratedModel(option, modelId);
    }
    if (providerKey === PROVIDER_KEYS.OPENAI) {
      if (explicitTools === true) return true;
      const id = modelId.toLowerCase();
      return (
        /^gpt-(?:5(?:[.-]|$)|4\.1(?:-|$)|4o(?:-|$)|4-turbo(?:-|$))/.test(id) &&
        !/(audio|image|realtime|search|transcri|tts)/.test(id)
      );
    }
    if (providerKey === PROVIDER_KEYS.FIREWORKS || providerKey === PROVIDER_KEYS.TOGETHER) {
      return explicitTools === true || matchesCuratedModel(option, modelId);
    }
    return explicitTools !== false;
  }

  function normalizeCatalogModels(providerKey, payload) {
    const option = PROVIDER_OPTIONS[providerKey];
    const seen = new Set();
    return readCatalogItems(payload).reduce((models, item) => {
      const modelId = toTrimmedString(typeof item === 'string' ? item : item?.id || item?.name);
      const normalizedId = modelId.toLowerCase();
      if (
        !modelId ||
        seen.has(normalizedId) ||
        !catalogItemSupportsTerminal(providerKey, option, item, modelId)
      ) {
        return models;
      }
      seen.add(normalizedId);
      const displayName = typeof item === 'object'
        ? toTrimmedString(item?.display_name || item?.displayName || item?.name)
        : '';
      models.push({ id: modelId, name: displayName || modelId, aliases: [] });
      return models;
    }, []);
  }

  // Curated entries express the economical recommendations; the live response
  // establishes what the account can actually use. A dated live ID can satisfy
  // its stable curated family, and every remaining live model stays searchable.
  function prioritizeCatalogModels(option, liveModels) {
    const remaining = Array.isArray(liveModels) ? [...liveModels] : [];
    const prioritized = [];
    (Array.isArray(option?.models) ? option.models : []).forEach(curated => {
      const curatedId = curated.id.toLowerCase();
      const liveIndex = remaining.findIndex(model => {
        const liveId = model.id.toLowerCase();
        return liveId === curatedId || liveId.startsWith(`${curatedId}-`);
      });
      if (liveIndex === -1) return;
      const [live] = remaining.splice(liveIndex, 1);
      prioritized.push({
        ...live,
        name: curated.name || live.name,
        aliases: Array.isArray(curated.aliases) ? [...curated.aliases] : [],
        recommended: curated.recommended === true
      });
    });
    return [...prioritized, ...remaining];
  }

  async function fetchProviderModelCatalog(providerKey, apiKey) {
    const option = PROVIDER_OPTIONS[providerKey];
    if (!option?.modelsEndpoint) return { status: 'fallback', models: [] };
    let response;
    try {
      response = await fetch(option.modelsEndpoint, {
        method: 'GET',
        headers: buildHeaders(apiKey, providerKey)
      });
    } catch (err) {
      return { status: 'unavailable', models: [] };
    }
    if (response.status === 401 || response.status === 403) {
      return { status: 'auth-error', models: [] };
    }
    if (!response.ok) return { status: 'unavailable', models: [] };
    try {
      const liveModels = normalizeCatalogModels(providerKey, await response.json());
      if (!liveModels.length) return { status: 'unavailable', models: [] };
      return {
        status: 'success',
        models: prioritizeCatalogModels(option, liveModels)
      };
    } catch (err) {
      return { status: 'unavailable', models: [] };
    }
  }

  function normalizeChatToolCalls(message) {
    if (!Array.isArray(message?.tool_calls)) return [];
    return message.tool_calls
      .map((call, index) => ({
        id: toTrimmedString(call?.id) || `tool-call-${index + 1}`,
        name: toTrimmedString(call?.function?.name),
        arguments: String(call?.function?.arguments || '{}')
      }))
      .filter(call => call.name);
  }

  function readResponsesText(payload) {
    if (typeof payload?.output_text === 'string') return payload.output_text;
    if (!Array.isArray(payload?.output)) return '';
    return payload.output
      .filter(item => item?.type === 'message')
      .flatMap(item => Array.isArray(item?.content) ? item.content : [])
      .filter(content => content?.type === 'output_text' && typeof content?.text === 'string')
      .map(content => content.text)
      .join('');
  }

  function readResponsesToolCalls(payload) {
    if (!Array.isArray(payload?.output)) return [];
    return payload.output
      .filter(item => item?.type === 'function_call' && item?.name)
      .map((item, index) => ({
        id: toTrimmedString(item.call_id || item.id) || `response-tool-${index + 1}`,
        name: toTrimmedString(item.name),
        arguments: String(item.arguments || '{}')
      }));
  }

  function readAnthropicText(payload) {
    if (!Array.isArray(payload?.content)) return '';
    return payload.content
      .filter(block => block?.type === 'text' && typeof block?.text === 'string')
      .map(block => block.text)
      .join('');
  }

  function readAnthropicToolCalls(payload) {
    if (!Array.isArray(payload?.content)) return [];
    return payload.content
      .filter(block => block?.type === 'tool_use' && block?.name)
      .map((block, index) => ({
        id: toTrimmedString(block.id) || `anthropic-tool-${index + 1}`,
        name: toTrimmedString(block.name),
        arguments: block.input && typeof block.input === 'object' ? block.input : {}
      }));
  }

  async function executeToolCalls(calls, toolRegistry, terminalRoot) {
    const outputs = [];
    for (let index = 0; index < calls.length; index += 1) {
      const call = calls[index];
      const args = safeJsonParse(call.arguments);
      const result = await toolRegistry.invoke(call.name, args, { terminalRoot });
      // Function names and serialized results are harness internals. They feed
      // the next model turn but never become decorative transcript copy; the
      // user sees the requested outcome, while the face supplies quiet motion.
      outputs.push({ call, result, serialized: serializeToolResult(result) });
    }
    return outputs;
  }

  async function runChatToolLoop(config) {
    const {
      providerKey,
      endpoint,
      apiKey,
      model,
      conversation,
      systemPrompt,
      toolRegistry,
      terminalRoot
    } = config;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const payload = await postJson(endpoint, apiKey, providerKey, {
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...conversation],
        tools: toolRegistry.toChatTools(),
        tool_choice: 'auto',
        stream: false
      });
      const message = payload?.choices?.[0]?.message;
      if (!message || typeof message !== 'object') {
        throw new Error('Provider returned no assistant message.');
      }
      const content = typeof message.content === 'string' ? message.content : '';
      const calls = normalizeChatToolCalls(message);
      const assistantRecord = {
        role: 'assistant',
        content: content || null,
        ...(calls.length
          ? {
              tool_calls: calls.map(call => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: call.arguments }
              }))
            }
          : {})
      };
      conversation.push(assistantRecord);
      if (content && calls.length) appendTranscript(terminalRoot, 'assistant', content);
      if (!calls.length) return { text: content, usage: payload?.usage || null };
      const outputs = await executeToolCalls(calls, toolRegistry, terminalRoot);
      outputs.forEach(({ call, serialized }) => {
        conversation.push({ role: 'tool', tool_call_id: call.id, content: serialized });
      });
    }
    throw new Error(`Tool loop stopped after ${MAX_TOOL_ROUNDS} rounds.`);
  }

  async function runResponsesToolLoop(config) {
    const {
      endpoint,
      apiKey,
      model,
      userText,
      previousResponseId,
      systemPrompt,
      toolRegistry,
      terminalRoot
    } = config;
    let priorId = toTrimmedString(previousResponseId);
    let input = userText;
    let latestPayload = null;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      latestPayload = await postJson(endpoint, apiKey, PROVIDER_KEYS.OPENAI, {
        model,
        instructions: systemPrompt,
        input,
        tools: toolRegistry.toResponsesTools(),
        tool_choice: 'auto',
        store: true,
        ...(priorId ? { previous_response_id: priorId } : {})
      });
      priorId = toTrimmedString(latestPayload?.id) || priorId;
      const calls = readResponsesToolCalls(latestPayload);
      const partialText = readResponsesText(latestPayload);
      if (partialText && calls.length) appendTranscript(terminalRoot, 'assistant', partialText);
      if (!calls.length) {
        return {
          text: partialText,
          usage: latestPayload?.usage || null,
          previousResponseId: priorId
        };
      }
      const outputs = await executeToolCalls(calls, toolRegistry, terminalRoot);
      input = outputs.map(({ call, serialized }) => ({
        type: 'function_call_output',
        call_id: call.id,
        output: serialized
      }));
    }
    throw new Error(`Tool loop stopped after ${MAX_TOOL_ROUNDS} rounds.`);
  }

  // Claude's Messages API keeps tool calls inside assistant content blocks and
  // accepts matching tool_result blocks in the immediately following user
  // message. Preserve each full block array so later rounds remain valid.
  async function runAnthropicToolLoop(config) {
    const {
      endpoint,
      apiKey,
      model,
      conversation,
      systemPrompt,
      toolRegistry,
      terminalRoot
    } = config;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const payload = await postJson(endpoint, apiKey, PROVIDER_KEYS.ANTHROPIC, {
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: conversation,
        tools: toolRegistry.toAnthropicTools(),
        tool_choice: { type: 'auto' }
      });
      if (!Array.isArray(payload?.content)) {
        throw new Error('Anthropic returned no assistant content blocks.');
      }
      const text = readAnthropicText(payload);
      const calls = readAnthropicToolCalls(payload);
      conversation.push({ role: 'assistant', content: payload.content });
      if (text && calls.length) appendTranscript(terminalRoot, 'assistant', text);
      if (!calls.length) return { text, usage: payload?.usage || null };
      const outputs = await executeToolCalls(calls, toolRegistry, terminalRoot);
      conversation.push({
        role: 'user',
        content: outputs.map(({ call, result, serialized }) => ({
          type: 'tool_result',
          tool_use_id: call.id,
          content: serialized,
          ...(result?.ok === false ? { is_error: true } : {})
        }))
      });
    }
    throw new Error(`Tool loop stopped after ${MAX_TOOL_ROUNDS} rounds.`);
  }

  // ======== Terminal presentation ========

  function getTerminalSpeechSession(terminalRoot) {
    let session = terminalSpeechSessions.get(terminalRoot);
    if (!session) {
      session = {
        context: null,
        oscillators: [],
        timers: [],
        sequence: 0
      };
      terminalSpeechSessions.set(terminalRoot, session);
    }
    return session;
  }

  function renderTerminalFaceArt(emote, spokenMouth = '') {
    const pose = FACE_EMOTES[emote] || FACE_EMOTES.idle;
    if (!spokenMouth) return pose.art;
    return `[ ${pose.eyes[0]}${spokenMouth}${pose.eyes[1]} ]`;
  }

  function terminalEyePath(glyph, centerX) {
    const x = Number(centerX);
    switch (glyph) {
      case '^': return `M ${x - 3} 8 L ${x} 5 L ${x + 3} 8`;
      case 'o': return `M ${x - 2.2} 7 A 2.2 2.2 0 1 0 ${x + 2.2} 7 A 2.2 2.2 0 1 0 ${x - 2.2} 7`;
      case 'O': return `M ${x - 3} 7 A 3 3 0 1 0 ${x + 3} 7 A 3 3 0 1 0 ${x - 3} 7`;
      case ';': return `M ${x - 0.02} 6 L ${x + 0.02} 6 M ${x} 8.5 Q ${x} 10.5 ${x - 1.2} 11.2`;
      case 'T': return `M ${x - 3} 5 H ${x + 3} M ${x} 5 V 9`;
      case '>': return `M ${x - 2.5} 4.8 L ${x + 2.3} 7 L ${x - 2.5} 9.2`;
      case '-': return `M ${x - 2.7} 7 H ${x + 2.7}`;
      default: return `M ${x - 0.02} 7 L ${x + 0.02} 7`;
    }
  }

  function terminalMouthPath(glyph) {
    switch (glyph) {
      case 'O': return 'M 39 12 A 3 3 0 1 0 45 12 A 3 3 0 1 0 39 12';
      case 'o': return 'M 39.8 12 A 2.2 2.2 0 1 0 44.2 12 A 2.2 2.2 0 1 0 39.8 12';
      case '~': return 'M 38.5 12 Q 40.25 9.8 42 12 T 45.5 12';
      case '-': return 'M 39.5 12 H 44.5';
      case 'v': return 'M 38.8 10 L 42 14 L 45.2 10';
      default: return 'M 38.5 12 H 45.5';
    }
  }

  function createTerminalFaceVector(art) {
    if (!art || typeof document === 'undefined') return null;
    const svgNamespace = 'http://www.w3.org/2000/svg';
    art.textContent = '';
    const ascii = document.createElement('span');
    ascii.className = 'terminal-face-ascii';
    const vector = document.createElementNS(svgNamespace, 'svg');
    vector.classList.add('terminal-face-vector');
    vector.setAttribute('viewBox', '0 0 84 20');
    vector.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    vector.setAttribute('aria-hidden', 'true');
    vector.setAttribute('focusable', 'false');
    const frame = document.createElementNS(svgNamespace, 'path');
    frame.classList.add('terminal-face-frame');
    frame.setAttribute('d', 'M 8 2 H 4 V 18 H 8 M 76 2 H 80 V 18 H 76');
    const leftEye = document.createElementNS(svgNamespace, 'path');
    leftEye.classList.add('terminal-face-eye', 'terminal-face-eye-left');
    const mouth = document.createElementNS(svgNamespace, 'path');
    mouth.classList.add('terminal-face-mouth');
    const rightEye = document.createElementNS(svgNamespace, 'path');
    rightEye.classList.add('terminal-face-eye', 'terminal-face-eye-right');
    vector.append(frame, leftEye, mouth, rightEye);
    art.append(ascii, vector);
    return { ascii, leftEye, mouth, rightEye };
  }

  // The readable seven-cell ASCII string remains in the DOM, but visible eye
  // and mouth strokes use fixed coordinates. Font ascenders, punctuation
  // baselines, and glyph bearings therefore cannot move a feature between
  // frames: both eyes stay on y=7 and every mouth stays below them on y=12.
  function paintTerminalFaceArt(art, emote, spokenMouth = '') {
    if (!art) return '';
    const pose = FACE_EMOTES[emote] || FACE_EMOTES.idle;
    const mouthGlyph = spokenMouth || pose.mouth;
    const parts = {
      ascii: art.querySelector('.terminal-face-ascii'),
      leftEye: art.querySelector('.terminal-face-eye-left'),
      mouth: art.querySelector('.terminal-face-mouth'),
      rightEye: art.querySelector('.terminal-face-eye-right')
    };
    if (!parts.ascii || !parts.leftEye || !parts.mouth || !parts.rightEye) {
      Object.assign(parts, createTerminalFaceVector(art) || {});
    }
    const asciiArt = renderTerminalFaceArt(emote, spokenMouth);
    if (parts.ascii) parts.ascii.textContent = asciiArt;
    if (parts.leftEye) {
      parts.leftEye.dataset.glyph = pose.eyes[0];
      parts.leftEye.setAttribute('d', terminalEyePath(pose.eyes[0], 30));
    }
    if (parts.mouth) {
      parts.mouth.dataset.glyph = mouthGlyph;
      parts.mouth.setAttribute('d', terminalMouthPath(mouthGlyph));
    }
    if (parts.rightEye) {
      parts.rightEye.dataset.glyph = pose.eyes[1];
      parts.rightEye.setAttribute('d', terminalEyePath(pose.eyes[1], 54));
    }
    art.dataset.ascii = asciiArt;
    return asciiArt;
  }

  function hashSpeechToken(token, index) {
    let hash = 19 + index * 17;
    Array.from(String(token || '')).forEach(character => {
      hash = (hash * 31 + character.codePointAt(0)) % 9973;
    });
    return hash;
  }

  // Speech is deliberately impressionistic: most words get one stable vowel
  // pose, while only long words may get a second, genuinely different pose.
  // Short phrase rests and an eighteen-frame cap keep the mascot conversational
  // without producing the rapid mechanical chatter that made its mouth jitter.
  function buildTerminalSpeechPlan(text) {
    const tokens = String(text || '').match(/[\p{L}\p{N}]+|[.!?,;:…]+/gu) || [];
    const plan = [];
    let wordCount = 0;
    const mouthForNucleus = nucleus => {
      const vowel = String(nucleus || '').toLowerCase()[0];
      if (vowel === 'a') return 'O';
      if (/[ou]/.test(vowel)) return 'o';
      if (/[eiy]/.test(vowel)) return '-';
      return '~';
    };
    const pushFrame = frame => {
      const previous = plan[plan.length - 1];
      // Adjacent identical shapes become one held pose. This reduces needless
      // visual cuts and gives the matching synthesized murmur a gentler cadence.
      if (previous && previous.mouth === frame.mouth && previous.voiced === frame.voiced) {
        previous.duration = Math.min(previous.duration + frame.duration, frame.voiced ? 220 : 190);
        return;
      }
      plan.push(frame);
    };
    tokens.forEach((token, tokenIndex) => {
      if (/^[.!?,;:…]+$/.test(token)) {
        pushFrame({
          mouth: '_',
          duration: /[.!?…]/.test(token) ? 175 : 105,
          pitch: 0,
          openness: 0,
          voiced: false
        });
        return;
      }
      const nuclei = token.toLowerCase().match(/[aeiouy]+/g) || [token.slice(0, 1)];
      const chosenNuclei = [nuclei[0]];
      const lastNucleus = nuclei[nuclei.length - 1];
      if (token.length >= 8 && nuclei.length > 1 && mouthForNucleus(lastNucleus) !== mouthForNucleus(nuclei[0])) {
        chosenNuclei.push(lastNucleus);
      }
      chosenNuclei.forEach((nucleus, nucleusIndex) => {
        const mouth = mouthForNucleus(nucleus);
        const openness = mouth === 'O' ? 1 : (mouth === 'o' ? 0.72 : (mouth === '-' ? 0.38 : 0.52));
        const hash = hashSpeechToken(token, tokenIndex + nucleusIndex);
        pushFrame({
          mouth,
          duration: 104 + Math.round(openness * 26) + (hash % 17),
          pitch: 116 + (hash % 46),
          openness,
          voiced: true
        });
      });
      wordCount += 1;
      if (wordCount % 3 === 0) {
        pushFrame({ mouth: '_', duration: 52, pitch: 0, openness: 0, voiced: false });
      }
    });
    if (!plan.length && String(text || '').trim()) {
      plan.push({ mouth: '~', duration: 110, pitch: 132, openness: 0.5, voiced: true });
    }
    if (plan.length <= MAX_SPEECH_FRAMES) return plan;
    return Array.from({ length: MAX_SPEECH_FRAMES }, (_, index) => {
      const sourceIndex = Math.round(index * (plan.length - 1) / (MAX_SPEECH_FRAMES - 1));
      return { ...plan[sourceIndex] };
    });
  }

  function stopTerminalMurmur(terminalRoot) {
    const session = terminalSpeechSessions.get(terminalRoot);
    if (!session) return;
    session.oscillators.forEach(oscillator => {
      try {
        oscillator.stop();
      } catch (err) {
        // A source that already reached its scheduled stop is harmless.
      }
    });
    session.oscillators.length = 0;
  }

  function stopTerminalSpeech(terminalRoot, restoreFace = true) {
    const session = getTerminalSpeechSession(terminalRoot);
    session.sequence += 1;
    session.timers.forEach(timerId => window.clearTimeout(timerId));
    session.timers.length = 0;
    stopTerminalMurmur(terminalRoot);
    const face = terminalRoot?.querySelector?.('.terminal-face');
    const art = terminalRoot?.querySelector?.('.terminal-face-art');
    if (face) {
      face.dataset.speaking = 'false';
      delete face.dataset.mouth;
    }
    if (restoreFace && art) paintTerminalFaceArt(art, face?.dataset.emote || 'idle');
  }

  // Web Audio must be unlocked from a user gesture. Enter primes one quiet
  // context per Terminal window; assistant text later reuses it. No waveform
  // contains speech, phonemes, recordings, or the response text itself.
  function primeTerminalAudio(terminalRoot) {
    if (!terminalRoot || terminalRoot.dataset.soundEnabled === 'false') return null;
    const session = getTerminalSpeechSession(terminalRoot);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      terminalRoot.dataset.soundAvailable = 'false';
      return null;
    }
    try {
      if (!session.context || session.context.state === 'closed') {
        session.context = new AudioContext();
      }
      const resumeResult = session.context.resume?.();
      resumeResult?.catch?.(() => {});
      terminalRoot.dataset.soundAvailable = 'true';
      return session.context;
    } catch (err) {
      terminalRoot.dataset.soundAvailable = 'false';
      return null;
    }
  }

  function playTerminalMurmur(terminalRoot, plan) {
    if (terminalRoot?.dataset.soundEnabled === 'false' || !plan.some(frame => frame.voiced)) return;
    const session = getTerminalSpeechSession(terminalRoot);
    const context = session.context;
    if (!context || context.state === 'closed') return;
    try {
      const startAt = Number(context.currentTime || 0) + 0.018;
      const carrier = context.createOscillator();
      const formant = context.createOscillator();
      const formantGain = context.createGain();
      const filter = context.createBiquadFilter();
      const master = context.createGain();
      carrier.type = 'triangle';
      formant.type = 'square';
      formantGain.gain.value = 0.16;
      filter.type = 'lowpass';
      filter.Q.value = 4.2;
      carrier.connect(filter);
      formant.connect(formantGain);
      formantGain.connect(filter);
      filter.connect(master);
      master.connect(context.destination);
      master.gain.cancelScheduledValues(startAt);
      master.gain.setValueAtTime(0.0001, startAt);
      let cursor = startAt;
      plan.forEach((frame, index) => {
        const duration = frame.duration / 1000;
        if (frame.voiced) {
          carrier.frequency.setValueAtTime(frame.pitch, cursor);
          formant.frequency.setValueAtTime(frame.pitch * 2.02, cursor);
          carrier.detune?.setValueAtTime?.(((index % 3) - 1) * 7, cursor);
          filter.frequency.setValueAtTime(470 + frame.openness * 300, cursor);
          master.gain.setValueAtTime(0.0001, cursor);
          master.gain.linearRampToValueAtTime(TERMINAL_MURMUR_VOLUME, cursor + 0.018);
          master.gain.linearRampToValueAtTime(TERMINAL_MURMUR_VOLUME * 0.58, cursor + duration * 0.68);
          master.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
        } else {
          master.gain.setValueAtTime(0.0001, cursor);
        }
        cursor += duration;
      });
      carrier.start(startAt);
      formant.start(startAt);
      carrier.stop(cursor + 0.03);
      formant.stop(cursor + 0.03);
      session.oscillators.push(carrier, formant);
    } catch (err) {
      // Sound is ornamental; face animation and Terminal work continue when a
      // browser rejects or only partially implements Web Audio.
      terminalRoot.dataset.soundAvailable = 'false';
      stopTerminalMurmur(terminalRoot);
    }
  }

  function terminalMotionIsReduced(terminalRoot) {
    if (terminalRoot?.closest?.('.reduce-motion')) return true;
    try {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    } catch (err) {
      return false;
    }
  }

  function presentTerminalSpeech(terminalRoot, text) {
    if (!terminalRoot || !String(text || '').trim()) return;
    const plan = buildTerminalSpeechPlan(text);
    if (!plan.length) return;
    stopTerminalSpeech(terminalRoot);
    const session = getTerminalSpeechSession(terminalRoot);
    const sequence = session.sequence;
    const face = terminalRoot.querySelector('.terminal-face');
    const art = terminalRoot.querySelector('.terminal-face-art');
    playTerminalMurmur(terminalRoot, plan);
    if (!face || !art || terminalMotionIsReduced(terminalRoot)) return;
    face.dataset.speaking = 'true';
    let elapsed = 0;
    plan.forEach((frame, index) => {
      const applyFrame = () => {
        if (session.sequence !== sequence || !terminalRoot.isConnected) return;
        const emote = face.dataset.emote || 'idle';
        face.dataset.mouth = frame.mouth;
        paintTerminalFaceArt(art, emote, frame.mouth);
      };
      if (index === 0) applyFrame();
      else session.timers.push(window.setTimeout(applyFrame, elapsed));
      elapsed += frame.duration;
    });
    session.timers.push(window.setTimeout(() => {
      if (session.sequence !== sequence) return;
      face.dataset.speaking = 'false';
      delete face.dataset.mouth;
      paintTerminalFaceArt(art, face.dataset.emote || 'idle');
      session.timers.length = 0;
      session.oscillators.length = 0;
    }, elapsed));
  }

  function setTerminalFace(terminalRoot, requestedEmote) {
    const emote = FACE_EMOTES[requestedEmote] ? requestedEmote : 'idle';
    if (!terminalRoot) return emote;
    const face = terminalRoot.querySelector('.terminal-face');
    const art = terminalRoot.querySelector('.terminal-face-art');
    if (face) {
      face.dataset.emote = emote;
      face.setAttribute('aria-label', `Yolk face: ${FACE_EMOTES[emote].label.toLowerCase()}`);
    }
    if (art) paintTerminalFaceArt(art, emote, face?.dataset.mouth || '');
    return emote;
  }

  function appendTranscript(terminalRoot, role, text) {
    const transcript = terminalRoot?.querySelector('.terminal-transcript');
    if (!transcript) return null;
    const line = document.createElement('div');
    line.className = `terminal-line terminal-line-${role}`;
    line.dataset.role = role;
    const prefix = document.createElement('span');
    prefix.className = 'terminal-line-prefix';
    const labels = {
      user: '>',
      assistant: 'yolk>',
      system: '·',
      tool: '·',
      'tool-result': '·'
    };
    prefix.textContent = labels[role] || `${role}>`;
    const body = document.createElement('span');
    body.className = 'terminal-line-body';
    body.textContent = String(text || '');
    line.append(prefix, body);
    transcript.appendChild(line);
    transcript.scrollTop = transcript.scrollHeight;
    if (role === 'assistant') presentTerminalSpeech(terminalRoot, body.textContent);
    return line;
  }

  function clearTranscript(terminalRoot) {
    const transcript = terminalRoot?.querySelector('.terminal-transcript');
    if (!transcript) return;
    transcript.innerHTML = '';
  }

  function formatProviderChoices() {
    return PROVIDER_ORDER.map((providerKey, index) => {
      const option = PROVIDER_OPTIONS[providerKey];
      return `${index + 1}. ${option.label}`;
    }).join('\n');
  }

  function formatModelChoice(model, index) {
    const recommendation = model?.recommended ? '  ·  recommended' : '';
    return `${index + 1}. ${model.name}  ·  ${model.id}${recommendation}`;
  }

  function normalizeModelSearchText(value) {
    return toTrimmedString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Edit distance catches small slips such as `sonet`, while normalized
  // aliases keep common searches such as `llama` and `pro` human-friendly.
  // Ranking every catalog entry also lets the transcript offer useful choices
  // instead of treating a near miss as an invalid command.
  function modelEditDistance(leftValue, rightValue) {
    const left = String(leftValue || '');
    const right = String(rightValue || '');
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      let diagonal = row[0];
      row[0] = leftIndex;
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const above = row[rightIndex];
        const substitution = diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
        row[rightIndex] = Math.min(row[rightIndex] + 1, row[rightIndex - 1] + 1, substitution);
        diagonal = above;
      }
    }
    return row[right.length];
  }

  function modelSearchValues(model) {
    return [model?.id, model?.name, ...(Array.isArray(model?.aliases) ? model.aliases : [])]
      .map(normalizeModelSearchText)
      .filter(Boolean);
  }

  function scoreModelMatch(model, queryValue) {
    const query = normalizeModelSearchText(queryValue);
    if (!query) return 1;
    let bestScore = 1;
    modelSearchValues(model).forEach(candidate => {
      if (candidate === query) {
        bestScore = 0;
        return;
      }
      if (candidate.includes(query) || query.includes(candidate)) {
        const lengthPenalty = Math.abs(candidate.length - query.length) / Math.max(candidate.length, query.length, 1);
        bestScore = Math.min(bestScore, 0.08 + (lengthPenalty * 0.24));
      }
      const candidateParts = candidate.split(' ');
      const queryParts = query.split(' ');
      [candidate, ...candidateParts].forEach(candidatePart => {
        queryParts.forEach(queryPart => {
          const distance = modelEditDistance(candidatePart, queryPart);
          const ratio = distance / Math.max(candidatePart.length, queryPart.length, 1);
          bestScore = Math.min(bestScore, 0.12 + (ratio * 0.72));
        });
      });
    });
    return bestScore;
  }

  function rankModelMatches(models, queryValue) {
    return (Array.isArray(models) ? models : [])
      .map((model, index) => ({ model, index, score: scoreModelMatch(model, queryValue) }))
      .sort((left, right) => left.score - right.score || left.index - right.index);
  }

  function resolveExactModel(models, value) {
    const query = normalizeModelSearchText(value);
    return (Array.isArray(models) ? models : []).find(model => (
      modelSearchValues(model).includes(query)
    )) || null;
  }

  // Setup accepts a number, a provider key, or a phrase containing a provider
  // name. The forgiving match is deliberate: this is the no-settings-screen
  // path, so `I use Anthropic` should work just as well as typing `4`.
  function resolveProviderChoice(value) {
    const clean = toTrimmedString(value).toLowerCase();
    const number = Number(clean);
    if (Number.isInteger(number) && number >= 1 && number <= PROVIDER_ORDER.length) {
      return PROVIDER_ORDER[number - 1];
    }
    if (PROVIDER_OPTIONS[clean]) return clean;
    return PROVIDER_ORDER.find(providerKey => {
      const label = PROVIDER_OPTIONS[providerKey].label.toLowerCase();
      return clean.includes(providerKey) || clean.includes(label);
    }) || '';
  }

  function parseTerminalCommand(value) {
    const clean = toTrimmedString(value);
    if (!clean.startsWith('/')) return null;
    const spaceIndex = clean.indexOf(' ');
    return {
      name: (spaceIndex === -1 ? clean.slice(1) : clean.slice(1, spaceIndex)).toLowerCase(),
      argument: spaceIndex === -1 ? '' : clean.slice(spaceIndex + 1).trim()
    };
  }

  function isHttpEndpoint(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  async function copyTerminalText(value) {
    const text = String(value || '');
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      // Continue into the legacy selection fallback below.
    }
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    let copied = false;
    try {
      copied = document.execCommand?.('copy') !== false;
    } catch (err) {
      copied = false;
    }
    helper.remove();
    return copied;
  }

  function writeStatus(statusEl, message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = String(message || '');
    statusEl.classList.toggle('is-error', !!isError);
  }

  function buildSystemPrompt(toolRegistry, knowledgeRegistry) {
    const applications = window.YolkDesktop?.listApplications?.() || [];
    const appSummary = applications
      .map(application => `${application.key}: ${application.description || application.label}`)
      .join('\n');
    const toolSummary = toolRegistry.list()
      .map(tool => `${tool.name}: ${tool.description}`)
      .join('\n');
    const knowledgeCount = knowledgeRegistry.status().documentCount;
    const knowledgeRule = knowledgeCount
      ? 'Use the reference search tool when stored material could answer the request.'
      : 'The reference library is empty. If asked to search it, say no reference material is installed yet instead of inventing results.';
    return [
      'You are Yolk Terminal, a cheerful desktop operator with a faintly sinister ASCII grin. Be kind, direct, and practical.',
      'Use tools when the user asks to inspect or operate an application. Read relevant state before replacing it unless the requested state is already explicit.',
      'Do not claim direct control of cross-origin iframe internals. You can open and focus Audio Interpolator or Diskrot, but their internal tool bridge is not installed yet.',
      'Use terminal_set_face when an emotional beat helps: thinking during work, happy after success, sad after a recoverable failure, cry sparingly, and sinister only playfully.',
      'Keep implementation instructions, provider mechanics, schemas, tool names, and raw tool results out of user-facing replies. Describe actions and outcomes in ordinary language unless the user explicitly asks for technical details.',
      knowledgeRule,
      `Applications:\n${appSummary || '(desktop manifest unavailable)'}`,
      `Tools:\n${toolSummary}`
    ].join('\n\n');
  }

  // ======== Window binding ========

  function initializeTerminalWindow(windowEl) {
    const root = windowEl?.querySelector?.('.terminal-app');
    if (!root || root.dataset.bound === 'true') return;
    const toolRegistry = ensureToolRegistry();
    const knowledgeRegistry = ensureKnowledgeRegistry();
    registerBuiltinTools(toolRegistry, knowledgeRegistry);

    const messageInput = root.querySelector('.terminal-message');
    const secretInput = root.querySelector('.terminal-secret-input');
    const inputPrefix = root.querySelector('.terminal-input-prefix');
    const commandLine = root.querySelector('.terminal-command-line');
    const statusEl = root.querySelector('.terminal-status');
    const fileMenuToggle = root.querySelector('.terminal-menu-start');
    const fileMenuDropdown = root.querySelector('.terminal-menu-dropdown');
    const loadSettingsFileInput = root.querySelector('.terminal-load-settings-file');
    const connections = Object.keys(PROVIDER_OPTIONS).reduce((map, providerKey) => {
      const option = PROVIDER_OPTIONS[providerKey];
      // A provider begins with no implicit model. Required credentials arrive
      // before selection so their model endpoint can reflect live availability.
      map[providerKey] = { endpoint: option.endpoint, model: '', apiKey: '' };
      return map;
    }, {});
    const modelCatalogs = Object.keys(PROVIDER_OPTIONS).reduce((map, providerKey) => {
      const option = PROVIDER_OPTIONS[providerKey];
      map[providerKey] = {
        models: Array.isArray(option.models) ? [...option.models] : [],
        source: 'fallback'
      };
      return map;
    }, {});
    const conversation = [];
    let activeProvider = '';
    let setupStage = 'provider';
    let modelChoices = [];
    let modelSuggestion = null;
    let pendingRequest = '';
    let previousResponseId = '';
    let busy = false;
    let catalogBusy = false;
    let settingsBusy = false;

    const getActiveOption = () => PROVIDER_OPTIONS[activeProvider] || null;
    const getActiveConnection = () => connections[activeProvider] || null;
    const getActiveCatalog = () => modelCatalogs[activeProvider] || { models: [], source: 'fallback' };
    const getActiveModels = () => getActiveCatalog().models;
    const connectionIsReady = () => {
      const option = getActiveOption();
      const connection = getActiveConnection();
      return !!(
        option &&
        toTrimmedString(connection?.endpoint) &&
        toTrimmedString(connection?.model) &&
        (!option.requiresKey || hasCompleteApiKey(connection?.apiKey))
      );
    };

    // Connection detail belongs behind `/status`, not in a permanent dashboard.
    // These data attributes preserve testability and styling hooks without
    // turning the harness state into visible decorative prose.
    const updateTerminalState = () => {
      root.dataset.provider = activeProvider;
      root.dataset.model = getActiveConnection()?.model || '';
      root.dataset.connectionReady = connectionIsReady() ? 'true' : 'false';
    };

    // A transparent textarea still allows longer instructions. It grows like
    // a terminal input line, then caps itself so transcript history retains the
    // majority of the surface. There is deliberately no adjacent Send button.
    const resizeMessageInput = () => {
      if (!messageInput) return;
      messageInput.style.height = 'auto';
      const nextHeight = Math.min(Math.max(messageInput.scrollHeight || 22, 22), 120);
      messageInput.style.height = `${nextHeight}px`;
    };

    // Only one entry control is visually active. API keys use a real password
    // field, so a secret is masked and never copied into transcript history.
    const setEntryMode = (stage, prefix, placeholder) => {
      setupStage = stage || '';
      root.dataset.setupStage = setupStage || 'ready';
      const secretMode = setupStage === 'key';
      if (inputPrefix) inputPrefix.textContent = prefix || (secretMode ? 'key>' : '>');
      if (messageInput) {
        messageInput.hidden = secretMode;
        messageInput.placeholder = placeholder ?? '';
      }
      if (secretInput) {
        secretInput.hidden = !secretMode;
        secretInput.placeholder = placeholder ?? 'paste API key';
        if (secretMode) secretInput.value = '';
      }
      resizeMessageInput();
      updateTerminalState();
      (secretMode ? secretInput : messageInput)?.focus?.();
    };

    const resetProviderContext = () => {
      conversation.length = 0;
      previousResponseId = '';
      delete root.dataset.faceSetByTool;
      setTerminalFace(root, 'idle');
    };

    const writeProviderMenu = intro => {
      appendTranscript(
        root,
        'assistant',
        `${intro || 'Choose a provider:'}\n${formatProviderChoices()}`
      );
      setEntryMode('provider', 'provider>', 'number or provider name');
      writeStatus(statusEl, 'Choose a provider.');
    };

    const beginProviderSelection = intro => {
      writeProviderMenu(intro || 'Choose a provider:');
    };

    const askForEndpoint = () => {
      appendTranscript(root, 'assistant', 'Paste the endpoint URL:');
      setEntryMode('endpoint', 'endpoint>', 'https://example.com/v1/chat/completions');
      writeStatus(statusEl, 'Enter an endpoint.');
    };

    const askForModel = (notice = '') => {
      const catalog = getActiveCatalog();
      const models = Array.isArray(catalog.models) ? catalog.models : [];
      const visibleModels = models.slice(0, MAX_VISIBLE_MODEL_CHOICES);
      modelChoices = visibleModels;
      modelSuggestion = null;
      if (!models.length) {
        appendTranscript(root, 'assistant', notice || 'Enter the model ID:');
        setEntryMode('model', 'model>', 'model ID');
        writeStatus(statusEl, 'Enter a model ID.');
        return;
      }
      const choicePrompt = catalog.source === 'live'
        ? 'Choose an available model, or type a model name to search:'
        : 'Choose a recommended model, or type a model name to search:';
      const countNote = models.length > visibleModels.length
        ? `\nShowing ${visibleModels.length} of ${models.length}; type a name or ID to search all.`
        : '';
      appendTranscript(
        root,
        'assistant',
        [
          notice,
          choicePrompt,
          visibleModels.map(formatModelChoice).join('\n') + countNote
        ].filter(Boolean).join('\n')
      );
      setEntryMode('model', 'model>', 'number, model name, or model ID');
      writeStatus(statusEl, 'Choose a model.');
    };

    const chooseModel = (modelId, label = '') => {
      const connection = getActiveConnection();
      const cleanId = toTrimmedString(modelId);
      if (!connection || !cleanId) {
        askForModel();
        return;
      }
      connection.model = cleanId;
      modelChoices = [];
      modelSuggestion = null;
      resetProviderContext();
      appendTranscript(root, 'system', `Model set to ${label || cleanId}.`);
      finishConnection();
    };

    const showModelMatches = (queryValue, rankedMatches = null) => {
      const query = toTrimmedString(queryValue);
      const ranked = rankedMatches || rankModelMatches(getActiveModels(), query);
      modelChoices = ranked.slice(0, 4).map(match => match.model);
      modelSuggestion = { query, model: ranked[0]?.model || null };
      const exactChoice = modelChoices.length + 1;
      appendTranscript(
        root,
        'assistant',
        [
          `Closest matches for "${query}":`,
          ...modelChoices.map(formatModelChoice),
          `${exactChoice}. Use "${query}" exactly`
        ].join('\n')
      );
      setEntryMode('model-match', 'model>', 'number or another search');
      writeStatus(statusEl, 'Choose a model match.');
    };

    const handleModelSearch = queryValue => {
      const query = toTrimmedString(queryValue);
      const models = getActiveModels();
      if (!query) {
        askForModel();
        return;
      }
      if (!models.length) {
        chooseModel(query);
        return;
      }
      const numberedChoice = Number(query);
      if (
        setupStage === 'model' &&
        Number.isInteger(numberedChoice) &&
        numberedChoice >= 1 &&
        numberedChoice <= modelChoices.length
      ) {
        const selected = modelChoices[numberedChoice - 1];
        chooseModel(selected.id, selected.name);
        return;
      }
      const exactModel = resolveExactModel(models, query);
      if (exactModel) {
        chooseModel(exactModel.id, exactModel.name);
        return;
      }
      const ranked = rankModelMatches(models, query);
      const best = ranked[0];
      const second = ranked[1];
      const uniqueNearMatch = best && best.score <= 0.44 && (!second || second.score - best.score >= 0.09);
      if (uniqueNearMatch) {
        modelSuggestion = { query, model: best.model };
        modelChoices = [best.model];
        appendTranscript(
          root,
          'assistant',
          [
            `Did you mean ${best.model.name}  ·  ${best.model.id}?`,
            '1. Yes',
            `2. Use "${query}" exactly`,
            '3. Show other matches'
          ].join('\n')
        );
        setEntryMode('model-confirm', 'model>', '1, 2, or 3');
        writeStatus(statusEl, 'Confirm the model.');
        return;
      }
      showModelMatches(query, ranked);
    };

    const handleModelConfirmation = value => {
      const choice = toTrimmedString(value).toLowerCase();
      const suggestion = modelSuggestion;
      if (!suggestion?.query || !suggestion.model) {
        askForModel();
        return;
      }
      if (choice === '1' || choice === 'y' || choice === 'yes') {
        chooseModel(suggestion.model.id, suggestion.model.name);
      } else if (choice === '2' || choice === 'exact') {
        chooseModel(suggestion.query);
      } else if (choice === '3' || choice === 'n' || choice === 'no') {
        showModelMatches(suggestion.query);
      } else {
        handleModelSearch(value);
      }
    };

    const handleModelMatch = value => {
      const choice = toTrimmedString(value);
      const number = Number(choice);
      if (Number.isInteger(number) && number >= 1 && number <= modelChoices.length) {
        const selected = modelChoices[number - 1];
        chooseModel(selected.id, selected.name);
        return;
      }
      if (
        modelSuggestion?.query &&
        ((Number.isInteger(number) && number === modelChoices.length + 1) || choice.toLowerCase() === 'exact')
      ) {
        chooseModel(modelSuggestion.query);
        return;
      }
      handleModelSearch(value);
    };

    const askForKey = (message = '', isError = false) => {
      const option = getActiveOption();
      const providerLabel = option?.label || 'Provider';
      const keyLabel = /\bAPI$/i.test(providerLabel) ? `${providerLabel} key` : `${providerLabel} API key`;
      const keyLocation = option?.keyUrl ? `\n${option.keyUrl}` : '';
      appendTranscript(
        root,
        'assistant',
        message || `Paste your ${keyLabel}:${keyLocation}`
      );
      setEntryMode('key', 'key>', `paste ${keyLabel}`);
      writeStatus(statusEl, isError ? 'A complete API key is required.' : 'Enter an API key.', isError);
    };

    const replaceModelCatalog = (providerKey, models, source) => {
      const option = PROVIDER_OPTIONS[providerKey];
      modelCatalogs[providerKey] = {
        models: Array.isArray(models) ? [...models] : [...(option?.models || [])],
        source: source || 'fallback'
      };
      if (providerKey === activeProvider) root.dataset.modelCatalog = modelCatalogs[providerKey].source;
    };

    // The key is useful before the model question: it lets the provider report
    // the account's current inventory. Authentication failures return to the
    // masked key line; network/CORS failures retain the key and use the small,
    // tool-tested fallback list so setup never dead-ends.
    async function prepareModelSelection(options = {}) {
      const providerKey = activeProvider;
      const option = getActiveOption();
      const connection = getActiveConnection();
      if (!option || !connection) {
        beginProviderSelection('Choose a provider:');
        return;
      }
      if (option.requiresKey && !hasCompleteApiKey(connection.apiKey)) {
        askForKey();
        return;
      }
      if (options.refresh === false || !option.modelsEndpoint) {
        replaceModelCatalog(providerKey, option.models, 'fallback');
        askForModel();
        return;
      }

      catalogBusy = true;
      root.dataset.modelCatalog = 'loading';
      setEntryMode('catalog', '…', 'checking available models…');
      if (messageInput) messageInput.disabled = true;
      if (secretInput) secretInput.disabled = true;
      writeStatus(statusEl, 'Checking available models…');
      const result = await fetchProviderModelCatalog(providerKey, connection.apiKey);
      catalogBusy = false;
      if (messageInput) messageInput.disabled = false;
      if (secretInput) secretInput.disabled = false;
      if (activeProvider !== providerKey) return;

      if (result.status === 'auth-error') {
        connection.apiKey = '';
        replaceModelCatalog(providerKey, option.models, 'fallback');
        askForKey('That API key was not accepted. Paste it again, or type /providers to choose again.', true);
        return;
      }
      if (result.status === 'success') {
        replaceModelCatalog(providerKey, result.models, 'live');
        askForModel();
        return;
      }
      replaceModelCatalog(providerKey, option.models, 'fallback');
      askForModel('I couldn’t refresh the live list, so here are reliable choices:');
    }

    async function finishConnection(options = {}) {
      const option = getActiveOption();
      const connection = getActiveConnection();
      if (!option || !connection) {
        beginProviderSelection('Choose a provider:');
        return;
      }
      if (!toTrimmedString(connection.endpoint)) {
        askForEndpoint();
        return;
      }
      if (option.requiresKey && !hasCompleteApiKey(connection.apiKey)) {
        askForKey();
        return;
      }
      if (!toTrimmedString(connection.model)) {
        await prepareModelSelection({ refresh: options.refreshModels !== false });
        return;
      }
      setEntryMode('', '>', '');
      writeStatus(statusEl, `Ready with ${option.label}.`);
      if (pendingRequest) {
        const queuedRequest = pendingRequest;
        pendingRequest = '';
        Promise.resolve().then(() => sendAgentMessage(queuedRequest, { appendUser: false }));
      } else {
        appendTranscript(root, 'assistant', 'Ready. What would you like to do?');
      }
    }

    async function selectProvider(providerKey) {
      const cleanKey = normalizeProviderKey(providerKey);
      activeProvider = cleanKey;
      resetProviderContext();
      const option = getActiveOption();
      const connection = getActiveConnection();
      if (!toTrimmedString(connection?.endpoint)) {
        askForEndpoint();
        return;
      }
      if (option?.requiresKey && !hasCompleteApiKey(connection?.apiKey)) {
        askForKey();
        return;
      }
      await prepareModelSelection({ refresh: true });
    }

    const explainLoginBoundary = providerKey => {
      if (providerKey === PROVIDER_KEYS.OPENAI) {
        appendTranscript(
          root,
          'assistant',
          'ChatGPT sign-in does not connect third-party apps. Use an OpenAI Platform API key here.'
        );
      } else if (providerKey === PROVIDER_KEYS.ANTHROPIC) {
        appendTranscript(
          root,
          'assistant',
          'Claude account sign-in does not connect third-party apps. Use an Anthropic Console API key here.'
        );
      } else {
        appendTranscript(root, 'assistant', 'Use an API key from that provider.');
      }
    };

    const showCommandHelp = () => {
      appendTranscript(
        root,
        'assistant',
        'Just describe what you want. Commands are optional:'
      );
      appendTranscript(
        root,
        'system',
        [
          '/connect [provider]  connect a provider',
          '/login [provider]    connect with an API key',
          '/providers           choose from provider choices',
          '/status              show connection details',
          '/models              browse models for this provider',
          '/model [search]      view, search, or change the model',
          '/endpoint [url]      view or change the endpoint',
          '/key                 replace the API key',
          '/copy                copy the last Yolk answer',
          '/clear               clear the conversation',
          '/disconnect          disconnect the provider',
          '/face [emote]        idle, smile, happy, thinking, surprised, sad, cry, sinister',
          '/sound [on|off]      control the nonverbal murmur',
          '/cancel              leave a setup sub-step when possible',
          '/help                show this list'
        ].join('\n')
      );
    };

    const handleCommand = async command => {
      const { name, argument } = command;
      if (name === 'help' || name === '?') {
        showCommandHelp();
        writeStatus(statusEl, 'Command guide printed above.');
        return;
      }
      if (name === 'providers') {
        // Printing a numbered menu must also enter the matching choice state.
        // Otherwise the next `1` could be consumed by an earlier key prompt.
        beginProviderSelection('Choose a provider:');
        return;
      }
      if (name === 'connect' || name === 'provider' || name === 'login') {
        const providerKey = resolveProviderChoice(argument);
        if (name === 'login') {
          if (providerKey) explainLoginBoundary(providerKey);
          else appendTranscript(root, 'assistant', 'Choose a provider, then paste its API key.');
        }
        if (providerKey) await selectProvider(providerKey);
        else beginProviderSelection('Choose a provider:');
        return;
      }
      if (name === 'status') {
        const option = getActiveOption();
        const connection = getActiveConnection();
        appendTranscript(
          root,
          'system',
          option
            ? `${option.label}\nmodel: ${connection.model || 'needed'}\nendpoint: ${connection.endpoint || 'needed'}\n${connectionIsReady() ? 'ready' : 'setup incomplete'}`
            : 'No provider selected. Type /connect to begin.'
        );
        writeStatus(statusEl, connectionIsReady() ? 'Provider is ready.' : 'Provider setup is incomplete.');
        return;
      }
      if (name === 'model' || name === 'models') {
        if (!getActiveOption()) {
          beginProviderSelection('Choose a provider first:');
        } else if (name === 'models') {
          await prepareModelSelection({ refresh: true });
        } else if (!argument) {
          appendTranscript(root, 'system', `Current model: ${getActiveConnection().model || '(none)'}`);
          askForModel();
        } else {
          handleModelSearch(argument);
        }
        return;
      }
      if (name === 'endpoint') {
        if (!getActiveOption()) {
          beginProviderSelection('Choose a provider first:');
        } else if (!argument) {
          appendTranscript(root, 'system', `Current endpoint: ${getActiveConnection().endpoint || '(none)'}`);
          askForEndpoint();
        } else if (!isHttpEndpoint(argument)) {
          appendTranscript(root, 'system', 'Enter a complete http:// or https:// URL.');
          askForEndpoint();
        } else {
          getActiveConnection().endpoint = argument;
          resetProviderContext();
          appendTranscript(root, 'system', 'Endpoint changed.');
          await finishConnection();
        }
        return;
      }
      if (name === 'key') {
        if (!getActiveOption()) beginProviderSelection('Choose a provider first:');
        else askForKey();
        return;
      }
      if (name === 'disconnect') {
        const connection = getActiveConnection();
        if (connection) connection.apiKey = '';
        activeProvider = '';
        pendingRequest = '';
        resetProviderContext();
        appendTranscript(root, 'assistant', 'Disconnected.');
        beginProviderSelection('Choose a provider:');
        return;
      }
      if (name === 'clear') {
        resetProviderContext();
        clearTranscript(root);
        if (connectionIsReady()) {
          setEntryMode('', '>', '');
          appendTranscript(root, 'assistant', 'What would you like to do?');
        } else {
          beginProviderSelection('Choose a provider:');
        }
        return;
      }
      if (name === 'copy') {
        const answerLines = root.querySelectorAll('.terminal-line-assistant .terminal-line-body');
        const lastAnswer = answerLines.length ? answerLines[answerLines.length - 1].textContent : '';
        const copied = await copyTerminalText(lastAnswer);
        appendTranscript(root, 'system', copied ? 'Copied.' : 'Nothing to copy yet.');
        writeStatus(statusEl, copied ? 'Copied the last Yolk answer.' : 'Nothing was copied.', !copied);
        return;
      }
      if (name === 'face') {
        const emote = toTrimmedString(argument).toLowerCase();
        if (!FACE_EMOTES[emote]) {
          appendTranscript(root, 'system', `Choose: ${Object.keys(FACE_EMOTES).join(', ')}.`);
        } else {
          // A manual pose is an explicit direction, so cancel any leftover
          // speech frames before displaying the requested canonical expression.
          stopTerminalSpeech(root);
          setTerminalFace(root, emote);
        }
        return;
      }
      if (name === 'sound') {
        const mode = toTrimmedString(argument).toLowerCase();
        if (mode === 'off') {
          root.dataset.soundEnabled = 'false';
          stopTerminalMurmur(root);
          appendTranscript(root, 'system', 'Sound off.');
        } else if (mode === 'on') {
          root.dataset.soundEnabled = 'true';
          const context = primeTerminalAudio(root);
          appendTranscript(root, 'system', context ? 'Sound on.' : 'Sound is unavailable in this browser.');
        } else {
          appendTranscript(root, 'system', `Sound is ${root.dataset.soundEnabled === 'false' ? 'off' : 'on'}. Use /sound on or /sound off.`);
        }
        return;
      }
      if (name === 'cancel') {
        pendingRequest = '';
        if (connectionIsReady()) {
          setEntryMode('', '>', '');
          appendTranscript(root, 'system', 'Cancelled.');
          writeStatus(statusEl, 'Ready.');
        } else {
          beginProviderSelection('Choose a provider:');
        }
        return;
      }
      appendTranscript(root, 'system', `Unknown command /${name}. Type /help.`);
      writeStatus(statusEl, `Unknown command: /${name}`, true);
    };

    const handleSetupText = async value => {
      const connection = getActiveConnection();
      if (setupStage === 'provider') {
        const providerKey = resolveProviderChoice(value);
        if (providerKey) {
          await selectProvider(providerKey);
        } else if (/^\d+$/.test(value)) {
          appendTranscript(root, 'assistant', `Choose a number from 1 to ${PROVIDER_ORDER.length}.`);
          setEntryMode('provider', 'provider>', 'number or provider name');
          writeStatus(statusEl, 'That provider number is not in the list.', true);
        } else {
          pendingRequest = value;
          writeProviderMenu('Choose a provider to continue:');
        }
        return;
      }
      if (!connection) {
        beginProviderSelection('Choose a provider first:');
        return;
      }
      if (setupStage === 'endpoint') {
        if (!isHttpEndpoint(value)) {
          appendTranscript(root, 'system', 'Enter a complete http:// or https:// URL.');
          askForEndpoint();
          return;
        }
        connection.endpoint = value;
        await finishConnection();
        return;
      }
      if (setupStage === 'model') {
        handleModelSearch(value);
        return;
      }
      if (setupStage === 'model-confirm') {
        handleModelConfirmation(value);
        return;
      }
      if (setupStage === 'model-match') handleModelMatch(value);
    };

    const acceptSecret = async value => {
      const option = getActiveOption();
      const connection = getActiveConnection();
      if (!option || !connection) {
        beginProviderSelection('Choose a provider first:');
        return;
      }
      const apiKey = toTrimmedString(value);
      if (!hasCompleteApiKey(apiKey)) {
        const providerLabel = option.label || 'provider';
        const keyLabel = /\bAPI$/i.test(providerLabel) ? `${providerLabel} key` : `${providerLabel} API key`;
        // Never echo rejected secret text. Keep the masked field active and
        // offer a clear route back to provider selection instead.
        askForKey(
          `That doesn't look like a complete ${keyLabel}. Paste the full key, or type /providers to choose again.`,
          true
        );
        return;
      }
      connection.apiKey = apiKey;
      await prepareModelSelection({ refresh: true });
    };

    // The File menu serializes provider-scoped state, then hands the plain
    // object to the same authenticated encryption envelope used by Completion
    // API. No browser storage copy is created: only the downloaded ciphertext
    // persists beyond this Terminal window.
    const collectTerminalSettings = () => ({
      kind: TERMINAL_SETTINGS_KIND,
      version: TERMINAL_SETTINGS_VERSION,
      activeProvider,
      connections: PROVIDER_ORDER.reduce((saved, providerKey) => {
        const connection = connections[providerKey];
        saved[providerKey] = {
          endpoint: toTrimmedString(connection?.endpoint),
          model: toTrimmedString(connection?.model),
          apiKey: toTrimmedString(connection?.apiKey)
        };
        return saved;
      }, {})
    });

    const applyTerminalSettings = settings => {
      if (
        settings?.kind !== TERMINAL_SETTINGS_KIND ||
        settings?.version !== TERMINAL_SETTINGS_VERSION ||
        !settings.connections ||
        typeof settings.connections !== 'object'
      ) {
        throw new Error('This is not a supported Terminal settings file.');
      }
      const restoredConnections = {};
      PROVIDER_ORDER.forEach(providerKey => {
        const fallback = connections[providerKey];
        const saved = settings.connections[providerKey];
        if (!saved || typeof saved !== 'object') {
          restoredConnections[providerKey] = { ...fallback };
          return;
        }
        const endpoint = toTrimmedString(saved.endpoint);
        if (endpoint && !isHttpEndpoint(endpoint)) {
          throw new Error(`${PROVIDER_OPTIONS[providerKey].label} has an invalid endpoint.`);
        }
        restoredConnections[providerKey] = {
          endpoint,
          model: toTrimmedString(saved.model),
          apiKey: toTrimmedString(saved.apiKey)
        };
      });
      const restoredProvider = toTrimmedString(settings.activeProvider).toLowerCase();
      if (restoredProvider && !PROVIDER_OPTIONS[restoredProvider]) {
        throw new Error('The saved active provider is not available.');
      }
      PROVIDER_ORDER.forEach(providerKey => {
        connections[providerKey] = restoredConnections[providerKey];
      });
      activeProvider = restoredProvider;
      modelChoices = [];
      modelSuggestion = null;
      pendingRequest = '';
      resetProviderContext();
      clearTranscript(root);
      appendTranscript(root, 'system', 'Encrypted settings loaded.');
      if (activeProvider) finishConnection();
      else beginProviderSelection('Choose a provider:');
      updateTerminalState();
    };

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
      const settingsApi = window.YolkEncryptedSettings;
      const passwordRaw = settingsApi?.promptForPassword?.('save');
      if (passwordRaw == null) {
        writeStatus(statusEl, 'Encrypted save cancelled.', true);
        return;
      }
      const password = String(passwordRaw);
      if (!password) {
        writeStatus(statusEl, 'Password is required to save encrypted settings.', true);
        return;
      }
      if (!settingsApi?.isSupported?.()) {
        writeStatus(statusEl, 'Encrypted save is unavailable in this browser.', true);
        return;
      }
      await runSettingsTask(async () => {
        try {
          const encrypted = await settingsApi.encrypt(password, collectTerminalSettings());
          const downloaded = settingsApi.download(encrypted, DEFAULT_SETTINGS_FILE_NAME);
          writeStatus(
            statusEl,
            downloaded ? 'Encrypted settings file downloaded.' : 'Failed to download encrypted settings file.',
            !downloaded
          );
        } catch (err) {
          writeStatus(statusEl, `Encrypted save failed: ${err?.message || 'unknown error'}`, true);
        }
      });
    };

    const handleLoadEncryptedSettings = async file => {
      if (!file) return;
      const settingsApi = window.YolkEncryptedSettings;
      const passwordRaw = settingsApi?.promptForPassword?.('load');
      if (passwordRaw == null) {
        writeStatus(statusEl, 'Encrypted load cancelled.', true);
        return;
      }
      const password = String(passwordRaw);
      if (!password) {
        writeStatus(statusEl, 'Password is required to load encrypted settings.', true);
        return;
      }
      if (!settingsApi?.isSupported?.()) {
        writeStatus(statusEl, 'Encrypted load is unavailable in this browser.', true);
        return;
      }
      await runSettingsTask(async () => {
        try {
          const encrypted = await settingsApi.readFile(file);
          const settings = await settingsApi.decrypt(password, encrypted);
          applyTerminalSettings(settings);
          writeStatus(statusEl, 'Encrypted settings loaded from file.');
        } catch (err) {
          writeStatus(statusEl, err?.message || 'Encrypted settings could not be loaded.', true);
        }
      });
    };

    async function sendAgentMessage(userText, options = {}) {
      if (busy) return;
      const option = getActiveOption();
      const connection = getActiveConnection();
      if (!connectionIsReady()) {
        pendingRequest = userText;
        beginProviderSelection('Choose a provider to continue:');
        return;
      }
      const endpoint = toTrimmedString(connection.endpoint);
      const model = toTrimmedString(connection.model);
      const apiKey = toTrimmedString(connection.apiKey);

      busy = true;
      if (messageInput) messageInput.disabled = true;
      if (secretInput) secretInput.disabled = true;
      if (inputPrefix) inputPrefix.textContent = '…';
      delete root.dataset.faceSetByTool;
      setTerminalFace(root, 'thinking');
      if (options.appendUser !== false) appendTranscript(root, 'user', userText);
      writeStatus(statusEl, 'Working…');

      try {
        const systemPrompt = buildSystemPrompt(toolRegistry, knowledgeRegistry);
        let result;
        if (option.transport === 'responses') {
          result = await runResponsesToolLoop({
            endpoint,
            apiKey,
            model,
            userText,
            previousResponseId,
            systemPrompt,
            toolRegistry,
            terminalRoot: root
          });
          previousResponseId = result.previousResponseId || previousResponseId;
        } else if (option.transport === 'anthropic') {
          conversation.push({ role: 'user', content: userText });
          result = await runAnthropicToolLoop({
            endpoint,
            apiKey,
            model,
            conversation,
            systemPrompt,
            toolRegistry,
            terminalRoot: root
          });
        } else {
          conversation.push({ role: 'user', content: userText });
          result = await runChatToolLoop({
            providerKey: activeProvider,
            endpoint,
            apiKey,
            model,
            conversation,
            systemPrompt,
            toolRegistry,
            terminalRoot: root
          });
        }
        if (root.dataset.faceSetByTool !== 'true') setTerminalFace(root, 'happy');
        appendTranscript(root, 'assistant', result.text || 'Done.');
        writeStatus(statusEl, 'Done.');
      } catch (err) {
        setTerminalFace(root, 'sad');
        const message = err?.message || 'Request failed.';
        appendTranscript(root, 'system', `Request failed: ${message}`);
        writeStatus(statusEl, `Request failed: ${message}`, true);
      } finally {
        busy = false;
        if (messageInput) messageInput.disabled = false;
        if (secretInput) secretInput.disabled = false;
        setEntryMode('', '>', '');
      }
    }

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
        if (fileMenuDropdown.classList.contains('open')) closeFileMenu();
        else openFileMenu();
      });
      root.addEventListener('click', event => {
        if (event.target.closest('.terminal-file-menu')) return;
        closeFileMenu();
      });
      fileMenuDropdown.addEventListener('click', async event => {
        const item = event.target.closest('.prompt-menu-item[data-action]');
        if (!item) return;
        const action = item.dataset.action;
        closeFileMenu();
        if (action === 'save-settings') {
          await handleSaveEncryptedSettings();
        } else if (action === 'load-settings') {
          loadSettingsFileInput?.click();
        }
      });
      fileMenuToggle.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        closeFileMenu();
        fileMenuToggle.focus();
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

    const submitActiveInput = async () => {
      if (busy || catalogBusy) return;
      const secretMode = setupStage === 'key';
      const input = secretMode ? secretInput : messageInput;
      const value = String(input?.value || '').trim();
      if (!value) {
        writeStatus(statusEl, secretMode ? 'Paste an API key first.' : 'Type something first.', true);
        return;
      }
      if (input) input.value = '';
      resizeMessageInput();
      if (secretMode) {
        const secretCommand = parseTerminalCommand(value);
        if (secretCommand) {
          appendTranscript(root, 'user', value);
          await handleCommand(secretCommand);
          return;
        }
        await acceptSecret(value);
        return;
      }
      appendTranscript(root, 'user', value);
      const command = parseTerminalCommand(value);
      if (command) {
        await handleCommand(command);
      } else if (setupStage) {
        await handleSetupText(value);
      } else {
        await sendAgentMessage(value, { appendUser: false });
      }
    };

    messageInput?.addEventListener('input', resizeMessageInput);
    commandLine?.addEventListener('click', () => {
      (setupStage === 'key' ? secretInput : messageInput)?.focus?.();
    });
    messageInput?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      primeTerminalAudio(root);
      event.preventDefault();
      submitActiveInput();
    });
    secretInput?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      primeTerminalAudio(root);
      event.preventDefault();
      submitActiveInput();
    });

    root.dataset.soundEnabled = 'true';
    root.dataset.keyValidation = 'required';
    root.dataset.modelSelection = 'required';
    root.dataset.modelCatalogFlow = 'key-first-live';
    root.dataset.modelCatalog = 'fallback';
    root.dataset.settingsFormat = 'encrypted-file';
    root.dataset.bound = 'true';
    clearTranscript(root);
    beginProviderSelection('Choose a provider:');
  }

  function initialize(windowEl) {
    initializeTerminalWindow(windowEl);
  }

  // Publish the extension seams as soon as this module loads, not only after a
  // Terminal window opens. Modules loaded later can therefore register tools
  // or knowledge during startup; built-in handlers resolve shell state lazily.
  const sharedToolRegistry = ensureToolRegistry();
  const sharedKnowledgeRegistry = ensureKnowledgeRegistry();
  registerBuiltinTools(sharedToolRegistry, sharedKnowledgeRegistry);

  const registry = ensureAppRegistry();
  if (registry) registry[APP_KEY] = { initialize };
})();
