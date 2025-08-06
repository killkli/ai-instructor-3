/**
 * 會話UI管理器
 * 處理會話列表、會話載入、會話切換等UI相關操作
 */

import sessionManager from '../services/session-manager.js';
import promptManager from '../config/prompt-manager.js';

class SessionUIManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化會話UI管理器
   */
  async init() {
    if (this.initialized) return;

    try {
      console.log('🎭 Initializing SessionUIManager...');
      this.initialized = true;
      console.log('✅ SessionUIManager initialized');
    } catch (error) {
      console.error('❌ SessionUIManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * 載入會話列表
   */
  loadSessionsList() {
    try {
      const sessions = sessionManager.getSessionsList();
      this.updateSessionsListUI(sessions);
    } catch (error) {
      console.error('Failed to load sessions list:', error);
    }
  }

  /**
   * 更新會話列表
   */
  async updateSessionsList() {
    this.loadSessionsList();
  }

  /**
   * 更新會話列表UI
   */
  updateSessionsListUI(sessions) {
    if (!this.app.elements.sessionsList) return;

    this.app.elements.sessionsList.innerHTML = '';

    sessions.forEach(session => {
      const sessionElement = this.createSessionElement(session);
      this.app.elements.sessionsList.appendChild(sessionElement);
    });
  }

  /**
   * 創建會話元素
   */
  createSessionElement(session) {
    const element = document.createElement('div');
    element.className = `session-item ${session.isActive ? 'active' : ''}`;
    element.dataset.sessionId = session.id;

    // 獲取角色信息
    const roleProfile = session.metadata?.roleId ?
      promptManager.getRoleProfile(session.metadata.roleId) : null;
    const roleIcon = roleProfile?.icon || '🤖';
    const roleColor = roleProfile?.color || '#6b7280';

    element.innerHTML = `
      <div class="session-header">
        <span class="session-role-icon" style="color: ${roleColor}">${roleIcon}</span>
        <div class="session-title">${this._escapeHtml(session.title)}</div>
      </div>
      <div class="session-meta">
        <span class="session-date">${this._formatDate(session.updatedAt)}</span>
        <span class="session-count">${session.messageCount || session.metadata?.messageCount || 0} 訊息</span>
      </div>
      <button class="session-delete" data-session-id="${session.id}">🗑️</button>
    `;

    // 添加點擊事件
    element.addEventListener('click', (e) => {
      if (!e.target.classList.contains('session-delete')) {
        this.loadSession(session.id);
        // 在移動端選擇會話後關閉側邊欄
        if (window.innerWidth <= 768) {
          this.app._closeSidebar();
        }
      }
    });

    // 添加刪除事件
    element.querySelector('.session-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteSession(session.id);
    });

    return element;
  }

  /**
   * 載入會話
   */
  async loadSession(sessionId) {
    try {
      this.app._showLoading('載入會話...');

      const session = await sessionManager.switchToSession(sessionId);
      this.app.currentSessionId = sessionId;

      this.loadSessionMessages(session);
      await this.updateSessionsList();

      // 更新當前角色顯示（如果設定頁面是打開的）
      this.app.settingsManager?.updateCurrentRoleDisplay();

      this.app._hideLoading();

    } catch (error) {
      this.app._hideLoading();
      this.app._showNotification(`載入會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 載入會話訊息
   */
  async loadSessionMessages(session) {
    this.app.messageProcessingManager.clearMessages();

    if (session.messages.length === 0) {
      this.app.messageProcessingManager.addWelcomeMessage();
    } else {
      for (const message of session.messages) {
        if(message.metadata.hidden) continue;
        let contentToDisplay = message.content;
        this.app.messageProcessingManager.addMessageToUI(message.role, contentToDisplay, message.images);
      }
    }

    this.app._scrollToBottom();
  }

  /**
   * 刪除會話
   */
  async deleteSession(sessionId) {
    if (!confirm('確定要刪除這個會話嗎？')) return;

    try {
      await sessionManager.deleteSession(sessionId);
      await this.updateSessionsList();

      // 如果刪除的是當前會話，創建新會話
      if (this.app.currentSessionId === sessionId) {
        await this.app._handleNewChat();
      }

      this.app._showNotification('會話已刪除', 'success');

    } catch (error) {
      this.app._showNotification(`刪除會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 顯示當前會話資訊
   */
  showCurrentSessionInfo() {
    const session = sessionManager.getCurrentSession();
    if (session) {
      const info = `
當前會話: ${session.title}
創建時間: ${this._formatDate(session.createdAt)}
訊息數量: ${session.messages.length}
會話ID: ${session.id}
      `.trim();

      this.app.messageProcessingManager.addMessageToUI('assistant', info);
    } else {
      this.app.messageProcessingManager.addMessageToUI('assistant', '目前沒有活動會話');
    }
  }

  /**
   * 顯示會話摘要
   */
  async showSessionSummary() {
    try {
      this.app._showTypingIndicator();

      const summary = await sessionManager.generateSessionSummary();

      this.app._hideTypingIndicator();
      this.app.messageProcessingManager.addMessageToUI('assistant', summary);

    } catch (error) {
      this.app._hideTypingIndicator();
      this.app._showNotification(`生成摘要失敗: ${error.message}`, 'error');
    }
  }

  /**
   * HTML 轉義
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 格式化日期
   */
  _formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export default SessionUIManager; 
