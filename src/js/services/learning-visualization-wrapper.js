import CanvasVisualization from './canvas-visualization.js';
import { LearningVisualization } from './learning-visualization.js';

// Constants for default styling and visualization parameters
const DEFAULT_CANVAS_HEIGHT = '400px';
const DEFAULT_CANVAS_BACKGROUND = '#f9f9f9';
const DEFAULT_CANVAS_BORDER = '1px solid #ddd';
const DEFAULT_CANVAS_BORDER_RADIUS = '8px';
const DEFAULT_CANVAS_MARGIN = '10px 0';

const DEFAULT_FUNCTION_COLOR = '#0066CC';
const DEFAULT_FUNCTION_RANGE = [-10, 10]; // Default x-axis range for functions

const DEFAULT_POINT_COLOR = '#FF0000';
const DEFAULT_POINT_RADIUS = 3;

const DEFAULT_SHAPE_COORD = 0; // Default coordinate for shapes if not specified
const DEFAULT_SHAPE_SIZE = 1; // Default radius/width/height for shapes if not specified
const DEFAULT_LINE_END_COORD = 1; // Default end coordinate for lines if not specified


/**
 * 學習視覺化包裝器服務
 * 為 ContentRenderer 提供統一的視覺化接口
 * 整合 Canvas 動態視覺化和統計圖表功能
 */
class LearningVisualizationWrapper {
  constructor() {
    this.canvasInstances = new Map(); // 儲存 Canvas 實例
    // this.chartInstances is declared but currently not populated or used by this wrapper,
    // as _renderChartVisualization delegates directly to a new LearningVisualization instance.
    // Chart instance management is expected to be handled by the LearningVisualization class itself.
    this.chartInstances = new Map(); // 儲存 Chart.js 實例
    this.initialized = false;
  }

  /**
   * 初始化服務
   */
  async init() {
    if (this.initialized) return;

    try {
      console.log('🎨 初始化學習視覺化包裝器服務...');
      this.initialized = true;
      console.log('✅ 學習視覺化包裝器服務初始化完成');
    } catch (error) {
      console.error('❌ 學習視覺化包裝器服務初始化失敗:', error);
    }
  }

  /**
   * 渲染視覺化內容
   * @param {HTMLElement} container - 容器元素
   * @param {Object} visualizationConfig - 視覺化配置
   * @returns {Promise<boolean>} 渲染是否成功
   */
  async renderVisualization(container, visualizationConfig) {
    if (!container || !visualizationConfig) {
      console.warn('⚠️ 缺少容器或配置參數');
      return false;
    }

    try {
      const { type, data, options = {} } = visualizationConfig;

      console.log(`🎬 開始渲染視覺化: ${type}`, data);

      switch (type) {
        case 'canvas':
        case 'function':
        case 'geometry':
        case 'animation':
          return this._renderCanvasVisualization(container, visualizationConfig);

        case 'chart':
        case 'statistics':
          return this._renderChartVisualization(container, visualizationConfig);

        default:
          console.warn(`⚠️ 不支援的視覺化類型: ${type}`);
          return false;
      }
    } catch (error) {
      console.error('❌ 視覺化渲染失敗:', error);
      return false;
    }
  }

  /**
   * 渲染 Canvas 視覺化
   * @param {HTMLElement} container - 容器元素
   * @param {Object} config - 配置
   * @returns {Promise<boolean>} 渲染是否成功
   */
  async _renderCanvasVisualization(container, config) {
    const { data, options = {} } = config;
    // Generate a unique ID for the canvas to avoid conflicts
    const canvasId = `canvas-viz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create Canvas container element
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-visualization-container';
    // Applying inline styles for direct control as per original implementation
    canvasContainer.style.cssText = `
            width: 100%;
            height: ${options.height || DEFAULT_CANVAS_HEIGHT};
            border: ${DEFAULT_CANVAS_BORDER};
            border-radius: ${DEFAULT_CANVAS_BORDER_RADIUS};
            margin: ${DEFAULT_CANVAS_MARGIN};
            background: ${options.background || DEFAULT_CANVAS_BACKGROUND};
        `;

    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
        `;

    canvasContainer.appendChild(canvas);
    container.appendChild(canvasContainer);

    // Wait briefly for DOM to update and layout the canvas before initializing CanvasVisualization
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
      const drawGrid = options.drawGrid ?? true;
      // Create Canvas visualization instance
      const canvasViz = new CanvasVisualization(canvasId, drawGrid);
      await canvasViz.init();

      // Store the instance for later management (e.g., destruction)
      this.canvasInstances.set(canvasId, canvasViz);

      // Render content based on data type
      this._renderCanvasContent(canvasViz, data, options);

      console.log(`✅ Canvas 視覺化渲染完成: ${canvasId}`);
      return true;
    } catch (error) {
      console.error('❌ Canvas 視覺化創建失敗:', error);
      return false;
    }
  }

  /**
   * 渲染 Canvas 內容
   * @param {CanvasVisualization} canvasViz - Canvas 視覺化實例
   * @param {Object} data - 數據
   * @param {Object} options - 選項
   */
  _renderCanvasContent(canvasViz, data, options) {
    if (!data) return;

    const { contentType, content } = data;

    switch (contentType) {
      case 'function':
        this._renderFunction(canvasViz, content, options);
        break;
      case 'geometry':
        this._renderGeometry(canvasViz, content, options);
        break;
      case 'dataPoints':
        this._renderDataPoints(canvasViz, content, options);
        break;
      default:
        console.log('🎨 繪製預設座標軸和網格');
        canvasViz.draw(); // Draw default axes and grid if no specific content type
    }
  }

  /**
   * 渲染數學函數
   * @param {CanvasVisualization} canvasViz - Canvas 實例
   * @param {Object} content - 函數內容
   * @param {Object} options - 選項
   */
  _renderFunction(canvasViz, content, options) {
    const { functions = [], range = DEFAULT_FUNCTION_RANGE } = content;

    functions.forEach(funcData => {
      const { expression, color = DEFAULT_FUNCTION_COLOR } = funcData;

      try {
        // Support string expressions or function objects
        let func;
        if (typeof expression === 'string') {
          // Simple mathematical expression parsing
          func = this._parseExpression(expression);
        } else if (typeof expression === 'function') {
          func = expression;
        } else {
          console.warn('⚠️ 不支援的函數格式');
          return;
        }

        canvasViz.plotFunction(func, {
          color,
          xMin: range[0],
          xMax: range[1],
          ...options
        });

        console.log(`📈 繪製函數: ${expression} (${color})`);
      } catch (error) {
        console.error('❌ 函數繪製失敗:', error);
      }
    });
  }

  /**
   * 渲染幾何圖形
   * @param {CanvasVisualization} canvasViz - Canvas 實例
   * @param {Object} content - 幾何內容
   * @param {Object} options - 選項
   */
  _renderGeometry(canvasViz, content, options) {
    const { shapes = [] } = content;

    shapes.forEach(shape => {
      try {
        // Normalize shape data format for consistent drawing
        const normalizedShape = this._normalizeShapeData(shape);
        const { type, params, style } = normalizedShape;

        switch (type) {
          case 'circle':
            canvasViz.drawCircle(
              params.x, params.y, params.radius,
              style.fillColor, style.strokeColor, style.strokeWidth
            );
            break;
          case 'rectangle':
          case 'rect':  // Support rect alias
            canvasViz.drawRect(
              params.x, params.y, params.width, params.height,
              style.fillColor, style.strokeColor, style.strokeWidth
            );
            break;
          case 'polygon':
            canvasViz.drawPolygon(
              params.points, style.fillColor, style.strokeColor, style.strokeWidth
            );
            break;
          case 'line':
            canvasViz.drawLine(
              params.x1, params.y1, params.x2, params.y2,
              style.color, style.width
            );
            break;
          default:
            console.warn(`⚠️ 不支援的幾何類型: ${type}`);
        }

        console.log(`🔷 繪製幾何圖形: ${type}`);
      } catch (error) {
        console.error('❌ 幾何圖形繪製失敗:', error);
      }
    });
  }

  /**
   * 標準化圖形數據格式
   * Ensures all shape data conforms to a standard `params` and `style` structure.
   * @param {Object} shape - 原始圖形數據
   * @returns {Object} 標準化後的圖形數據
   */
  _normalizeShapeData(shape) {
    const { type } = shape;
    let params = {};
    let style = {};

    // If the shape is already in the standardized format, return it directly
    if (shape.params && shape.style) {
      return shape;
    }

    // Process style properties
    if (shape.color) { // Assuming 'color' is primarily for fill, fallback to stroke if fill not applicable
      style.fillColor = shape.color;
      style.strokeColor = shape.color; // For lines, 'color' maps to stroke
    }
    if (shape.strokeColor) {
      style.strokeColor = shape.strokeColor;
    }
    if (shape.strokeWidth) {
      style.strokeWidth = shape.strokeWidth;
    }

    // Standardize parameters based on shape type
    switch (type) {
      case 'circle':
        if (shape.center) {
          params.x = shape.center[0];
          params.y = shape.center[1];
        } else {
          params.x = shape.x || DEFAULT_SHAPE_COORD;
          params.y = shape.y || DEFAULT_SHAPE_COORD;
        }
        params.radius = shape.radius || DEFAULT_SHAPE_SIZE;
        break;

      case 'rectangle':
      case 'rect':
        if (shape.center) {
          // Center point mode: calculate top-left coordinates
          params.x = shape.center[0] - (shape.width || DEFAULT_SHAPE_SIZE) / 2;
          params.y = shape.center[1] + (shape.height || DEFAULT_SHAPE_SIZE) / 2; // Canvas Y-axis typically inverted from math
        } else {
          params.x = shape.x || DEFAULT_SHAPE_COORD;
          params.y = shape.y || DEFAULT_SHAPE_COORD;
        }
        params.width = shape.width || DEFAULT_SHAPE_SIZE;
        params.height = shape.height || DEFAULT_SHAPE_SIZE;
        break;

      case 'polygon':
        params.points = shape.points || [];
        break;

      case 'line':
        if (shape.start && shape.end) {
          params.x1 = shape.start[0];
          params.y1 = shape.start[1];
          params.x2 = shape.end[0];
          params.y2 = shape.end[1];
        } else {
          params.x1 = shape.x1 || DEFAULT_SHAPE_COORD;
          params.y1 = shape.y1 || DEFAULT_SHAPE_COORD;
          params.x2 = shape.x2 || DEFAULT_LINE_END_COORD;
          params.y2 = shape.y2 || DEFAULT_LINE_END_COORD;
        }
        break;
    }

    return { type, params, style };
  }


  /**
   * 渲染數據點
   * @param {CanvasVisualization} canvasViz - Canvas 實例
   * @param {Object} content - 數據內容
   * @param {Object} options - 選項
   */
  _renderDataPoints(canvasViz, content, options) {
    const { datasets = [] } = content;

    datasets.forEach(dataset => {
      const { points, style = {} } = dataset;

      try {
        canvasViz.plotDataPoints(points, {
          pointColor: style.color || DEFAULT_POINT_COLOR,
          pointRadius: style.radius || DEFAULT_POINT_RADIUS,
          ...options
        });

        console.log(`📊 繪製數據點: ${points.length} 個點`);
      } catch (error) {
        console.error('❌ 數據點繪製失敗:', error);
      }
    });
  }

  /**
   * 解析數學表達式（簡化版）
   * This method uses `new Function()` which can be a security risk if `expression` comes from untrusted user input.
   * For internal or trusted expressions, it offers a flexible way to define functions.
   * @param {string} expression - 數學表達式
   * @returns {Function} 解析後的函數
   */
  _parseExpression(expression) {
    // If the expression already contains 'Math.', assume it's ready for direct execution
    if (expression.includes('Math.')) {
      try {
        return new Function('x', `return ${expression};`);
      } catch (error) {
        console.error('❌ 表達式解析失敗:', error);
        return x => 0; // Return a zero function as fallback
      }
    }

    // Simple expression parsing for common math functions and constants
    const sanitizedExpression = expression
      .replace(/\^/g, '**')  // Convert exponentiation operator (e.g., x^2 to x**2)
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\blog\b/g, 'Math.log')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bpi\b/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E');

    try {
      return new Function('x', `return ${sanitizedExpression};`);
    } catch (error) {
      console.error('❌ 表達式解析失敗:', error);
      return x => 0; // Return a zero function as fallback
    }
  }


  /**
   * 渲染統計圖表（使用現有的 learning-visualization.js）
   * This method creates a new LearningVisualization instance for each chart.
   * The management of Chart.js instances (e.g., destruction) is delegated to the LearningVisualization class itself.
   */
  async _renderChartVisualization(container, config) {
    try {
      // Create LearningVisualization instance
      const learningViz = new LearningVisualization();
      // Use the instance to render the chart
      return learningViz.renderVisualization(container, config);
    } catch (error) {
      console.error('❌ 統計圖表渲染失敗:', error);
      return false;
    }
  }

  /**
   * 清除視覺化內容
   * Clears Canvas visualizations managed by this wrapper.
   * Chart visualizations are assumed to be managed by the LearningVisualization class they delegate to.
   * @param {HTMLElement} container - 容器元素
   */
  clearVisualization(container) {
    if (!container) return;

    try {
      // Clear Canvas instances
      const canvasElements = container.querySelectorAll('canvas[id^="canvas-viz-"]');
      canvasElements.forEach(canvas => {
        const canvasViz = this.canvasInstances.get(canvas.id);
        if (canvasViz) {
          canvasViz.destroy(); // Call destroy method on CanvasVisualization instance
          this.canvasInstances.delete(canvas.id);
        }
      });

      // Chart instances are not directly managed by this wrapper;
      // their cleanup depends on the internal logic of LearningVisualization.js.

      // Remove visualization containers from DOM
      const vizContainers = container.querySelectorAll('.canvas-visualization-container');
      vizContainers.forEach(vizContainer => {
        vizContainer.remove();
      });

      console.log('🧹 視覺化內容已清除');
    } catch (error) {
      console.error('❌ 清除視覺化內容失敗:', error);
    }
  }

  /**
   * 銷毀服務
   * Destroys all managed CanvasVisualization instances.
   * Chart instances are not directly managed here; their lifecycle is delegated.
   */
  destroy() {
    // Destroy all Canvas instances managed by this wrapper
    this.canvasInstances.forEach(canvasViz => {
      canvasViz.destroy();
    });
    this.canvasInstances.clear();

    // The `chartInstances` map is not populated by `_renderChartVisualization` in this class,
    // as it delegates instance creation and management to `LearningVisualization`.
    // Clearing it here is harmless but redundant if it was never populated.
    this.chartInstances.clear();

    this.initialized = false;
    console.log('💀 學習視覺化包裝器服務已銷毀');
  }
}

export default LearningVisualizationWrapper;
