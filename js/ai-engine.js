// Local inference only. This module never falls back to a cloud AI service.
export const MODEL_URL = 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-gpu.litertlm';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@litert-lm/core/+esm';

function aborted() {
  const error = new Error('操作已取消。');
  error.name = 'AbortError';
  return error;
}

export class AIEngine {
  // Dependency injection is for lifecycle tests; the app uses the official SDK.
  constructor({ sdkLoader = () => import(SDK_URL) } = {}) {
    this.ready = false;
    this.simulation = false;
    this.generating = false;
    this.engine = null;
    this.conversation = null;
    this._sdkLoader = sdkLoader;
    this._samplerType = null;
    this._loading = null;
    this._unloading = null;
    this._generation = null;
    this._revision = 0;
  }

  async capabilities() {
    const nav = globalThis.navigator;
    let adapter = null;
    let GPUError = null;
    let storage = null;
    let storageError = null;
    try {
      adapter = await nav?.gpu?.requestAdapter();
    } catch (error) {
      GPUError = error?.message || String(error);
    }
    // Storage estimates are diagnostic, not a prerequisite for a local File.
    try {
      storage = await nav?.storage?.estimate?.() ?? null;
    } catch (error) {
      storageError = error?.message || String(error);
    }
    return {
      secureContext: globalThis.isSecureContext === true,
      WebGPU: !!nav?.gpu,
      GPUAdapter: !!adapter,
      JSPI: typeof globalThis.WebAssembly?.Suspending === 'function'
        && typeof globalThis.WebAssembly?.promising === 'function',
      storage,
      GPUError,
      storageError,
    };
  }

  async load(file) {
    if (this._unloading) throw new Error('模型正在卸載，請完成後再載入。');
    if (this._loading) return this._loading;
    if (this.ready && this.engine) return;
    if (this.engine) throw new Error('上次模型卸載未完成，請重新執行卸載後再試。');
    if (!file) throw new Error('請先選擇官方 Gemma 4 E2B GPU .litertlm 檔案。');
    if (typeof file.name !== 'string' || !/\.litertlm$/i.test(file.name)) {
      throw new Error('模型格式須為 .litertlm；請使用官方 E2B GPU 模型。');
    }
    if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('模型檔案為空或無法讀取。');

    const revision = this._revision;
    const task = (async () => {
      const cap = await this.capabilities();
      if (revision !== this._revision) throw aborted();
      if (!cap.secureContext) throw new Error('本地 AI 需要 HTTPS 或 localhost 安全環境。');
      if (!cap.GPUAdapter || !cap.JSPI) {
        throw new Error('裝置未符合 WebGPU／JSPI 要求。現有 LiteRT-LM Web runtime 未能保證 iPad Safari 運行；可在支援 JSPI 的 Mac Chrome 測試同一模型，或使用 Swift 原生推理。');
      }
      const sdk = await this._sdkLoader();
      if (revision !== this._revision) throw aborted();
      if (typeof sdk?.Engine?.create !== 'function') throw new Error('LiteRT-LM SDK 載入失敗或 API 不相容。');
      if (sdk.SamplerType?.TOP_P == null) throw new Error('LiteRT-LM SDK 缺少 SamplerType.TOP_P，請重新載入網頁。');
      this._samplerType = sdk.SamplerType.TOP_P;
      const engine = await sdk.Engine.create({
        model: file,
        mainExecutorSettings: { maxNumTokens: 2048 },
      });
      // Unload may have been requested while native/WASM initialization awaited.
      if (revision !== this._revision) {
        await engine.delete();
        throw aborted();
      }
      this.engine = engine;
      this.ready = true;
    })();
    this._loading = task;
    try {
      await task;
    } finally {
      if (this._loading === task) this._loading = null;
    }
  }

  async *generate(text, length = 'short') {
    if (typeof text !== 'string' || !text.trim()) throw new Error('請先輸入問題。');
    if (text.length > 500) throw new Error('問題請控制喺 500 字以內。');
    if (this._unloading) throw new Error('模型正在卸載。');
    if (this.generating) throw new Error('上一個生成仍未結束，請稍後再試。');
    if (this.simulation) {
      yield '【介面模擬，並非 AI 答案】呢段固定文字只用嚟測試表情、逐句朗讀同操作流程。';
      return;
    }
    if (!this.ready || !this.engine) throw new Error('真正 Gemma 尚未載入。請到教師設定檢查。');

    const engine = this.engine;
    let finish;
    const operation = { cancelled: false, conversation: null, done: new Promise(resolve => { finish = resolve; }) };
    this._generation = operation;
    this.generating = true;
    let failure = null;
    try {
      const conversation = await engine.createConversation({
        preface: {
          extra_context: { enable_thinking: false },
          messages: [{
            role: 'system',
            content: `你係叻豬博士，香港小學 AI 助教。只用香港廣東話及繁體中文，友善有耐性。回答${length === 'long' ? '60至100' : '20至60'}字，第一句簡短有實際內容。用簡單例子，數學引導思考。不確定就承認。危險、欺凌、受傷或情緒困擾應鼓勵立即找老師協助。不要要求姓名或個人資料。不要產生不適齡內容。`,
          }],
        },
        sessionConfig: {
          maxOutputTokens: length === 'long' ? 256 : 180,
          // This Web executor can be limited to top-k 1. Do not inherit the
          // model's default k=64, which fails before the first token.
          samplerParams: { type: this._samplerType, k: 1, p: 1, temperature: 0.7 },
        },
      });
      operation.conversation = conversation;
      this.conversation = conversation;
      // cancel() can arrive before createConversation() has resolved.
      if (operation.cancelled) {
        this._cancelConversation(conversation);
        throw aborted();
      }
      for await (const chunk of conversation.sendMessageStreaming(text.trim())) {
        if (operation.cancelled) throw aborted();
        if (!Array.isArray(chunk?.content)) continue;
        for (const item of chunk.content) {
          if (operation.cancelled) throw aborted();
          if (item?.type === 'text' && typeof item.text === 'string' && item.text) yield item.text;
        }
      }
      if (operation.cancelled) throw aborted();
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      try {
        await operation.conversation?.delete?.();
      } catch (error) {
        // Preserve the original inference failure; never leave the busy lock set.
        if (!failure) throw error;
      } finally {
        if (this._generation === operation) {
          this.conversation = null;
          this._generation = null;
          this.generating = false;
        }
        finish();
      }
    }
  }

  _cancelConversation(conversation) {
    // App emergency-stop handlers are synchronous. Do not throw into those handlers
    // or leave an unhandled rejection if a runtime implements asynchronous cancel.
    try {
      Promise.resolve(conversation?.cancel?.()).catch(() => {});
    } catch { /* The operation remains cancelled; unload waits for its completion. */ }
  }

  cancel() {
    const operation = this._generation;
    if (!operation) return;
    operation.cancelled = true;
    this._cancelConversation(operation.conversation);
  }

  async unload() {
    if (this._unloading) return this._unloading;
    this.ready = false;
    this._revision++;
    this.cancel();
    const loading = this._loading;
    const generation = this._generation;
    const task = (async () => {
      // Never delete the engine while a conversation is still using it.
      // If a runtime hangs, remain unloading rather than falsely report success.
      if (loading) await loading.catch(() => {});
      if (generation) await generation.done;
      const engine = this.engine;
      if (engine) await engine.delete();
      if (this.engine === engine) this.engine = null;
    })();
    this._unloading = task;
    try {
      await task;
    } finally {
      if (this._unloading === task) this._unloading = null;
    }
  }
}
