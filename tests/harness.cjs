'use strict';
// Loads the production scripts in a deterministic, browser-shaped Node VM.
// Canvas is a no-op; this tests game behavior, not browser rendering quality.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const KEY = 'xiuxian_idle_v3';
function createGame(options = {}) {
  const storage = new Map();
  let storageFailure=options.failStorage || null;
  let now = options.now || 1800000000000;
  let seed = options.seed || 42;
  let frameCallback=null,rafTime=1;
  const downloads=[],objectUrls=new Map(),timers=[],images=[],imageDraws=[];
  const listeners={},canvasListeners={},viewportListeners={},fontListeners={},fontReady=[];
  const listen = target => (name,fn) => { (target[name] ||= []).push(fn); };
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const context = new Proxy({
    drawImage: (...args)=>imageDraws.push(args),
    measureText: function (text) { const size = parseFloat(String(this.font || '24px').match(/([\d.]+)px/)[1]); return {width: Array.from(String(text)).reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.55)*size,0)}; },
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  }, { get: (o, k) => k in o ? o[k] : noop });
  const canvas = { style: {}, width: 375, height: 667, getContext: () => context, addEventListener: listen(canvasListeners) };
  const FakeDate = class extends Date { static now() { return now; } };
  const sandbox = {
    console, Math: math, Date: FakeDate, performance: { now: () => now },
    setTimeout: options.downloads ? fn=>{timers.push(fn);} : noop, clearTimeout: noop, requestAnimationFrame: cb => { frameCallback=cb; },
    innerWidth: options.width || 375, innerHeight: options.height || 667, devicePixelRatio: 1,
    addEventListener: listen(listeners), navigator: {}, location: { search: '' },
    document: { documentElement: {lang:'zh-CN',dir:'ltr'}, getElementById: () => canvas, createElement: () => canvas, addEventListener: noop },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => { if(storageFailure&&storageFailure(k,v))throw new Error('QuotaExceededError'); storage.set(k, v); }, removeItem: k => storage.delete(k) },
  };
  if(options.fonts) sandbox.document.fonts={status:'loaded',addEventListener:listen(fontListeners),ready:{then:fn=>{fontReady.push(fn);}}};
  if(options.downloads) {
    sandbox.Blob=Blob;
    sandbox.URL={createObjectURL:blob=>{const url='blob:test-'+(objectUrls.size+1);objectUrls.set(url,blob);return url;},revokeObjectURL:url=>objectUrls.delete(url)};
    sandbox.document.body={appendChild:noop};
    sandbox.document.createElement=tag=>tag==='a'?{style:{},click(){downloads.push({name:this.download,blob:objectUrls.get(this.href)});},remove:noop}:canvas;
  }
  if (options.images) sandbox.Image=class { constructor(){images.push(this);this.width=1024;this.height=1536;this.naturalWidth=1024;this.naturalHeight=1536;} set src(value){this.url=value;} };
  if (options.visualViewport) sandbox.visualViewport={width:options.width||375,height:options.height||667,addEventListener:listen(viewportListeners)};
  sandbox.window = sandbox;
  if (options.save) storage.set(KEY, JSON.stringify({ v: 3, balanceVersion: 1, ts: now, ...options.save }));
  if(options.rawSave!==undefined)storage.set(KEY,options.rawSave);
  for(const [key,value] of Object.entries(options.storageEntries||{}))storage.set(key,value);
  vm.createContext(sandbox);
  for (const name of ['platform', 'balance', 'draw', 'ui', 'audio', 'main']) {
    let src = fs.readFileSync(path.join(root, 'assets', name + '.js'), 'utf8');
    if (options.source) src = options.source(name, src);
    if (options.fast && name === 'main' && !src.includes('sec, noRender')) src = src.replace('step: function (sec) {', 'step: function (sec, noRender) {').replace('render(per);', 'if (!noRender) render(per);');
    vm.runInContext(src, sandbox, { filename: name + '.js' });
  }
  // Start through the same title button used by the UI, with the save fixture.
  const button = sandbox.XUI.button;
  let start = !options.noStart;
  sandbox.XUI.button = (id, ...args) => id === 'start' && start ? (start = false, true) : button(id, ...args);
  sandbox.__test.step(0.001);
  sandbox.XUI.button = button;
  if (options.fast) {
    for (const key of Object.keys(sandbox.XD)) if (key.startsWith('draw')) sandbox.XD[key] = noop;
    for (const key of ['text','panel','bar','drawToasts','modalBackdrop']) sandbox.XUI[key] = noop;
  }
  const uiControls=new Map(),scrollViews=new Map(),uiTexts=[];
  const originalText=sandbox.XUI.text;
  sandbox.XUI.text=(text,x,y,opt)=>{uiTexts.push({text,x,y,opt});return originalText(text,x,y,opt);};
  const originalButton=sandbox.XUI.button,originalScroll=sandbox.XUI.scrollArea;
  sandbox.XUI.button=(id,x,y,w,h,opt)=>{uiControls.set(id,{x,y,w,h,opt});return originalButton(id,x,y,w,h,opt);};
  sandbox.XUI.scrollArea=(id,x,y,w,h,contentH)=>{const state=originalScroll(id,x,y,w,h,contentH);scrollViews.set(id,{x,y,w,h,state});return state;};
  const api = sandbox.__test;
  return {
    fontEvent: name => (fontListeners[name]||[]).forEach(fn=>fn()),
    fontsReady: () => {while(fontReady.length)fontReady.shift()();},
    images, imageDraws,
    downloads, flushTimers: () => {while(timers.length)timers.shift()();}, objectUrls,
    failWrites: predicate => {storageFailure=predicate;},
    api, XB: sandbox.XB, sandbox, storage, uiControls, scrollViews, uiTexts,
    resize: (w,h) => {sandbox.innerWidth=w;sandbox.innerHeight=h;if(sandbox.visualViewport){sandbox.visualViewport.width=w;sandbox.visualViewport.height=h;}(listeners.resize||[]).forEach(fn=>fn());uiControls.clear();scrollViews.clear();uiTexts.length=0;api.step(0);},
    canvasEvent: (name,event={}) => (canvasListeners[name]||[]).forEach(fn=>fn(event)),
    tap: id => { const old=sandbox.XUI.button; sandbox.XUI.button=(key,...args)=>key===id?true:old(key,...args); api.step(1e-9); sandbox.XUI.button=old; },
    state: () => api.state(),
    frame: ms => {now+=ms;rafTime+=ms;frameCallback(rafTime);return api.state();},
    step: sec => { now += sec * 1000; api.step(sec, options.fast); return api.state(); },
    save: () => JSON.parse(storage.get(KEY) || '{}'),
    show: sec => { sandbox.XP._fireHide(); now += sec * 1000; sandbox.XP._fireShow(); return api.state(); },
    render: () => api.step(0),
  };
}
module.exports = { createGame, KEY };
