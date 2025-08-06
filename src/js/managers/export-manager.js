/**
 * 匯出管理器
 * 負責處理所有匯出相關的UI交互邏輯
 */

import exportService from '../services/export-service.js';
import sessionManager from '../services/session-manager.js';
// 匯出功能所需的套件（使用全域變數，透過 <script> 標籤載入）
// - jsPDF: 全域變數 window.jspdf.jsPDF
// - jsPDF-autoTable: 自動附加到 jsPDF
// - XLSX: 全域變數 window.XLSX
// - FileSaver: 全域變數 window.saveAs
// - html2canvas: 全域變數 window.html2canvas

class ExportManager {
  constructor(app) {
    this.app = app;
    this.initialized = false;
  }

  /**
   * 初始化匯出管理器
   */
  async init() {
    if (this.initialized) return;

    try {
      // 不在這裡設定事件監聽器，等到 UI 初始化完成後再設定
      this.initialized = true;
      console.log('ExportManager initialized (events will be set up later)');
    } catch (error) {
      console.error('Failed to initialize ExportManager:', error);
      throw error;
    }
  }

  /**
   * 設定事件監聽器（在 UI 初始化完成後調用）
   */
  setupEvents() {
    if (this.eventsSetup) return;
    
    try {
      this._setupEventListeners();
      this.eventsSetup = true;
      console.log('ExportManager events set up successfully');
    } catch (error) {
      console.error('Failed to set up ExportManager events:', error);
    }
  }

  /**
   * 設定所有匯出相關的事件監聽器
   */
  _setupEventListeners() {
    this._setupBasicExportEvents();
    this._setupModalEvents();
  }

  /**
   * 設定基本匯出事件（側欄和設定按鈕）
   */
  _setupBasicExportEvents() {
    // 側欄快速匯出按鈕
    this.app.elements.exportCurrentSessionBtn?.addEventListener('click', () => {
      this.handleExportCurrentSession();
    });

    this.app.elements.exportAllSessionsBtn?.addEventListener('click', () => {
      this.handleExportAllSessions();
    });

    // 設定中的匯出按鈕
    this.app.elements.exportSettingsBtn?.addEventListener('click', () => {
      this.showExportModal();
    });
  }

  /**
   * 設定匯出模態框內的事件監聽器
   */
  _setupModalEvents() {
    // 匯出範圍選擇變化
    document.querySelectorAll('input[name="export-scope"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.handleExportScopeChange(e.target.value);
      });
    });

    // 篩選條件套用
    const applyFilterBtn = document.getElementById('apply-filter');
    applyFilterBtn?.addEventListener('click', () => {
      this.applyExportFilter();
    });

    // 預覽生成
    const generatePreviewBtn = document.getElementById('generate-preview');
    generatePreviewBtn?.addEventListener('click', () => {
      this.generateExportPreview();
    });

    // 複製預覽內容
    const copyPreviewBtn = document.getElementById('copy-preview');
    copyPreviewBtn?.addEventListener('click', () => {
      this.copyPreviewContent();
    });

    // 下載檔案
    const downloadExportBtn = document.getElementById('download-export');
    downloadExportBtn?.addEventListener('click', () => {
      this.downloadExportFile();
    });
  }

  /**
   * 處理當前會話匯出
   */
  async handleExportCurrentSession() {
    try {
      const currentSession = sessionManager.getCurrentSession();
      if (!currentSession) {
        this.app._showNotification('沒有可匯出的會話', 'warning');
        return;
      }

      const result = await exportService.exportAndDownloadSession(currentSession.id, 'json');
      this.app._showNotification(`已匯出會話：${result.fileName}`, 'success');
    } catch (error) {
      console.error('Export current session failed:', error);
      this.app._showNotification('匯出失敗：' + error.message, 'error');
    }
  }

  /**
   * 處理所有會話匯出
   */
  async handleExportAllSessions() {
    try {
      const result = await exportService.exportAndDownloadAllSessions('json');
      this.app._showNotification(`已匯出 ${result.totalSessions} 個會話：${result.fileName}`, 'success');
    } catch (error) {
      console.error('Export all sessions failed:', error);
      this.app._showNotification('匯出失敗：' + error.message, 'error');
    }
  }

  /**
   * 顯示匯出模態框
   */
  async showExportModal() {
    try {
      // 重置模態框狀態
      this.resetExportModalState();

      // 載入統計資訊
      await this.loadExportStatistics();

      // 載入會話列表
      this.loadSessionsForExport();

      // 載入可用格式
      this.loadExportFormats();

      // 載入角色選項
      this.loadRoleOptionsForFilter();

      // 顯示模態框
      this.app.elements.exportModal?.classList.remove('hidden');

    } catch (error) {
      console.error('Failed to show export modal:', error);
      this.app._showNotification('無法開啟匯出功能', 'error');
    }
  }

  /**
   * 顯示所有匯出選項
   */
  showAllExportOptions() {
    const exportOptions = document.querySelector('.export-options');
    if (exportOptions) {
      exportOptions.style.display = 'block';
    }

    // 確保所有子元素也被顯示
    const exportTypeSelection = document.querySelector('.export-type-selection');
    const sessionSelection = document.querySelector('.session-selection');
    const filterOptions = document.querySelector('.filter-options');
    const formatSelection = document.querySelector('.format-selection');
    const exportPreview = document.querySelector('.export-preview');

    [exportTypeSelection, sessionSelection, filterOptions, formatSelection, exportPreview].forEach(element => {
      if (element) {
        element.style.display = 'block';
      }
    });
  }

  /**
   * 更新匯出模態框標題
   */
  updateExportModalTitle(title) {
    const modalTitle = document.querySelector('#export-modal .modal-header h3');
    if (modalTitle) {
      modalTitle.textContent = title;
    }
  }

  /**
   * 重置匯出模態框狀態
   */
  resetExportModalState() {
    // 恢復默認標題
    this.updateExportModalTitle('📤 匯出對話');

    // 顯示所有匯出選項
    this.showAllExportOptions();

    // 重置表單
    this.resetExportForm();
  }

  /**
   * 載入匯出統計資訊
   */
  async loadExportStatistics() {
    try {
      const stats = await exportService.getExportStatistics();
      console.log('Loading export statistics to UI:', stats); // 調試信息

      const totalSessionsSpan = document.getElementById('total-sessions');
      const totalMessagesSpan = document.getElementById('total-messages');
      const estimatedCharsSpan = document.getElementById('estimated-chars');

      console.log('Found UI elements:', {
        totalSessionsSpan,
        totalMessagesSpan,
        estimatedCharsSpan
      }); // 調試信息

      if (totalSessionsSpan) {
        totalSessionsSpan.textContent = stats.totalSessions.toLocaleString();
        console.log('Updated totalSessions:', stats.totalSessions);
      } else {
        console.error('Element #total-sessions not found');
      }

      if (totalMessagesSpan) {
        totalMessagesSpan.textContent = stats.totalMessages.toLocaleString();
        console.log('Updated totalMessages:', stats.totalMessages);
      } else {
        console.error('Element #total-messages not found');
      }

      if (estimatedCharsSpan) {
        estimatedCharsSpan.textContent = this.formatNumber(stats.estimatedCharacters);
        console.log('Updated estimatedChars:', stats.estimatedCharacters);
      } else {
        console.error('Element #estimated-chars not found');
      }

    } catch (error) {
      console.error('Failed to load export statistics:', error);
    }
  }

  /**
   * 載入會話列表供選擇
   */
  loadSessionsForExport() {
    const sessions = sessionManager.getSessionsList();

    const sessionCheckboxes = document.getElementById('session-checkboxes');
    if (sessionCheckboxes) {
      sessionCheckboxes.innerHTML = '';

      sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-checkbox-item';

        item.innerHTML = `
          <input type="checkbox" value="${session.id}" id="session-${session.id}">
          <label for="session-${session.id}" class="session-checkbox-label">
            ${this.app._escapeHtml(session.title)}
          </label>
          <span class="session-checkbox-meta">
            ${this.app._formatDate(session.createdAt)} | ${session.messageCount || 0} 則訊息
          </span>
        `;

        sessionCheckboxes.appendChild(item);
      });
    }
  }

  /**
   * 載入匯出格式選項
   */
  loadExportFormats() {
    const formats = exportService.getAvailableFormats();

    const formatGrid = document.getElementById('format-grid');
    if (formatGrid) {
      formatGrid.innerHTML = '';

      formats.forEach(format => {
        const option = document.createElement('div');
        option.className = 'format-option';
        option.dataset.format = format.id;

        // 格式圖示
        const formatIcons = {
          json: '📋',
          txt: '📄',
          md: '📝',
          html: '🌐'
        };

        option.innerHTML = `
          <div class="format-icon">${formatIcons[format.id] || '📄'}</div>
          <div class="format-name">${format.name}</div>
          <div class="format-description">${format.description}</div>
        `;

        option.addEventListener('click', () => {
          // 移除其他選中狀態
          formatGrid.querySelectorAll('.format-option').forEach(opt => {
            opt.classList.remove('selected');
          });

          // 選中當前格式
          option.classList.add('selected');

          // 啟用預覽按鈕
          const generatePreviewBtn = document.getElementById('generate-preview');
          if (generatePreviewBtn) {
            generatePreviewBtn.disabled = false;
          }
        });

        formatGrid.appendChild(option);
      });

      // 預設選中 JSON 格式
      const jsonOption = formatGrid.querySelector('[data-format="json"]');
      if (jsonOption) {
        jsonOption.click();
      }
    }
  }

  /**
   * 載入角色選項供篩選使用
   */
  loadRoleOptionsForFilter() {
    const sessions = sessionManager.getSessionsList();
    const roles = new Set();

    sessions.forEach(session => {
      // 確保 session 和 session.metadata 存在，然後檢查 roleName
      if (session && session.metadata && session.metadata.roleName) {
        roles.add(session.metadata.roleName);
      }
    });

    const filterRoleSelect = document.getElementById('filter-role');
    if (filterRoleSelect) {
      // 清空現有選項（保留第一個"全部角色"選項）
      while (filterRoleSelect.children.length > 1) {
        filterRoleSelect.removeChild(filterRoleSelect.lastChild);
      }

      // 添加角色選項
      Array.from(roles).sort().forEach(roleName => {
        const option = document.createElement('option');
        option.value = roleName;
        option.textContent = roleName;
        filterRoleSelect.appendChild(option);
      });
    }
  }

  /**
   * 處理匯出範圍變化
   */
  handleExportScopeChange(scope) {
    // 隱藏所有選項區域
    const sessionSelection = document.getElementById('session-selection');
    const filterOptions = document.getElementById('filter-options');

    if (sessionSelection) {
      sessionSelection.style.display = 'none';
    }
    if (filterOptions) {
      filterOptions.style.display = 'none';
    }

    // 根據選擇顯示對應區域
    switch (scope) {
      case 'selected':
        if (sessionSelection) {
          sessionSelection.style.display = 'block';
        }
        break;
      case 'filtered':
        if (filterOptions) {
          filterOptions.style.display = 'block';
        }
        break;
    }
  }

  /**
   * 套用匯出篩選條件
   */
  applyExportFilter() {
    const criteria = {
      dateFrom: document.getElementById('filter-date-from')?.value || null,
      dateTo: document.getElementById('filter-date-to')?.value || null,
      roleName: document.getElementById('filter-role')?.value || null,
      minMessages: parseInt(document.getElementById('filter-min-messages')?.value) || null,
      maxMessages: parseInt(document.getElementById('filter-max-messages')?.value) || null,
      titleKeyword: document.getElementById('filter-keyword')?.value?.trim() || null
    };

    const result = exportService.selectSessionsByCriteria(criteria);

    this.app._showNotification(`篩選結果：找到 ${result.totalCount} 個符合條件的會話`, 'info');
  }

  /**
   * 格式化數字（添加千分位分隔符）
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  }

  /**
   * 重置匯出表單
   */
  resetExportForm() {
    // 重置匯出範圍選擇
    const currentRadio = document.querySelector('input[name="export-scope"][value="current"]');
    if (currentRadio) {
      currentRadio.checked = true;
      this.handleExportScopeChange('current');
    }

    // 重置篩選表單
    const filterForm = document.getElementById('export-filter-form');
    if (filterForm) {
      filterForm.reset();
    }

    // 清空預覽區域
    const exportPreview = document.getElementById('preview-content');
    if (exportPreview) {
      exportPreview.innerHTML = '';
    }

    // 禁用預覽和下載按鈕
    const generatePreviewBtn = document.getElementById('generate-preview');
    const downloadExportBtn = document.getElementById('download-export');
    const copyPreviewBtn = document.getElementById('copy-preview');
    if (generatePreviewBtn) {
      generatePreviewBtn.disabled = false;
    }
    if (downloadExportBtn) {
      downloadExportBtn.disabled = true;
    }
    if (copyPreviewBtn) {
      copyPreviewBtn.disabled = true;
    }
  }

  /**
   * 生成匯出預覽
   */
  async generateExportPreview() {
    try {
      const selectedFormat = document.querySelector('.format-option.selected')?.dataset.format;
      if (!selectedFormat) {
        this.app._showNotification('請選擇匯出格式', 'warning');
        return;
      }

      const exportScope = document.querySelector('input[name="export-scope"]:checked')?.value;
      let preview = '';

      switch (exportScope) {
        case 'current':
          const currentSession = sessionManager.getCurrentSession();
          if (currentSession) {
            const previewResult = await exportService.getExportPreview(currentSession.id, selectedFormat);
            preview = previewResult.content;
          }
          break;

        case 'selected':
          const selectedIds = Array.from(document.querySelectorAll('#session-checkboxes input:checked'))
            .map(cb => cb.value);
          if (selectedIds.length === 0) {
            this.app._showNotification('請選擇要匯出的會話', 'warning');
            return;
          }
          // 對於多個會話，顯示第一個會話的預覽
          const previewResult = await exportService.getExportPreview(selectedIds[0], selectedFormat);
          preview = previewResult.content;
          if (selectedIds.length > 1) {
            preview = `[預覽第一個會話，共選擇 ${selectedIds.length} 個會話]\n\n` + preview;
          }
          break;

        case 'all':
          const allSessions = sessionManager.getSessionsList();
          if (allSessions.length > 0) {
            const allPreviewResult = await exportService.getExportPreview(allSessions[0].id, selectedFormat);
            preview = `[預覽第一個會話，共 ${allSessions.length} 個會話]\n\n` + allPreviewResult.content;
          }
          break;

        case 'filtered':
          this.app._showNotification('篩選預覽功能開發中', 'info');
          return;
      }

      const exportPreview = document.getElementById('preview-content');
      if (exportPreview) {
        exportPreview.innerHTML = `<pre>${this.app._escapeHtml(preview)}</pre>`;
      }

      // 啟用下載按鈕
      const downloadExportBtn = document.getElementById('download-export');
      const copyPreviewBtn = document.getElementById('copy-preview');
      if (downloadExportBtn) {
        downloadExportBtn.disabled = false;
      }
      if (copyPreviewBtn) {
        copyPreviewBtn.disabled = false;
      }

    } catch (error) {
      console.error('Failed to generate preview:', error);
      this.app._showNotification('預覽生成失敗：' + error.message, 'error');
    }
  }

  /**
   * 複製預覽內容到剪貼簿
   */
  async copyPreviewContent() {
    const exportPreview = document.getElementById('preview-content');
    const previewText = exportPreview?.textContent;
    if (!previewText) {
      this.app._showNotification('沒有可複製的內容', 'warning');
      return;
    }

    try {
      const success = await exportService.copyToClipboard(previewText);
      if (success) {
        this.app._showNotification('內容已複製到剪貼簿', 'success');
      } else {
        this.app._showNotification('複製失敗', 'error');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      this.app._showNotification('複製失敗：' + error.message, 'error');
    }
  }

  /**
   * 下載匯出檔案
   */
  async downloadExportFile() {
    try {
      const selectedFormat = document.querySelector('.format-option.selected')?.dataset.format;
      if (!selectedFormat) {
        this.app._showNotification('請選擇匯出格式', 'warning');
        return;
      }

      const exportScope = document.querySelector('input[name="export-scope"]:checked')?.value;
      let result;

      this.app._showLoading('正在準備匯出檔案...');

      switch (exportScope) {
        case 'current':
          const currentSession = sessionManager.getCurrentSession();
          if (currentSession) {
            result = await exportService.exportAndDownloadSession(currentSession.id, selectedFormat);
            this.app._showNotification(`已匯出會話：${result.fileName}`, 'success');
          } else {
            this.app._showNotification('沒有可匯出的當前會話', 'warning');
          }
          break;

        case 'selected':
          const selectedIds = Array.from(document.querySelectorAll('#session-checkboxes input:checked'))
            .map(cb => cb.value);
          if (selectedIds.length === 0) {
            this.app._showNotification('請選擇要匯出的會話', 'warning');
            break;
          }
          result = await exportService.exportAndDownloadMultipleSessions(selectedIds, selectedFormat);
          this.app._showNotification(`已匯出 ${selectedIds.length} 個會話：${result.fileName}`, 'success');
          break;

        case 'all':
          result = await exportService.exportAndDownloadAllSessions(selectedFormat);
          this.app._showNotification(`已匯出所有會話：${result.fileName}`, 'success');
          break;

        case 'filtered':
          this.app._showNotification('篩選匯出功能開發中', 'info');
          break;
      }

      // 關閉模態框
      this.app.modalManager.hideModal('export-modal');

    } catch (error) {
      console.error('Download failed:', error);
      this.app._showNotification('下載失敗：' + error.message, 'error');
    } finally {
      this.app._hideLoading();
    }
  }

  // === 學習報告匯出功能 ===

  /**
   * 匯出學習報告為 PDF
   * @param {Object} reportData - ReportGenerator 生成的報告數據
   * @param {Object} options - 匯出選項
   */
  async exportReportAsPDF(reportData, options = {}) {
    try {
      console.log('開始匯出 PDF 報告...', reportData);
      
      const doc = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // 創建一個臨時的 HTML 元素來處理中文文字
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '210mm';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif, "Microsoft YaHei", "Helvetica Neue", Helvetica';
      tempDiv.style.fontSize = '12px';
      tempDiv.style.lineHeight = '1.5';
      tempDiv.style.color = '#000';
      tempDiv.style.backgroundColor = '#fff';
      
      // 構建 HTML 內容
      let htmlContent = `
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center;">
          學習報告 - ${this._getReportTypeLabel(reportData.type)}
        </div>
        
        <div style="margin-bottom: 20px;">
          <strong>生成時間：</strong>${new Date(reportData.generatedAt).toLocaleString('zh-TW')}<br>
          <strong>統計期間：</strong>${reportData.period.description}
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">學習摘要</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr style="background-color: #f8f9fa;">
              <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold;">指標</td>
              <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold;">數值</td>
            </tr>
            <tr><td style="border: 1px solid #dee2e6; padding: 8px;">總學習時間</td><td style="border: 1px solid #dee2e6; padding: 8px;">${reportData.summary.totalTime}</td></tr>
            <tr><td style="border: 1px solid #dee2e6; padding: 8px;">總答題數</td><td style="border: 1px solid #dee2e6; padding: 8px;">${reportData.summary.questionsCount} 題</td></tr>
            <tr><td style="border: 1px solid #dee2e6; padding: 8px;">整體正確率</td><td style="border: 1px solid #dee2e6; padding: 8px;">${reportData.summary.successRate}</td></tr>
            <tr><td style="border: 1px solid #dee2e6; padding: 8px;">學習會話數</td><td style="border: 1px solid #dee2e6; padding: 8px;">${reportData.summary.sessionsCount} 次</td></tr>
            <tr><td style="border: 1px solid #dee2e6; padding: 8px;">表現最佳主題</td><td style="border: 1px solid #dee2e6; padding: 8px;">${reportData.summary.topPerformingTopic}</td></tr>
            <tr><td style="border: 1px solid #dee2e6; padding: 8px;">最困難主題</td><td style="border: 1px solid #dee2e6; padding: 8px;">${reportData.summary.mostDifficultTopic}</td></tr>
          </table>
        </div>`;

      // 添加主題詳細數據
      if (reportData.data.successStats.byTopic && Object.keys(reportData.data.successStats.byTopic).length > 0) {
        htmlContent += `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 5px;">各主題表現詳情</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <tr style="background-color: #f8f9fa;">
                <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold;">主題</td>
                <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold;">正確數/總數</td>
                <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold;">正確率</td>
                <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold;">學習時間</td>
              </tr>`;
              
        Object.entries(reportData.data.successStats.byTopic).forEach(([topic, stats]) => {
          const timeData = reportData.data.timeStats.byTopic[topic] || { totalTime: 0 };
          htmlContent += `
            <tr>
              <td style="border: 1px solid #dee2e6; padding: 8px;">${topic}</td>
              <td style="border: 1px solid #dee2e6; padding: 8px;">${stats.correct}/${stats.total}</td>
              <td style="border: 1px solid #dee2e6; padding: 8px;">${stats.successRate.toFixed(1)}%</td>
              <td style="border: 1px solid #dee2e6; padding: 8px;">${this._formatTimeForExport(timeData.totalTime)}</td>
            </tr>`;
        });
        
        htmlContent += `</table></div>`;
      }

      // 添加 AI 分析
      if (reportData.analysis && reportData.analysis.summary) {
        htmlContent += `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #2c3e50; border-bottom: 2px solid #e74c3c; padding-bottom: 5px;">AI 學習分析</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin-top: 10px;">
              ${reportData.analysis.summary}
            </div>
          </div>`;
      }

      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);

      try {
        // 使用 html2canvas 將 HTML 轉換為圖片
        const canvas = await window.html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 寬度 (mm)
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // 添加圖片到 PDF
        doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        // 清理臨時元素
        document.body.removeChild(tempDiv);

        // 保存 PDF
        const fileName = `learning-report-${reportData.type}-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);

        console.log('PDF 匯出完成:', fileName);
        return { success: true, fileName };

      } catch (canvasError) {
        console.warn('HTML2Canvas 失敗，使用備用方法:', canvasError);
        
        // 清理臨時元素
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }

        // 備用方法：使用純文字（不支援中文但至少能運作）
        return this._exportPDFWithTextOnly(doc, reportData);
      }
      


    } catch (error) {
      console.error('PDF 匯出失敗:', error);
      throw new Error(`PDF 匯出失敗: ${error.message}`);
    }
  }

  /**
   * 備用的純文字 PDF 匯出方法
   * @private
   */
  _exportPDFWithTextOnly(doc, reportData) {
    try {
      // 設定字體
      doc.setFont('helvetica', 'normal');
      
      // 添加標題（英文）
      doc.setFontSize(20);
      doc.text('Learning Report', 20, 30);
      
      // 添加基本資訊
      doc.setFontSize(12);
      let currentY = 50;
      
      const basicInfo = [
        `Report Type: ${reportData.type}`,
        `Generated: ${new Date(reportData.generatedAt).toISOString().split('T')[0]}`,
        `Period: ${reportData.period.description}`,
        ''
      ];
      
      basicInfo.forEach(info => {
        doc.text(info, 20, currentY);
        currentY += 8;
      });

      // 摘要數據
      doc.setFontSize(16);
      doc.text('Summary', 20, currentY + 10);
      currentY += 20;

      doc.setFontSize(12);
      const summaryInfo = [
        `Total Time: ${reportData.summary.totalTime}`,
        `Questions: ${reportData.summary.questionsCount}`,
        `Success Rate: ${reportData.summary.successRate}`,
        `Sessions: ${reportData.summary.sessionsCount}`,
        `Best Topic: ${reportData.summary.topPerformingTopic}`,
        `Difficult Topic: ${reportData.summary.mostDifficultTopic}`
      ];

      summaryInfo.forEach(info => {
        doc.text(info, 20, currentY);
        currentY += 8;
      });

      // 主題詳細數據
      if (reportData.data.successStats.byTopic && Object.keys(reportData.data.successStats.byTopic).length > 0) {
        currentY += 15;
        doc.setFontSize(16);
        doc.text('Topic Details', 20, currentY);
        currentY += 15;

        doc.setFontSize(10);
        Object.entries(reportData.data.successStats.byTopic).forEach(([topic, stats]) => {
          const timeData = reportData.data.timeStats.byTopic[topic] || { totalTime: 0 };
          doc.text(`${topic}: ${stats.correct}/${stats.total} (${stats.successRate.toFixed(1)}%) - ${this._formatTimeForExport(timeData.totalTime)}`, 20, currentY);
          currentY += 6;
        });
      }

      // 保存 PDF
      const fileName = `learning-report-${reportData.type}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      console.log('PDF 匯出完成 (備用方法):', fileName);
      return { success: true, fileName, fallback: true };

    } catch (error) {
      console.error('備用 PDF 匯出失敗:', error);
      throw new Error(`備用 PDF 匯出失敗: ${error.message}`);
    }
  }

  /**
   * 匯出學習報告為 Excel
   * @param {Object} reportData - ReportGenerator 生成的報告數據
   * @param {Object} options - 匯出選項
   */
  async exportReportAsExcel(reportData, options = {}) {
    try {
      console.log('開始匯出 Excel 報告...', reportData);

              const wb = window.XLSX.utils.book_new();

      // 工作表1：報告摘要
      const summaryData = [
        ['學習報告摘要'],
        ['報告類型', this._getReportTypeLabel(reportData.type)],
        ['生成時間', new Date(reportData.generatedAt).toLocaleString('zh-TW')],
        ['統計期間', reportData.period.description],
        [],
        ['學習指標', '數值'],
        ['總學習時間', reportData.summary.totalTime],
        ['總答題數', `${reportData.summary.questionsCount} 題`],
        ['整體正確率', reportData.summary.successRate],
        ['學習會話數', `${reportData.summary.sessionsCount} 次`],
        ['平均回答時間', reportData.summary.averageResponseTime],
        ['表現最佳主題', reportData.summary.topPerformingTopic],
        ['最困難主題', reportData.summary.mostDifficultTopic],
        ['困難主題數', `${reportData.summary.difficultTopicsCount} 個`]
      ];

              const summaryWS = window.XLSX.utils.aoa_to_sheet(summaryData);
        window.XLSX.utils.book_append_sheet(wb, summaryWS, '報告摘要');

      // 工作表2：主題詳細數據
      if (reportData.data.successStats.byTopic && Object.keys(reportData.data.successStats.byTopic).length > 0) {
        const topicData = [
          ['主題名稱', '正確數', '總答題數', '正確率(%)', '學習時間(分鐘)', '平均回答時間(秒)', '會話數']
        ];

        Object.entries(reportData.data.successStats.byTopic).forEach(([topic, stats]) => {
          const timeData = reportData.data.timeStats.byTopic[topic] || { 
            totalTime: 0, 
            averageResponseTime: 0, 
            sessions: 0 
          };
          
          topicData.push([
            topic,
            stats.correct,
            stats.total,
            stats.successRate.toFixed(1),
            (timeData.totalTime / (1000 * 60)).toFixed(1), // 轉換為分鐘
            (timeData.averageResponseTime / 1000).toFixed(1), // 轉換為秒
            timeData.sessions || 0
          ]);
        });

                  const topicWS = window.XLSX.utils.aoa_to_sheet(topicData);
          window.XLSX.utils.book_append_sheet(wb, topicWS, '主題詳細數據');
      }

      // 工作表3：圖表數據
      if (reportData.charts) {
        const chartsData = [['圖表數據'], []];

        // 時間分佈數據
        if (reportData.charts.timeDistribution && reportData.charts.timeDistribution.data) {
          chartsData.push(['時間分佈'], ['主題', '學習時間(分鐘)']);
          const timeChart = reportData.charts.timeDistribution.data;
          timeChart.labels.forEach((label, index) => {
            const timeInMinutes = (timeChart.datasets[0].data[index] / (1000 * 60)).toFixed(1);
            chartsData.push([label, timeInMinutes]);
          });
          chartsData.push([]);
        }

        // 成功率數據
        if (reportData.charts.successRates && reportData.charts.successRates.data) {
          chartsData.push(['各主題成功率'], ['主題', '成功率(%)']);
          const successChart = reportData.charts.successRates.data;
          successChart.labels.forEach((label, index) => {
            chartsData.push([label, successChart.datasets[0].data[index].toFixed(1)]);
          });
        }

                  const chartsWS = window.XLSX.utils.aoa_to_sheet(chartsData);
          window.XLSX.utils.book_append_sheet(wb, chartsWS, '圖表數據');
      }

      // 工作表4：建議與分析
      if (reportData.analysis || reportData.recommendations) {
        const analysisData = [['學習分析與建議'], []];

        if (reportData.analysis && reportData.analysis.summary) {
          analysisData.push(['AI 分析摘要']);
          analysisData.push([reportData.analysis.summary]);
          analysisData.push([]);
        }

        if (reportData.recommendations && reportData.recommendations.length > 0) {
          analysisData.push(['學習建議']);
          reportData.recommendations.forEach((rec, index) => {
            analysisData.push([`${index + 1}. ${rec.title}`]);
            analysisData.push([rec.description]);
            if (rec.actionItems) {
              rec.actionItems.forEach(item => analysisData.push([`   • ${item}`]));
            }
            analysisData.push([]);
          });
        }

        if (reportData.achievements && reportData.achievements.length > 0) {
          analysisData.push(['獲得成就']);
          reportData.achievements.forEach(achievement => {
            analysisData.push([`${achievement.icon} ${achievement.title}: ${achievement.description}`]);
          });
        }

                  const analysisWS = window.XLSX.utils.aoa_to_sheet(analysisData);
          window.XLSX.utils.book_append_sheet(wb, analysisWS, '分析與建議');
      }

      // 生成並保存 Excel 檔案
      const fileName = `learning-report-${reportData.type}-${new Date().toISOString().split('T')[0]}.xlsx`;
              const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        window.saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);

      console.log('Excel 匯出完成:', fileName);
      return { success: true, fileName };

    } catch (error) {
      console.error('Excel 匯出失敗:', error);
      throw new Error(`Excel 匯出失敗: ${error.message}`);
    }
  }

  /**
   * 將圖表添加到 PDF
   * @private
   */
  async _addChartsToPDF(doc, charts, startY) {
    try {
      if (!charts || Object.keys(charts).length === 0) {
        return startY;
      }

      let currentY = startY;

      // 檢查是否需要新頁面
      if (currentY > 200) {
        doc.addPage();
        currentY = 30;
      }

      doc.setFontSize(16);
      doc.text('圖表', 20, currentY);
      currentY += 15;

      // 嘗試從頁面中獲取已渲染的圖表 Canvas
      const chartCanvases = document.querySelectorAll('canvas[data-chart-type]');
      
      for (const canvas of chartCanvases) {
        try {
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 150;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // 檢查是否需要新頁面
          if (currentY + imgHeight > 280) {
            doc.addPage();
            currentY = 30;
          }

          doc.addImage(imgData, 'PNG', 20, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 20;
        } catch (error) {
          console.warn('無法添加圖表到 PDF:', error);
        }
      }

      return currentY;

    } catch (error) {
      console.warn('添加圖表到 PDF 時發生錯誤:', error);
      return startY;
    }
  }

  /**
   * 獲取報告類型標籤
   * @private
   */
  _getReportTypeLabel(type) {
    const labels = {
      'weekly': '週報告',
      'monthly': '月報告',
      'custom': '自訂期間報告'
    };
    return labels[type] || type;
  }

  /**
   * 格式化時間用於匯出
   * @private
   */
  _formatTimeForExport(milliseconds) {
    if (!milliseconds || milliseconds === 0) return '0分鐘';
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分鐘`;
    } else {
      return `${seconds}秒`;
    }
  }
}

export default ExportManager; 