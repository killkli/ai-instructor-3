/**
 * 通知管理器
 * 負責處理所有通知、載入狀態、錯誤訊息等UI反饋功能
 */
class NotificationManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
    this.loadingCount = 0; // 追蹤載入狀態的數量
    this.activeNotifications = new Set(); // 追蹤活動的通知
  }

  /**
   * 初始化通知管理器
   */
  async init() {
    try {
      this.initialized = true;
      console.log('🔔 NotificationManager initialized');
    } catch (error) {
      console.error('❌ NotificationManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * 顯示通知
   */
  showNotification(message, type = 'info') {
    if (!this.app.elements.notifications) {
      console.warn('Notifications container not found');
      return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('data-notification-id', Date.now().toString());

    // 創建通知內容
    const messageSpan = document.createElement('span');
    messageSpan.className = 'notification-message';
    messageSpan.textContent = message;

    // 創建關閉按鈕
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '✖';
    closeButton.title = '關閉通知';

    // 組裝通知
    notification.appendChild(messageSpan);
    notification.appendChild(closeButton);

    this.app.elements.notifications.appendChild(notification);
    this.activeNotifications.add(notification);

    // 關閉按鈕事件
    const removeNotification = () => {
      this.removeNotification(notification);
    };

    closeButton.addEventListener('click', removeNotification);

    // 點擊通知本身也可以關閉
    notification.addEventListener('click', removeNotification);

    // 自動移除（根據類型設定不同的顯示時間）
    const autoRemoveTime = this.getAutoRemoveTime(type);
    const autoRemoveTimer = setTimeout(removeNotification, autoRemoveTime);

    // 如果手動關閉，清除自動移除計時器
    notification._autoRemoveTimer = autoRemoveTimer;

    return notification;
  }

  /**
   * 移除通知
   */
  removeNotification(notification) {
    if (!notification || !notification.parentNode) return;

    // 清除自動移除計時器
    if (notification._autoRemoveTimer) {
      clearTimeout(notification._autoRemoveTimer);
    }

    this.activeNotifications.delete(notification);

    notification.classList.add('notification-removing');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * 清除所有通知
   */
  clearAllNotifications() {
    this.activeNotifications.forEach(notification => {
      this.removeNotification(notification);
    });
  }

  /**
   * 顯示載入狀態
   */
  showLoading(message = '載入中...') {
    this.loadingCount++;

    if (this.app.elements.loadingIndicator) {
      const loadingText = this.app.elements.loadingIndicator.querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = message;
      }
      this.app.elements.loadingIndicator.style.display = 'flex';
    }
  }

  /**
   * 隱藏載入狀態
   */
  hideLoading() {
    this.loadingCount = Math.max(0, this.loadingCount - 1);

    if (this.loadingCount === 0 && this.app.elements.loadingIndicator) {
      this.app.elements.loadingIndicator.style.display = 'none';
    }
  }

  /**
   * 強制隱藏載入狀態
   */
  forceHideLoading() {
    this.loadingCount = 0;
    if (this.app.elements.loadingIndicator) {
      this.app.elements.loadingIndicator.style.display = 'none';
    }
  }

  /**
   * 顯示打字指示器
   */
  showTypingIndicator() {
    if (this.app.elements.typingIndicator) {
      this.app.elements.typingIndicator.style.display = 'block';
    }
  }

  /**
   * 隱藏打字指示器
   */
  hideTypingIndicator() {
    if (this.app.elements.typingIndicator) {
      this.app.elements.typingIndicator.style.display = 'none';
    }
  }

  /**
   * 顯示錯誤訊息
   */
  showError(title, message) {
    // 創建錯誤通知的HTML內容
    const errorContent = `
      <div class="notification-title">${title}</div>
      <div class="notification-text">${message}</div>
    `;

    // 創建臨時容器來處理HTML內容
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = errorContent;

    const notification = this.showNotification('', 'error');
    if (notification) {
      // 替換簡單的文字內容為結構化內容
      const messageSpan = notification.querySelector('.notification-message');
      if (messageSpan) {
        messageSpan.innerHTML = errorContent;
      }
    }

    return notification;
  }

  /**
   * 顯示成功訊息
   */
  showSuccess(message) {
    return this.showNotification(message, 'success');
  }

  /**
   * 顯示警告訊息
   */
  showWarning(message) {
    return this.showNotification(message, 'warning');
  }

  /**
   * 顯示資訊訊息
   */
  showInfo(message) {
    return this.showNotification(message, 'info');
  }

  /**
   * 根據通知類型獲取自動移除時間
   */
  getAutoRemoveTime(type) {
    switch (type) {
      case 'error':
        return 8000; // 錯誤訊息顯示較久
      case 'warning':
        return 6000; // 警告訊息顯示中等時間
      case 'success':
        return 4000; // 成功訊息顯示較短
      case 'info':
      default:
        return 5000; // 預設顯示時間
    }
  }

  /**
   * 檢查是否正在載入
   */
  isLoading() {
    return this.loadingCount > 0;
  }

  /**
   * 獲取活動通知數量
   */
  getActiveNotificationCount() {
    return this.activeNotifications.size;
  }

  /**
   * 顯示帶有按鈕的互動式通知
   */
  showInteractiveNotification(message, type = 'info', buttons = []) {
    const notification = this.showNotification(message, type);
    
    if (buttons.length > 0 && notification) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'notification-buttons';
      
      buttons.forEach(buttonConfig => {
        const button = document.createElement('button');
        button.className = `notification-btn ${buttonConfig.type || 'default'}`;
        button.textContent = buttonConfig.text;
        button.addEventListener('click', () => {
          if (buttonConfig.action) {
            buttonConfig.action();
          }
          this.removeNotification(notification);
        });
        buttonContainer.appendChild(button);
      });
      
      notification.appendChild(buttonContainer);
    }
    
    return notification;
  }
}

export default NotificationManager; 