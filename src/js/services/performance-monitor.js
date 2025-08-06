/**
 * 效能監控服務
 * 用於測量和監控應用程式的關鍵效能指標
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.isEnabled = true;
    this.thresholds = {
      questionGeneration: 5000, // 5秒
      indexedDBQuery: 1000,     // 1秒
      chartRendering: 2000,     // 2秒
      totalResponseTime: 8000   // 8秒
    };
    this.performanceMarks = new Map();
    this.performanceEntries = [];
    this.observers = new Set();
    this.initializeObservers();
  }

  /**
   * 初始化效能觀察器
   */
  initializeObservers() {
    // 使用 PerformanceObserver 監控長任務
    if ('PerformanceObserver' in window) {
      try {
        // 監控長任務（阻塞主線程的任務）
        const longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.duration > 50) { // 超過50ms的任務
              this.recordMetric('longTask', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
                type: entry.entryType
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.add(longTaskObserver);
      } catch (error) {
        console.warn('無法監控長任務:', error);
      }

      try {
        // 監控導航和資源載入
        const navigationObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            this.recordMetric('navigation', {
              duration: entry.duration,
              loadEventEnd: entry.loadEventEnd,
              domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
              type: entry.entryType
            });
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.add(navigationObserver);
      } catch (error) {
        console.warn('無法監控導航:', error);
      }
    }
  }

  /**
   * 開始測量效能
   * @param {string} name - 測量名稱
   * @param {Object} context - 上下文資訊
   */
  startMeasure(name, context = {}) {
    if (!this.isEnabled) return;

    const markName = `${name}_start`;
    performance.mark(markName);
    
    this.performanceMarks.set(name, {
      startTime: performance.now(),
      startMark: markName,
      context: context
    });
  }

  /**
   * 結束測量效能
   * @param {string} name - 測量名稱
   * @param {Object} additionalData - 額外數據
   * @returns {Object} 測量結果
   */
  endMeasure(name, additionalData = {}) {
    if (!this.isEnabled) return null;

    const endTime = performance.now();
    const startData = this.performanceMarks.get(name);
    
    if (!startData) {
      console.warn(`未找到開始測量標記: ${name}`);
      return null;
    }

    const duration = endTime - startData.startTime;
    const endMark = `${name}_end`;
    performance.mark(endMark);

    // 創建測量
    const measureName = `${name}_measure`;
    performance.measure(measureName, startData.startMark, endMark);

    const result = {
      name,
      duration: Math.round(duration * 100) / 100,
      startTime: startData.startTime,
      endTime,
      context: startData.context,
      ...additionalData
    };

    this.recordMetric(name, result);
    this.performanceMarks.delete(name);

    // 檢查是否超過閾值
    const threshold = this.thresholds[name];
    if (threshold && duration > threshold) {
      console.warn(`🚨 效能警告: ${name} 執行時間 ${duration}ms 超過閾值 ${threshold}ms`);
    }

    return result;
  }

  /**
   * 記錄效能指標
   * @param {string} category - 指標類別
   * @param {Object} data - 指標數據
   */
  recordMetric(category, data) {
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }
    
    const entry = {
      timestamp: Date.now(),
      ...data
    };
    
    this.metrics.get(category).push(entry);
    this.performanceEntries.push(entry);

    // 限制保存的條目數量
    if (this.performanceEntries.length > 1000) {
      this.performanceEntries = this.performanceEntries.slice(-500);
    }
  }

  /**
   * 測量問題生成效能
   * @param {Function} generationFunction - 問題生成函數
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 生成結果和效能數據
   */
  async measureQuestionGeneration(generationFunction, context = {}) {
    this.startMeasure('questionGeneration', context);
    
    try {
      const result = await generationFunction();
      const metrics = this.endMeasure('questionGeneration', {
        success: true,
        questionsGenerated: Array.isArray(result) ? result.length : 1,
        promptLength: context.promptLength || 0,
        apiModel: context.apiModel || 'unknown'
      });
      
      return { result, metrics };
    } catch (error) {
      this.endMeasure('questionGeneration', {
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 測量 IndexedDB 查詢效能
   * @param {Function} queryFunction - 查詢函數
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 查詢結果和效能數據
   */
  async measureIndexedDBQuery(queryFunction, context = {}) {
    this.startMeasure('indexedDBQuery', context);
    
    try {
      const result = await queryFunction();
      const metrics = this.endMeasure('indexedDBQuery', {
        success: true,
        recordsFound: Array.isArray(result) ? result.length : (result ? 1 : 0),
        queryType: context.queryType || 'unknown',
        storeName: context.storeName || 'unknown'
      });
      
      return { result, metrics };
    } catch (error) {
      this.endMeasure('indexedDBQuery', {
        success: false,
        error: error.message,
        queryType: context.queryType || 'unknown'
      });
      throw error;
    }
  }

  /**
   * 測量圖表渲染效能
   * @param {Function} renderFunction - 渲染函數
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 渲染結果和效能數據
   */
  async measureChartRendering(renderFunction, context = {}) {
    this.startMeasure('chartRendering', context);
    
    try {
      const result = await renderFunction();
      const metrics = this.endMeasure('chartRendering', {
        success: true,
        chartType: context.chartType || 'unknown',
        dataPoints: context.dataPoints || 0,
        chartId: context.chartId || 'unknown'
      });
      
      return { result, metrics };
    } catch (error) {
      this.endMeasure('chartRendering', {
        success: false,
        error: error.message,
        chartType: context.chartType || 'unknown'
      });
      throw error;
    }
  }

  /**
   * 執行記憶體使用分析
   * @returns {Object} 記憶體使用情況
   */
  analyzeMemoryUsage() {
    const memoryInfo = {
      timestamp: Date.now(),
      available: false
    };

    // 現代瀏覽器的記憶體 API
    if (performance.memory) {
      memoryInfo.available = true;
      memoryInfo.used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100; // MB
      memoryInfo.total = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024 * 100) / 100; // MB
      memoryInfo.limit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100; // MB
      memoryInfo.usage = Math.round((memoryInfo.used / memoryInfo.total) * 100);
    }

    this.recordMetric('memoryUsage', memoryInfo);
    return memoryInfo;
  }

  /**
   * 執行效能基準測試
   * @param {Object} services - 服務物件
   * @returns {Promise<Object>} 基準測試結果
   */
  async runBenchmark(services = {}) {
    const results = {
      timestamp: Date.now(),
      tests: {},
      summary: {}
    };

    console.log('🚀 開始效能基準測試...');

    // 測試 IndexedDB 查詢效能
    if (services.storageService) {
      console.log('📊 測試 IndexedDB 查詢效能...');
      
      // 測試基本查詢
      try {
        const { metrics } = await this.measureIndexedDBQuery(
          () => services.storageService.getAllSessions(),
          { queryType: 'getAllSessions', storeName: 'sessions' }
        );
        results.tests.indexedDB_getAllSessions = metrics;
      } catch (error) {
        results.tests.indexedDB_getAllSessions = { error: error.message };
      }

      // 測試學習記錄查詢
      try {
        const { metrics } = await this.measureIndexedDBQuery(
          () => services.storageService.getLearningRecords({ userId: 'default' }),
          { queryType: 'getLearningRecords', storeName: 'learningRecords' }
        );
        results.tests.indexedDB_getLearningRecords = metrics;
      } catch (error) {
        results.tests.indexedDB_getLearningRecords = { error: error.message };
      }

      // 測試問題庫查詢
      try {
        const { metrics } = await this.measureIndexedDBQuery(
          () => services.storageService.getQuestions({ topic: 'mathematics' }),
          { queryType: 'getQuestions', storeName: 'questionBank' }
        );
        results.tests.indexedDB_getQuestions = metrics;
      } catch (error) {
        results.tests.indexedDB_getQuestions = { error: error.message };
      }
    }

    // 測試問題生成效能
    if (services.geminiService) {
      console.log('🤖 測試問題生成效能...');
      
      try {
        const testPrompt = "生成一道數學加法問題，適合小學生。";
        const { metrics } = await this.measureQuestionGeneration(
          () => services.geminiService.sendMessage(testPrompt),
          { 
            promptLength: testPrompt.length, 
            apiModel: services.geminiService.getCurrentModel() 
          }
        );
        results.tests.questionGeneration_simple = metrics;
      } catch (error) {
        results.tests.questionGeneration_simple = { error: error.message };
      }
    }

    // 測試圖表渲染效能
    if (services.learningVisualization) {
      console.log('📈 測試圖表渲染效能...');
      
      // 創建測試容器
      const testContainer = document.createElement('div');
      testContainer.id = 'performance-test-container';
      testContainer.style.cssText = 'position: absolute; top: -9999px; width: 400px; height: 300px;';
      document.body.appendChild(testContainer);

      const testCanvas = document.createElement('canvas');
      testCanvas.id = 'performance-test-canvas';
      testCanvas.width = 400;
      testCanvas.height = 300;
      testContainer.appendChild(testCanvas);

      try {
        // 生成測試數據
        const testData = {
          byTopic: {
            '數學': { totalTime: 120000, count: 10 },
            '英語': { totalTime: 90000, count: 8 },
            '科學': { totalTime: 60000, count: 5 },
            '歷史': { totalTime: 45000, count: 4 }
          }
        };

        const { metrics } = await this.measureChartRendering(
          () => services.learningVisualization.createTimeDistributionChart('performance-test-canvas', testData),
          { 
            chartType: 'timeDistribution', 
            dataPoints: Object.keys(testData.byTopic).length,
            chartId: 'performance-test-canvas'
          }
        );
        results.tests.chartRendering_timeDistribution = metrics;
      } catch (error) {
        results.tests.chartRendering_timeDistribution = { error: error.message };
      } finally {
        // 清理測試容器
        document.body.removeChild(testContainer);
      }
    }

    // 記憶體使用分析
    console.log('💾 分析記憶體使用...');
    results.tests.memoryUsage = this.analyzeMemoryUsage();

    // 計算摘要
    const successfulTests = Object.values(results.tests).filter(test => !test.error && test.duration);
    results.summary = {
      totalTests: Object.keys(results.tests).length,
      successfulTests: successfulTests.length,
      averageDuration: successfulTests.length > 0 
        ? Math.round(successfulTests.reduce((sum, test) => sum + test.duration, 0) / successfulTests.length * 100) / 100
        : 0,
      slowestTest: successfulTests.length > 0 
        ? successfulTests.reduce((max, test) => test.duration > max.duration ? test : max, successfulTests[0])
        : null
    };

    console.log('✅ 效能基準測試完成');
    return results;
  }

  /**
   * 獲取效能報告
   * @param {string} category - 特定類別 (可選)
   * @returns {Object} 效能報告
   */
  getPerformanceReport(category = null) {
    const report = {
      timestamp: Date.now(),
      categories: {},
      summary: {}
    };

    const categories = category ? [category] : Array.from(this.metrics.keys());

    for (const cat of categories) {
      const entries = this.metrics.get(cat) || [];
      if (entries.length === 0) continue;

      const durations = entries
        .filter(entry => typeof entry.duration === 'number')
        .map(entry => entry.duration);

      const successCount = entries.filter(entry => entry.success !== false).length;

      report.categories[cat] = {
        totalEntries: entries.length,
        successCount,
        successRate: entries.length > 0 ? Math.round((successCount / entries.length) * 100) : 0,
        durations: durations.length > 0 ? {
          min: Math.min(...durations),
          max: Math.max(...durations),
          average: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length * 100) / 100,
          median: this._calculateMedian(durations)
        } : null,
        recentEntries: entries.slice(-5) // 最近5個條目
      };
    }

    // 整體摘要
    const allEntries = Array.from(this.metrics.values()).flat();
    report.summary = {
      totalEntries: allEntries.length,
      categoriesCount: Object.keys(report.categories).length,
      timeSpan: allEntries.length > 0 
        ? {
            start: Math.min(...allEntries.map(e => e.timestamp)),
            end: Math.max(...allEntries.map(e => e.timestamp))
          }
        : null
    };

    return report;
  }

  /**
   * 計算中位數
   * @param {Array} numbers - 數字陣列
   * @returns {number} 中位數
   */
  _calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * 清除效能數據
   * @param {string} category - 特定類別 (可選)
   */
  clearMetrics(category = null) {
    if (category) {
      this.metrics.delete(category);
    } else {
      this.metrics.clear();
      this.performanceEntries = [];
    }
  }

  /**
   * 設定效能閾值
   * @param {Object} thresholds - 閾值對象
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 啟用或禁用效能監控
   * @param {boolean} enabled - 是否啟用
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * 銷毀監控器
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.clearMetrics();
  }
}

// 全域實例
window.performanceMonitor = new PerformanceMonitor(); 