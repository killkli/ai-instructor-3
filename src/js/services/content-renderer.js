/**
 * 內容渲染服務
 * 支援 Markdown、語法高亮、LaTeX 數學公式和動態視覺化
 */
class ContentRenderer {
  constructor() {
    this.markdownIt = null;
    this.visualizationWrapper = null;
    this.initialized = false;
  }

  /**
   * 初始化渲染器
   */
  async init() {
    if (this.initialized) return;

    try {
      // 等待第三方庫載入
      await this._waitForLibraries();
      
      // 初始化視覺化包裝器
      if (typeof LearningVisualizationWrapper !== 'undefined') {
        this.visualizationWrapper = new LearningVisualizationWrapper();
        await this.visualizationWrapper.init();
        console.log('✅ 視覺化包裝器初始化成功');
      } else {
        console.warn('⚠️ LearningVisualizationWrapper 類別未載入');
      }
      
      // 初始化 markdown-it
      this.markdownIt = window.markdownit({
        html: false,        // 不允許HTML標籤
        xhtmlOut: true,     // 使用XHTML格式
        breaks: true,       // 換行符轉換為<br>
        linkify: true,      // 自動連結
        typographer: true,  // 智能引號和其他印刷符號
        highlight: (str, lang) => {
          // 語法高亮
          if (lang && window.hljs.getLanguage(lang)) {
            try {
              return window.hljs.highlight(str, { language: lang }).value;
            } catch (__) {}
          }
          return '';
        }
      });

      this.initialized = true;
      console.log('✅ ContentRenderer initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ContentRenderer:', error);
    }
  }

  /**
   * 等待第三方庫載入
   */
  async _waitForLibraries() {
    const maxWait = 5000; // 減少等待時間到5秒
    const checkInterval = 100;
    let elapsed = 0;

    while (elapsed < maxWait) {
      if (window.markdownit && window.katex && window.hljs) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    console.warn('⚠️ Third-party libraries failed to load, using fallback');
    // 如果CDN失敗，提供基本的回退功能
    this._setupFallback();
  }

  /**
   * 設置離線回退方案
   */
  _setupFallback() {
    // 簡化的Markdown解析器
    if (!window.markdownit) {
      window.markdownit = () => ({
        render: (text) => this._basicMarkdownParse(text)
      });
    }

    // 簡化的語法高亮
    if (!window.hljs) {
      window.hljs = {
        getLanguage: () => false,
        highlight: () => ({ value: '' }),
        highlightElement: () => {}
      };
    }

    // 簡化的數學渲染
    if (!window.katex) {
      window.katex = {
        renderToString: (tex) => `<span class="math-fallback">${this._escapeHtml(tex)}</span>`
      };
    }
  }

  /**
   * 基本的Markdown解析（離線回退）
   */
  _basicMarkdownParse(text) {
    return text
      // 標題
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // 粗體和斜體
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // 代碼
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/```([^`]+)```/gim, '<pre><code>$1</code></pre>')
      // 換行
      .replace(/\n/gim, '<br>')
      // 連結
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
  }

  /**
   * 渲染內容
   * @param {string} content - 原始內容
   * @returns {string} 渲染後的HTML
   */
  render(content) {
    if (!this.initialized || !content) {
      return this._escapeHtml(content || '');
    }

    try {
      // 1. 預處理 LaTeX 數學公式
      const processedContent = this._preprocessMath(content);
      
      // 2. 渲染 Markdown
      let html = this.markdownIt.render(processedContent);
      
      // 3. 後處理 LaTeX 數學公式
      html = this._postprocessMath(html);
      
      return html;
    } catch (error) {
      console.error('Content rendering failed:', error);
      return this._escapeHtml(content);
    }
  }

  /**
   * 解析簡單配置格式
   * @param {string} configStr - 配置字符串
   * @returns {Object} 解析後的配置
   */
  _parseSimpleConfig(configStr) {
    const config = { data: {}, options: {} };
    const lines = configStr.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      try {
        // 嘗試解析為 JSON 值
        const parsedValue = JSON.parse(value);
        config.data[key] = parsedValue;
      } catch {
        // 如果不是 JSON，當作字符串處理
        config.data[key] = value;
      }
    }

    return config;
  }

  /**
   * 渲染單個視覺化
   * @param {HTMLElement} container - 容器元素
   * @param {Object} visualizationConfig - 視覺化配置
   */
  async _renderVisualization(container, visualizationConfig) {
    if (!this.visualizationWrapper) {
      console.warn('⚠️ 視覺化包裝器未初始化');
      return;
    }

    try {
      const success = await this.visualizationWrapper.renderVisualization(
        container, 
        visualizationConfig
      );

      if (success) {
        console.log(`✅ 視覺化渲染成功: ${visualizationConfig.type}`);
      } else {
        console.warn(`⚠️ 視覺化渲染失敗: ${visualizationConfig.type}`);
      }
    } catch (error) {
      console.error('視覺化渲染錯誤:', error);
    }
  }

  /**
   * 清理視覺化資源
   * @param {HTMLElement} container - 容器元素
   */
  clearVisualizations(container) {
    if (this.visualizationWrapper) {
      this.visualizationWrapper.clearVisualization(container);
    }
  }

  /**
   * 預處理數學公式，保護其不被 Markdown 處理
   */
  _preprocessMath(content) {
    const mathPlaceholders = [];
    let index = 0;

    // 處理塊級數學公式 $$...$$
    content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
      const placeholder = `MATH_BLOCK_${index}`;
      mathPlaceholders[index] = { type: 'block', content: math.trim() };
      index++;
      return placeholder;
    });

    // 處理行內數學公式 $...$
    content = content.replace(/\$([^$\n]+?)\$/g, (match, math) => {
      const placeholder = `MATH_INLINE_${index}`;
      mathPlaceholders[index] = { type: 'inline', content: math.trim() };
      index++;
      return placeholder;
    });

    // 儲存數學公式占位符以供後續處理
    this._mathPlaceholders = mathPlaceholders;
    return content;
  }

  /**
   * 後處理數學公式，渲染 LaTeX
   */
  _postprocessMath(html) {
    if (!this._mathPlaceholders) return html;

    this._mathPlaceholders.forEach((mathData, index) => {
      if (!mathData) return;

      try {
        const placeholder = mathData.type === 'block' 
          ? `MATH_BLOCK_${index}`
          : `MATH_INLINE_${index}`;

        if (html.includes(placeholder)) {
          const isDisplayMode = mathData.type === 'block';
          const rendered = window.katex.renderToString(mathData.content, {
            displayMode: isDisplayMode,
            throwOnError: false,
            errorColor: '#cc0000',
            strict: false
          });

          html = html.replace(placeholder, rendered);
        }
      } catch (error) {
        console.warn('LaTeX rendering failed for:', mathData.content, error);
        // 如果渲染失敗，保留原始內容
        const placeholder = mathData.type === 'block' 
          ? `MATH_BLOCK_${index}`
          : `MATH_INLINE_${index}`;
        const fallback = mathData.type === 'block' 
          ? `<div class="math-error">$$${mathData.content}$$</div>`
          : `<span class="math-error">$${mathData.content}$</span>`;
        html = html.replace(placeholder, fallback);
      }
    });

    // 清理占位符
    this._mathPlaceholders = null;
    return html;
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
   * 應用語法高亮到已存在的代碼塊
   */
  highlightCodeBlocks(container) {
    if (!window.hljs || !container) return;

    try {
      const codeBlocks = container.querySelectorAll('pre code');
      codeBlocks.forEach(block => {
        if (!block.classList.contains('hljs')) {
          window.hljs.highlightElement(block);
        }
      });
    } catch (error) {
      console.warn('Code highlighting failed:', error);
    }
  }

  /**
   * 重新渲染數學公式（用於動態內容）
   */
  renderMathInElement(element) {
    if (!window.katex || !element) return;

    try {
      // 渲染所有 .katex 元素
      const mathElements = element.querySelectorAll('.katex');
      mathElements.forEach(mathEl => {
        // KaTeX 已經渲染過，無需重複處理
      });
    } catch (error) {
      console.warn('Math re-rendering failed:', error);
    }
  }
}

// 創建全域實例
const contentRenderer = new ContentRenderer();

export default contentRenderer; 
