/**
 * 消息處理管理器
 * 處理消息發送、接收、顯示和狀態管理
 */

import geminiService from '../services/gemini-service.js';
import sessionManager from '../services/session-manager.js';
import promptProcessor from '../services/prompt-processor.js';
import contentRenderer from '../services/content-renderer.js';
import promptManager from '../config/prompt-manager.js';

class MessageProcessingManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化消息處理管理器
   */
  async init() {
    if (this.initialized) return;

    try {
      console.log('💬 Initializing MessageProcessingManager...');
      this.initialized = true;
      console.log('✅ MessageProcessingManager initialized');
    } catch (error) {
      console.error('❌ MessageProcessingManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * 處理發送訊息
   */
  async handleSendMessage() {
    if (this.app.isProcessing) return;

    const messageText = this.app.elements.messageInput?.value.trim();
    if (!messageText && this.app.appStateManager.get('uploadedImages').length === 0) return;

    try {
      this.app.isProcessing = true;
      this.app._updateSendButton(false);

      // 構建多模態訊息
      const multimodalMessage = this.app.imageManager.buildMultimodalMessage(messageText);

      // 清空輸入框
      if (this.app.elements.messageInput) {
        this.app.elements.messageInput.value = '';
      }

      // 添加用戶訊息到UI（包含圖片）
      this.addMessageToUI('user', messageText, this.app.appStateManager.get('uploadedImages'));

      // 清空已上傳的圖片
      this.app.imageManager.clearUploadedImages();

      // 檢查是否是指令
      if (messageText.startsWith('/')) {
        // 指令處理完後再保存到會話歷史
        await this.handleCommand(messageText);
        await sessionManager.addMessage('user', messageText);
      } else {
        // 發送到AI，在AI回應成功後再保存用戶訊息
        await this.sendToAI(multimodalMessage);
      }

    } catch (error) {
      console.error('Send message error:', error);
      this.app._showNotification(`發送訊息失敗: ${error.message}`, 'error');
    } finally {
      this.app.isProcessing = false;
      this.app._updateSendButton(true);
      this.app._hideTypingIndicator();
    }
  }

  /**
   * 發送訊息到AI
   */
  async sendToAI(message) {
    // 創建思考中的AI訊息氣泡
    const thinkingMessageId = this.addThinkingMessage();

    try {
      // 獲取對話歷史（不包含當前訊息）
      const history = sessionManager.getSessionHistory(null, 20);

      // 獲取系統提示詞（優先使用自定義提示詞）
      let systemPrompt = promptProcessor.getEffectiveSystemPrompt();

      // 獲取隱藏的練習分析並加入系統提示詞
      systemPrompt = promptProcessor.addPracticeAnalysisToSystemPrompt(systemPrompt, history);

      // 配置選項
      const options = {
        temperature: this.app.appStateManager.get('temperature') || 0.7,
        maxTokens: 8192
      };

      if (this.app.appStateManager.get('streamingEnabled')) {
        // 串流模式
        await this.handleStreamingResponse(message, history, systemPrompt, options, thinkingMessageId);
      } else {
        // 一般模式
        const response = await geminiService.sendMessage(message, history, systemPrompt, options);

        // 更新思考氣泡為實際回應
        const fixedContent = await this.updateMessageContent(thinkingMessageId, response.text);

        // AI回應成功後，保存用戶訊息和助理回應
        await sessionManager.addMessage('user', message);
        await sessionManager.addMessage('assistant', fixedContent, {
          model: this.app.appStateManager.get('currentModel'),
          finishReason: response.finishReason,
          usage: response.usage
        });
      }

      // 更新會話列表
      await this.app.sessionUIManager.updateSessionsList();

    } catch (error) {
      console.error('AI request failed:', error);

      // 更新思考氣泡為錯誤狀態
      this.updateMessageToError(thinkingMessageId, error.message, () => {
        this.sendToAI(message); // 重試函數
      });
    }
  }

  /**
   * 處理串流回應
   */
  async handleStreamingResponse(message, history, systemPrompt, options, thinkingMessageId) {
    let fullResponse = '';

    try {
      await geminiService.sendMessageStream(
        message,
        history,
        systemPrompt,
        (chunk, fullText) => {
          fullResponse = fullText;
          // 更新思考氣泡的內容
          this.updateMessageContent(thinkingMessageId, fullText, false);
        },
        options
      );

      const fixedContent = await this.updateMessageContent(thinkingMessageId, fullResponse);

      // 串流回應完成後，保存用戶訊息和助理回應
      await sessionManager.addMessage('user', message);
      await sessionManager.addMessage('assistant', fixedContent, {
        model: this.app.appStateManager.get('currentModel'),
        streaming: true
      });

    } catch (error) {
      // 更新思考氣泡為錯誤狀態
      this.updateMessageToError(thinkingMessageId, error.message, () => {
        this.sendToAI(message); // 重試函數
      });
      throw error;
    }
  }

  /**
   * 處理指令
   */
  async handleCommand(command) {
    const [cmd, ...args] = command.split(' ');

    switch (cmd.toLowerCase()) {
      case '/new':
        await this.app.roleSelectionManager.showRoleSelection();
        break;

      case '/current':
        this.app.sessionUIManager.showCurrentSessionInfo();
        break;

      case '/summary':
        await this.app.sessionUIManager.showSessionSummary();
        break;

      case '/question':
        if (args.length > 0) {
          await this.sendToAI(args.join(' '));
        } else {
          this.app._showNotification('請在 /question 後面輸入您的問題', 'info');
        }
        break;

      case '/practice':
        await this.app.practiceIntegration.handlePracticeRequest(args);
        break;

      default:
        this.app._showNotification(`未知指令: ${cmd}`, 'warning');
    }
  }

  /**
   * 添加思考中的AI訊息氣泡
   */
  addThinkingMessage() {
    if (!this.app.elements.messagesContainer) return null;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper assistant thinking';
    messageWrapper.dataset.messageId = messageId;

    // 創建頭像
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar assistant';
    avatar.textContent = '🤖';

    // 創建訊息氣泡
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble assistant thinking';

    // 創建思考動畫
    const thinkingContent = document.createElement('div');
    thinkingContent.className = 'thinking-content';
    thinkingContent.innerHTML = `
      <div class="thinking-dots">
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
        <span class="thinking-dot"></span>
      </div>
      <span class="thinking-text">AI正在思考中...</span>
    `;

    // 組裝結構
    messageBubble.appendChild(thinkingContent);
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageBubble);

    this.app.elements.messagesContainer.appendChild(messageWrapper);
    this.app._scrollToBottom();

    return messageId;
  }

  /**
   * 更新訊息內容
   */

  async updateMessageContent(messageId, content, fixJson = true) {
    const messageWrapper = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageWrapper) return;

    const messageBubble = messageWrapper.querySelector('.message-bubble');
    if (!messageBubble) return;

    // 移除思考狀態
    messageBubble.classList.remove('thinking');
    messageWrapper.classList.remove('thinking');

    // 創建一個臨時容器來存放渲染後的內容和視覺化圖表
    const tempContentContainer = document.createElement('div');
    tempContentContainer.className = 'message-content'; // 保持與原始訊息內容相同的類名

    // 使用新的、更可靠的正規表示式
    const VISUALIZATION_REGEX = /\[VISUALIZATION_START\]([\s\S]*?)\[VISUALIZATION_END\]/g;
    let lastIndex = 0;
    let match;

    // Array to build the potentially updated content string for return value
    const updatedContentParts = [];
    // Reset regex lastIndex to ensure correct iteration from the beginning
    VISUALIZATION_REGEX.lastIndex = 0;

    while ((match = VISUALIZATION_REGEX.exec(content)) !== null) {
      const vizJsonString = match[1];
      const vizStartIndex = match.index;
      const vizEndIndex = VISUALIZATION_REGEX.lastIndex;

      // 添加此視覺化之前的文字內容
      if (vizStartIndex > lastIndex) {
        const textBefore = content.substring(lastIndex, vizStartIndex);
        const textElement = document.createElement('div');
        textElement.innerHTML = contentRenderer.render(textBefore);
        tempContentContainer.appendChild(textElement);
        updatedContentParts.push(textBefore); // Add to parts for return value
      }

      // 添加視覺化圖表
      let vizConfig = null;
      let parseError = null;
      let vizBlockToAppend = match[0]; // Default to original block for return value

      // 1st: 嘗試本地修正後 parse
      try {
        const cleanedVizJsonString = vizJsonString.replace(/,(\s*[}\]])/g, '$1');
        vizConfig = JSON.parse(cleanedVizJsonString);
        // If local fix succeeds, update the block to append for return value
        vizBlockToAppend = `[VISUALIZATION_START]${JSON.stringify(vizConfig)}[VISUALIZATION_END]`;
      } catch (error) {
        parseError = error;
      }

      // 2nd: fallback 用 Gemini 修復
      if (!vizConfig && parseError && fixJson) {
        try {
          const fixedJson = await geminiService.fixJsonWithLiteModel(vizJsonString);
          vizConfig = JSON.parse(fixedJson);
          // If Gemini fixes it, update the block to append for return value
          vizBlockToAppend = `[VISUALIZATION_START]${JSON.stringify(vizConfig)}[VISUALIZATION_END]`;
        } catch (fallbackError) {
          console.error('解析或修復視覺化 JSON 失敗:', fallbackError);
          // If Gemini also fails, vizBlockToAppend remains the original match[0]
        }
      }

      if (vizConfig) {
        const vizContainer = document.createElement('div');
        vizContainer.className = 'ai-visualization-container';
        tempContentContainer.appendChild(vizContainer);
        this.app.learningVisualizationWrapper.renderVisualization(vizContainer, vizConfig);
      } else {
        // 兩次都失敗，顯示原始內容
        const errorTextElement = document.createElement('div');
        errorTextElement.innerHTML = contentRenderer.render(match[0]);
        tempContentContainer.appendChild(errorTextElement);
      }
      updatedContentParts.push(vizBlockToAppend); // Add the (potentially fixed) visualization block
      lastIndex = vizEndIndex;
    }

    // 添加最後一個視覺化之後的剩餘文字內容（或如果沒有視覺化則添加所有內容）
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      const textElement = document.createElement('div');
      textElement.innerHTML = contentRenderer.render(remainingText);
      tempContentContainer.appendChild(textElement);
      updatedContentParts.push(remainingText); // Add to parts for return value
    }

    // 清除現有內容並附加新的結構化內容
    messageBubble.innerHTML = '';
    messageBubble.appendChild(tempContentContainer);

    // 添加時間戳
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = this.app._formatTime(new Date());
    messageBubble.appendChild(messageTime);

    // 對整個訊息內容應用語法高亮和數學渲染
    contentRenderer.highlightCodeBlocks(tempContentContainer);
    contentRenderer.renderMathInElement(tempContentContainer);

    // 如果是 AI 回應，添加語音按鈕
    if (messageWrapper.classList.contains('assistant')) {
      this.app.speechManager?.addSpeechButtonsToMessage(messageWrapper);
    }

    this.app._scrollToBottom();

    // 如果 fixJson 為 true，則回傳修正後的內容
    if (fixJson) {
      return updatedContentParts.join('');
    }
  }

  /**
   * 更新訊息為錯誤狀態
   */
  updateMessageToError(messageId, errorMessage, retryCallback) {
    const messageWrapper = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageWrapper) return;

    const messageBubble = messageWrapper.querySelector('.message-bubble');
    if (!messageBubble) return;

    // 移除思考狀態，添加錯誤狀態
    messageBubble.classList.remove('thinking');
    messageBubble.classList.add('error');
    messageWrapper.classList.remove('thinking');
    messageWrapper.classList.add('error');

    // 創建錯誤內容
    const errorContent = document.createElement('div');
    errorContent.className = 'error-content';
    errorContent.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">發送失敗：${this.app._escapeHtml(errorMessage)}</span>
      </div>
      <div class="error-actions">
        <button class="retry-button" data-action="retry">🔄 重試</button>
        <button class="dismiss-button" data-action="dismiss">✖️ 關閉</button>
      </div>
      <div class="message-time">${this.app._formatTime(new Date())}</div>
    `;

    // 添加事件監聽器
    const retryButton = errorContent.querySelector('.retry-button');
    const dismissButton = errorContent.querySelector('.dismiss-button');

    if (retryButton) {
      retryButton.addEventListener('click', () => {
        // 移除錯誤訊息
        messageWrapper.remove();
        // 執行重試
        retryCallback();
      });
    }

    if (dismissButton) {
      dismissButton.addEventListener('click', () => {
        messageWrapper.remove();
      });
    }

    // 更新內容
    messageBubble.innerHTML = '';
    messageBubble.appendChild(errorContent);

    this.app._scrollToBottom();
  }

  /**
   * 添加訊息到UI
   */
  addMessageToUI(role, content, images = null) {
    if (!this.app.elements.messagesContainer) return null;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${role}`;
    messageWrapper.dataset.messageId = messageId;

    // 創建頭像
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${role}`;
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    // 創建訊息氣泡
    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${role}`;

    // 創建訊息內容容器
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // 添加圖片（如果有）
    if (images && images.length > 0) {
      const imagesContainer = document.createElement('div');
      imagesContainer.className = images.length === 1 ? 'message-images' : 'message-image-grid';

      images.forEach(image => {
        const img = document.createElement('img');
        img.className = 'message-image';
        img.src = `data:${image.mimeType};base64,${image.data}`;
        img.alt = image.name || '上傳的圖片';
        img.title = image.name || '上傳的圖片';

        // 添加點擊放大功能
        img.addEventListener('click', () => {
          this.app.imageManager.showImageLightbox(img.src);
        });

        imagesContainer.appendChild(img);
      });

      messageContent.appendChild(imagesContainer);
    }

    // 添加文字內容（如果有）
    if (content && content.trim()) {
      // For assistant messages, use updateMessageContent to handle visualization tags
      if (role === 'assistant') {
        // Temporarily add to DOM to get messageId, then update content
        messageBubble.appendChild(messageContent); // Append empty content for now
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(messageBubble);
        this.app.elements.messagesContainer.appendChild(messageWrapper);
        this.app._scrollToBottom(); // Scroll to show the new message container

        this.updateMessageContent(messageId, content, false); // Process and update content
      } else {
        const textContent = document.createElement('div');
        const renderedContent = contentRenderer.render(content);
        textContent.innerHTML = renderedContent;
        messageContent.appendChild(textContent);

        // Create timestamp
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.app._formatTime(new Date());

        // Assemble structure for user messages
        messageBubble.appendChild(messageContent);
        messageBubble.appendChild(messageTime);
        messageWrapper.appendChild(messageBubble);
        messageWrapper.appendChild(avatar);
        this.app.elements.messagesContainer.appendChild(messageWrapper);
        this.app._scrollToBottom();
      }
    } else { // Handle cases where content might be empty but images exist
      // Create timestamp
      const messageTime = document.createElement('div');
      messageTime.className = 'message-time';
      messageTime.textContent = this.app._formatTime(new Date());

      // Assemble structure
      messageBubble.appendChild(messageContent);
      messageBubble.appendChild(messageTime);

      if (role === 'user') {
        messageWrapper.appendChild(messageBubble);
        messageWrapper.appendChild(avatar);
      } else {
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(messageBubble);
      }
      this.app.elements.messagesContainer.appendChild(messageWrapper);
      this.app._scrollToBottom();
    }

    // For user messages, apply syntax highlighting and math rendering if needed
    if (role === 'user') {
      contentRenderer.highlightCodeBlocks(messageContent);
      contentRenderer.renderMathInElement(messageContent);
    }

    return messageId;
  }

  /**
   * 添加歡迎訊息
   */
  addWelcomeMessage() {
    const welcomeMessage = promptManager.getUIMessage('welcome');
    this.addMessageToUI('assistant', welcomeMessage);
  }

  /**
   * 清空訊息
   */
  clearMessages() {
    this.app.uiManager.clearMessages();
  }
}

export default MessageProcessingManager; 
