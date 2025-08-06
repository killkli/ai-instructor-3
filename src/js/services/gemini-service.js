/**
 * Gemini API 服務
 * 負責與Google Gemini API進行通訊
 */

class GeminiService {
  constructor() {
    this.apiKey = null;
    this.model = 'gemini-2.5-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.initialized = false;
  }

  /**
   * 初始化服務
   * @param {string} apiKey - Gemini API金鑰
   * @param {string} model - 要使用的模型名稱
   */
  init(apiKey, model = 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.initialized = true;
    console.log(`GeminiService initialized with model: ${this.model}`);
  }

  /**
   * 檢查服務是否已初始化
   */
  isInitialized() {
    return this.initialized && this.apiKey;
  }

  /**
   * 檢查服務是否已初始化
   */
  _ensureInitialized() {
    if (!this.initialized || !this.apiKey) {
      throw new Error('GeminiService not initialized. Call init() first with API key.');
    }
  }

  /**
   * 發送訊息到Gemini API
   * @param {string|Object} message - 用戶訊息，可以是字符串或包含文本和媒體的對象
   * @param {Array} history - 對話歷史
   * @param {string} systemPrompt - 系統提示詞
   * @param {Object} options - 額外選項
   * @returns {Promise<Object>} API回應
   */
  async sendMessage(message, history = [], systemPrompt = '', options = {}) {
    this._ensureInitialized();

    const modelToUse = options.model || this.model;
    const url = `${this.baseUrl}/${modelToUse}:generateContent?key=${this.apiKey}`;
    
    // 建構對話內容
    const contents = this._buildContents(message, history, systemPrompt);
    
    // 設定生成配置
    const generationConfig = {
      temperature: options.temperature || 0.7,
      topK: options.topK || 40,
      topP: options.topP || 0.95,
      maxOutputTokens: options.maxTokens || 16192,
      ...options.generationConfig
    };

    const requestBody = {
      contents,
      generationConfig,
      safetySettings: this._getDefaultSafetySettings()
    };

    if (options.tools) {
      requestBody.tools = options.tools;
    }

    // 根據官方文檔，如果有系統指令，應該使用systemInstruction字段
    // 但為了向後兼容，我們同時支持兩種方式
    if (systemPrompt && !contents.some(c => c.role === 'user' && c.parts[0].text === systemPrompt)) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} - ${await response.text()}`);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated from API');
      }

      const candidate = data.candidates[0];
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response blocked by safety filters');
      }

      // 檢查回應結構
      if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        throw new Error('Invalid response structure from API');
      }

      return {
        text: candidate.content.parts[0].text,
        finishReason: candidate.finishReason,
        usage: data.usageMetadata || null,
        safetyRatings: candidate.safetyRatings || [],
        groundingMetadata: candidate.groundingMetadata || null
      };

    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to get response: ${error.message}`);
    }
  }

  /**
   * 串流發送訊息
   * @param {string|Object} message - 用戶訊息，可以是字符串或包含文本和媒體的對象
   * @param {Array} history - 對話歷史
   * @param {string} systemPrompt - 系統提示詞
   * @param {Function} onChunk - 處理串流片段的回調函數
   * @param {Object} options - 額外選項
   */
  async sendMessageStream(message, history = [], systemPrompt = '', onChunk, options = {}) {
    this._ensureInitialized();

    const url = `${this.baseUrl}/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    
    const contents = this._buildContents(message, history, systemPrompt);
    
    const generationConfig = {
      temperature: options.temperature || 0.7,
      topK: options.topK || 40,
      topP: options.topP || 0.95,
      maxOutputTokens: options.maxTokens || 8192,
      ...options.generationConfig
    };

    const requestBody = {
      contents,
      generationConfig,
      safetySettings: this._getDefaultSafetySettings()
    };

    if (options.tools) {
      requestBody.tools = options.tools;
    }

    // 根據官方文檔，如果有系統指令，應該使用systemInstruction字段
    // 但為了向後兼容，我們同時支持兩種方式
    if (systemPrompt && !contents.some(c => c.role === 'user' && c.parts[0].text === systemPrompt)) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} - ${await response.text()}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '' || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() === '[DONE]') break;
            
            try {
              const data = JSON.parse(jsonStr);
              
              if (data.candidates && data.candidates[0] && 
                  data.candidates[0].content && 
                  data.candidates[0].content.parts && 
                  data.candidates[0].content.parts[0] &&
                  data.candidates[0].content.parts[0].text) {
                const text = data.candidates[0].content.parts[0].text;
                fullText += text;
                onChunk(text, fullText);
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }

      return { text: fullText };

    } catch (error) {
      console.error('Gemini Stream API Error:', error);
      throw new Error(`Failed to get streaming response: ${error.message}`);
    }
  }

  /**
   * 建構API請求的內容陣列
   */
  _buildContents(message, history, systemPrompt) {
    const contents = [];

    // 添加系統提示詞作為第一個訊息（向後兼容）
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: '我了解您的要求，我會按照這些指導原則來協助學生學習。' }]
      });
    }

    // 添加對話歷史
    history.forEach(item => {
      const contentParts = this._buildMessageParts(item.content, item.images);
      contents.push({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: contentParts
      });
    });

    // 添加當前用戶訊息
    const currentMessageParts = this._buildMessageParts(message);
    contents.push({
      role: 'user',
      parts: currentMessageParts
    });

    return contents;
  }

  /**
   * 建構訊息parts，支援文字和圖片
   * @param {string|Object} message - 訊息內容
   * @param {Array} images - 圖片陣列（可選，用於歷史記錄）
   * @returns {Array} parts陣列
   */
  _buildMessageParts(message, images = null) {
    const parts = [];

    // 處理不同類型的訊息
    if (typeof message === 'string') {
      // 純文字訊息
      parts.push({ text: message });
    } else if (message && typeof message === 'object') {
      // 多模態訊息
      if (message.text) {
        parts.push({ text: message.text });
      }
      
      // 添加圖片
      if (message.images && Array.isArray(message.images)) {
        message.images.forEach(image => {
          if (image.data && image.mimeType) {
            parts.push({
              inlineData: {
                mimeType: image.mimeType,
                data: image.data
              }
            });
          }
        });
      }
    }

    // 處理歷史記錄中的圖片（向後兼容）
    if (images && Array.isArray(images)) {
      images.forEach(image => {
        if (image.data && image.mimeType) {
          parts.push({
            inlineData: {
              mimeType: image.mimeType,
              data: image.data
            }
          });
        }
      });
    }

    return parts.length > 0 ? parts : [{ text: '' }];
  }

  /**
   * 獲取預設安全設定
   */
  _getDefaultSafetySettings() {
    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];
  }

  /**
   * 生成內容的快捷方法（為了與QuestionBankService兼容）
   * @param {string} prompt - 提示詞
   * @param {Object} options - 選項
   * @returns {Promise<string>} 生成的文本
   */
  async generateContent(prompt, options = {}) {
    const response = await this.sendMessage(prompt, [], '', options);
    return response.text;
  }

  /**
   * 測試API連接
   */
  async testConnection() {
    try {
      const response = await this.sendMessage('Hello', [], '', {
        maxTokens: 10
      });
      return { success: true, response: response.text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取可用模型列表
   */
  async getAvailableModels() {
    this._ensureInitialized();

    try {
      const url = `${this.baseUrl}?key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * 設定新的模型
   */
  setModel(model) {
    this.model = model;
    console.log(`Model changed to: ${this.model}`);
  }

  /**
   * 獲取當前模型
   */
  getCurrentModel() {
    return this.model;
  }

  /**
   * 檢查API金鑰是否有效
   */
  async validateApiKey(apiKey = null) {
    const keyToTest = apiKey || this.apiKey;
    
    if (!keyToTest) {
      return { valid: false, error: 'No API key provided' };
    }

    try {
      // 使用簡單的模型列表API來驗證金鑰
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToTest}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return { valid: false, error: `API key validation failed: ${response.status}` };
      }

      const data = await response.json();
      
      // 檢查是否有模型列表
      if (data.models && data.models.length > 0) {
        return { valid: true, error: null };
      } else {
        return { valid: false, error: 'No models available with this API key' };
      }
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 使用Google Search工具發送訊息
   * @param {string|Object} message - 用戶訊息
   * @param {Array} history - 對話歷史
   * @param {string} systemPrompt - 系統提示詞
   * @param {Object} options - 額外選項
   * @returns {Promise<Object>} API回應
   */
  async sendMessageWithGoogleSearch(message, history = [], systemPrompt = '', options = {}) {
    const toolOptions = {
      ...options,
      tools: [
        { "google_search": {} }
      ]
    };
    return this.sendMessage(message, history, systemPrompt, toolOptions);
  }

  /**
   * 串流發送包含Google Search工具的訊息
   * @param {string|Object} message - 用戶訊息
   * @param {Array} history - 對話歷史
   * @param {string} systemPrompt - 系統提示詞
   * @param {Function} onChunk - 處理串流片段的回調函數
   * @param {Object} options - 額外選項
   * @returns {Promise<Object>} API回應
   */
  async sendMessageWithGoogleSearchStream(message, history = [], systemPrompt = '', onChunk, options = {}) {
    const toolOptions = {
      ...options,
      tools: [
        { "google_search": {} }
      ]
    };
    return this.sendMessageStream(message, history, systemPrompt, onChunk, toolOptions);
  }

  /**
   * 使用 gemini-2.0-flash-lite 修復 JSON 字串，僅回傳修正後的 JSON 內容
   * @param {string} badJson - 需要修復的 JSON 字串
   * @returns {Promise<string>} 修正後的 JSON 字串
   */
  async fixJsonWithLiteModel(badJson) {
    const prompt = `Fix this json, export json code only:\n${badJson}`;
    const response = await this.sendMessage(prompt, [], '', {
      maxTokens: 2048,
      temperature: 0.2,
      model: 'gemini-2.0-flash-lite'
    });
    const text = response.text || '';
    // 抽出 ```json ... ``` 區塊
    const match = text.match(/```json\s*([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
  }
}

// 創建全域實例
const geminiService = new GeminiService();

export default geminiService; 