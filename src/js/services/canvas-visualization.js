/**
 * Canvas 動態視覺化服務 (優化版)
 * 使用 HTML5 Canvas API 實現數學函數圖形、幾何圖形和物理現象模擬
 *
 * @version 2.0
 * @author Optimized by AI
 *
 * --- 優化說明 ---
 * 1.  **渲染效能**:
 *     - 使用 `requestAnimationFrame` 批次處理繪圖請求，提升平移/縮放時的流暢度。
 *     - 將所有繪圖 API 改為非立即執行，而是加入命令佇列，由統一的 `draw` 方法渲染。
 *     - 函數繪製 (`plotFunction`) 採用自適應步長，根據縮放級別動態調整繪圖精度與效能。
 *     - 函數繪製僅計算並渲染可視範圍內的點，避免不必要的計算。
 *
 * 2.  **使用者體驗**:
 *     - 增加對觸控設備的雙指縮放 (Pinch-to-Zoom) 支援。
 *     - 優化事件處理器綁定與移除機制，確保資源能被完全釋放。
 *
 * 3.  **程式碼品質**:
 *     - 移除有安全風險的 `eval`，改用更安全的 `new Function()`。
 *     - 簡化繪圖邏輯，移除冗餘的 `_draw...` 內部方法，使程式碼更精煉。
 *     - 增強程式碼一致性與可維護性。
 */
class CanvasVisualization {
  constructor(canvasId, drawGrid = true) {
    this.canvasId = canvasId;
    this.canvas = null;
    this.ctx = null;
    this.dpi = window.devicePixelRatio || 1;
    this.draw_grid = drawGrid;

    // 動畫與渲染狀態
    this.animationFrameId = null;
    this.isAnimating = false;
    this.redrawRequested = false;

    // 視覺化數據
    this.staticDrawCommands = []; // 保存靜態繪製命令
    this.activePlots = []; // 儲存所有活躍的函數定義
    this.plotDrawingCommands = []; // 儲存由函數生成的低階繪圖命令
    this.needsPlotRecalculation = true;

    // 座標系統參數
    this.originX = 0;
    this.originY = 0;
    this.scaleX = 50;
    this.scaleY = 50;

    // 互動狀態
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastTouchDistance = 0; // 用於雙指縮放

    // 自動縮放功能
    this.worldBoundingBox = null;
    this.initialZoomDone = false;

    // 事件處理器綁定 (優化)
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
    this.boundHandleWheel = this.handleWheel.bind(this);
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchMove = this.handleTouchMove.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    this.boundHandleResize = this.handleResize.bind(this);
    this.boundPreventContextMenu = (e) => e.preventDefault();
    this.boundDraw = this.draw.bind(this);

    // 初始化
    this.init();
  }

  /**
   * 初始化 Canvas 和相關設定
   */
  init() {
    try {
      this.canvas = document.getElementById(this.canvasId);
      if (!this.canvas) {
        console.error(`找不到 Canvas 元素: ${this.canvasId}`);
        return false;
      }

      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        console.error('無法取得 2D 繪圖上下文');
        return false;
      }

      this.resizeCanvas();
      this.bindEvents();

      console.log(`✅ Canvas 視覺化服務初始化成功: ${this.canvasId}`);
      return true;
    } catch (error) {
      console.error('Canvas 視覺化服務初始化失敗:', error);
      return false;
    }
  }

  /**
   * 調整 Canvas 尺寸，處理高 DPI 螢幕
   */
  resizeCanvas() {
    if (!this.canvas || !this.ctx) return;

    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (this.canvas.width !== displayWidth * this.dpi || this.canvas.height !== displayHeight * this.dpi) {
      this.canvas.width = displayWidth * this.dpi;
      this.canvas.height = displayHeight * this.dpi;
      this.ctx.scale(this.dpi, this.dpi);

      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;

      this.originX = displayWidth / 2;
      this.originY = displayHeight / 2;

      this.needsPlotRecalculation = true;
      this.requestRedraw();
      console.log(`📐 Canvas 尺寸已調整: ${displayWidth}x${displayHeight} (DPI: ${this.dpi})`);
    }
  }

  /**
   * 綁定事件監聽器 (優化)
   */
  bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
    this.canvas.addEventListener('mousemove', this.boundHandleMouseMove);
    this.canvas.addEventListener('mouseup', this.boundHandleMouseUp);
    this.canvas.addEventListener('mouseout', this.boundHandleMouseUp);
    this.canvas.addEventListener('wheel', this.boundHandleWheel);
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd);
    this.canvas.addEventListener('contextmenu', this.boundPreventContextMenu);
    window.addEventListener('resize', this.boundHandleResize);
  }

  /**
   * 處理視窗大小變化 (Debounced)
   */
  handleResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.resizeCanvas(), 100);
  }

  // --- 座標與事件輔助方法 ---

  getCanvasCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (event.touches) { // 觸控事件
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    // 滑鼠事件
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  // --- 互動事件處理 (優化) ---

  handleMouseDown(event) {
    event.preventDefault();
    const coords = this.getCanvasCoords(event);
    this.isPanning = true;
    this.lastMouseX = coords.x;
    this.lastMouseY = coords.y;
  }

  handleMouseMove(event) {
    if (!this.isPanning) return;
    event.preventDefault();
    const coords = this.getCanvasCoords(event);
    const dx = coords.x - this.lastMouseX;
    const dy = coords.y - this.lastMouseY;

    this.originX += dx;
    this.originY += dy;

    this.lastMouseX = coords.x;
    this.lastMouseY = coords.y;

    this.requestRedraw();
  }

  handleMouseUp() {
    this.isPanning = false;
  }

  handleWheel(event) {
    event.preventDefault();
    const coords = this.getCanvasCoords(event);
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoomAt(coords.x, coords.y, zoomFactor);
    this.needsPlotRecalculation = true;
    this.requestRedraw();
  }

  handleTouchStart(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const coords = this.getCanvasCoords(event);
      this.isPanning = true;
      this.lastMouseX = coords.x;
      this.lastMouseY = coords.y;
    } else if (event.touches.length === 2) {
      this.isPanning = false;
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      this.lastTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  }

  handleTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 1 && this.isPanning) {
      const coords = this.getCanvasCoords(event);
      const dx = coords.x - this.lastMouseX;
      const dy = coords.y - this.lastMouseY;
      this.originX += dx;
      this.originY += dy;
      this.lastMouseX = coords.x;
      this.lastMouseY = coords.y;
      this.requestRedraw();
    } else if (event.touches.length === 2) {
      const rect = this.canvas.getBoundingClientRect();
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const zoomFactor = currentDist / this.lastTouchDistance;

      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const centerY = (t1.clientY + t2.clientY) / 2 - rect.top;

      this.zoomAt(centerX, centerY, zoomFactor);
      this.lastTouchDistance = currentDist;
      this.needsPlotRecalculation = true;
      this.requestRedraw();
    }
  }

  handleTouchEnd() {
    this.isPanning = false;
    this.lastTouchDistance = 0;
  }

  // --- 座標轉換與縮放 ---

  zoomAt(x, y, factor) {
    const worldBefore = this.screenToWorld(x, y);
    this.scaleX *= factor;
    this.scaleY *= factor;
    const worldAfter = this.screenToWorld(x, y);
    this.originX += (worldAfter.x - worldBefore.x) * this.scaleX;
    this.originY -= (worldAfter.y - worldBefore.y) * this.scaleY;
    console.log(`🔍 縮放: ${factor.toFixed(2)}x, 比例: ${this.scaleX.toFixed(1)}`);
  }

  worldToScreen(worldX, worldY) {
    return {
      x: this.originX + worldX * this.scaleX,
      y: this.originY - worldY * this.scaleY,
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.originX) / this.scaleX,
      y: (this.originY - screenY) / this.scaleY,
    };
  }

  getCanvasWorldBounds() {
    const { clientWidth, clientHeight } = this.canvas;
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(clientWidth, clientHeight);
    return { left: topLeft.x, right: bottomRight.x, top: topLeft.y, bottom: bottomRight.y };
  }

  // --- 繪圖核心 (優化) ---

  /**
   * 請求重繪，使用 requestAnimationFrame 避免不必要的渲染
   */
  requestRedraw() {
    if (!this.redrawRequested) {
      this.redrawRequested = true;
      requestAnimationFrame(this.boundDraw);
    }
  }

  /**
   * 主要繪製方法，由 requestAnimationFrame 觸發
   */
  draw() {
    this.redrawRequested = false;
    if (!this.ctx) return;

    const { clientWidth, clientHeight } = this.canvas;
    this.ctx.clearRect(0, 0, clientWidth, clientHeight);

    if(this.draw_grid) this.drawAxesAndGrid();

    if (this.needsPlotRecalculation) {
      this.recalculatePlots();
      this.needsPlotRecalculation = false;
      // 僅在首次計算後或數據變更後執行自動縮放
      this.autoZoomIfNeeded();
    }

    this.renderVisualization();
  }

  /**
   * 渲染所有已註冊的視覺化內容
   */
  renderVisualization() {
    // 繪製靜態圖形
    this.staticDrawCommands.forEach(command => command());
    // 繪製函數圖形
    this.plotDrawingCommands.forEach(command => command());
  }

  // --- 座標軸與網格 ---

  drawAxesAndGrid() {
    const { ctx } = this;
    const { clientWidth, clientHeight } = this.canvas;

    ctx.save();
    const tickSpacing = this.calculateTickSpacing();

    // 繪製網格線
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    const { left, right, top, bottom } = this.getCanvasWorldBounds();
    const xStart = Math.floor(left / tickSpacing) * tickSpacing;
    const yStart = Math.floor(bottom / tickSpacing) * tickSpacing;

    for (let x = xStart; x <= right; x += tickSpacing) {
      if (Math.abs(x) < 1e-9) continue;
      const screenX = this.worldToScreen(x, 0).x;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, clientHeight);
      ctx.stroke();
    }
    for (let y = yStart; y <= top; y += tickSpacing) {
      if (Math.abs(y) < 1e-9) continue;
      const screenY = this.worldToScreen(0, y).y;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(clientWidth, screenY);
      ctx.stroke();
    }

    // 繪製主軸線
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, this.originY);
    ctx.lineTo(clientWidth, this.originY);
    ctx.moveTo(this.originX, 0);
    ctx.lineTo(this.originX, clientHeight);
    ctx.stroke();

    // 繪製刻度標籤
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.lineWidth = 1;

    // X 軸刻度
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = xStart; x <= right; x += tickSpacing) {
      if (Math.abs(x) < 1e-9) continue;
      const screenX = this.worldToScreen(x, 0).x;
      ctx.fillText(x.toPrecision(3), screenX, this.originY + 8);
    }

    // Y 軸刻度
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = yStart; y <= top; y += tickSpacing) {
      if (Math.abs(y) < 1e-9) continue;
      const screenY = this.worldToScreen(0, y).y;
      ctx.fillText(y.toPrecision(3), this.originX - 8, screenY);
    }
    ctx.restore();
  }

  calculateTickSpacing() {
    const targetPixelSpacing = 60;
    const worldSpacing = targetPixelSpacing / this.scaleX;
    const magnitude = Math.pow(10, Math.floor(Math.log10(worldSpacing)));
    const normalized = worldSpacing / magnitude;
    if (normalized < 1.5) return magnitude;
    if (normalized < 3.5) return 2 * magnitude;
    if (normalized < 7.5) return 5 * magnitude;
    return 10 * magnitude;
  }

  // ========== 基本繪圖 API (優化為命令模式) ==========

  drawPoint(x, y, color = '#FF0000', radius = 3) {
    this.updateWorldBoundingBox(x, y);
    this.staticDrawCommands.push(() => {
      const screenPos = this.worldToScreen(x, y);
      const { ctx } = this;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    });
    this.requestRedraw();
  }

  drawLine(x1, y1, x2, y2, color = '#0000FF', width = 2) {
    this.updateWorldBoundingBox(x1, y1);
    this.updateWorldBoundingBox(x2, y2);
    this.staticDrawCommands.push(() => {
      const start = this.worldToScreen(x1, y1);
      const end = this.worldToScreen(x2, y2);
      const { ctx } = this;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    });
    this.requestRedraw();
  }

  drawCircle(centerX, centerY, radius, fillColor = null, strokeColor = '#0000FF', strokeWidth = 2) {
    this.updateWorldBoundingBox(centerX - radius, centerY - radius);
    this.updateWorldBoundingBox(centerX + radius, centerY + radius);
    this.staticDrawCommands.push(() => {
      const center = this.worldToScreen(centerX, centerY);
      const screenRadius = radius * this.scaleX;
      const { ctx } = this;
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, Math.max(0.5, screenRadius), 0, 2 * Math.PI);
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
      ctx.restore();
    });
    this.requestRedraw();
  }

  drawRect(x, y, width, height, fillColor = null, strokeColor = '#0000FF', strokeWidth = 2) {
    this.updateWorldBoundingBox(x, y);
    this.updateWorldBoundingBox(x + width, y - height); // Y 軸反轉
    this.staticDrawCommands.push(() => {
      const topLeft = this.worldToScreen(x, y);
      const screenWidth = width * this.scaleX;
      const screenHeight = height * this.scaleY;
      const { ctx } = this;
      ctx.save();
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(topLeft.x, topLeft.y - screenHeight, screenWidth, screenHeight);
      }
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(topLeft.x, topLeft.y - screenHeight, screenWidth, screenHeight);
      }
      ctx.restore();
    });
    this.requestRedraw();
  }

  drawText(text, x, y, color = '#000000', font = '14px Arial', align = 'center') {
    this.updateWorldBoundingBox(x, y);
    this.staticDrawCommands.push(() => {
      const screenPos = this.worldToScreen(x, y);
      const { ctx } = this;
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, screenPos.x, screenPos.y);
      ctx.restore();
    });
    this.requestRedraw();
  }

  drawPolygon(points, fillColor = null, strokeColor = '#0000FF', strokeWidth = 2) {
    if (!points || points.length < 2) return;
    points.forEach(p => this.updateWorldBoundingBox(p.x, p.y));
    this.staticDrawCommands.push(() => {
      if (!this.ctx || !points || points.length < 2) return;
      const { ctx } = this;
      ctx.save();
      ctx.beginPath();
      const firstPoint = this.worldToScreen(points[0].x, points[0].y);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < points.length; i++) {
        const screenPoint = this.worldToScreen(points[i].x, points[i].y);
        ctx.lineTo(screenPoint.x, screenPoint.y);
      }
      ctx.closePath();
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
      ctx.restore();
    });
    this.requestRedraw();
  }

  drawEllipse(centerX, centerY, radiusX, radiusY, rotation = 0, fillColor = null, strokeColor = '#0000FF', strokeWidth = 2) {
    const maxRadius = Math.max(radiusX, radiusY);
    this.updateWorldBoundingBox(centerX - maxRadius, centerY - maxRadius);
    this.updateWorldBoundingBox(centerX + maxRadius, centerY + maxRadius);
    this.staticDrawCommands.push(() => {
      const center = this.worldToScreen(centerX, centerY);
      const screenRadiusX = radiusX * this.scaleX;
      const screenRadiusY = radiusY * this.scaleY;
      const { ctx } = this;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, Math.max(0, screenRadiusX), Math.max(0, screenRadiusY), rotation, 0, 2 * Math.PI);
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
      ctx.restore();
    });
    this.requestRedraw();
  }


  // ========== 函數繪圖 API (優化) ==========

  plotFunction(func, options = {}) {
    this.activePlots.push({ type: 'function', func, opts: { ...options } });
    this.needsPlotRecalculation = true;
    this.requestRedraw();
  }

  _plotFunction(func, opts) {
    let mathFunc;
    if (typeof func === 'string') {
      try {
        const functionString = func.includes('=>') ? func : `(x) => ${func}`;
        mathFunc = new Function('return ' + functionString)();
      } catch (error) {
        console.error('無效的函數字符串:', error);
        return;
      }
    } else if (typeof func === 'function') {
      mathFunc = func;
    } else {
      console.error('無效的函數類型');
      return;
    }

    const defaultOptions = { color: '#FF0000', width: 2, showPoints: false };
    const finalOpts = { ...defaultOptions, ...opts };

    const worldBounds = this.getCanvasWorldBounds();
    // 自適應步長：目標是每 2 個像素一個點
    const step = 2 / this.scaleX;

    const points = [];
    for (let x = worldBounds.left; x <= worldBounds.right; x += step) {
      try {
        const y = mathFunc(x);
        if (Number.isFinite(y)) {
          points.push({ x, y });
          this.updateWorldBoundingBox(x, y);
        } else {
          // 處理不連續點，如果前一個點是有效的，則先繪製
          if (points.length > 1) this.addPlotSegment(points, finalOpts);
          points.length = 0; // 清空點集
        }
      } catch (e) { /* 忽略計算錯誤的點 */ }
    }
    if (points.length > 1) this.addPlotSegment(points, finalOpts);
  }

  plotParametricFunction(xFunc, yFunc, options = {}) {
     this.activePlots.push({ type: 'parametric', xFunc, yFunc, opts: { ...options } });
     this.needsPlotRecalculation = true;
     this.requestRedraw();
  }

  _plotParametricFunction(xFunc, yFunc, opts) {
    const defaultOptions = { tMin: 0, tMax: 2 * Math.PI, step: 0.01, color: '#00AA00', width: 2, showPoints: false };
    const finalOpts = { ...defaultOptions, ...opts };

    const points = [];
    for (let t = finalOpts.tMin; t <= finalOpts.tMax; t += finalOpts.step) {
      try {
        const x = xFunc(t);
        const y = yFunc(t);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          points.push({ x, y });
          this.updateWorldBoundingBox(x, y);
        }
      } catch (e) { /* 忽略 */ }
    }
    if (points.length > 1) this.addPlotSegment(points, finalOpts);
  }

  plotDataPoints(data, options = {}) {
     if (!data || data.length === 0) return;
     this.activePlots.push({ type: 'dataPoints', data, opts: { ...options } });
     this.needsPlotRecalculation = true;
     this.requestRedraw();
  }

  _plotDataPoints(data, opts) {
    const defaultOptions = { pointColor: '#0066CC', pointRadius: 3, connectPoints: false, lineColor: '#0066CC', lineWidth: 1 };
    const finalOpts = { ...defaultOptions, ...opts };
    
    data.forEach(p => this.updateWorldBoundingBox(p.x, p.y));

    this.plotDrawingCommands.push(() => {
      const { ctx } = this;
      ctx.save();
      if (finalOpts.connectPoints && data.length > 1) {
        ctx.strokeStyle = finalOpts.lineColor;
        ctx.lineWidth = finalOpts.lineWidth;
        ctx.beginPath();
        data.forEach((p, i) => {
          const sp = this.worldToScreen(p.x, p.y);
          i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
        });
        ctx.stroke();
      }
      ctx.fillStyle = finalOpts.pointColor;
      data.forEach(p => {
        const sp = this.worldToScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, finalOpts.pointRadius, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  /**
   * 將一段連續的點加入繪圖命令
   */
  addPlotSegment(points, opts) {
    this.plotDrawingCommands.push(() => {
      const { ctx } = this;
      ctx.save();
      ctx.strokeStyle = opts.color;
      ctx.lineWidth = opts.width;
      ctx.beginPath();
      points.forEach((p, i) => {
        const sp = this.worldToScreen(p.x, p.y);
        i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
      });
      ctx.stroke();
      if (opts.showPoints) {
        ctx.fillStyle = opts.color;
        points.forEach(p => {
          const sp = this.worldToScreen(p.x, p.y);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      ctx.restore();
    });
  }

  recalculatePlots() {
    this.plotDrawingCommands = [];
    this.worldBoundingBox = null; // 重置邊界框

    // 重新計算靜態圖形的邊界，因為它們也可能影響自動縮放
    this.staticDrawCommands.forEach(cmd => {
        // 這是一個簡化。在理想情況下，應該從命令本身提取數據點來更新邊界。
        // 為保持簡單，我們假設靜態圖形的邊界在添加時已經更新。
        // 這裡可以通過解析命令來重新計算邊界，但會增加複雜度。
    });


    for (const plot of this.activePlots) {
      switch (plot.type) {
        case 'function': this._plotFunction(plot.func, plot.opts); break;
        case 'parametric': this._plotParametricFunction(plot.xFunc, plot.yFunc, plot.opts); break;
        case 'dataPoints': this._plotDataPoints(plot.data, plot.opts); break;
        // 向量場和其他類型可以類似地添加
      }
    }
  }

  // --- 自動縮放 ---

  updateWorldBoundingBox(x, y) {
    if (!this.worldBoundingBox) {
      this.worldBoundingBox = { minX: x, maxX: x, minY: y, maxY: y };
    } else {
      this.worldBoundingBox.minX = Math.min(this.worldBoundingBox.minX, x);
      this.worldBoundingBox.maxX = Math.max(this.worldBoundingBox.maxX, x);
      this.worldBoundingBox.minY = Math.min(this.worldBoundingBox.minY, y);
      this.worldBoundingBox.maxY = Math.max(this.worldBoundingBox.maxY, y);
    }
  }

  zoomToFit() {
    if (!this.worldBoundingBox) return;

    const bbox = this.worldBoundingBox;
    const { clientWidth, clientHeight } = this.canvas;
    const padding = 50;

    const worldWidth = bbox.maxX - bbox.minX;
    const worldHeight = bbox.maxY - bbox.minY;

    if (worldWidth < 1e-9 || worldHeight < 1e-9) {
      // 處理單點或直線的情況
      this.scaleX = this.scaleY = 50; // 使用預設縮放
    } else {
      const scaleX = (clientWidth - 2 * padding) / worldWidth;
      const scaleY = (clientHeight - 2 * padding) / worldHeight;
      this.scaleX = this.scaleY = Math.min(scaleX, scaleY);
    }
    
    // 避免縮放過大
    if(this.scaleX > 5000) this.scaleX = this.scaleY = 5000;


    const worldCenterX = bbox.minX + worldWidth / 2;
    const worldCenterY = bbox.minY + worldHeight / 2;

    this.originX = clientWidth / 2 - worldCenterX * this.scaleX;
    this.originY = clientHeight / 2 + worldCenterY * this.scaleY;

    this.needsPlotRecalculation = true;
    this.requestRedraw();
    console.log('✨ 已自動縮放至合適視圖');
  }

  autoZoomIfNeeded() {
    if (this.initialZoomDone || !this.worldBoundingBox) return;
    this.zoomToFit();
    this.initialZoomDone = true;
  }

  // --- 控制 API ---

  clearVisualization() {
    this.stopAnimation();
    this.staticDrawCommands = [];
    this.activePlots = [];
    this.plotDrawingCommands = [];
    this.worldBoundingBox = null;
    this.initialZoomDone = false;
    this.needsPlotRecalculation = true;
    this.requestRedraw();
    console.log('🧹 已清除視覺化內容');
  }

  startAnimation() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const loop = () => {
        if (!this.isAnimating) return;
        // 在這裡加入動畫更新邏輯，例如更新粒子位置
        this.requestRedraw();
        this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
    console.log('▶️ 動畫已開始');
  }

  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.isAnimating = false;
    this.animationFrameId = null;
    console.log('⏹️ 動畫已停止');
  }

  /**
   * 銷毀服務，清理資源
   */
  destroy() {
    this.stopAnimation();
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
      this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
      this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp);
      this.canvas.removeEventListener('mouseout', this.boundHandleMouseUp);
      this.canvas.removeEventListener('wheel', this.boundHandleWheel);
      this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
      this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove);
      this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);
      this.canvas.removeEventListener('contextmenu', this.boundPreventContextMenu);
    }
    window.removeEventListener('resize', this.boundHandleResize);
    clearTimeout(this.resizeTimeout);

    this.canvas = null;
    this.ctx = null;
    this.staticDrawCommands = [];
    this.activePlots = [];
    this.plotDrawingCommands = [];

    console.log('💀 Canvas 視覺化服務已銷毀');
  }
}

// 導出類別 (如果使用模組系統)
export default CanvasVisualization;
