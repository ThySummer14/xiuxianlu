/* ============================================================
 * 斩妖·修仙录 · platform.js
 * 平台抽象层：浏览器 / 微信小游戏 双端统一接口 XP
 * - 屏幕 canvas 与 DPR/视口缩放
 * - 本地存储 / 离屏 canvas / AudioContext
 * - 前后台切换回调 / 震动反馈
 * 依赖：无（最先加载）
 * ============================================================ */

'use strict';

var XP = (function () {

  var isWx = (typeof wx !== 'undefined') && !!wx.getSystemInfo &&
             !!wx.createCanvas;

  var screenCv = null;
  var dpr = 1;
  var vw = 375;
  var vh = 667;
  var safeTop = 0;
  var safeBottom = 0;

  var showCbs = [];
  var hideCbs = [];
  var resizeCbs = [];

  /* ---------- 屏幕 canvas 与尺寸 ---------- */
  if (isWx) {
    screenCv = wx.createCanvas();          /* 第一次创建 = 上屏 canvas */
    var sys = {};
    try { sys = wx.getSystemInfoSync(); } catch (e) { sys = {}; }
    dpr = Math.max(1, Math.min(3, sys.pixelRatio || 2));
    vw = sys.windowWidth || 375;
    vh = sys.windowHeight || 667;
    safeTop = sys.statusBarHeight || 0;
    if (sys.safeArea && typeof sys.safeArea.top === 'number') {
      safeTop = sys.safeArea.top;
      safeBottom = Math.max(0, (sys.screenHeight || vh) - sys.safeArea.bottom);
    }
    try {
      wx.onWindowResize(function (res) {
        vw = res.windowWidth || vw;
        vh = res.windowHeight || vh;
        for (var i = 0; i < resizeCbs.length; i++) resizeCbs[i]();
      });
    } catch (e2) { /* 旧基础库忽略 */ }
    try {
      wx.onShow(function () { _fire(showCbs); });
      wx.onHide(function () { _fire(hideCbs); });
    } catch (e3) { /* 忽略 */ }
  } else {
    /* 浏览器：canvas 由 index.html 提供，id=game */
    if (typeof document !== 'undefined') {
      screenCv = document.getElementById('game');
      /* 标签页可见性 → 前后台回调 */
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') _fire(hideCbs);
        else _fire(showCbs);
      });
    }
    if (typeof window !== 'undefined') {
      function readWebViewport() {
        var vv = window.visualViewport;
        vw = (vv && vv.width) || window.innerWidth || vw;
        vh = (vv && vv.height) || window.innerHeight || vh;
        // env() follows browser chrome, display cutouts and gesture navigation.
        if (document.body && window.getComputedStyle) {
          var probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
          document.body.appendChild(probe);
          var style = window.getComputedStyle(probe);
          safeTop = parseFloat(style.paddingTop) || 0;
          safeBottom = parseFloat(style.paddingBottom) || 0;
          probe.remove();
        }
        if (typeof location !== 'undefined' && location.search) {
          var top = location.search.match(/[?&]top=(\d+)/);
          if (top) safeTop = Math.max(safeTop, parseInt(top[1], 10) || 0);
        }
      }
      readWebViewport();
      function onWebResize() { readWebViewport(); _fire(resizeCbs); }
      window.addEventListener('resize', onWebResize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', onWebResize);
    }
    /* URL ?top=NN 可强制下移 HUD（小红书容器内嵌时用） */
    if (typeof location !== 'undefined' && location.search) {
      var m = location.search.match(/[?&]top=(\d+)/);
      if (m) safeTop = parseInt(m[1], 10) || 0;
    }
  }

  function _fire(cbs) {
    for (var i = 0; i < cbs.length; i++) {
      try { cbs[i](); } catch (e) { /* 单个回调异常不扩散 */ }
    }
  }

  function applyDpr() {
    if (!screenCv) return;
    screenCv.width = Math.round(vw * dpr);
    screenCv.height = Math.round(vh * dpr);
  }
  if (!isWx && screenCv) {
    var gdpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    dpr = Math.max(1, Math.min(3, gdpr));
    applyDpr();
  }

  /* ---------- 存储 ---------- */
  function storageGet(key) {
    try {
      if (isWx) return wx.getStorageSync(key) || null;
      return localStorage.getItem(key);
    } catch (e) { return null; }
  }
  function storageSet(key, val) {
    try {
      if (isWx) wx.setStorageSync(key, val);
      else localStorage.setItem(key, val);
      return true;
    } catch (e) { return false; }
  }
  function storageRemove(key) {
    try {
      if (isWx) wx.removeStorageSync(key);
      else localStorage.removeItem(key);
    } catch (e) { /* 忽略 */ }
  }

  /* Browser export is a download request, not proof that the user saved the file. */
  function canExportText() {
    return !isWx && typeof document !== 'undefined' && typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  }
  function exportText(name, text, cb) {
    if (!canExportText()) { cb(new Error('unsupported')); return; }
    var url = null, link = null;
    try {
      url = URL.createObjectURL(new Blob([text], {type: 'application/json;charset=utf-8'}));
      link = document.createElement('a');
      link.href = url; link.download = name; link.style.display = 'none';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      cb(null);
    } catch (e) {
      if (link && link.remove) link.remove();
      if (url) URL.revokeObjectURL(url);
      cb(e);
    }
  }

  var activeSavePicker = null;
  function canImportText() {
    return !isWx && typeof document !== 'undefined' && typeof FileReader !== 'undefined';
  }
  function readSaveFile(cb) {
    if (!canImportText()) { cb(new Error('unsupported')); return; }
    if (activeSavePicker) activeSavePicker.remove();
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json'; input.style.display = 'none';
    activeSavePicker = input;
    function cleanup() { input.remove(); if (activeSavePicker === input) activeSavePicker = null; }
    input.oncancel = function () { cleanup(); cb(null, null); };
    input.onchange = function () {
      var file = input.files && input.files[0]; cleanup();
      if (!file) { cb(null, null); return; }
      if (file.size > 1024 * 1024) { cb(new Error('too-large')); return; }
      var reader = new FileReader();
      reader.onload = function () { cb(null, String(reader.result)); };
      reader.onerror = function () { cb(new Error('read-failed')); };
      reader.readAsText(file, 'UTF-8');
    };
    document.body.appendChild(input);
    try { input.click(); } catch (e) { cleanup(); cb(e); }
  }

  /* ---------- 离屏 canvas（境界卡用） ---------- */
  function createCanvas(w, h) {
    var cv = isWx ? wx.createCanvas()
                  : document.createElement('canvas');
    if (w) cv.width = w;
    if (h) cv.height = h;
    return cv;
  }

  /* ---------- 音频 ---------- */
  function createAudioContext() {
    try {
      if (isWx && wx.createWebAudioContext) return wx.createWebAudioContext();
      var Ctor = (typeof window !== 'undefined') &&
                 (window.AudioContext || window.webkitAudioContext);
      return Ctor ? new Ctor() : null;
    } catch (e) { return null; }
  }

  /* ---------- 震动（轻反馈，失败静默） ---------- */
  function vibrate(kind) {
    try {
      if (isWx) {
        if (kind === 'long') wx.vibrateLong({ type: 'heavy' });
        else wx.vibrateShort({ type: kind === 'medium' ? 'medium' : 'light' });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(kind === 'long' ? 60 : 12);
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 保存到相册（微信原生能力，浏览器降级） ---------- */
  function saveImageToPhotosAlbum(dataUri, cb) {
    if (!isWx) { cb(new Error('browser')); return; }
    var fs = wx.getFileSystemManager();
    var path = wx.env.USER_DATA_PATH + '/realm_card.png';
    var b64 = dataUri.split(',')[1];
    fs.writeFile({
      filePath: path,
      data: b64,
      encoding: 'base64',
      success: function () {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: function () { cb(null); },
          fail: function (err) { cb(err); }
        });
      },
      fail: function (err) { cb(err); }
    });
  }

  return {
    isWx: isWx,
    canvas: screenCv,
    dpr: dpr,
    get vw() { return vw; },
    get vh() { return vh; },
    get safeTop() { return safeTop; },
    get safeBottom() { return safeBottom; },
    applyDpr: applyDpr,
    storageGet: storageGet,
    storageSet: storageSet,
    storageRemove: storageRemove,
    canExportText: canExportText, exportText: exportText,
    canImportText: canImportText, readSaveFile: readSaveFile,
    createCanvas: createCanvas,
    createAudioContext: createAudioContext,
    vibrate: vibrate,
    saveImageToPhotosAlbum: saveImageToPhotosAlbum,
    onShow: function (cb) { showCbs.push(cb); },
    onHide: function (cb) { hideCbs.push(cb); },
    onResize: function (cb) { resizeCbs.push(cb); },
    _fireShow: function () { _fire(showCbs); },
    _fireHide: function () { _fire(hideCbs); }
  };
})();
