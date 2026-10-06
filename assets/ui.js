/* ============================================================
 * 斩妖·修仙录 · ui.js
 * Canvas 即时模式 UI 工具（无 DOM，浏览器/微信小游戏通用）
 * - 点击命中：按下→抬起 距离 < 24px 视为点按
 * - 滚动区：纵向拖动 / 滚轮
 * - 弹窗层级：后绘制者命中优先（逆序检测）
 * 经典脚本，挂 window.XUI
 * ============================================================ */

'use strict';

var XUI = (function () {

  var ctx = null;
  var nowT = 0;

  /* ---------- 指针状态 ---------- */
  var ptr = { x: -1, y: -1, down: false };
  var downPt = null;          /* {x,y} 按下位置 */
  var downId = null;          /* 按下时命中的控件 id */
  var downIsScroll = false;   /* 按下落在滚动区 */
  var scrolled = false;       /* 本次按下已发生拖动 */
  var taps = [];              /* 待消费的 tap 事件队列 */
  var frameTaps = [];         /* 本帧可见的 tap */

  var rects = [];             /* 本帧注册的可点矩形 {id,x,y,w,h,scroll} */
  var scrollStates = {};      /* id → {off, contentH, dragging, lastY, lastT, v} */
  var inputScopes = [];
  var scrollCandidate = null;
  var hotId = null;           /* 当前按压中的控件（反馈用） */
  var pressT = 0;             /* 按下时刻（按压动画） */

  /* ---------- 颜色 ---------- */
  var C = {
    paper: '#f4ecdc',
    paperHi: 'rgba(244,236,220,0.94)',
    ink: '#2f2a24',
    ink55: 'rgba(47,42,36,0.55)',
    ink30: 'rgba(47,42,36,0.30)',
    ink14: 'rgba(47,42,36,0.14)',
    cinnabar: '#b03a30',
    gold: '#c9a05a',
    goldDeep: '#8a6a30',
    indigo: '#3d4a5c'
  };

  /* ---------- 字体 ---------- */
  var SERIF = '"Songti SC","STSong","Noto Serif SC",serif';
  var SANS = '"PingFang SC","Microsoft YaHei",sans-serif';
  function fSerif(size, weight) {
    return (weight ? weight + ' ' : '') + size + 'px ' + SERIF;
  }
  function fSans(size, weight) {
    return (weight ? weight + ' ' : '') + size + 'px ' + SANS;
  }

  /* ============================================================
   * 输入（由 main.js 从 canvas 事件喂入，逻辑坐标 750×1334）
   * ============================================================ */
  function contains(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  function topHit(x, y) {
    for (var i = rects.length - 1; i >= 0; i--) if (contains(rects[i], x, y)) return rects[i];
    return null;
  }
  function hitTest(x, y, wantScroll) {
    for (var i = rects.length - 1; i >= 0; i--) {
      var r = rects[i];
      if (!contains(r, x, y)) continue;
      if (wantScroll && r.blockScroll) return null;
      if (!!r.scroll === !!wantScroll) return r;
    }
    return null;
  }
  function beginDrag(id, y, startTime) {
    downId = id; downIsScroll = true; hotId = null;
    var st = _scrollState(id);
    st.dragging = true; st.lastY = y; st.lastT = startTime == null ? nowT : startTime; st.v = 0;
  }
  function pointerDown(x, y) {
    ptr.x = x; ptr.y = y; ptr.down = true;
    downPt = { x: x, y: y };
    scrolled = false; scrollCandidate = null;
    var r = topHit(x, y);
    if (r && r.scroll) { beginDrag(r.id, y); return true; }
    if (r) {
      downId = r.id; downIsScroll = false; hotId = r.id; pressT = nowT;
      scrollCandidate = r.scrollParent || null;
      return true;
    }
    downId = null; hotId = null;
    return false;
  }

  function pointerMove(x, y) {
    ptr.x = x; ptr.y = y;
    if (!ptr.down) return;
    if (downPt && Math.abs(y - downPt.y) > 10) {
      scrolled = true;
      if (scrollCandidate && !downIsScroll) beginDrag(scrollCandidate, downPt.y, pressT);
    }
    if (downIsScroll && downId) {
      var st = scrollStates[downId];
      if (st && st.dragging) {
        var dy = st.lastY - y;
        st.off = Math.max(0, Math.min(st.contentH, st.off + dy));
        st.v = dy / Math.max(0.016, nowT - st.lastT);
        st.lastY = y;
        st.lastT = nowT;
      }
    }
  }

  function pointerUp(x, y) {
    ptr.x = x; ptr.y = y;
    ptr.down = false;
    if (downIsScroll && downId && scrollStates[downId]) {
      scrollStates[downId].dragging = false;
    }
    if (downId && !downIsScroll && !scrolled && downPt) {
      var dx = x - downPt.x, dy = y - downPt.y;
      var releasedOn = topHit(x, y);
      if (dx * dx + dy * dy < 24 * 24 && releasedOn && releasedOn.id === downId) taps.push(downId);
    }
    downId = null;
    downIsScroll = false;
    scrollCandidate = null;
    hotId = null;
  }

  function cancelPointer() {
    ptr.down = false; downPt = null; downId = null; downIsScroll = false;
    scrollCandidate = null; hotId = null; taps.length = 0; frameTaps.length = 0;
    for (var id in scrollStates) { scrollStates[id].dragging = false; scrollStates[id].v = 0; }
  }

  function wheel(x, y, dy) {
    /* 桌面滚轮：命中滚动区则滚动 */
    var sc = hitTest(x, y, true);
    if (sc) {
      var st = _scrollState(sc.id);
      st.off = Math.max(0, Math.min(st.contentH, st.off + dy * 3));
    }
  }

  /* ============================================================
   * 帧流程
   * ============================================================ */
  function beginFrame(c, dt) {
    if (ctx !== c) clearTextLayoutCache();
    ctx = c;
    nowT += (typeof dt === 'number' && dt > 0 && dt < 1) ? dt : 0.016;
    frameTaps = taps.splice(0, taps.length);
    rects.length = 0;
    inputScopes.length = 0;
  }

  /* 注册一个可点区域（用于非按钮的自绘控件，如页签） */
  function register(id, x, y, w, h) {
    var scope = inputScopes.length ? inputScopes[inputScopes.length - 1] : null;
    var parent = null;
    if (scope) {
      y -= scope.off;
      var right = Math.min(x + w, scope.x + scope.w), bottom = Math.min(y + h, scope.y + scope.h);
      x = Math.max(x, scope.x); y = Math.max(y, scope.y);
      w = right - x; h = bottom - y; parent = scope.id;
      if (w <= 0 || h <= 0) return;
    }
    rects.push({ id: id, x: x, y: y, w: w, h: h, scrollParent: parent });
  }
  function beginScroll(st) { inputScopes.push(st.inputView); }
  function endScroll() { inputScopes.pop(); }

  function tapped(id) { return frameTaps.indexOf(id) >= 0; }
  function isPressed(id) { return hotId === id && ptr.down; }

  function _scrollState(id) {
    if (!scrollStates[id]) {
      scrollStates[id] = { off: 0, contentH: 0, dragging: false, lastY: 0, lastT: 0, v: 0 };
    }
    return scrollStates[id];
  }

  /* ============================================================
   * 基础绘制
   * ============================================================ */
  function panel(x, y, w, h, opt) {
    opt = opt || {};
    ctx.save();
    ctx.shadowColor = 'rgba(47,42,36,0.18)';
    ctx.shadowBlur = opt.flat ? 0 : 10;
    ctx.shadowOffsetY = opt.flat ? 0 : 3;
    XD.roundRectPath(ctx, x, y, w, h, opt.r == null ? 16 : opt.r);
    ctx.fillStyle = opt.fill || C.paperHi;
    ctx.fill();
    ctx.restore();
    if (!opt.noBorder) {
      XD.roundRectPath(ctx, x, y, w, h, opt.r == null ? 16 : opt.r);
      ctx.strokeStyle = opt.border || 'rgba(47,42,36,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function text(str, x, y, opt) {
    opt = opt || {};
    ctx.font = opt.serif === false ? fSans(opt.size || 24, opt.weight)
                                   : fSerif(opt.size || 24, opt.weight);
    ctx.textAlign = opt.align || 'center';
    ctx.textBaseline = opt.baseline || 'middle';
    ctx.fillStyle = opt.color || C.ink;
    if (opt.maxW) {
      var lines = wrap(str, opt.maxW, opt.size || 24, opt.serif === false, opt.weight);
      for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, y + i * (opt.lineH || (opt.size || 24) * 1.4));
      }
      return lines.length;
    }
    ctx.fillText(str, x, y);
    return 1;
  }

  function textW(str, size, noSerif, weight) {
    ctx.font = noSerif ? fSans(size, weight) : fSerif(size, weight);
    return ctx.measureText(str).width;
  }

  // Cache only line layout, never pixels, time, prices or game state.
  var TEXT_CACHE_LIMIT = 128;
  var TEXT_CACHE_MAX_LENGTH = 2048;
  var TEXT_CACHE_BUDGET = 32768;
  var textLayouts = new Map();
  var textLayoutUnits = 0;
  function clearTextLayoutCache() { textLayouts.clear(); textLayoutUnits = 0; }
  function textCacheInfo() {
    return {entries: textLayouts.size, units: textLayoutUnits, limit: TEXT_CACHE_LIMIT,
      maxTextLength: TEXT_CACHE_MAX_LENGTH, budget: TEXT_CACHE_BUDGET};
  }
  function textLayoutKey(str, maxW) {
    function prop(object, key) { var value = object && object[key]; return typeof value === 'string' ? value : ''; }
    var root = typeof document !== 'undefined' ? document.documentElement : null;
    // Transform, color, alignment and baseline do not change measured line width.
    return JSON.stringify([ctx.font, str, maxW, prop(ctx, 'direction'), prop(ctx, 'fontKerning'),
      prop(ctx, 'fontStretch'), prop(ctx, 'fontVariantCaps'), prop(ctx, 'letterSpacing'),
      prop(ctx, 'wordSpacing'), prop(ctx, 'textRendering'), prop(ctx, 'lang'),
      prop(ctx.canvas, 'lang'), prop(ctx.canvas, 'dir'), prop(root, 'lang'), prop(root, 'dir')]);
  }
  if (typeof document !== 'undefined' && document.fonts) {
    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loading', clearTextLayoutCache);
      document.fonts.addEventListener('loadingdone', clearTextLayoutCache);
      document.fonts.addEventListener('loadingerror', clearTextLayoutCache);
    }
    if (document.fonts.ready && typeof document.fonts.ready.then === 'function')
      document.fonts.ready.then(clearTextLayoutCache, clearTextLayoutCache);
  }

  function fontsLoading() {
    return typeof document !== 'undefined' && document.fonts && document.fonts.status === 'loading';
  }

  function wrap(str, maxW, size, noSerif, weight) {
    ctx.font = noSerif ? fSans(size, weight) : fSerif(size, weight);
    var canCache = typeof str === 'string' && str.length <= TEXT_CACHE_MAX_LENGTH &&
      typeof maxW === 'number' && isFinite(maxW) && maxW > 0 && !fontsLoading();
    var key = canCache ? textLayoutKey(str, maxW) : null;
    if (key !== null && textLayouts.has(key)) {
      var hit = textLayouts.get(key);
      textLayouts.delete(key); textLayouts.set(key, hit); // Least-recently-used eviction.
      return hit.lines.slice(); // Preserve the old API's independently mutable results.
    }
    var lines = [];
    var cur = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        lines.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    if (key !== null && !fontsLoading()) {
      // Account for both source/key text and line-array overhead; not an unbounded log.
      var units = key.length + str.length + lines.length * 4;
      if (units <= TEXT_CACHE_BUDGET) {
        while (textLayouts.size && (textLayouts.size >= TEXT_CACHE_LIMIT || textLayoutUnits + units > TEXT_CACHE_BUDGET)) {
          var oldest = textLayouts.keys().next().value;
          textLayoutUnits -= textLayouts.get(oldest).units; textLayouts.delete(oldest);
        }
        textLayouts.set(key, {lines: lines.slice(), units: units}); textLayoutUnits += units;
      }
    }
    return lines;
  }

  function bar(x, y, w, h, frac, opt) {
    opt = opt || {};
    XD.roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = opt.bg || C.ink14;
    ctx.fill();
    var f = Math.max(0, Math.min(1, frac));
    if (f > 0) {
      // A native-sized thin bar can be <3 logical units in landscape.
      // Canvas arcTo rejects negative radii; retain a positive inner track.
      var inset = Math.min(1.5, h / 4), innerH = h - inset * 2;
      XD.roundRectPath(ctx, x + inset, y + inset, Math.max(innerH, (w - inset * 2) * f), innerH, innerH / 2);
      ctx.fillStyle = opt.fill || C.gold;
      ctx.fill();
    }
    if (opt.border !== false) {
      XD.roundRectPath(ctx, x, y, w, h, h / 2);
      ctx.strokeStyle = opt.border || 'rgba(47,42,36,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ---------- 按钮 ----------
   * opt: { label, sub, size, disabled, style: primary|gold|ghost|danger,
   *        badge, r }  返回是否被点按 */
  function button(id, x, y, w, h, opt) {
    opt = opt || {};
    register(id, x, y, w, h);
    var dis = !!opt.disabled;
    var pressed = isPressed(id) && !dis;
    var style = opt.style || 'ghost';
    var sc = pressed ? 0.96 : 1;
    var cx = x + w / 2, cy = y + h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);

    var fills = {
      primary: ['#b23e33', '#a83428'],
      gold: ['#d8b97e', '#c9a05a'],
      ghost: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.55)'],
      danger: ['#b03a30', '#8f2b23'],
      dark: ['rgba(47,42,36,0.9)', 'rgba(47,42,36,0.9)']
    };
    var pair = fills[style] || fills.ghost;
    var txtCol = (style === 'ghost' || style === 'gold') ? C.ink : C.paper;

    ctx.shadowColor = 'rgba(47,42,36,0.22)';
    ctx.shadowBlur = pressed ? 3 : 8;
    ctx.shadowOffsetY = pressed ? 1 : 3;
    XD.roundRectPath(ctx, x, y, w, h, opt.r == null ? Math.min(999, h / 2) : opt.r);
    if (dis) {
      ctx.fillStyle = 'rgba(47,42,36,0.26)';
    } else {
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, pair[0]);
      g.addColorStop(1, pair[1]);
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';

    if (style === 'ghost' || style === 'gold') {
      XD.roundRectPath(ctx, x, y, w, h, opt.r == null ? Math.min(999, h / 2) : opt.r);
      ctx.strokeStyle = dis ? 'rgba(47,42,36,0.3)'
        : (style === 'gold' ? 'rgba(138,106,48,0.7)' : 'rgba(47,42,36,0.55)');
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    var mainSize = opt.size || Math.min(26, h * 0.44);
    if (opt.sub) {
      text(opt.label, cx, cy - h * 0.16, { size: mainSize, color: dis ? '#56514b' : txtCol, weight: 700 });
      text(opt.sub, cx, cy + h * 0.22, { size: opt.subSize || Math.max(16, mainSize * 0.62), color: dis ? '#56514b' : txtCol, serif: false });
    } else {
      text(opt.label, cx, cy, { size: mainSize, color: dis ? '#56514b' : txtCol, weight: 700 });
    }
    ctx.restore();

    if (opt.badge) {
      ctx.fillStyle = C.cinnabar;
      ctx.beginPath();
      ctx.arc(x + w - 6, y + 6, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    return !dis && tapped(id);
  }

  /* ---------- 状态 chip（轻量信息胶囊） ----------
   * 返回下一个 x 坐标，便于连续排布 */
  function chip(x, y, txt, opt) {
    opt = opt || {};
    var size = opt.size || 17;
    var w = textW(txt, size, true, 600) + 24;
    var h = opt.h || 30;
    XD.roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = opt.fill || 'rgba(47,42,36,0.08)';
    ctx.fill();
    if (opt.stroke) {
      XD.roundRectPath(ctx, x, y, w, h, h / 2);
      ctx.strokeStyle = opt.stroke; ctx.lineWidth = 1.2; ctx.stroke();
    }
    text(txt, x + w / 2, y + h / 2 + 1, { size: size, color: opt.color || C.ink55, serif: false, weight: 600 });
    return x + w + 6;
  }

  /* ---------- 页内标题行 ---------- */
  function sectionHeader(px, py, pw, title, rightTxt, titleColor) {
    text(title, px + 18, py + 24, { size: 22, weight: 700, align: 'left', color: titleColor || C.cinnabar });
    if (rightTxt) text(rightTxt, px + pw - 18, py + 24, { size: 16, color: C.ink30, align: 'right', serif: false });
  }

  /* ---------- 滚动区 ----------
   * contentH：内容总高；返回本帧可视偏移。
   * 用法：var sc = scrollArea(id,...); ctx.save(); clip; 用 -sc.off 平移绘制; restore */
  function scrollArea(id, x, y, w, h, contentH) {
    var st = _scrollState(id);
    rects.push({ id: id, x: x, y: y, w: w, h: h, scroll: true });
    st.contentH = Math.max(0, contentH - h);
    /* 惯性 */
    if (!st.dragging && Math.abs(st.v) > 30) {
      st.off = Math.max(0, Math.min(st.contentH, st.off + st.v * 0.016));
      st.v *= 0.92;
      if (Math.abs(st.v) < 30) st.v = 0;
    }
    /* 橡皮筋回弹 */
    if (st.off > st.contentH) st.off = st.contentH;
    st.inputView = {id: id, x: x, y: y, w: w, h: h, off: st.off};
    return st;
  }

  /* ---------- 弹窗底幕 + 卡片（w/h 随动态画布传入） ---------- */
  function modalBackdrop(id, w, h) {
    var W = w || 750, H = h || 1334;
    rects.push({ id: id, x: 0, y: 0, w: W, h: H, blockScroll: true });
    ctx.fillStyle = 'rgba(47,42,36,0.5)';
    ctx.fillRect(0, 0, W, H);
    return tapped(id);
  }

  /* ---------- Toast（贴底部面板上方，不挡主视野） ---------- */
  var viewH = 1334;
  function setViewSize(w, h) { viewH = h; clearTextLayoutCache(); }
  var toastTop = 834, toastSize = 21;
  var toastBox = null;
  function setToastLayout(top, size, box) { toastTop = top; toastSize = size; toastBox = box || null; }
  var toasts = [];   /* {txt, t, born} */
  function toast(txt) {
    toasts.push({ txt: txt, t: 0, born: Date.now() });
    if (toasts.length > 2) toasts.shift();
  }
  function drawToasts(dt) {
    /* dt 防护：任何非数字/非正计时按默认帧步进 */
    var step = (typeof dt === 'number' && dt > 0 && dt < 1) ? dt : 0.016;
    var nowMs = Date.now();
    for (var i = toasts.length - 1; i >= 0; i--) {
      var tt = toasts[i];
      tt.t += step;
      /* 双保险：即使渲染计时被污染，真实时间超 2.4s 一律清除，
         绝不允许 toast 变成常驻贴图 */
      if (!(tt.t <= 1.8) || (tt.born && nowMs - tt.born > 2400)) { toasts.splice(i, 1); continue; }
      var a = tt.t < 0.15 ? tt.t / 0.15 : (tt.t > 1.45 ? (1.8 - tt.t) / 0.35 : 1);
      if (toastBox) {
        // Use the existing status row; a toast never covers enemy names or controls.
        // Only the newest message is shown in this compact row. Full dialogs stay scrollable.
        if (i !== toasts.length - 1) continue;
        var room = Math.max(1, toastBox.w - toastSize * 1.5);
        var compactLines = wrap(tt.txt, room - textW('…', toastSize, true, 500), toastSize, true, 500);
        var label = (compactLines[0] || '') + (compactLines.length > 1 ? '…' : '');
        ctx.save(); ctx.beginPath(); ctx.rect(toastBox.x, toastBox.y, toastBox.w, toastBox.h); ctx.clip();
        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(47,42,36,0.92)';
        ctx.fillRect(toastBox.x, toastBox.y, toastBox.w, toastBox.h);
        text(label, toastBox.x + toastBox.w / 2, toastBox.y + toastBox.h / 2,
          {size: toastSize, color: C.paper, serif: false, weight: 500});
        ctx.restore(); continue;
      }
      var w = Math.min(690, textW(tt.txt, toastSize, false, 600) + 56);
      var lines = wrap(tt.txt, w - 40, toastSize, true, 500);
      var h = lines.length * toastSize * 1.4 + 24;
      var x = 375 - w / 2;
      var y = toastTop - h - i * (h + 10);
      ctx.save();
      ctx.globalAlpha = a;
      XD.roundRectPath(ctx, x, y, w, h, 18);
      ctx.fillStyle = 'rgba(47,42,36,0.82)';
      ctx.fill();
      text(tt.txt, 375, y + 12, { size: toastSize, maxW: w - 40, lineH: toastSize * 1.4, baseline: 'top', color: C.paper, serif: false, weight: 500 });
      ctx.restore();
    }
  }

  return {
    setToastLayout: setToastLayout,
    C: C,
    fSerif: fSerif,
    fSans: fSans,
    beginFrame: beginFrame,
    register: register,
    tapped: tapped,
    isPressed: isPressed,
    pointerDown: pointerDown,
    pointerMove: pointerMove,
    pointerUp: pointerUp,
    cancelPointer: cancelPointer,
    wheel: wheel,
    panel: panel,
    text: text,
    textW: textW,
    wrap: wrap,
    clearTextLayoutCache: clearTextLayoutCache, textCacheInfo: textCacheInfo,
    bar: bar,
    button: button,
    chip: chip,
    sectionHeader: sectionHeader,
    scrollArea: scrollArea,
    beginScroll: beginScroll, endScroll: endScroll,
    modalBackdrop: modalBackdrop,
    toast: toast,
    setViewSize: setViewSize,
    drawToasts: drawToasts
  };
})();
