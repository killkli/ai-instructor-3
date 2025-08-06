/**
 * 角色選擇管理器
 * 處理角色選擇界面、角色卡片生成、角色確認等操作
 */

import promptManager from '../config/prompt-manager.js';
import sessionManager from '../services/session-manager.js';
import geminiService from '../services/gemini-service.js';

class RoleSelectionManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化角色選擇管理器
   */
  async init() {
    if (this.initialized) return;

    try {
      console.log('🎭 Initializing RoleSelectionManager...');
      this.initialized = true;
      console.log('✅ RoleSelectionManager initialized');
    } catch (error) {
      console.error('❌ RoleSelectionManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * 顯示角色選擇界面
   */
  async showRoleSelection() {
    try {
      // 載入角色配置
      const roleProfiles = promptManager.getRoleProfiles();

      // 生成角色卡片
      this.generateRoleCards(roleProfiles);

      // 顯示模態框
      this.app.elements.roleSelectionModal?.classList.remove('hidden');

      // 重置選擇狀態
      this.app.appStateManager.set('selectedRole', null);
      this.app.elements.roleSelectionConfirm.disabled = true;

    } catch (error) {
      console.error('Failed to show role selection:', error);
      this.app._showNotification('載入角色選擇失敗', 'error');
    }
  }

  /**
   * 生成角色卡片
   */
  generateRoleCards(roleProfiles) {
    if (!this.app.elements.roleGrid) return;

    this.app.elements.roleGrid.innerHTML = '';

    Object.entries(roleProfiles).forEach(([roleId, profile]) => {
      const card = document.createElement('div');
      card.className = 'role-card';
      card.dataset.roleId = roleId;
      card.style.setProperty('--role-color', profile.color);

      card.innerHTML = `
        <div class="role-icon">${profile.icon}</div>
        <div class="role-name">${profile.name}</div>
        <div class="role-description">${profile.description}</div>
        <div class="role-audience">${profile.targetAudience}</div>
      `;

      // 添加點擊事件
      card.addEventListener('click', () => this.selectRole(roleId));

      this.app.elements.roleGrid.appendChild(card);
    });
  }

  /**
   * 選擇角色
   */
  selectRole(roleId) {
    // 移除其他卡片的選中狀態
    this.app.elements.roleGrid.querySelectorAll('.role-card').forEach(card => {
      card.classList.remove('selected');
    });

    // 設定當前選中的角色
    const selectedCard = this.app.elements.roleGrid.querySelector(`[data-role-id="${roleId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
      this.app.appStateManager.set('selectedRole', roleId);
      this.app.elements.roleSelectionConfirm.disabled = false;
    }
  }

  /**
   * 顯示年級與自定程度選擇 Modal
   * @returns {Promise<{grade: string, customLevel: string}>}
   */
  async showGradeAndLevelModal() {
    return new Promise((resolve, reject) => {
      // 建立 Modal 元素（如尚未存在）
      if (!this.app.elements.gradeLevelModal) {
        const modal = document.createElement('div');
        modal.className = 'modal grade-level-modal hidden'; // Initial hidden state
        modal.innerHTML = `
          <div class="modal-content">
            <h2>請選擇您的年級與自評程度</h2>
            <label>年級：
              <select id="grade-select">
                <option value="小一">國小一年級</option>
                <option value="小二">國小二年級</option>
                <option value="小三">國小三年級</option>
                <option value="小四">國小四年級</option>
                <option value="小五">國小五年級</option>
                <option value="小六">國小六年級</option>
                <option value="國一">國中一年級</option>
                <option value="國二">國中二年級</option>
                <option value="國三">國中三年級</option>
                <option value="其他">其他（請務必填寫學習狀況）</option>
              </select>
            </label>
            <label>自定程度：
              <input type="text" id="custom-level-input" placeholder="請簡述您的學習狀況" />
            </label>
            <div class="modal-actions">
              <button id="grade-level-confirm">確認</button>
              <button id="grade-level-cancel">取消</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        this.app.elements.gradeLevelModal = modal;
      }

      // 動態載入 CSS (如果尚未載入)
      if (!this.app.elements.gradeLevelModalStyle) {
        const style = document.createElement('style');
        style.id = 'grade-level-modal-style';
        style.textContent = `
          .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 1;
            visibility: visible;
            transition: opacity 0.3s ease, visibility 0.3s ease;
          }

          .modal.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
          }

          .modal-content {
            background-color: #fff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            width: 90%;
            max-width: 500px;
            animation: fadeInScale 0.3s ease-out;
          }

          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          .modal-content h2 {
            font-size: 1.5em;
            color: #333;
            margin-bottom: 25px;
            text-align: center;
          }

          .modal-content label {
            display: block;
            margin-bottom: 15px;
            font-size: 1.1em;
            color: #555;
          }

          .modal-content select,
          .modal-content input[type="text"] {
            width: 100%;
            padding: 10px 12px;
            margin-top: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 1em;
            color: #333;
          }

          .modal-content select:focus,
          .modal-content input[type="text"]:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 30px;
          }

          .modal-actions button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            transition: background-color 0.2s ease, transform 0.1s ease;
          }

          #grade-level-confirm {
            background-color: #007bff;
            color: white;
          }

          #grade-level-confirm:hover {
            background-color: #0056b3;
            transform: translateY(-1px);
          }

          #grade-level-cancel {
            background-color: #dc3545;
            color: white;
          }

          #grade-level-cancel:hover {
            background-color: #c82333;
            transform: translateY(-1px);
          }
        `;
        document.head.appendChild(style);
        this.app.elements.gradeLevelModalStyle = style;
      }

      const modal = this.app.elements.gradeLevelModal;
      modal.classList.remove('hidden'); // 顯示 Modal

      // 綁定事件
      const confirmBtn = modal.querySelector('#grade-level-confirm');
      const cancelBtn = modal.querySelector('#grade-level-cancel');
      const gradeSelect = modal.querySelector('#grade-select');
      const customInput = modal.querySelector('#custom-level-input');

      const cleanup = () => {
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        modal.classList.add('hidden'); // 隱藏 Modal

        // 移除動態載入的 CSS
        if (this.app.elements.gradeLevelModalStyle && this.app.elements.gradeLevelModalStyle.parentNode) {
          this.app.elements.gradeLevelModalStyle.parentNode.removeChild(this.app.elements.gradeLevelModalStyle);
          this.app.elements.gradeLevelModalStyle = null; // 清除引用
        }
      };
      const onConfirm = () => {
        cleanup();
        resolve({
          grade: gradeSelect.value,
          customLevel: customInput.value.trim()
        });
      };
      const onCancel = () => {
        cleanup();
        reject(new Error('User cancelled grade/level selection'));
      };
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  /**
   * 確認角色選擇
   */
  async confirmRoleSelection() {
    const selectedRole = this.app.appStateManager.get('selectedRole');
    if (!selectedRole) return;

    try {
      // 隱藏角色選擇界面
      this.hideRoleSelection();

      const { grade, customLevel } = await this._setupGradeAndLearningStructure(selectedRole);

      // 創建新會話，並設定選擇的角色
      const newSession = await sessionManager.createNewSession({
        roleId: selectedRole,
        roleName: promptManager.getRoleProfile(selectedRole)?.name,
        grade,
        customLevel
      });

      this.app.currentSessionId = newSession.id;

      // 清空聊天區域
      this.app.messageProcessingManager.clearMessages();

      // 更新會話列表
      await this.app.sessionUIManager.updateSessionsList();

      // 顯示角色相關的歡迎訊息
      this.addRoleWelcomeMessage(selectedRole);


      this.app._hideLoading();


      const inquiryPrompt = "你是一位專業的學習診斷ai，專門協助新進學生。請注意，學生通常帶著學習問題前來。你的任務是透過一次一個簡單明確的問題，逐步引導學生說明目前的學習領域、目標，以及遇到的具體困難。每次提問後，等待學生回答再繼續。";
      this.app.messageProcessingManager.sendToAI(inquiryPrompt);

      this.app._showNotification('新會話已創建', 'success');

    } catch (error) {
      this.app._hideLoading();
      this.app._showNotification(`創建新會話失敗: ${error.message}`, 'error');
    }
  }

  /**
   * 隱藏角色選擇界面
   */
  hideRoleSelection() {
    this.app.elements.roleSelectionModal?.classList.add('hidden');
    this.app.appStateManager.set('selectedRole', null);
    this.app.elements.roleSelectionConfirm.disabled = true;
  }

  /**
   * 添加角色歡迎訊息
   */
  addRoleWelcomeMessage(roleId) {
    if (!this.app.elements.messagesContainer) return;

    const roleProfile = promptManager.getRoleProfile(roleId);
    if (!roleProfile) {
      this.app.messageProcessingManager.addWelcomeMessage();
      return;
    }

    const welcomeMessage = promptManager.getRoleWelcomeMessage(roleId);

    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper assistant welcome-message';

    // 創建頭像
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar assistant';
    avatar.textContent = roleProfile.icon;

    // 創建訊息氣泡
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble assistant';
    messageBubble.style.borderLeftColor = roleProfile.color;

    // 創建內容
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
      <h3>${welcomeMessage}</h3>
      <p>我是專精<strong>${roleProfile.name.replace('助理', '')}</strong>的AI助理，讓我們一起開始學習之旅吧！</p>
      <div class="quick-actions">
        <button class="quick-action" data-message="我想開始學習">🚀 開始學習</button>
        <button class="quick-action" data-message="我有問題想問">❓ 問題解答</button>
        <button class="quick-action" data-message="介紹一下你的教學方式">📖 教學方式</button>
      </div>
    `;

    // 組裝結構
    messageBubble.appendChild(messageContent);
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageBubble);

    this.app.elements.messagesContainer.appendChild(messageWrapper);

    // 添加快速操作事件
    messageContent.querySelectorAll('.quick-action').forEach(button => {
      button.addEventListener('click', () => {
        this.app.elements.messageInput.value = button.dataset.message;
        this.app.messageProcessingManager.handleSendMessage();
      });
    });

    this.app._scrollToBottom();
  }

  async _setupGradeAndLearningStructure(selectedRole) {
    const gradeData = {
      grade: "",
      customLevel: ""
    };
    try {
      const { grade, customLevel } = await this.showGradeAndLevelModal();
      gradeData.grade = grade;
      gradeData.customLevel = customLevel;
      // 這裡之後會串接 Gemini API 與 promptManager
      console.log('用戶選擇年級:', grade, '自定程度:', customLevel);
      // 呼叫 Gemini API 並存入 promptManager
      try {
        this.app._showLoading('正在取得學習架構...');
        const trimmedCustomLevel = customLevel.trim();
        // Assuming promptManager and geminiService are properties of 'this'
        const checkerText = promptManager.getLearningStructure(selectedRole, grade, trimmedCustomLevel);
        if (checkerText === null) {
          const roleProfile = promptManager.getRoleProfile(selectedRole);
          const subject = roleProfile?.name || selectedRole;
          let prompt = '';
          let structureText = '';
          if (grade === "其他") {
            if (trimmedCustomLevel !== '') {
              // Only generate prompt if customLevel is not empty when grade is "其他"
              prompt = `請提供「${subject}」針對臺灣學生的學習架構與重點，學生自評程度：「${trimmedCustomLevel}」。請條列重點。`;
            }
          } else {
            // For specific grades
            const effectiveCustomLevel = trimmedCustomLevel || '未填寫';
            prompt = `請提供「${subject}」針對臺灣「${grade}」學生的學習架構與重點，學生自評程度：「${effectiveCustomLevel}」。請條列重點。`;
          }

          if (prompt && prompt !== '') {
            const response = await geminiService.sendMessageWithGoogleSearch(prompt);
            structureText = response.text;
          }

          promptManager.setLearningStructure(selectedRole, grade, trimmedCustomLevel, structureText);
        }
        this.app._showNotification('已取得學習架構', 'success');
      } catch (err) {
        this.app._showNotification('學習架構取得失敗: ' + err.message, 'error');
      } finally {
        this.app._hideLoading();
      }
    } catch (modalError) {
      // 使用者取消
      this.app._showNotification('已取消年級/程度設定', 'info');
    }
    return gradeData;
  }
}

export default RoleSelectionManager; 
