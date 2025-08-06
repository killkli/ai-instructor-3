/**
 * 通用視覺化渲染服務 (Generic Visualization Rendering Service)
 * 專門用於解析特定 JSON 結構，並使用 Chart.js 渲染統計圖表。
 * 這個類別是無狀態的 (stateless)，不依賴外部數據追蹤器。
 */
class LearningVisualization {
  /**
   * 初始化渲染器。
   * 使用 WeakMap 來儲存圖表實例，這有助於自動記憶體管理。
   * 當容器元素從 DOM 中被移除時，相關的圖表實例會被自動垃圾回收。
   */
  constructor() {
    this.chartsByContainer = new WeakMap();
  }

  /**
   * 根據提供的 JSON 配置，在指定的容器中渲染一個視覺化圖表。
   * 這是此類別最主要的方法。
   * @param {HTMLElement} container - 將要容納圖表的 HTML 元素。
   * @param {object} config - 來自 prompt 的視覺化 JSON 設定物件。
   * @returns {Promise<boolean>} 如果渲染成功則異步返回 true，否則返回 false。
   */
  async renderVisualization(container, config) {
    try {
      // 步驟 1: 驗證輸入的有效性
      if (!container || !(container instanceof HTMLElement)) {
        console.error('無效的容器元素 (Invalid container element)。');
        return false;
      }
      if (!config || !config.data || !config.data.content) {
        console.error('無效的圖表設定 (Invalid chart config)。');
        return false;
      }
      const isChartType = ['chart', 'statistics'].includes(config.type);
      if (!isChartType || config.data.contentType !== 'chart') {
        console.error(`設定類型不匹配 (Config type mismatch)。需要 type: 'chart' 或 'statistics' 且 contentType: 'chart'。`);
        return false;
      }

      // 步驟 2: 清理舊圖表和容器
      // 如果此容器中已存在圖表，先將其銷毀
      this.destroyChart(container);
      container.innerHTML = ''; // 清空容器內容

      // 步驟 3: 應用全域選項 (來自 JSON 的 options)
      if (config.options) {
        if (config.options.height) {
          container.style.height = config.options.height;
        }
        if (config.options.background) {
          container.style.backgroundColor = config.options.background;
        }
      }
      // 確保容器具有相對定位，以便 canvas 能夠正確地填充它
      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      // 步驟 4: 創建 Canvas 元素並添加到容器中
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      // 步驟 5: 準備 Chart.js 設定並創建圖表實例
      const chartJsConfig = config.data.content;
      
      // 為提高穩健性，確保設定了響應式選項
      if (chartJsConfig.options === undefined) chartJsConfig.options = {};
      if (chartJsConfig.options.responsive === undefined) chartJsConfig.options.responsive = true;
      if (chartJsConfig.options.maintainAspectRatio === undefined) chartJsConfig.options.maintainAspectRatio = false;

      const chartInstance = new Chart(canvas.getContext('2d'), chartJsConfig);

      // 步驟 6: 儲存新的圖表實例，以便後續管理
      this.chartsByContainer.set(container, chartInstance);

      console.log('✅ 圖表渲染成功 (Chart rendered successfully)。');
      return true;

    } catch (error) {
      console.error('❌ 圖表渲染失敗 (renderVisualization):', error);
      // 在容器中顯示錯誤訊息，方便除錯
      if (container) {
        container.innerHTML = `<div style="padding: 15px; background-color: #fff0f0; border: 1px solid #ffaaaa; color: #d8000c; border-radius: 5px;">
          <strong>圖表渲染失敗:</strong>
          <pre style="white-space: pre-wrap; word-wrap: break-word; margin-top: 5px;">${error.message}</pre>
        </div>`;
      }
      return false;
    }
  }

  /**
   * 銷毀與指定容器關聯的圖表。
   * 這是一個輔助方法，用於在重新渲染或移除元素時進行清理。
   * @param {HTMLElement} container - 包含圖表的容器元素。
   */
  destroyChart(container) {
    if (this.chartsByContainer.has(container)) {
      const chartInstance = this.chartsByContainer.get(container);
      chartInstance.destroy();
      this.chartsByContainer.delete(container);
      console.log('- 已銷毀舊圖表 (Old chart destroyed)。');
    }
  }
}

// 導出類別以便在其他模組中使用
export { LearningVisualization };
