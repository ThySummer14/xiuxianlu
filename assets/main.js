/* ============================================================
 * 斩妖·修仙录 · main.js  v3
 * 状态机（title → play）/ 全系统 / Canvas UI / 存档 / 离线结算
 * ------------------------------------------------------------
 * 系统：斩妖战斗（点击+连击+暴击+剑侍）· 打坐修为（主）·
 *       功法经书 ×7 · 坊市生意 · 装备掉落 · 灵气潮汐 · 奇遇 ·
 *       突破（小境界自动 / 大境界渡劫手动）· 轮回转世（道基）·
 *       离线闭关（前 2h 全额→24h 内 50%，修复旧版固定收益 bug）
 * 渲染：全 Canvas 即时 UI（XUI），逻辑分辨率 750×1334，
 *       无 DOM 依赖 → 可直迁微信小游戏
 * 依赖顺序：platform.js → balance.js → draw.js → ui.js →
 *           audio.js → main.js
 * ============================================================ */

'use strict';

(function () {

  /* 运行时报错采集（供测试钩子检查） */
  var G0 = typeof window !== 'undefined' ? window
         : (typeof GameGlobal !== 'undefined' ? GameGlobal : null);
  if (G0) {
    G0.__errs = G0.__errs || [];
    if (typeof window !== 'undefined') {
      window.addEventListener('error', function (e) {
        G0.__errs.push(String(e.message || e));
      });
    }
  }

  /* ---------- 常量 ---------- */
  var VIEW_W = 750;
  var VIEW_H = 1334;             /* 动态逻辑高度，resize 时重算 */
  var STORE_KEY = 'xiuxian_idle_v3';
  var LEGACY_KEY = 'xiuxian_idle_v1';
  var AUTOSAVE_SEC = 3;
  var MON_BASE_Y = 905;          /* 妖兽脚底基线，随 VIEW_H 重算 */
  var OFFLINE_MIN_GAP = 45;      /* 前后台切换结算最小间隔秒 */
  var SWING_GAP = 0.22;          /* 按住连斩间隔秒 */
  var H_MIN = 1150;              /* 逻辑高度夹取范围 */
  var H_MAX = 1760;

  /* ---------- 画布与视口 ---------- */
  var cv = XP.canvas;
  var ctx = cv.getContext('2d');
  var viewScale = 1;
  var viewOffsetX = 0;
  var viewOffsetY = 0;
  var hudTopL = 20;              /* 顶部 HUD 逻辑 y（避让胶囊/状态栏） */
  var safeBottomL = 0;

  function resize() {
    var dpr = XP.dpr;
    var cw = XP.vw;
    var ch = XP.vh;
    XP.applyDpr();
    cv.style && (cv.style.width = cw + 'px');
    cv.style && (cv.style.height = ch + 'px');
    /* 宽度贴合 + 逻辑高度自适应：画布铺满视口，不再信箱留白。
       矮胖窗口（桌面）以最小高度定缩放，左右由页面底色补白。 */
    viewScale = Math.min(cw / VIEW_W, ch / H_MIN);
    var logicalH = ch / viewScale;
    VIEW_H = Math.min(H_MAX, Math.max(H_MIN, logicalH));
    viewOffsetX = (cw - VIEW_W * viewScale) / 2;
    viewOffsetY = (ch - VIEW_H * viewScale) / 2;
    XD.setView(VIEW_W, VIEW_H);
    if (typeof XUI !== 'undefined' && XUI.setViewSize) XUI.setViewSize(VIEW_W, VIEW_H);
    MON_BASE_Y = VIEW_H - 430;
    if (monster) monster.y = MON_BASE_Y;
    /* 微信小游戏：顶部让出状态栏 + 胶囊按钮高度 */
    hudTopL = Math.min(160, Math.max(20,
      (XP.safeTop + (XP.isWx ? 46 : 4)) / viewScale));
    safeBottomL = Math.min(160, XP.safeBottom / viewScale);
    resize._dpr = dpr;
  }
  XP.onResize(resize);
  resize();

  /* ---------- 游戏状态 ---------- */
  var SCENE_TITLE = 'title';
  var SCENE_PLAY = 'play';
  var scene = SCENE_TITLE;

  var stones = 0;
  var exp = 0;
  var S = 0;                 /* 全局小境界序号 0..59 */
  var level = 1;

  var sj = 0;                /* 剑诀 */
  var ss = 0;                /* 剑侍 */
  var ls = 0;                /* 灵兽 */
  var tn = 0;                /* 吐纳术 */
  var gf = [];               /* 功法层数，下标对齐 XB.GONGFA */
  (function () { for (var i = 0; i < XB.GONGFA_COUNT; i++) gf.push(0); })();

  var eq = { sword: null, armor: null, talisman: null, pendant: null };
  var mk = [0, 0, 0, 0, 0];
  var dj = 0;                /* 道基 */
  var rb = 0;                /* 轮回次数 */
  var bond = 0;              /* 仙缘（机缘事件永久：修为 +3%/点） */
  var sgn = 0;               /* 剑心（机缘事件永久：点击伤害 +2%/点） */
  var best = 0;              /* 历史最高小境界 */
  var totalKills = 0;

  var monster = null;
  var slashes = [];
  var smokes = [];
  var floats = [];
  var bt = null;             /* 突破动画 { t, big, name } */
  var shakeT = 0;
  var dpsFloatT = 0;
  var dpsAccShow = 0;
  var nowSec = 0;

  var combo = { n: 0, t: 0 };          /* 连击：次数 / 距上次命中秒数 */
  var tide = { left: 0, next: 0 };     /* 灵气潮汐 */
  var hold = { active: false, x: 0, y: 0, last: 0 };
  var autoBtT = 0;                     /* 自动小突破检查计时 */

  var bgPrevBand = 0;
  var bgTrans = 1;

  var autosaveT = 0;
  var offlineResumeModal = null;
  var offlineInfo = null;    /* 离线结算弹窗数据 */
  var activeTab = 'cult';
  var questClaimed = {};
  var storySeen = {};
  var modal = null;          /* 'settings'|'confirm'|'realm'|'offline'|'fate'|'story' */
          /* 'settings'|'confirm'|'realm' */
  var resetArmed = false;
  var rebirthArmed = false;
  var rebirthArmT = 0;
  var resetArmT = 0;
  var hiddenAt = 0;
  var muted = false;

  var dropCount = 0;
  var fateCd = 30;           /* 奇遇最小保护期（开局 30s 不触发） */
  var fateEvent = null;      /* 当前选择型机缘事件 */
  var storyQueue = [];       /* 待弹出的境界剧情队列 */
  var storyRealm = -1;       /* 正在展示的剧情境界 */

  /* ---------- v4：魔窟妖塔 / 血量 / 宗门 ---------- */
  var mode = 'home';         /* 'home' 日常打坐 | 'tower' 魔窟历练 */
  var temperFloor = 1;
  var towerPlan = 'advance';
  var epipFrontier = 1;       /* 同一阻碍不能反复刷生死顿悟 */
  var towerFloor = 1;        /* 当前塔层（level 与其同步） */
  var towerBest = 1;         /* 历史最深 */
  var ph = 0;                /* 主角当前血量 */
  var monAtkT = 0;           /* 妖兽扑咬计时 */
  var injuryT = 0;           /* 重伤剩余秒 */
  var epip = 0;              /* 生死顿悟次数（永久 +5%/次，轮回不清） */
  var cmp = [];              /* 功法领悟点（斩妖实践积累） */
  (function () { for (var i = 0; i < XB.GONGFA_COUNT; i++) cmp.push(0); })();
  var mp = [0, 0, 0, 0, 0];  /* 坊市各店利润等级 */
  var sectId = '';           /* 宗门 id，'' 未拜师 */
  var sectLv = {};           /* 镇宗功法层数 artId→lv */
  var contrib = 0;           /* 贡献值 */
  var missions = [null, null, null]; /* 宗门任务槽 */
  var accStones = 0;         /* 累计获得灵石（任务统计） */
  var homeFateT = 55;        /* 日常机缘计时 */
  var breathT = 0;           /* 打坐呼吸浮动计时 */

  /* ---------- 派生数值 ---------- */
  function gLv(id) {
    for (var i = 0; i < XB.GONGFA.length; i++) {
      if (XB.GONGFA[i].id === id) return gf[i];
    }
    return 0;
  }
  function equipPowerTotal() {
    var sum = 0;
    for (var i = 0; i < XB.EQUIP_SLOTS.length; i++) {
      var it = eq[XB.EQUIP_SLOTS[i]];
      if (it) sum += it.power;
    }
    return sum;
  }

  function daoMult() { return XB.daoJiMult(dj); }

  /* ---------- 宗门加成 ---------- */
  function sectArtLv(artId) { return sectLv[artId] || 0; }
  function sectClick() {
    var v = 1;
    if (sectId === 'qingyuan') v *= 1.08;
    v *= 1 + 0.10 * sectArtLv('qy1');
    return v;
  }
  function sectDps() {
    var v = 1;
    v *= 1 + 0.12 * sectArtLv('wb1');
    return v;
  }
  function sectMed() {
    var v = 1;
    v *= 1 + 0.12 * sectArtLv('dt1');
    return v;
  }
  function sectAllExp() {
    var v = 1;
    v *= 1 + 0.08 * sectArtLv('dt2');
    v *= XB.epiphanyMult(epip);
    return v;
  }
  function sectCritRateBonus() { return 0.015 * sectArtLv('wb2'); }
  function sectCritDmgBonus() { return 0.6 * sectArtLv('qy2'); }
  function sectMarket() {
    var v = 1;
    if (sectId === 'tianshu') v *= 1.10;
    v *= 1 + 0.15 * sectArtLv('ts1');
    return v;
  }
  function sectStone() {
    var v = 1;
    if (sectId === 'tianshu') v *= 1.25;
    v *= 1 + 0.10 * sectArtLv('ts2');
    return v;
  }
  function sectInsight() { return sectId === 'wanbei' ? 1.4 : 1; }
  function sectHealMult() { return sectId === 'dantang' ? 1.5 : 1; }
  function injured() { return injuryT > 0; }
  function injPenalty() { return injured() ? XB.INJURE_PENALTY : 1; }
  function playerHpMax() {
    var armor = eq.armor ? eq.armor.power : 0;
    return XB.playerHpMax(S, armor, 1);
  }
  /* 领悟：斩妖实践加深对该功法的理解（并入 gEff） */
  function gEff(id) {
    for (var i = 0; i < XB.GONGFA.length; i++) {
      if (XB.GONGFA[i].id === id) {
        var e = XB.GONGFA[i].eff(gf[i]);
        /* id=='body' 的 eff 返回层数本身（供暴击暴伤直接加），领悟不适用 */
        if (id === 'body') return e;
        return e * XB.insightBonus(cmp[i]);
      }
    }
    return 1;
  }

  function expAllMult() { return gEff('dao') * daoMult() * XB.bondMult(bond) * sectAllExp(); }
  function medRate() {
    return XB.meditationRate(S, tn, gEff('breath') * gEff('dao') * sectMed(),
      daoMult(), tideMultMed()) * XB.bondMult(bond) * sectAllExp() * injPenalty();
  }
  function stoneMultAll() {
    return XB.stoneMult(gEff('gold'), daoMult(), tide.left > 0 ? XB.TIDE_STONE_MULT : 1);
  }
  function tideMultMed() { return tide.left > 0 ? XB.TIDE_MED_MULT : 1; }
  function tideMultExp() { return tide.left > 0 ? XB.TIDE_EXP_MULT : 1; }

  function clickDamage() {
    return (XB.swordJueDmg(sj) + equipPowerTotal()) *
           XB.beastMult(ls) * XB.realmMult(S) *
           gEff('sword') * daoMult() * XB.comboMult(combo.n) *
           XB.swordHeartMult(sgn) * sectClick() * injPenalty() *
           XB.epiphanyMult(epip);
  }
  function curDps() {
    return (XB.swordShiDps(ss) + equipPowerTotal()) *
           XB.realmMult(S) * gEff('shadow') * daoMult() *
           sectDps() * injPenalty() * XB.epiphanyMult(epip);
  }
  function curMarketRate() {
    return XB.marketRate(mk, S, gEff('map'), daoMult(), mp) * sectMarket() * marketEarningsMult();
  }
  function marketEarningsMult() {
    return gEff('gold') * (1 + .10 * sectArtLv('ts2')) * (tide.left > 0 ? XB.TIDE_STONE_MULT : 1);
  }
  function expNeed() { return XB.expNeed(S); }
  function critRate() {
    var body = gLv('body');
    return Math.min(XB.CRIT_CAP, XB.CRIT_BASE +
      XB.beastCrit(ls) + 0.015 * body + sectCritRateBonus());
  }
  function critMult() { return XB.CRIT_MULT + 0.25 * gLv('body') + sectCritDmgBonus(); }
  function totalPower() { return Math.round(clickDamage() + curDps() * 5); }
  function marketUnlocked() { return towerBest >= XB.MARKET_UNLOCK_LEVEL || S >= 4; }

  /* ---------- 存档 ---------- */
  function saveGame() {
    // The title screen has not loaded the saved character yet. Never overwrite it.
    if (scene !== SCENE_PLAY) return;
    try {
      XP.storageSet(STORE_KEY, JSON.stringify({
        v: 3, balanceVersion: XB.BALANCE_VERSION, stones: stones, exp: exp, S: S, level: level,
        sj: sj, ss: ss, ls: ls, tn: tn, gf: gf,
        eq: eq, mk: mk, mp: mp, dj: dj, rb: rb, best: best,
        bond: bond, sgn: sgn, storySeen: storySeen,
        towerFloor: towerFloor, towerBest: towerBest, towerPlan: towerPlan,
        epipFrontier: epipFrontier, ph: ph, injuryT: injuryT,
        epip: epip, cmp: cmp, sectId: sectId, sectLv: sectLv,
        contrib: contrib, missions: missions, accStones: accStones,
        kills: totalKills, muted: muted, questClaimed: questClaimed, ts: Date.now()
      }));
    } catch (e) { /* 静默 */ }
  }

  function safeNumber(value, fallback, max, integer) {
    var n = Number(value);
    if (!isFinite(n)) return fallback || 0;
    n = Math.max(0, Math.min(max == null ? 1e100 : max, n));
    return integer ? Math.floor(n) : n;
  }
  function backupRawSave(raw) {
    if (!raw) return;
    var key = STORE_KEY + '_backup';
    var previous = XP.storageGet(key);
    if (previous === raw) return;
    if (previous) XP.storageSet(STORE_KEY + '_previous', previous);
    XP.storageSet(key, raw);
  }
  // Only impossible/corrupt values are repaired; ordinary earned progress is retained.
  function normalizeSave(d) {
    var money = ['stones', 'exp', 'contrib', 'accStones'];
    for (var i = 0; i < money.length; i++) d[money[i]] = safeNumber(d[money[i]], 0);
    d.S = safeNumber(d.S, 0, XB.MAX_STAGE, true);
    d.best = Math.max(d.S, safeNumber(d.best, 0, XB.MAX_STAGE, true));
    var upgrades = ['sj', 'ss', 'ls', 'tn'];
    for (i = 0; i < upgrades.length; i++) d[upgrades[i]] = safeNumber(d[upgrades[i]], 0, (upgrades[i] === 'sj' || upgrades[i] === 'ss') ? 3000 : 1e12, true);
    var permanent = ['dj', 'rb', 'bond', 'sgn', 'kills'];
    for (i = 0; i < permanent.length; i++) d[permanent[i]] = safeNumber(d[permanent[i]], 0, 1e12, true);
    d.level = Math.max(1, safeNumber(d.level, 1, 3000, true));
    d.towerFloor = Math.max(1, safeNumber(d.towerFloor, d.level, 3000, true));
    d.towerBest = Math.max(d.towerFloor, safeNumber(d.towerBest, d.level, 3000, true));
    d.epipFrontier = Math.max(1, safeNumber(d.epipFrontier, d.towerFloor, 3000, true));
    d.epip = safeNumber(d.epip, 0, XB.EPIPHANY_MAX, true);
    d.injuryT = safeNumber(d.injuryT, 0, XB.INJURE_DUR);
    function levels(values, length, cap) {
      var result = [];
      for (var j = 0; j < length; j++) result.push(safeNumber(values && values[j], 0, cap, true));
      return result;
    }
    d.gf = levels(d.gf, XB.GONGFA_COUNT, 1e12);
    d.cmp = levels(d.cmp, XB.GONGFA_COUNT, XB.INSIGHT_CAP);
    d.mk = levels(d.mk, XB.MARKET_SHOPS.length, 1e12);
    d.mp = levels(d.mp, XB.MARKET_SHOPS.length, XB.MARKET_PROFIT_UP.length - 1);
    var cleanArts = {};
    for (i = 0; i < XB.SECTS.length; i++) for (var j = 0; j < XB.SECTS[i].arts.length; j++) {
      var artId = XB.SECTS[i].arts[j].id;
      var artLv = safeNumber(d.sectLv && d.sectLv[artId], 0, 1e12, true);
      if (artLv > 0) cleanArts[artId] = artLv;
    }
    d.sectLv = cleanArts;
    var cleanEquip = {};
    for (i = 0; i < XB.EQUIP_SLOTS.length; i++) {
      var slot = XB.EQUIP_SLOTS[i];
      var item = d.eq && d.eq[slot];
      if (item && item.name && typeof item.power === 'number' && isFinite(item.power) && item.power >= 0) {
        cleanEquip[slot] = {slot: slot, name: String(item.name), power: safeNumber(item.power, 0),
          qIdx: safeNumber(item.qIdx, 0, XB.QUALITIES.length - 1, true)};
      }
    }
    d.eq = cleanEquip;
    var maxHp = XB.playerHpMax(d.S, cleanEquip.armor ? cleanEquip.armor.power : 0, 1);
    d.ph = safeNumber(d.ph, maxHp, maxHp);
    if (d.ph <= 0 && d.injuryT <= 0) d.ph = maxHp;
    var missionKinds = XB.MISSION_KINDS.map(function (m) { return m.kind; });
    d.missions = [0, 1, 2].map(function (idx) {
      var m = d.missions && d.missions[idx];
      if (!m || missionKinds.indexOf(m.kind) < 0) return null;
      var keys = ['base', 'need', 'contrib', 'stones'];
      for (var k = 0; k < keys.length; k++) {
        var n = Number(m[keys[k]]);
        if (!isFinite(n) || n < 0 || n > 1e100) return null;
      }
      if (m.need <= 0 || (m.kind === 'realm' && m.base > d.S)) return null;
      return {kind: m.kind, base: Number(m.base), need: Number(m.need), contrib: Number(m.contrib),
        stones: Number(m.stones), runFrontier: !!m.runFrontier};
    });
    return d;
  }

  function loadGame() {
    try {
      var raw = XP.storageGet(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === 'object' && d.v === 3 && d.ts) {
          backupRawSave(raw);
          return normalizeSave(d);
        }
      }
      /* 旧版 v1/v2 档迁移 */
      var old = XP.storageGet(LEGACY_KEY);
      if (old) {
        var o = JSON.parse(old);
        if (o && typeof o === 'object' && o.ts) {
          backupRawSave(old);
          return normalizeSave(migrateLegacy(o));
        }
      }
    } catch (e) { backupRawSave(raw); }
    return null;
  }

  function migrateLegacy(o) {
    return {
      v: 3,
      stones: Number(o.stones) || 0,
      exp: 0,
      S: Math.min(XB.MAX_STAGE, Math.max(0, (Number(o.realm) || 0) * XB.STAGES_PER_REALM)),
      level: Math.max(1, Number(o.level) || 1),
      sj: Math.max(0, Number(o.sjLv) || 0),
      ss: Math.max(0, Number(o.ssLv) || 0),
      ls: Math.max(0, Number(o.lsLv) || 0),
      tn: 0, gf: null,
      eq: o.eq || null, mk: o.mk || null,
      dj: 0, rb: 0, best: 0, kills: 0,
      muted: false, ts: o.ts
    };
  }

  function clearSave() {
    XP.storageRemove(STORE_KEY);
    XP.storageRemove(LEGACY_KEY);
  }

  function applySave(d) {
    stones = Math.max(0, Number(d.stones) || 0);
    exp = Math.max(0, Number(d.exp) || 0);
    S = Math.min(XB.MAX_STAGE, Math.max(0, Number(d.S) || 0));
    if (!d.balanceVersion) exp *= XB.expNeed(S) / XB.legacyExpNeed(S);
    level = Math.max(1, Number(d.level) || 1);
    sj = Math.max(0, Number(d.sj) || 0);
    ss = Math.max(0, Number(d.ss) || 0);
    ls = Math.max(0, Number(d.ls) || 0);
    tn = Math.max(0, Number(d.tn) || 0);
    for (var i = 0; i < XB.GONGFA_COUNT; i++) {
      gf[i] = Math.max(0, (d.gf && Number(d.gf[i])) || 0);
    }
    eq = { sword: null, armor: null, talisman: null, pendant: null };
    if (d.eq && typeof d.eq === 'object') {
      for (var k = 0; k < XB.EQUIP_SLOTS.length; k++) {
        var sl = XB.EQUIP_SLOTS[k];
        var it = d.eq[sl];
        if (it && typeof it.power === 'number' && it.name) {
          eq[sl] = { slot: sl, name: String(it.name), power: it.power, qIdx: it.qIdx | 0 };
        }
      }
    }
    mk = [0, 0, 0, 0, 0];
    if (Array.isArray(d.mk)) {
      for (var j = 0; j < mk.length && j < d.mk.length; j++) {
        mk[j] = Math.max(0, Number(d.mk[j]) || 0);
      }
    }
    dj = Math.max(0, Number(d.dj) || 0);
    rb = Math.max(0, Number(d.rb) || 0);
    bond = Math.max(0, Number(d.bond) || 0);
    sgn = Math.max(0, Number(d.sgn) || 0);
    storySeen = (d.storySeen && typeof d.storySeen === 'object') ? d.storySeen : {};
    /* v4 字段（旧档缺失按默认值） */
    towerFloor = Math.max(1, Number(d.towerFloor) || Number(d.level) || 1);
    level = Math.max(level, towerFloor);
    towerBest = Math.max(towerFloor, Number(d.towerBest) || 1);
    level = towerFloor; /* 本世进度与历代最深纪录分开，轮回后不可跳回旧魔窟 */
    towerPlan = d.towerPlan === 'temper' ? 'temper' : 'advance';
    epipFrontier = Math.max(1, Number(d.epipFrontier) || towerFloor);
    epip = Math.max(0, Math.min(XB.EPIPHANY_MAX, Number(d.epip) || 0));
    sectId = typeof d.sectId === 'string' && XB.getSect(d.sectId) ? d.sectId : '';
    sectLv = (d.sectLv && typeof d.sectLv === 'object') ? d.sectLv : {};
    contrib = Math.max(0, Number(d.contrib) || 0);
    accStones = Math.max(0, Number(d.accStones) || 0);
    if (Array.isArray(d.cmp)) {
      for (var ci = 0; ci < cmp.length; ci++) cmp[ci] = Math.max(0, Number(d.cmp[ci]) || 0);
    }
    if (Array.isArray(d.mp)) {
      for (var mi = 0; mi < mp.length; mi++) mp[mi] = Math.max(0, Number(d.mp[mi]) || 0);
    }
    missions = [null, null, null];
    if (Array.isArray(d.missions)) {
      for (var qi = 0; qi < 3; qi++) if (d.missions[qi] && d.missions[qi].kind) missions[qi] = d.missions[qi];
    }
    ph = Math.max(0, Number(d.ph) || 0);
    injuryT = Math.max(0, Number(d.injuryT) || 0);
    mode = 'home';
    if (ph <= 0 && injuryT <= 0) ph = playerHpMax();
    best = Math.max(0, Number(d.best) || 0);
    totalKills = Math.max(0, Number(d.kills) || 0);
    questClaimed = (d.questClaimed && typeof d.questClaimed === 'object') ? d.questClaimed : {};
    muted = !!d.muted;
    XAudio.setMuted(muted);
    if (sectId) rollMissions(false);
  }

  /* ---------- 妖兽（v4：只存在于魔窟塔内） ---------- */
  function spawnMonster() {
    monAtkT = 0;  /* 每只妖兽都有完整起手，上一只的计时不偷袭下一层 */
    var boss = XB.isBoss(level);
    var types = XB.MONSTER_TYPES;
    var idx = Math.floor(XD.srand(level * 13 + 7) * types.length) % types.length;
    var hpv = XB.towerHp(level);
    monster = {
      type: types[idx].id,
      boss: boss,
      level: level,
      atk: XB.towerAtk(level),
      scale: boss ? 1.42 : (1 + XD.srand(level * 29) * 0.12),
      seed: level * 101,
      x: VIEW_W / 2,
      y: MON_BASE_Y,
      maxHp: hpv,
      hp: hpv,
      spawnT: 0,
      dyingT: -1,
      hurtT: 0
    };
  }

  function monsterCenter() {
    return { x: monster.x, y: monster.y - 175 * monster.scale };
  }
  function monsterRadius() { return 235 * monster.scale * 1.18; }

  /* ---------- 特效 ---------- */
  function addSlash(x, y) {
    slashes.push({
      x: x, y: y,
      ang: -Math.PI / 4 + (XD.srand(slashes.length * 31 + nowSec * 97) - 0.5) * 0.5,
      t: 0
    });
  }
  function addFloat(x, y, txt, color, size, life) {
    if (floats.length > 26) floats.shift();
    floats.push({ x: x, y: y, txt: txt, color: color, size: size || 36,
      t: 0, life: life || 0.9 });
  }
  function burstSmoke(x, y, scale) {
    var n = 22;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + XD.srand(i + nowSec * 7);
      var sp = 60 + XD.srand(i * 17 + 3) * 160;
      smokes.push({
        x: x + (XD.srand(i * 5) - 0.5) * 90,
        y: y - 140 * scale + (XD.srand(i * 11) - 0.5) * 120,
        vx: Math.cos(a) * sp * 0.6,
        vy: Math.sin(a) * sp * 0.35 - 70,
        r: 14 + XD.srand(i * 23) * 26,
        alpha: 0.34,
        t: 0,
        life: 0.55 + XD.srand(i * 41) * 0.35
      });
    }
  }

  /* ---------- 装备掉落 ---------- */
  function dropRnd() {
    dropCount += 1;
    return XD.srand(dropCount * 7919 + level * 104729 + Math.floor(nowSec * 997));
  }

  function grantEquip(f) {
    var slot = XB.EQUIP_SLOTS[Math.floor(dropRnd() * XB.EQUIP_SLOTS.length)];
    var qIdx = XB.rollQuality(dropRnd());
    var power = XB.equipPower(f, qIdx, dropRnd());
    var cur = eq[slot];
    if (!cur || power > cur.power) {
      var name = XB.equipItemName(slot, qIdx);
      eq[slot] = { slot: slot, name: name, power: power, qIdx: qIdx };
      return { got: name, power: power, slot: slot };
    }
    var gain = XB.salvageStones(power);
    stones += gain; accStones += gain;
    return { salvaged: gain, power: power };
  }

  function rollDrop() {
    var r = grantEquip(level);
    if (!monster) return;
    var c = monsterCenter();
    if (r.got) {
      addFloat(c.x - 60, c.y - 130, '塔藏·' + r.got + ' +' + Math.round(r.power), '#c9a05a', 34);
    } else {
      addFloat(c.x - 60, c.y - 130, '分解 +' + r.salvaged + ' 灵石', 'rgba(47,42,36,0.62)', 28);
    }
  }

  function fateStoneReward() {
    var steadyMarket = curMarketRate() / (tide.left > 0 ? XB.TIDE_STONE_MULT : 1);
    return steadyMarket > 0 ? steadyMarket * XB.BALANCE.encounterStoneSeconds :
      XB.fateStones(S, level) * gEff('gold') * daoMult();
  }
  function fateExpReward() {
    var steadyRate = medRate() / tideMultMed() / injPenalty();
    return XB.fateExpReward(S, steadyRate);
  }

  /* ---------- 奇遇（即时小奖 + 选择型机缘） ---------- */
  function tryFate() {
    if (nowSec < fateCd) return;
    if (Math.random() >= XB.FATE_CHANCE) return;
    /* 近半概率升级为选择型机缘（无弹窗/无突破动画时） */
    if (!modal && !bt && Math.random() < 0.45) { openFateEvent(); return; }
    var c = monsterCenter();
    var roll = Math.random();
    if (roll < 0.3) {
      var gift = fateExpReward();
      exp += gift;
      addFloat(c.x, c.y - 190, '仙人传功 · +' + XB.fmt(gift) + ' 修为', '#b03a30', 38, 1.4);
    } else if (roll < 0.6) {
      var st = fateStoneReward();
      stones += st; accStones += st;
      addFloat(c.x, c.y - 190, '妖兽内丹 · +' + XB.fmt(st) + ' 灵石', '#8a6a30', 38, 1.4);
    } else if (roll < 0.72) {
      /* 无主法宝：日常机缘是装备主要来源 */
      var r = grantEquip(Math.max(level, S * 4));
      if (r.got) addFloat(c.x, c.y - 190, '无主法宝 · ' + r.got, '#c9a05a', 36, 1.6);
      else addFloat(c.x, c.y - 190, '法宝入手 · 旧物分解 +' + r.salvaged + ' 灵石', '#c9a05a', 32, 1.5);
    } else if (roll < 0.9) {
      /* 残卷：随机已解锁功法 +1 层 */
      var pool = [];
      for (var i = 0; i < XB.GONGFA.length; i++) {
        if (XB.realmIdx(S) >= XB.GONGFA[i].unlock) pool.push(i);
      }
      if (pool.length) {
        var gi = pool[Math.floor(Math.random() * pool.length)];
        gf[gi] += 1;
        addFloat(c.x, c.y - 190, '残卷 ·《' + XB.GONGFA[gi].name + '》+1层', '#3d4a5c', 34, 1.4);
      } else {
        stones += fateStoneReward() * 0.5; accStones += fateStoneReward() * 0.5;
      }
    } else {
      tn += 1;
      addFloat(c.x, c.y - 190, '灵植 · 吐纳术 +1级', '#3d4a5c', 34, 1.4);
    }
    XAudio.fate();
    XP.vibrate('medium');
  }

  function openFateEvent(ev) {
    if (modal || bt) return false;
    fateEvent = ev || XB.FATE_EVENTS[Math.floor(Math.random() * XB.FATE_EVENTS.length)];
    modal = 'fate';
    XAudio.fate();
    XP.vibrate('medium');
    return true;
  }

  function resolveFateOption(idx) {
    if (!fateEvent) { modal = null; return; }
    var opt = fateEvent.options[idx];
    if (!opt) return;
    var c = monster ? monsterCenter() : { x: 375, y: MON_BASE_Y - 210 };
    var key = opt.apply;
    /* 冒险选项有失败风险：幽窟可能空手而归，但不致命 */
    var riskyBig = key === 'big-stones-exp' && Math.random() < 0.35;
    var st, gift;
    if (key === 'bond') {
      bond += 1;
      addFloat(c.x, c.y - 190, '仙缘 +1 · 打坐与击杀修为永久提升', '#3d4a5c', 34, 1.6);
      XUI.toast('仙缘 +1（每点修为 +3%）');
    } else if (key === 'sgn') {
      sgn += 1;
      addFloat(c.x, c.y - 190, '剑心 +1 · 挥剑伤害永久提升', '#b03a30', 34, 1.6);
      XUI.toast('剑心 +1（每点点击伤害 +2%）');
    } else if (key === 'sgn-tide') {
      sgn += 1;
      tide.left = XB.TIDE_DUR;
      XUI.toast('剑心 +1 · 且引发灵气潮汐！');
    } else if (key === 'exp') {
      gift = fateExpReward();
      exp += gift;
      addFloat(c.x, c.y - 190, ' +' + XB.fmt(gift) + ' 修为', '#b03a30', 36, 1.6);
    } else if (key === 'stones') {
      st = fateStoneReward();
      stones += st; accStones += st;
      addFloat(c.x, c.y - 190, ' +' + XB.fmt(st) + ' 灵石', '#8a6a30', 36, 1.6);
    } else if (key === 'equip') {
      var er = grantEquip(Math.max(level, S * 4));
      if (er.got) addFloat(c.x, c.y - 190, '得至宝 · ' + er.got, '#c9a05a', 36, 1.8);
      else addFloat(c.x, c.y - 190, '旧物分解 +' + er.salvaged + ' 灵石', '#c9a05a', 32, 1.6);
    } else if (key === 'bond-equip') {
      bond += 1;
      var er2 = grantEquip(Math.max(level, S * 4));
      addFloat(c.x, c.y - 190, '仙缘 +1 · ' + (er2.got ? '获赠 ' + er2.got : '谢礼已收'), '#3d4a5c', 34, 1.8);
    } else if (key === 'stones-exp') {
      st = fateStoneReward() * 0.6;
      gift = fateExpReward() * 0.5;
      stones += st; accStones += st; exp += gift;
      addFloat(c.x, c.y - 190, '因果回报 · 灵石与修为双得', '#8a6a30', 34, 1.6);
    } else if (key === 'big-stones-exp') {
      if (riskyBig) {
        st = fateStoneReward() * 0.4;
        stones += st; accStones += st;
        addFloat(c.x, c.y - 190, '窟中空空 · 只得 +' + XB.fmt(st) + ' 灵石', 'rgba(47,42,36,0.62)', 32, 1.6);
      } else {
        st = fateStoneReward() * 2.5;
        gift = fateExpReward() * 1.2;
        stones += st; accStones += st; exp += gift;
        addFloat(c.x, c.y - 190, '满载而归 · 大机缘！', '#8a6a30', 38, 1.8);
      }
    } else if (key === 'tide') {
      tide.left = XB.TIDE_DUR;
      XUI.toast('灵气潮汐 · 修为与灵石暴增！');
    }
    fateEvent = null;
    modal = null;
    checkBreakthroughAuto();
    saveGame();
  }

  function fateOptionPreview(option) {
    var key = option.apply;
    if (key === 'exp') return '+' + XB.fmt(fateExpReward()) + ' 修为（本境' + Math.round(fateExpReward() / expNeed() * 100) + '%）';
    if (key === 'stones') return '+' + XB.fmt(fateStoneReward()) + (curMarketRate() > 0 ? ' 灵石（45秒稳定坊市产出）' : ' 灵石（初入仙途的路资）');
    if (key === 'stones-exp') return '+' + XB.fmt(fateStoneReward() * .6) + ' 灵石 / +' + XB.fmt(fateExpReward() * .5) + ' 修为';
    if (key === 'big-stones-exp') return '65%得大机缘；35%只得' + XB.fmt(fateStoneReward() * .4) + '灵石';
    return option.desc;
  }

  /* ---------- 战斗 ---------- */
  function attackAt(x, y) {
    if (!monster || monster.dyingT >= 0 || (bt && bt.big) || modal) return false;
    var c = monsterCenter();
    var dx = x - c.x;
    var dy = y - c.y;
    if (dx * dx + dy * dy > monsterRadius() * monsterRadius()) return false;

    var isCrit = Math.random() < critRate();
    var dmg = clickDamage() * (isCrit ? critMult() : 1);
    dealDamage(dmg);
    addSlash(x, y);
    if (isCrit) {
      addFloat(c.x + (XD.srand(nowSec * 53) - 0.5) * 140, c.y - 90,
               '暴击 -' + XB.fmt(dmg), '#b03a30', 52, 1.1);
      shakeT = Math.max(shakeT, 0.12);
      XAudio.crit();
      XP.vibrate('medium');
    } else {
      addFloat(c.x + (XD.srand(nowSec * 53) - 0.5) * 120, c.y - 60,
               '-' + XB.fmt(dmg), '#b03a30', 40);
      XAudio.slash();
    }
    combo.n += 1;
    combo.t = 0;
    monster.hurtT = 0.12;
    return true;
  }

  function dealDamage(dmg) {
    if (!monster || monster.dyingT >= 0) return;
    monster.hp -= dmg;
    if (monster.hp <= 0) killMonster();
  }

  function killMonster() {
    monster.hp = 0;
    monster.dyingT = 0;
    totalKills += 1;
    var c = monsterCenter();
    /* v4 历练产出：灵石小额补贴，主产出是修为/领悟/贡献 */
    var st = Math.round(XB.towerStones(level) * stoneMultAll() * sectStone());
    var ex = XB.towerExp(level, S) * expAllMult() * tideMultExp();
    stones += st; accStones += st;
    exp += ex;
    contrib += XB.towerContrib(level);
    addInsight(XB.towerInsight(level) * sectInsight());
    addFloat(monster.x, c.y - 190,
             '+' + XB.fmt(ex) + ' 修为 · +' + XB.fmt(st) + ' 灵石',
             '#3d4a5c', 28);
    /* 装备只在里程碑层掉落 */
    if (level % XB.TOWER_MILESTONE === 0) rollDrop();
    tryFate();
    burstSmoke(monster.x, monster.y, monster.scale);
    XAudio.kill();
    if (monster.boss) { shakeT = 0.4; XP.vibrate('long'); }
    checkBreakthroughAuto();
  }

  function advanceLevel() {
    if (towerPlan === 'temper') {
      var start = temperFloor;
      level = start + ((level - start + 1) % 5);
      spawnMonster();
      return;
    }
    level += 1;
    towerFloor = level;
    if (level > towerBest) towerBest = level;
    spawnMonster();
  }

  /* ---------- 领悟（斩妖实践 → 功法理解） ---------- */
  function addInsight(pts) {
    if (pts <= 0) return;
    /* 优先给已解锁、未满领悟的随机一部 */
    var pool = [];
    for (var i = 0; i < XB.GONGFA.length; i++) {
      if (XB.realmIdx(S) >= XB.GONGFA[i].unlock && cmp[i] < XB.INSIGHT_CAP) pool.push(i);
    }
    if (!pool.length) return;
    var gi = pool[Math.floor(Math.random() * pool.length)];
    var before = cmp[gi];
    cmp[gi] = Math.min(XB.INSIGHT_CAP, cmp[gi] + Math.max(1, Math.round(pts)));
    /* 每 20 点领悟弹一次突破提示，让玩家感知实践在生效 */
    if (Math.floor(cmp[gi] / 20) > Math.floor(before / 20) && cmp[gi] < XB.INSIGHT_CAP) {
      XUI.toast('斩妖印证·《' + XB.GONGFA[gi].name + '》领悟 ' + cmp[gi] + '/100');
    }
  }

  /* ---------- 魔窟出入 / 重伤 / 顿悟 ---------- */
  function towerUnlocked() { return level >= XB.TOWER_UNLOCK_LEVEL || towerBest >= XB.TOWER_UNLOCK_LEVEL; }
  function enterTower(plan) {
    if (mode === 'tower') return;
    if (plan === 'temper' && towerBest >= 6) towerPlan = 'temper';
    else if (plan === 'advance') towerPlan = 'advance';
    if (injured()) { XUI.toast('道体受创，先养好伤再入魔窟'); XAudio.deny(); return; }
    if (bt && bt.big) return;
    if (ph <= 0 && injuryT <= 0) ph = playerHpMax();
    mode = 'tower';
    temperFloor = XB.temperStart(towerBest, curDps(), playerHpMax());
    level = towerPlan === 'temper' ? temperFloor : towerFloor;
    monAtkT = 0;
    spawnMonster();
    XUI.toast((towerPlan === 'temper' ? '温养历练·' : '入魔窟·') + '第 ' + level + ' 层');
    saveGame();
  }
  function leaveTower() {
    if (mode !== 'tower') return;
    mode = 'home';
    level = towerFloor;
    monster = null;
    combo.n = 0;
    XUI.toast('归山闭关');
    saveGame();
  }
  function monsterHitsPlayer() {
    if (!monster || monster.dyingT >= 0 || monster.spawnT < 0.5) return;
    var dmg = monster.atk;
    ph -= dmg;
    var c = monsterCenter();
    addFloat(c.x - 120, MON_BASE_Y - 60, '-' + XB.fmt(dmg) + ' 气血', '#8f2b23', 30);
    shakeT = Math.max(shakeT, 0.06);
    if (ph <= 0) severeInjury();
    else if (towerPlan === 'temper' && ph < playerHpMax() * XB.BALANCE.recoveryReserve) {
      leaveTower();
      XUI.toast('温养收功 · 气血不足，先归山调息');
    }
  }
  function severeInjury() {
    ph = 0;
    mode = 'home';
    level = towerFloor;
    monster = null;
    combo.n = 0;
    injuryT = XB.INJURE_DUR * (sectId === 'dantang' ? 0.7 : 1);
    var c = { x: 375, y: MON_BASE_Y - 260 };
    var newTrial = towerFloor >= epipFrontier + 5;
    if (newTrial) epipFrontier = towerFloor;
    if (newTrial && epip < XB.EPIPHANY_MAX && Math.random() < XB.EPIPHANY_CHANCE) {
      epip += 1;
      addFloat(c.x, c.y - 60, '生死之间，忽有所得！', '#b03a30', 44, 2.2);
      addFloat(c.x, c.y, '顿悟·战力与修行永久 +5% ×' + epip, '#c9a05a', 32, 2.2);
      XUI.toast('生死顿悟！修行与战力永久提升');
      XAudio.breakthrough();
      XP.vibrate('long');
    } else {
      addFloat(c.x, c.y, '重伤濒死 · 遁出魔窟归山将养', '#8f2b23', 34, 2.0);
      XUI.toast('重伤：四十秒内不宜再战（可在塔页查看）');
      XAudio.fate();
    }
    saveGame();
  }

  /* ---------- 突破 ---------- */
  function canBreakthrough() { return S < XB.MAX_STAGE && exp >= expNeed(); }
  function atRealmGate() { return XB.isRealmGate(S); }

  /* 小境界：修为满自动突破（动画进行中不重复触发） */
  function checkBreakthroughAuto() {
    if (bt || !canBreakthrough() || atRealmGate()) return;
    startBreak(false);
  }

  function startBreak(big) {
    if (bt || !canBreakthrough()) return;
    var name = big ? XB.realmShort(S + 1) : XB.STAGE_NAMES[XB.stageIdx(S) + 1];
    if (!big) name = XB.realmShort(S) + '·' + name;
    bt = {
      t: 0, big: big, name: name,
      cy: monster ? monsterCenter().y : MON_BASE_Y - 210
    };
    if (big) {
      shakeT = 0.55;
      XAudio.breakthrough();
      XP.vibrate('long');
    } else {
      XAudio.stageUp();
    }
  }

  function finishBreak() {
    if (S >= XB.MAX_STAGE) return;
    var need = expNeed();
    exp = Math.max(0, exp - need);
    var prevRealm = XB.realmIdx(S);
    S += 1;
    // Breakthrough visibly breaks the old combat wall, with a fresh body for exploration.
    if (XB.realmIdx(S) > prevRealm) ph = playerHpMax();
    if (S > best) best = S;
    var nowRealm = XB.realmIdx(S);
    if (nowRealm > prevRealm) {
      if (nowRealm === 1 && mk[0] === 0) {
        mk[0] = 1;
        XUI.toast('筑基立业 · 获赠一间茶摊，闭关也有灵石入账');
      }
      bgTrans = 0;
      /* 新大境界：境界剧情入队（首遇弹窗） */
      if (!storySeen[nowRealm]) storyQueue.push(nowRealm);
      /* 功法解锁提示 */
      for (var i = 0; i < XB.GONGFA.length; i++) {
        if (XB.GONGFA[i].unlock === nowRealm) {
          XUI.toast('功法解锁 ·《' + XB.GONGFA[i].name + '》');
        }
      }
      if (!XB.isMortal(S)) XUI.toast('飞升仙界 · ' + XB.realmShort(S));
    }
    saveGame();
  }

  /* ---------- 轮回转世 ---------- */
  function canRebirth() { return S >= XB.REBIRTH_UNLOCK_S; }

  function doRebirth() {
    if (!canRebirth()) return;
    var gain = XB.daoJiGain(S);
    dj += gain;
    rb += 1;
    stones = XB.rebirthStones(dj);
    exp = 0;
    S = 0;
    level = 1;
    sj = ss = ls = tn = 0;
    for (var i = 0; i < gf.length; i++) gf[i] = 0;
    eq = { sword: null, armor: null, talisman: null, pendant: null };
    mk = [0, 0, 0, 0, 0];
    for (var mi3 = 0; mi3 < mp.length; mi3++) mp[mi3] = 0;
    /* 宗门、贡献、顿悟、仙缘剑心不随轮回洗去 */
    questClaimed = {};
    storySeen = {}; storyQueue.length = 0;
    towerFloor = 1; level = 1; towerPlan = 'advance'; epipFrontier = 1;
    missions = [null, null, null];
    if (sectId) rollMissions(true);
    monster = null; mode = 'home';
    ph = playerHpMax(); injuryT = 0;
    for (var ci3 = 0; ci3 < cmp.length; ci3++) cmp[ci3] = 0;
    combo.n = 0;
    tide.left = 0;
    tide.next = nowSec + 40;
    bt = { t: 0, big: false, transitionOnly: true, name: '轮回·一世',
           cy: MON_BASE_Y - 210 };
    modal = null;
    rebirthArmed = false;
    XAudio.breakthrough();
    saveGame();
    XUI.toast('轮回转世 · 道基 +' + gain + ' · 仙缘与剑心随身不改');
  }

  /* ---------- 购买 ---------- */
  function buyUpgrade(key) {
    if (bt && bt.big) return;
    var cost = 0;
    if (key === 'sj') cost = XB.costSwordJue(sj);
    else if (key === 'ss') cost = XB.costSwordShi(ss);
    else if (key === 'ls') cost = XB.costBeast(ls);
    else cost = XB.costTuna(tn);
    if (stones < cost) { XAudio.deny(); XUI.toast('灵石不足'); return; }
    stones -= cost;
    if (key === 'sj') sj += 1;
    else if (key === 'ss') ss += 1;
    else if (key === 'ls') ls += 1;
    else tn += 1;
    XAudio.buy();
    XP.vibrate('light');
    saveGame();
  }

  function buyGongfa(idx) {
    var g = XB.GONGFA[idx];
    if (XB.realmIdx(S) < g.unlock) {
      XUI.toast(XB.REALM_LIST[g.unlock] + '期解锁');
      XAudio.deny();
      return;
    }
    var cost = XB.gongfaCost(g, gf[idx]);
    if (stones < cost) { XAudio.deny(); XUI.toast('灵石不足'); return; }
    stones -= cost;
    gf[idx] += 1;
    XAudio.buy();
    XP.vibrate('light');
    saveGame();
  }

  function buyMarket(idx) {
    if (!marketUnlocked()) {
      XUI.toast('魔窟第 ' + XB.MARKET_UNLOCK_LEVEL + ' 层或筑基解锁坊市');
      return;
    }
    var cost = XB.marketCost(idx, mk[idx]);
    if (stones < cost) { XAudio.deny(); XUI.toast('灵石不足'); return; }
    stones -= cost;
    mk[idx] += 1;
    XAudio.buy();
    saveGame();
  }

  function buyMarketProfit(idx) {
    if (!marketUnlocked()) return;
    if (!XB.MARKET_SHOPS[idx] || XB.MARKET_PROFIT_UP[mp[idx] + 1] == null) return;
    if (mk[idx] < XB.MARKET_PROFIT_UP[mp[idx] + 1]) {
      XUI.toast('需先拥有 ' + XB.MARKET_PROFIT_UP[mp[idx] + 1] + ' 间 ' + XB.MARKET_SHOPS[idx].name);
      XAudio.deny(); return;
    }
    var cost = XB.marketProfitCost(idx, mp[idx], S);
    if (stones < cost) { XAudio.deny(); XUI.toast('灵石不足'); return; }
    stones -= cost;
    mp[idx] += 1;
    XAudio.buy(); XP.vibrate('light');
    XUI.toast(XB.MARKET_SHOPS[idx].name + ' 利润配方升级 · 单店产出 ×1.55');
    saveGame();
  }

  /* ---------- 宗门 / 贡献 / 任务 ---------- */
  function joinSect(id) {
    var s = XB.getSect(id);
    if (!s) return;
    if (sectId && sectId !== id) {
      XUI.toast('已换投' + s.name + '·旧宗功法封存不可再修（层数保留）');
    }
    sectId = id;
    if (!missions[0] && !missions[1] && !missions[2]) rollMissions(true);
    XUI.toast('拜入' + s.name + ' · 领宗門任务 x3');
    XAudio.buy();
    saveGame();
  }
  function learnArt(artId) {
    var art = null;
    for (var i = 0; i < XB.SECTS.length; i++) {
      var sec = XB.SECTS[i];
      for (var j = 0; j < sec.arts.length; j++) {
        if (sec.arts[j].id === artId) art = sec.arts[j];
      }
    }
    if (!art) return;
    if (sectId !== artOwner(artId)) { XUI.toast('需拜入该功法所属宗门'); XAudio.deny(); return; }
    if (S < art.reqS) { XUI.toast('需修为达 ' + XB.realmName(art.reqS) + ' 方可参研'); XAudio.deny(); return; }
    var lv = sectLv[artId] || 0;
    var cost = XB.sectArtCost(art, lv);
    if (contrib < cost) { XUI.toast('贡献不足（需 ' + cost + '）'); XAudio.deny(); return; }
    contrib -= cost;
    sectLv[artId] = lv + 1;
    XAudio.buy(); XP.vibrate('light');
    XUI.toast('《' + art.name + '》修至 ' + (lv + 1) + ' 层');
    saveGame();
  }
  function artOwner(artId) {
    for (var i = 0; i < XB.SECTS.length; i++) {
      for (var j = 0; j < XB.SECTS[i].arts.length; j++) {
        if (XB.SECTS[i].arts[j].id === artId) return XB.SECTS[i].id;
      }
    }
    return '';
  }
  function artTotalLv() {
    var t = 0;
    for (var k in sectLv) if (Object.prototype.hasOwnProperty.call(sectLv, k)) t += sectLv[k] | 0;
    return t;
  }

  function rollMission() {
    var used = missions.filter(function (m) { return !!m; }).map(function (m) { return m.kind; });
    var kinds = XB.MISSION_KINDS.filter(function (m) {
      return used.indexOf(m.kind) < 0 && !(m.kind === 'realm' && S >= XB.MAX_STAGE - 1);
    });
    var kind = kinds[Math.floor(Math.random() * kinds.length)].kind;
    var need, base = 0;
    if (kind === 'kill')  { need = 8 + Math.round(S * 2 + towerBest * 0.5); base = totalKills; }
    else if (kind === 'floor') { base = Math.max(1, towerFloor - 1); need = base + 3 + Math.round(S * 0.6); }
    else if (kind === 'stone') {
      var stableIncome = curMarketRate() / (tide.left > 0 ? XB.TIDE_STONE_MULT : 1);
      need = Math.max(400 + S * 250, Math.round(stableIncome * 90)); base = accStones;
    }
    else if (kind === 'shop') {
      var shops = mk[0] + mk[1] + mk[2] + mk[3] + mk[4];
      need = shops + Math.min(4, 2 + Math.floor(S / 12)); base = shops;
    }
    else { kind = 'realm'; need = S + 2; base = S; }
    var rew = XB.missionReward(kind, S);
    return { kind: kind, need: need, base: base, contrib: rew.contrib,
      stones: kind === 'stone' ? Math.min(rew.stones, Math.floor(need * .2)) : rew.stones,
      runFrontier: kind === 'floor' };
  }
  function rollMissions(force) {
    if (force) missions = [null, null, null];
    for (var i = 0; i < 3; i++) {
      if (force || !missions[i]) missions[i] = rollMission();
    }
  }
  /* 统一（当前值-基线）进度，need 为目标绝对值或增量已折算 */
  function missionCur(m) {
    if (m.kind === 'kill') return totalKills - m.base;
    if (m.kind === 'floor') return (m.runFrontier ? towerFloor : towerBest) - m.base;
    if (m.kind === 'stone') return accStones - m.base;
    if (m.kind === 'shop') return (mk[0] + mk[1] + mk[2] + mk[3] + mk[4]) - m.base;
    return S - m.base; /* realm: 再进一步 */
  }
  function missionNeed(m) {
    if (m.kind === 'floor' || m.kind === 'shop') return m.need - m.base;
    if (m.kind === 'realm') return 2;            /* 两个小境界 */
    return m.need;
  }
  function missionDone(m) { return !!m && missionCur(m) >= missionNeed(m); }
  function claimMission(i) {
    var m = missions[i];
    if (!m || !missionDone(m)) return;
    contrib += m.contrib;
    stones += m.stones; accStones += m.stones;
    XUI.toast('宗门任务·缴令 +' + m.contrib + ' 贡献 +' + XB.fmt(m.stones) + ' 灵石');
    XAudio.buy();
    missions[i] = null;
    missions[i] = rollMission();
    saveGame();
  }

  /* ---------- 灵气潮汐 ---------- */
  function scheduleTide() {
    tide.next = nowSec + XB.TIDE_GAP_MIN + Math.random() * XB.TIDE_GAP_RAND;
  }
  function updateTide(dt) {
    if (tide.left > 0) {
      tide.left -= dt;
      if (tide.left <= 0) { tide.left = 0; scheduleTide(); }
    } else if (nowSec >= tide.next) {
      tide.left = XB.TIDE_DUR;
      XAudio.tide();
      XUI.toast('灵气潮汐 · 修为与灵石暴增！');
    }
  }
  function tideStrength() {
    if (tide.left <= 0) return 0;
    var fin = Math.min(1, (XB.TIDE_DUR - tide.left) / 1.5,
      tide.left / 1.5);
    return Math.max(0, Math.min(1, fin));
  }

  /* ---------- 离线闭关结算 ---------- */
  function equipPowerOfSave(d) {
    var sum = 0;
    if (d.eq && typeof d.eq === 'object') {
      for (var key in d.eq) {
        if (Object.prototype.hasOwnProperty.call(d.eq, key) && d.eq[key]) {
          sum += Number(d.eq[key].power) || 0;
        }
      }
    }
    return sum;
  }

  function computeOffline(d, gapSec) {
    var gap = gapSec != null ? gapSec : (Date.now() - d.ts) / 1000;
    if (!isFinite(gap) || gap <= 0) return null;
    var weighted = XB.offlineWeightedSec(gap);
    var sSaved = Math.min(XB.MAX_STAGE, Math.max(0, Number(d.S) || 0));
    var djSaved = Math.max(0, Number(d.dj) || 0);
    var gfs = [];
    for (var i = 0; i < XB.GONGFA_COUNT; i++) {
      gfs.push(Math.max(0, (d.gf && Number(d.gf[i])) || 0));
    }
    /* 打坐效率（离线不吃潮汐）；v4：含领悟/宗门/顿悟乘区 */
    var medG = 1, mapG = 1, goldG = 1, daojiG = XB.daoJiMult(djSaved);
    var epSaved = Math.max(0, Math.min(XB.EPIPHANY_MAX, Number(d.epip) || 0));
    var sectSaved = typeof d.sectId === 'string' ? d.sectId : '';
    var sLv = (d.sectLv && typeof d.sectLv === 'object') ? d.sectLv : {};
    for (var j = 0; j < XB.GONGFA.length; j++) {
      var g = XB.GONGFA[j];
      var ins = XB.insightBonus(Number((d.cmp && d.cmp[j]) || 0));
      if (g.id === 'breath') medG *= g.eff(gfs[j]) * ins;
      if (g.id === 'dao') medG *= g.eff(gfs[j]) * ins;
      if (g.id === 'map') mapG *= g.eff(gfs[j]) * ins;
      if (g.id === 'gold') goldG *= g.eff(gfs[j]) * ins;
    }
    medG *= 1 + 0.12 * (sLv.dt1 | 0);             /* 丹霞镇宗功法 */
    medG *= 1 + 0.08 * (sLv.dt2 | 0);             /* 全部修为：线上线下一致 */
    medG *= XB.epiphanyMult(epSaved);            /* 生死顿悟 */
    var med = XB.meditationRate(sSaved, Math.max(0, Number(d.tn) || 0),
                                medG, daojiG, 1);
    med *= XB.bondMult(Number(d.bond) || 0);   /* 仙缘离线同样生效 */
    var mkSaved = Array.isArray(d.mk) ? d.mk : [0, 0, 0, 0, 0];
    var mkt = XB.marketRate(mkSaved, sSaved, mapG, daojiG, Array.isArray(d.mp) ? d.mp : null);
    if (sectSaved === 'tianshu') mkt *= 1.10;
    mkt *= (1 + 0.15 * (sLv.ts1 | 0)) * goldG * (1 + .10 * (sLv.ts2 | 0));
    var healMult = sectSaved === 'dantang' ? 1.5 : 1;
    var oldInjury = Math.max(0, Number(d.injuryT) || 0);
    var resting = d.mode !== 'tower' || gap >= OFFLINE_MIN_GAP;
    var injuredSeconds = Math.min(gap, oldInjury / healMult);
    var injuredWeight = XB.offlineWeightedSec(injuredSeconds);
    var expGainV = med * (weighted - injuredWeight * (1 - XB.INJURE_PENALTY));
    var armor = d.eq && d.eq.armor ? Number(d.eq.armor.power) || 0 : 0;
    var hpMax = XB.playerHpMax(sSaved, armor, 1);
    var hpBefore = d.ph == null ? hpMax : Math.max(0, Number(d.ph) || 0);
    var recovered = resting ? hpMax * healMult *
      (injuredSeconds * XB.INJURY_HEAL_RATE + (gap - injuredSeconds) * XB.HEAL_RATE) : 0;
    var stoneGain = mkt * weighted;
    if (expGainV <= 0 && stoneGain <= 0) return null;
    return {
      seconds: Math.min(gap, XB.OFFLINE_CAP_SEC),
      expGain: expGainV,
      stoneGain: stoneGain,
      injuryRemaining: Math.max(0, oldInjury - (resting ? gap * healMult : 0)),
      health: Math.min(hpMax, hpBefore + recovered)
    };
  }

  function showOfflineModal(info) {
    offlineResumeModal = modal && modal !== 'offline' ? modal : null;
    offlineInfo = info;
    modal = 'offline';   /* 前后台切换归来的结算也要弹窗可见 */
  }

  function settleOffline(info) {
    if (!info) return;
    exp += info.expGain;
    stones += info.stoneGain; accStones += info.stoneGain;
    injuryT = info.injuryRemaining; ph = info.health;
    if (info.seconds >= OFFLINE_MIN_GAP) {
      if (mode === 'tower') { mode = 'home'; monster = null; level = towerFloor; combo.n = 0; }
      showOfflineModal(info);
    } else offlineInfo = null;
    checkBreakthroughAuto();
    saveGame();
  }
  function dismissOffline() {
    offlineInfo = null;
    modal = offlineResumeModal;
    offlineResumeModal = null;
  }

  /* ---------- 标题 / 场景 ---------- */
  var titleSave = null;        /* 标题页缓存的存档摘要 */
  function refreshTitleSave() {
    var d = loadGame();
    titleSave = d ? {
      hasSave: true,
      S: Math.min(XB.MAX_STAGE, Math.max(0, Number(d.S) || 0)),
      level: Math.max(1, Number(d.level) || 1)
    } : { hasSave: false };
  }

  function enterPlay(fromSave) {
    scene = SCENE_PLAY;
    bgPrevBand = XD.bandOf(XB.realmIdx(S));
    bgTrans = 1;
    mode = 'home';
    monster = null;
    if (ph <= 0 && injuryT <= 0) ph = playerHpMax();
    if (!tide.next) scheduleTide();
    if (fromSave && offlineInfo) settleOffline(offlineInfo);
  }

  function freshState() {
    stones = 0; exp = 0; S = 0; level = 1;
    sj = ss = ls = tn = 0;
    for (var i = 0; i < gf.length; i++) gf[i] = 0;
    eq = { sword: null, armor: null, talisman: null, pendant: null };
    mk = [0, 0, 0, 0, 0];
    dj = 0; rb = 0; best = 0; totalKills = 0;
    bond = 0; sgn = 0;
    questClaimed = {}; storySeen = {}; storyQueue.length = 0; fateEvent = null;
    combo.n = 0; tide.left = 0; tide.next = 0;
    monster = null;
    mode = 'home';
    towerFloor = 1; towerBest = 1; towerPlan = 'advance'; epipFrontier = 1; ph = playerHpMax();
    injuryT = 0; epip = 0;
    for (var ci2 = 0; ci2 < cmp.length; ci2++) cmp[ci2] = 0;
    for (var mi2 = 0; mi2 < mp.length; mi2++) mp[mi2] = 0;
    sectId = ''; sectLv = {}; contrib = 0;
    missions = [null, null, null]; accStones = 0;
    slashes.length = 0; smokes.length = 0; floats.length = 0;
    bt = null; offlineInfo = null; offlineResumeModal = null;
  }

  /* ============================================================
   * UI 绘制
   * ============================================================ */
  var IC = XUI.C;

  function drawTitle() {
    var ts = (VIEW_H - 1334) / 2;   /* 动态高度下标题块整体居中 */
    ctx.fillStyle = 'rgba(244,236,220,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    XUI.text('修 仙 放 置 · 水 墨', 375, 330 + ts, { size: 28, color: IC.indigo });
    /* 朱砂边框题字 */
    var bx = 375, by = 470 + ts, bw = 540, bh = 180;
    ctx.fillStyle = 'rgba(244,236,220,0.6)';
    ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
    ctx.strokeStyle = 'rgba(176,58,48,0.85)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
    ctx.strokeStyle = 'rgba(201,160,90,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - bw / 2 + 8, by - bh / 2 + 8, bw - 16, bh - 16);
    XUI.text('斩妖·修仙录', 375, by - 6, { size: 92, weight: 900, color: IC.ink });
    XUI.text('v4.5 · 破境与传承', 375, by + 56, { size: 26, color: IC.ink55, serif: false });

    var hasSave = titleSave && titleSave.hasSave;
    XUI.text(hasSave
      ? '境界 ' + XB.realmName(titleSave.S) + ' · 魔窟第 ' + titleSave.level + ' 层'
      : '打坐证道 · 历练斩妖 · 得道飞升',
      375, 640 + ts, { size: 27, color: IC.ink55 });

    if (XUI.button('start', 375 - 195, 716 + ts, 390, 102, {
      label: hasSave ? '继 续 修 行' : '开 始 修 行',
      style: 'primary', size: 36
    })) {
      XAudio.init();
      var sv = loadGame();
      if (sv) {
        applySave(sv);
        offlineInfo = computeOffline(sv);
      } else {
        freshState();
      }
      enterPlay(!!sv);
      if (offlineInfo) saveGame();   /* 结算后立即存新时间戳 */
    }
    XUI.text('平日打坐修行 · 魔窟历练证剑 · 宗门求得道', 375, 884 + ts, { size: 23, color: '#c9a05a' });
  }

  /* ---------- 顶部 HUD ---------- */
  /* ---------- 顶部 HUD：固定高度卡片式布局 ----------
   * 胶囊行 → 主卡片（境界/双条/渡劫按钮）→ chip 行 + 右侧战报
   * 高度恒定，塔内外不重排 */
  function drawTopHUD() {
    var y = hudTopL;

    /* 场景 pill */
    var lvlTxt = mode === 'tower'
      ? (towerPlan === 'temper' ? '温养第 ' : '魔窟第 ') + level + ' 层' + (XB.isBoss(level) ? ' · 大妖' : '')
      : (injured() ? '山门 · 将养' : '山门 · 闭关');
    var lw = XUI.textW(lvlTxt, 24, false, 700) + 44;
    XUI.panel(20, y, lw, 48, { r: 24, flat: true });
    XUI.text(lvlTxt, 20 + lw / 2, y + 25, {
      size: 24, weight: 700,
      color: mode === 'tower' ? (XB.isBoss(level) ? IC.cinnabar : IC.indigo) : IC.ink
    });

    /* 灵石 pill */
    var stTxt = '灵石 ' + XB.fmt(stones);
    var sw = XUI.textW(stTxt, 24, false, 600) + 44;
    XUI.panel(VIEW_W - 20 - sw, y, sw, 48, { r: 24, flat: true, border: 'rgba(201,160,90,0.9)' });
    XUI.text(stTxt, VIEW_W - 20 - sw / 2, y + 25, { size: 24, weight: 600, color: '#8a6a30' });

    /* 主卡片 */
    var cx0 = 16, cw0 = VIEW_W - 32, cy0 = y + 58, chh = 142;
    XUI.panel(cx0, cy0, cw0, chh, { r: 16, flat: true, fill: 'rgba(244,236,220,0.9)' });

    /* 行1：境界名 + 序号 */
    XUI.text(XB.realmName(S) + (rb > 0 ? ' · ' + rb + '世' : ''),
             cx0 + 20, cy0 + 24, { size: 25, weight: 700, align: 'left' });
    XUI.text(S >= XB.MAX_STAGE ? '道之尽头' : (S + 1) + '/' + (XB.MAX_STAGE + 1),
             cx0 + cw0 - 168, cy0 + 24, { size: 18, color: IC.ink30, align: 'right', serif: false });

    /* 行2：修为条 + 气血条（双条定高，不再按模式增删） */
    var barX = cx0 + 20, barW = cw0 - 210, need = expNeed();
    var hpMax = playerHpMax();
    XUI.bar(barX, cy0 + 46, barW, 34, exp / need, { fill: '#c9a05a' });
    XUI.text('修为 ' + XB.fmt(Math.min(exp, need)) + '/' + XB.fmt(need) +
             ' · +' + XB.fmtRate(medRate()) + '/s',
             barX + barW / 2, cy0 + 64, { size: 18, serif: false, color: IC.ink });
    XUI.bar(barX, cy0 + 88, barW, 34, Math.max(0, ph) / hpMax, {
      fill: injured() ? 'rgba(143,43,35,0.8)' : (mode === 'tower' ? '#a0524a' : '#7d9a6a')
    });
    XUI.text('气血 ' + XB.fmt(Math.max(0, Math.round(ph))) + '/' + XB.fmt(hpMax) +
             (injured() ? ' · 重伤 ' + Math.ceil(injuryT) + 's' : (mode === 'home' && ph < hpMax ? ' · 回复中' : '')),
             barX + barW / 2, cy0 + 106, { size: 18, serif: false, color: IC.ink });

    /* 右侧：渡劫/突破按钮（固定锈定，跨双条高度） */
    var ready = canBreakthrough(), gate = atRealmGate();
    var bLabel = S >= XB.MAX_STAGE ? '圆满' : gate
      ? (ready ? '渡劫' : Math.floor(Math.min(100, exp / need * 100)) + '%')
      : Math.floor(Math.min(100, exp / need * 100)) + '%';
    var bSub = S >= XB.MAX_STAGE ? '道祖' : gate ? (ready ? '战力×' + XB.REALM_GATE_MULT : '未圆') : (ready ? '静极' : '积累');
    if (XUI.button('bt-break', cx0 + cw0 - 146, cy0 + 44, 126, 80, {
      label: bLabel, sub: bSub,
      style: (gate && ready) ? 'primary' : 'ghost', size: 26,
      disabled: !(gate && ready), r: 14
    })) {
      startBreak(true);
    }

    /* 行3：状态 chip + 右侧战报（chip 预留右侧空间，超宽则收略） */
    var chy = cy0 + chh + 8, chx = 20;
    var chipDefs = [];
    if (tide.left > 0)
      chipDefs.push({ t: '灵气潮汐 ' + Math.ceil(tide.left) + 's',
        o: { fill: 'rgba(201,160,90,0.22)', color: '#8a6a30', stroke: 'rgba(138,106,48,0.5)' } });
    if (epip > 0)
      chipDefs.push({ t: '顿悟×' + epip + ' +' + (epip * 5) + '%',
        o: { fill: 'rgba(176,58,48,0.10)', color: IC.cinnabar } });
    if (bond > 0 || sgn > 0)
      chipDefs.push({ t: '仙缘' + bond + ' · 剑心' + sgn, o: { color: IC.indigo } });
    if (sectId)
      chipDefs.push({ t: XB.getSect(sectId).name + ' · 贡献' + XB.fmt(contrib), o: {} });
    for (var chi = 0; chi < chipDefs.length; chi++) {
      if (chx > VIEW_W - 380) { chx = XUI.chip(chx, chy, '+' + (chipDefs.length - chi), {}); break; }
      chx = XUI.chip(chx, chy, chipDefs[chi].t, chipDefs[chi].o);
    }
    XUI.text('攻 ' + XB.fmt(clickDamage()) + ' · 秒 ' + XB.fmt(curDps()) +
             ' · 市 +' + XB.fmtRate(curMarketRate()) + '/s',
             VIEW_W - 22, chy + 15, { size: 17, color: IC.ink30, serif: false, align: 'right' });
  }

  /* ---------- 底部面板 ---------- */
  var PANEL_TABS = [
    { id: 'cult',   icon: '坐', label: '修行' },
    { id: 'tower',  icon: '塔', label: '魔窟' },
    { id: 'sect',   icon: '宗', label: '宗门' },
    { id: 'gongfa', icon: '典', label: '功法' },
    { id: 'market', icon: '市', label: '坊市' },
    { id: 'quest',  icon: '途', label: '仙途' }
  ];

  function drawBottomPanel() {
    var panelH = 408;
    var py = VIEW_H - panelH - 16 - safeBottomL;
    var px = 16;
    var pw = VIEW_W - 32;

    /* 页签行：图标 + 文字双行 */
    var tabW = 100;
    var tabH = 70;
    var tabGap = 5;
    for (var i = 0; i < PANEL_TABS.length; i++) {
      var t = PANEL_TABS[i];
      var tx = px + i * (tabW + tabGap);
      var act = activeTab === t.id;
      var badge = false;
      if (t.id === 'quest') {
        var qs = questList();
        for (var qi9 = 0; qi9 < qs.length; qi9++) {
          if (qs[qi9].unlocked && !questClaimed[qs[qi9].id] && qs[qi9].progress >= qs[qi9].goal) badge = true;
        }
      } else if (t.id === 'sect' && sectId) {
        for (var mi9 = 0; mi9 < 3; mi9++) if (missionDone(missions[mi9])) badge = true;
      }
      XUI.panel(tx, py, tabW, tabH, {
        r: 14, flat: true,
        fill: act ? IC.paperHi : 'rgba(244,236,220,0.55)',
        border: act ? 'rgba(47,42,36,0.6)' : 'rgba(47,42,36,0.3)'
      });
      XUI.text(t.icon, tx + tabW / 2, py + 22, {
        size: 22, weight: 700, color: act ? IC.cinnabar : IC.ink30
      });
      XUI.text(t.label, tx + tabW / 2, py + 48, {
        size: 20, weight: 700, color: act ? IC.ink : IC.ink30, serif: false
      });
      if (badge) {
        ctx.fillStyle = IC.cinnabar;
        ctx.beginPath();
        ctx.arc(tx + tabW - 10, py + 10, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      rectsTab(tx, py, tabW, tabH, t.id);
      if (XUI.tapped('tab-' + t.id)) {
        if (t.id === 'market' && !marketUnlocked()) {
          XUI.toast('魔窟第 ' + XB.MARKET_UNLOCK_LEVEL + ' 层或筑基解锁坊市');
        } else {
          activeTab = t.id;
        }
      }
    }
    /* 设置按钮 */
    if (XUI.button('settings', px + pw - 56, py, 56, tabH, { label: '☰', size: 28, r: 14 })) {
      openModal('settings');
    }

    /* 面板主体 */
    var bodyY = py + tabH + 6;
    var bodyH = panelH - tabH - 6;
    XUI.panel(px, bodyY, pw, bodyH, { r: 0 });
    /* 遮掉顶部圆角 */
    ctx.fillStyle = IC.paperHi;
    ctx.fillRect(px + 1, bodyY + 1, pw - 2, 18);

    if (activeTab === 'cult') drawCultPanel(px, bodyY, pw, bodyH);
    else if (activeTab === 'tower') drawTowerPanel(px, bodyY, pw, bodyH);
    else if (activeTab === 'sect') drawSectPanel(px, bodyY, pw, bodyH);
    else if (activeTab === 'gongfa') drawGongfaPanel(px, bodyY, pw, bodyH);
    else if (activeTab === 'market') drawMarketPanel(px, bodyY, pw, bodyH);
    else drawQuestPanel(px, bodyY, pw, bodyH);

    panelRect = { x: px, y: py, w: pw, h: panelH + tabH };
  }
  var panelRect = null;

  /* 页签命中区域（非按钮自绘控件） */
  function rectsTab(x, y, w, h, id) {
    XUI.register('tab-' + id, x, y, w, h);
  }

  function drawCultPanel(px, py, pw, ph) {
    var cards = [
      { key: 'sj', name: '剑诀',   lv: sj, desc: '剑诀基础伤害 +16%',
        cost: XB.costSwordJue(sj) },
      { key: 'ss', name: '剑侍',   lv: ss, desc: '剑侍基础秒伤 +18%',
        cost: XB.costSwordShi(ss) },
      { key: 'ls', name: '灵兽',   lv: ls, desc: '点击伤害+25% · 暴击+0.4%/级',
        cost: XB.costBeast(ls) },
      { key: 'tn', name: '吐纳术', lv: tn, desc: '当前修为 +' + (6 / (1 + .06 * tn)).toFixed(1) + '% · 闭关生效',
        cost: XB.costTuna(tn) }
    ];
    var cw = (pw - 12 * 3) / 2;
    var chh = (ph - 12 * 3) / 2;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var cx = px + 12 + (i % 2) * (cw + 12);
      var cy = py + 12 + Math.floor(i / 2) * (chh + 12);
      XUI.panel(cx, cy, cw, chh, { r: 12, flat: true, fill: 'rgba(255,255,255,0.45)' });
      XUI.text(c.name, cx + 16, cy + 27, { size: 27, weight: 700, align: 'left' });
      XUI.text('Lv.' + c.lv, cx + cw - 16, cy + 27, { size: 23, color: IC.ink55, align: 'right', serif: false });
      XUI.text(c.desc, cx + 16, cy + 58, { size: 18, color: IC.indigo, align: 'left', serif: false });
      if (XUI.button('buy-' + c.key, cx + 12, cy + chh - 62, cw - 24, 50, {
        label: XB.fmt(c.cost) + ' 灵石',
        style: 'primary', size: 22, disabled: stones < c.cost
      })) {
        buyUpgrade(c.key);
      }
    }
  }

  function drawGongfaPanel(px, py, pw, ph) {
    var rowH = 92;
    var contentH = XB.GONGFA_COUNT * (rowH + 10) + 10;
    var sc = XUI.scrollArea('gongfa-list', px + 4, py + 4, pw - 8, ph - 8, contentH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 4, py + 4, pw - 8, ph - 8);
    ctx.clip();
    ctx.translate(0, -sc.off);
    XUI.beginScroll(sc);
    for (var i = 0; i < XB.GONGFA.length; i++) {
      var g = XB.GONGFA[i];
      var id0 = g.id;
      var locked = XB.realmIdx(S) < g.unlock;
      var ry = py + 10 + i * (rowH + 10);
      var afford = stones >= XB.gongfaCost(g, gf[i]);
      XUI.panel(px + 10, ry, pw - 20, rowH, {
        r: 12, flat: true,
        fill: locked ? 'rgba(47,42,36,0.05)' : 'rgba(255,255,255,0.5)',
        noBorder: !locked
      });
      /* 功法印 */
      XD.roundRectPath(ctx, px + 22, ry + 14, 64, 64, 10);
      ctx.fillStyle = locked ? 'rgba(47,42,36,0.08)' : 'rgba(176,58,48,0.12)';
      ctx.fill();
      XUI.text(locked ? '锁' : g.icon, px + 54, ry + 46,
               { size: 30, weight: 700, color: locked ? IC.ink30 : IC.cinnabar });
      XUI.text('《' + g.name + '》' + (locked ? '' : '  ' + gf[i] + ' 层'),
               px + 100, ry + 28, {
        size: 25, weight: 700, align: 'left',
        color: locked ? IC.ink30 : IC.ink
      });
      XUI.text(locked ? XB.REALM_LIST[g.unlock] + '期解锁 · ' + g.desc
                      : g.desc + (id0 === 'body' || !cmp[i] ? '' : ' · 领悟+' + Math.round(Math.min(cmp[i], XB.INSIGHT_CAP) * XB.BALANCE.insightPerPoint * 100) + '%'),
               px + 100, ry + 60, { size: 17, color: IC.ink55, align: 'left', serif: false });
      if (!locked) {
        if (XUI.button('gf-' + i, px + pw - 174, ry + 18, 150, 56, {
          label: XB.fmt(XB.gongfaCost(g, gf[i])),
          sub: '灵石' + (afford ? '' : ' · 不足'),
          style: 'gold', size: 20, disabled: !afford
        })) {
          buyGongfa(i);
        }
      }
    }
    XUI.endScroll();
    ctx.restore();
  }

  function drawMarketPanel(px, py, pw, ph) {
    if (!marketUnlocked()) {
      XUI.text('魔窟第 ' + XB.MARKET_UNLOCK_LEVEL + ' 层或筑基解锁坊市', px + pw / 2, py + ph / 2,
               { size: 26, color: IC.ink55 });
      return;
    }
    XUI.text('坊市 · 灵石主产线 · 每秒 +' + XB.fmtRate(curMarketRate()) + ' 灵石',
             px + 18, py + 22, { size: 21, color: '#8a6a30', align: 'left', weight: 700 });
    XUI.text('回本按当前产出估算', px + pw - 18, py + 22,
             { size: 17, color: IC.ink30, align: 'right', serif: false });
    var rowH = 56;
    for (var i = 0; i < XB.MARKET_SHOPS.length; i++) {
      var shop = XB.MARKET_SHOPS[i];
      var ry = py + 38 + i * (rowH + 3);
      var cost = XB.marketCost(i, mk[i]);
      var single = [0, 0, 0, 0, 0]; single[i] = 1;
      var perShop = XB.marketRate(single, S, gEff('map'), daoMult(), mp) * sectMarket() * marketEarningsMult();
      XUI.text(shop.name + (mp[i] > 0 ? ' Lv' + mp[i] : ''), px + 16, ry + rowH / 2,
               { size: 23, weight: 700, align: 'left' });
      XUI.text(mk[i] + ' 间 · ' + XB.fmtRate(perShop) + '/s·间',
               px + 108, ry + rowH / 2, { size: 17, color: IC.ink55, align: 'left', serif: false });
      if (XUI.button('mk-' + i, px + pw - 296, ry + 4, 140, rowH - 8, {
        label: '置办 ' + XB.fmt(cost), sub: '回本' + XB.formatDur(cost / perShop),
        style: 'gold', size: 19, disabled: stones < cost
      })) buyMarket(i);
      /* 利润配方升级 */
      var pcost = XB.marketProfitCost(i, mp[i], S);
      var needN = XB.MARKET_PROFIT_UP[mp[i] + 1];
      var canP = needN != null && mk[i] >= needN;
      var pLabel = needN == null ? '已至顶层' : (canP ? '升阶 ' + XB.fmt(pcost) : ('需' + needN + '间'));
      if (XUI.button('mkp-' + i, px + pw - 150, ry + 4, 136, rowH - 8, {
        label: pLabel, sub: canP ? '回本' + XB.formatDur(pcost / (mk[i] * perShop * (XB.MARKET_PROFIT_R - 1))) : '',
        style: 'primary', size: 19, disabled: !canP || stones < pcost
      })) buyMarketProfit(i);
    }
  }

  /* ---------- 魔窟面板 ---------- */
  function drawTowerPanel(px, py, pw, pnlH) {
    var inT = mode === 'tower';
    XUI.text('魔窟妖塔 · 以战养道', px + 18, py + 24,
             { size: 23, color: IC.cinnabar, align: 'left', weight: 700 });
    XUI.text('当前第 ' + level + ' 层 · 纪录 ' + towerBest + ' 层',
             px + pw - 18, py + 24, { size: 19, color: IC.ink55, align: 'right', serif: false });
    var hpMax = playerHpMax();
    XUI.bar(px + 16, py + 44, pw - 32, 26, Math.min(1, Math.max(0, ph) / hpMax), {
      fill: injured() ? 'rgba(143,43,35,0.75)' : '#7d9a6a'
    });
    XUI.text('气血 ' + XB.fmt(Math.round(ph)) + ' / ' + XB.fmt(hpMax) +
             (injured() ? ' · 重伤 ' + Math.ceil(injuryT) + 's（战力与打坐 -30%）' : ' · 闭关时自动回复'),
             px + pw / 2, py + 57, { size: 17, color: injured() ? '#8f2b23' : IC.ink55, serif: false });
    var iy = py + 84;
    XUI.text('层产出：修为·领悟·贡献为主，灵石仅少量补贴；第 ' + XB.TOWER_MILESTONE +
             ' 层里程碑必掉装备', px + 16, iy, { size: 18, color: IC.ink55, align: 'left', serif: false });
    XUI.text('血尽重伤 · 每推进5层有一次生死顿悟机会；卡关可温养积累贡献与领悟',
             px + 16, iy + 26, { size: 18, color: IC.ink55, align: 'left', serif: false });
    XUI.text('累计斩妖 ' + XB.fmt(totalKills) + ' · 顿悟 x' + epip +
             ' · 贡献 ' + XB.fmt(contrib),
             px + 16, iy + 52, { size: 18, color: IC.indigo, align: 'left', serif: false });
    if (inT) {
      if (XUI.button('tw-leave', px + pw / 2 - 150, py + pnlH - 74, 300, 58, {
        label: '归山（保留血量）', style: 'ghost', size: 24
      })) leaveTower();
    } else {
      if (XUI.button('tw-enter', px + 20, py + pnlH - 74, (pw - 52) / 2, 58, {
        label: injured() ? ('重伤未愈 ' + Math.ceil(injuryT) + 's') : '闯关 · 第 ' + towerFloor + ' 层',
        style: 'primary', size: 22, disabled: injured()
      })) enterTower('advance');
      if (XUI.button('tw-temper', px + pw / 2 + 6, py + pnlH - 74, (pw - 52) / 2, 58, {
        label: towerBest >= 6 ? '温养 · 积累贡献' : '推进6层解锁温养',
        style: 'gold', size: 21, disabled: injured() || towerBest < 6
      })) enterTower('temper');
    }
  }

  /* ---------- 宗门面板 ---------- */
  function drawSectPanel(px, py, pw, ph) {
    if (!sectId) {
      XUI.text('择一宗门拜入 · 镇宗功法以贡献值参研', px + pw / 2, py + 22,
               { size: 20, color: IC.ink55 });
      var colW = (pw - 24) / 2, rowH2 = 100;
      for (var i = 0; i < XB.SECTS.length; i++) {
        var sx = px + 8 + (i % 2) * (colW + 8);
        var sy = py + 40 + Math.floor(i / 2) * (rowH2 + 8);
        XUI.panel(sx, sy, colW, rowH2, { r: 10, flat: true, fill: 'rgba(255,255,255,0.5)' });
        XUI.text(XB.SECTS[i].name, sx + colW / 2, sy + 24, { size: 23, weight: 700 });
        XUI.text(XB.SECTS[i].motto, sx + colW / 2, sy + 48, { size: 16, color: IC.indigo, serif: false });
        XUI.text(XB.SECTS[i].passive, sx + colW / 2, sy + 68, { size: 15, color: IC.ink55, serif: false });
        if (XUI.button('join-' + XB.SECTS[i].id, sx + colW / 2 - 52, sy + rowH2 - 34, 104, 30, {
          label: '拜入', style: 'gold', size: 18
        })) joinSect(XB.SECTS[i].id);
      }
      return;
    }
    var sect = XB.getSect(sectId);
    XUI.text(sect.name + ' · ' + sect.motto, px + 16, py + 22,
             { size: 21, weight: 700, align: 'left', color: IC.cinnabar });
    XUI.text('贡献 ' + XB.fmt(contrib), px + pw - 16, py + 22,
             { size: 20, weight: 700, align: 'right', color: IC.goldDeep || '#8a6a30' });
    /* 镇宗功法 */
    var ay = py + 42;
    for (var ai = 0; ai < sect.arts.length; ai++) {
      var art = sect.arts[ai];
      var alv = sectArtLv(art.id);
      var acost = XB.sectArtCost(art, alv);
      var locked = S < art.reqS;
      XUI.panel(px + 10, ay, pw - 20, 62, { r: 10, flat: true, fill: 'rgba(255,255,255,0.45)' });
      XUI.text('《' + art.name + '》' + alv + '层', px + 24, ay + 20,
        { size: 20, weight: 700, align: 'left', color: locked ? IC.ink30 : IC.ink });
      XUI.text(locked ? '需 ' + XB.realmName(art.reqS) + ' 方可参研 · ' + art.desc : art.desc,
        px + 24, ay + 44, { size: 15, color: IC.ink55, align: 'left', serif: false });
      if (XUI.button('art-' + art.id, px + pw - 160, ay + 8, 142, 46, {
        label: XB.fmt(acost) + ' 贡献', style: 'gold', size: 18,
        disabled: locked || contrib < acost
      })) learnArt(art.id);
      ay += 68;
    }
    /* 宗门任务 */
    XUI.text('宗门任务（缴令后换新令）', px + 16, ay + 4, { size: 17, color: IC.indigo, align: 'left', weight: 700 });
    ay += 16;
    for (var mi = 0; mi < 3; mi++) {
      var m = missions[mi];
      if (!m) continue;
      var cur = missionCur(m), nd = missionNeed(m);
      var done = missionDone(m);
      var mkinds = XB.MISSION_KINDS;
      var kindName = '历练';
      for (var ki = 0; ki < mkinds.length; ki++) if (mkinds[ki].kind === m.kind) kindName = mkinds[ki].text(m.kind === 'floor' || m.kind === 'shop' ? m.need : nd);
      XUI.text(kindName, px + 16, ay + 12, { size: 16, align: 'left', color: IC.ink, serif: false });
      XUI.bar(px + 250, ay + 6, pw - 470, 12, Math.min(1, cur / nd), { fill: done ? IC.cinnabar : IC.gold });
      if (XUI.button('mis-' + mi, px + pw - 160, ay - 4, 142, 32, {
        label: done ? '+' + m.contrib + '贡献' : (cur + '/' + nd),
        style: done ? 'primary' : 'ghost', size: 15, disabled: !done, r: 8
      })) claimMission(mi);
      ay += 30;
    }
  }


  function drawBagPanel(px, py, pw, ph) {
    XUI.text('行囊 · 总战力 +' + XB.fmt(totalPower()),
             px + 18, py + 26, { size: 23, color: '#8a6a30', align: 'left', weight: 700 });
    XUI.text('击杀掉落 · Boss 必掉 · 强者自动穿上',
             px + pw - 18, py + 26, { size: 18, color: IC.ink30, align: 'right', serif: false });
    var rowH = 62;
    for (var i = 0; i < XB.EQUIP_SLOTS.length; i++) {
      var sl = XB.EQUIP_SLOTS[i];
      var it = eq[sl];
      var ry = py + 46 + i * (rowH + 4);
      XD.roundRectPath(ctx, px + 16, ry, 52, 52, 10);
      ctx.fillStyle = it ? 'rgba(201,160,90,0.18)' : 'rgba(47,42,36,0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(47,42,36,0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      XUI.text(XB.SLOT_NAMES[sl], px + 42, ry + 27, { size: 25, weight: 700 });
      XUI.text(it ? it.name : '— 空 —', px + 88, ry + 27,
               { size: 23, align: 'left', color: it ? IC.ink : IC.ink30 });
      if (it) {
        XUI.text('+' + XB.fmt(Math.round(it.power)), px + pw - 22, ry + 27,
                 { size: 23, color: '#8a6a30', align: 'right', weight: 700, serif: false });
      }
    }
  }

  function questList() {
    var shops = mk[0] + mk[1] + mk[2] + mk[3] + mk[4];
    return [
      { id: 'first-blood', title: '初入山门', desc: '斩妖 10 只',
        progress: totalKills, goal: 10, reward: 180, unlocked: true },
      { id: 'ten-thousand', title: '小试牛刀', desc: '魔窟推进到第 10 层（首个大妖）',
        progress: Math.min(Math.max(0, level - 1), 10), goal: 10, reward: 500, unlocked: true },
      { id: 'steady-heart', title: '静心悟道', desc: '吐纳术达到 5 级',
        progress: tn, goal: 5, reward: 420, unlocked: !!questClaimed['first-blood'] },
      { id: 'merchant', title: '坊市立足', desc: '坊市拥有 8 间店铺',
        progress: shops, goal: 8, reward: 900, unlocked: !!questClaimed['ten-thousand'] },
      { id: 'fate-bound', title: '仙缘初结', desc: '在某次机缘中选择积累仙缘（仙缘 ≥ 1）',
        progress: bond > 0 ? 1 : 0, goal: 1, reward: 1500, unlocked: !!questClaimed['steady-heart'] },
      { id: 'sword-heart', title: '剑心通明', desc: '在某次机缘中坚定剑心（剑心 ≥ 1）',
        progress: sgn > 0 ? 1 : 0, goal: 1, reward: 1500, unlocked: !!questClaimed['fate-bound'] },
      { id: 'foundational', title: '筑基大道', desc: '修至筑基期（跨过第一道大门）',
        progress: XB.realmIdx(S) >= 1 ? 1 : 0, goal: 1, reward: 5000,
        unlocked: !!questClaimed['merchant'] }
    ];
  }
  function claimQuest(id) {
    var qs = questList();
    for (var i = 0; i < qs.length; i++) if (qs[i].id === id && !questClaimed[id]) {
      if (!qs[i].unlocked || qs[i].progress < qs[i].goal) return;
      questClaimed[id] = true;
      stones += qs[i].reward;
      saveGame();
      XUI.toast('仙途·「' + qs[i].title + '」完成 · +' + XB.fmt(qs[i].reward) + ' 灵石');
      XAudio.buy();
    }
  }

  function drawQuestPanel(px, py, pw, ph) {
    /* 上半：行囊（装备只来自机缘与塔层里程碑） */
    XUI.text('行囊 · 总战力 +' + XB.fmt(totalPower()), px + 18, py + 22,
             { size: 20, color: '#8a6a30', align: 'left', weight: 700 });
    XUI.text('装备来自机缘与塔层里程碑', px + pw - 18, py + 22,
             { size: 16, color: IC.ink30, align: 'right', serif: false });
    var bw = (pw - 40) / 4;
    for (var bi = 0; bi < XB.EQUIP_SLOTS.length; bi++) {
      var sl = XB.EQUIP_SLOTS[bi];
      var it = eq[sl];
      var bx2 = px + 12 + bi * (bw + 8);
      XD.roundRectPath(ctx, bx2, py + 34, bw, 40, 8);
      ctx.fillStyle = it ? 'rgba(201,160,90,0.16)' : 'rgba(47,42,36,0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(47,42,36,0.35)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      XUI.text(XB.SLOT_NAMES[sl] + ' · ' + (it ? '+' + XB.fmt(Math.round(it.power)) : '空'),
               bx2 + bw / 2, py + 54, { size: 16, color: it ? IC.ink : IC.ink30, serif: false });
    }
    /* 下半：仙途任务链 */
    var qs = questList();
    var rowH = 64, gap = 8, listTop = py + 84;
    var contentH = qs.length * (rowH + gap) + 16;
    var sc = XUI.scrollArea('quest-list', px + 4, listTop, pw - 8, ph - (listTop - py) - 8, contentH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 4, listTop, pw - 8, ph - (listTop - py) - 8);
    ctx.clip();
    ctx.translate(0, -sc.off);
    XUI.beginScroll(sc);
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var y = listTop + 4 + i * (rowH + gap);
      var done = !!questClaimed[q.id];
      var locked = !q.unlocked && !done;
      var ready = !locked && !done && q.progress >= q.goal;
      XUI.panel(px + 12, y, pw - 24, rowH, { r: 10, flat: true,
        fill: done ? 'rgba(47,42,36,0.07)' : (locked ? 'rgba(47,42,36,0.05)' : 'rgba(255,255,255,0.5)') });
      XUI.text(done ? '✓ ' + q.title : q.title, px + 28, y + 20,
        { size: 21, weight: 700, align: 'left', color: done || locked ? IC.ink30 : IC.ink });
      XUI.text(locked ? '？需先完成前置仙途' : q.desc + ' · ' + Math.min(q.progress, q.goal) + '/' + q.goal,
        px + 28, y + 44, { size: 16, color: IC.ink55, align: 'left', serif: false });
      if (!locked) {
        if (XUI.button('quest-' + q.id, px + pw - 170, y + 8, 142, rowH - 16, {
          label: done ? '已领取' : ('+' + XB.fmt(q.reward)),
          sub: done ? '' : '灵石',
          style: ready ? 'primary' : 'gold', size: 18, disabled: done || !ready
        })) claimQuest(q.id);
      }
    }
    XUI.endScroll();
    ctx.restore();
  }

  /* ---------- 弹窗 ---------- */
  function openModal(which) {
    modal = which;
    resetArmed = false;
    rebirthArmed = false;
  }

  function drawModalCard(w, h) {
    var x = 375 - w / 2;
    var y = VIEW_H / 2 - h / 2;   /* 随视口居中，不再写死 667 */
    XUI.panel(x, y, w, h, { r: 18, fill: IC.paper, border: 'rgba(47,42,36,0.7)' });
    return { x: x, y: y, w: w, h: h };
  }

  function drawModals() {
    if (!modal && storyQueue.length) {
      storyRealm = storyQueue.shift();
      storySeen[storyRealm] = 1;
      modal = 'story';
    }

    if (modal === 'story') {
      XUI.modalBackdrop('story-bg', VIEW_W, VIEW_H);
      var ms = drawModalCard(600, 520);
      XUI.text('· ' + XB.REALM_LIST[storyRealm] + ' ·', 375, ms.y + 64,
               { size: 36, weight: 800, color: IC.cinnabar });
      var stext = XB.REALM_STORY[storyRealm] || '前路无名，自行落笔。';
      XUI.text(stext, 375, ms.y + 150, {
        size: 24, color: IC.ink, maxW: ms.w - 96, lineH: 40, serif: true
      });
      if (storyRealm > 0) {
        var rewards = XB.breakthroughPreview(storyRealm * 4 - 1);
        XUI.text('战力与修行 ×' + XB.fmtRate(rewards.powerMult) + ' · 气血回满',
          375, ms.y + 290, { size: 23, color: IC.cinnabar, weight: 700 });
        XUI.text(rewards.unlocks.length ? '新功法 · ' + rewards.unlocks.join('、') : '再入魔窟，试一试旧日的大妖',
          375, ms.y + 332, { size: 20, color: IC.indigo });
      }
      XUI.text('—— 第 ' + (storyRealm + 1) + ' 卷 · ' + XB.REALM_LIST[storyRealm] + ' ——',
               375, ms.y + ms.h - 130, { size: 18, color: IC.ink30, serif: false });
      if (XUI.button('story-ok', 375 - 120, ms.y + ms.h - 96, 240, 60, {
        label: '继续修行', style: 'primary', size: 24
      })) {
        modal = null;
      }
      return;
    }

    if (modal === 'fate' && !fateEvent) modal = null;   /* 自愈：防状态卡死 */
    if (modal === 'fate' && fateEvent) {
      XUI.modalBackdrop('fate-bg', VIEW_W, VIEW_H);
      var mf = drawModalCard(600, 640);
      XUI.text('机 缘', 375, mf.y + 56, { size: 34, weight: 800, color: IC.goldDeep || '#8a6a30' });
      XUI.text('· ' + fateEvent.title + ' ·', 375, mf.y + 104,
               { size: 28, weight: 700, color: IC.cinnabar });
      XUI.text(fateEvent.text, 375, mf.y + 190, {
        size: 23, color: IC.ink, maxW: mf.w - 96, lineH: 38, serif: true
      });
      /* 先拿住选项引用：resolveFateOption 会同步清空 fateEvent，
         若循环条件再读 fateEvent.options 会抛异常导致主循环死亡 */
      var fopts = fateEvent.options || [];
      for (var fi = 0; fi < fopts.length; fi++) {
        var fo = fopts[fi];
        if (XUI.button('fate-' + fi, mf.x + 60, mf.y + 320 + fi * 96, mf.w - 120, 78, {
          label: fo.label, sub: fateOptionPreview(fo), style: fi === 0 ? 'primary' : 'gold', size: 24
        })) {
          resolveFateOption(fi);
          return;   /* 结算后本帧命运分支终止，避免碰已失效状态 */
        }
      }
      XUI.text('机缘只在一念之间', 375, mf.y + mf.h - 40,
               { size: 17, color: IC.ink30, serif: false });
      return;
    }

    if (modal === 'settings') {
      XUI.modalBackdrop('dismiss', VIEW_W, VIEW_H);
      var m = drawModalCard(520, 560);
      XUI.text('设 置', 375, m.y + 52, { size: 32, weight: 800 });
      var bx = m.x + 40, bw = m.w - 80, by = m.y + 96, bh = 64, gap = 14;
      if (XUI.button('mute', bx, by, bw, bh, {
        label: muted ? '音效：关' : '音效：开', size: 24
      })) { muted = !muted; XAudio.setMuted(muted); saveGame(); }
      by += bh + gap;
      if (XUI.button('card', bx, by, bw, bh, { label: '保存境界卡', size: 24 })) {
        saveRealmCard();
      }
      by += bh + gap;
      if (XUI.button('realm', bx, by, bw, bh, { label: '境界画卷', size: 24 })) {
        modal = 'realm';
      }
      by += bh + gap;
      if (XUI.button('reset', bx, by, bw, bh, {
        label: resetArmed ? '再点一次，清除全部进度' : '重修（清档重开）',
        style: resetArmed ? 'danger' : 'ghost', size: 22
      })) {
        if (!resetArmed) { resetArmed = true; resetArmT = 3; }
        else { clearSave(); freshState(); modal = null; XUI.toast('已重修，从头再来'); }
      }
      by += bh + gap;
      if (XUI.button('close', bx, by, bw, bh, { label: '关闭', size: 24 })) {
        modal = null;
      }
      XUI.text('进度每 3 秒自动保存 · v4 宗门魔窟版',
               375, m.y + m.h - 26, { size: 17, color: IC.ink30, serif: false });
      return;
    }

    if (modal === 'realm') {
      XUI.modalBackdrop('dismiss', VIEW_W, VIEW_H);
      var mm = drawModalCard(640, 900);
      XUI.text('境 界 画 卷', 375, mm.y + 50, { size: 30, weight: 800 });
      XUI.text('当前 ' + XB.realmName(S) + ' · 道基 +' + dj +
               ' · 仙缘 +' + bond + ' · 剑心 +' + sgn,
               375, mm.y + 88, { size: 20, color: IC.ink55, serif: false });
      var rows = XB.REALM_LIST.length;
      var rowH = 44;
      var listH = rows * (rowH + 4) + 8;
      var sc = XUI.scrollArea('realm-list', mm.x + 24, mm.y + 112, mm.w - 48, 560, listH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(mm.x + 24, mm.y + 112, mm.w - 48, 560);
      ctx.clip();
      ctx.translate(0, -sc.off);
      XUI.beginScroll(sc);
      for (var r = 0; r < rows; r++) {
        var y2 = mm.y + 116 + r * (rowH + 4);
        var cur = r === XB.realmIdx(S);
        var passed = r < XB.realmIdx(S);
        if (cur) {
          XD.roundRectPath(ctx, mm.x + 30, y2, mm.w - 60, rowH, 10);
          ctx.fillStyle = 'rgba(176,58,48,0.1)';
          ctx.fill();
        }
        XUI.text((r + 1) + '. ' + XB.REALM_LIST[r],
                 mm.x + 60, y2 + rowH / 2, {
          size: 25, weight: cur ? 800 : 500, align: 'left',
          color: cur ? IC.cinnabar : (passed ? IC.ink55 : IC.ink30)
        });
        XUI.text(cur ? '当前' : (passed ? '已参悟' : '未至'),
                 mm.x + mm.w - 60, y2 + rowH / 2, {
          size: 20, color: cur ? IC.cinnabar : IC.ink30, serif: false
        });
      }
      XUI.endScroll();
      ctx.restore();

      /* 轮回区 */
      var rbY = mm.y + mm.h - 150;
      if (canRebirth()) {
        var gain = XB.daoJiGain(S);
        if (rebirthArmed) XUI.text('重修：境界、灵石、装备、修行升级、普通功法、坊市归零\n保留：道基、宗门功法、贡献、顿悟、仙缘、剑心',
          375, rbY - 44, { size: 17, lineH: 20, maxW: mm.w - 50, color: IC.ink55 });
        if (XUI.button('rebirth', mm.x + 60, rbY, mm.w - 120, 60, {
          label: rebirthArmed ? Math.ceil(rebirthArmT) + '秒内再点 · 转世重修' :
                 '轮回转世（+' + gain + ' 道基）',
          style: rebirthArmed ? 'danger' : 'primary', size: 24
        })) {
          if (!rebirthArmed) { rebirthArmed = true; rebirthArmT = 5; }
          else doRebirth();
        }
        XUI.text('本次永久收益 ×' + XB.fmtRate(XB.daoJiMult(dj + gain) / daoMult()) + ' · 道基每点 +12%',
                 375, rbY + 84, { size: 17, color: IC.ink55, serif: false });
      } else {
        XUI.text('修至渡劫初期（' + (XB.REBIRTH_UNLOCK_S + 1) + '/' +
                 (XB.MAX_STAGE + 1) + '）解锁轮回转世',
                 375, rbY + 30, { size: 19, color: IC.ink30, serif: false });
      }
      if (XUI.button('realm-close', 375 - 80, mm.y + mm.h - 56, 160, 52,
                     { label: '合上画卷', size: 22 })) {
        modal = null;
      }
      return;
    }

    if (modal === 'offline' && offlineInfo) {
      XUI.modalBackdrop('offline-bg', VIEW_W, VIEW_H);
      var mo = drawModalCard(600, 560);
      XUI.text('闭 关 归 来', 375, mo.y + 60, { size: 32, weight: 800 });
      XUI.text('闭关 ' + XB.formatDur(offlineInfo.seconds),
               375, mo.y + 130, { size: 26, color: IC.ink55 });
      var ly = mo.y + 200;
      if (offlineInfo.expGain > 0) {
        XUI.text('打坐修为 +' + XB.fmt(offlineInfo.expGain),
                 375, ly, { size: 30, color: IC.cinnabar, weight: 700 });
        ly += 56;
      }
      if (offlineInfo.stoneGain > 0) {
        XUI.text('坊市入账 +' + XB.fmt(offlineInfo.stoneGain) + ' 灵石',
                 375, ly, { size: 30, color: '#8a6a30', weight: 700 });
        ly += 56;
      }
      XUI.text(offlineInfo.injuryRemaining > 0 ? '继续养伤 ' + Math.ceil(offlineInfo.injuryRemaining) + '秒' : '闭关养息 · 气血已恢复',
               375, mo.y + 320, { size: 21, color: IC.indigo });
      XUI.text('前 2 小时全额收益，其后 50%，24 小时封顶',
               375, mo.y + mo.h - 154, { size: 18, color: IC.ink30, serif: false });
      XUI.text('打坐效率越高，闭关收获越丰',
               375, mo.y + mo.h - 126, { size: 18, color: IC.ink30, serif: false });
      if (XUI.button('offline-ok', 375 - 120, mo.y + mo.h - 94, 240, 66, {
        label: '收 下', style: 'primary', size: 26
      })) {
        dismissOffline();
      }
    }
  }

  function saveRealmCard() {
    var tmp = XP.createCanvas(750, 1000);
    XD.drawRealmCard(tmp, {
      realm: XB.realmShort(S),
      stage: XB.STAGE_NAMES[XB.stageIdx(S)],
      level: level,
      stones: stones,
      power: totalPower(),
      dj: dj,
      rb: rb,
      date: new Date ? new Date().toLocaleDateString('zh-CN') : ''
    });
    var dataUri;
    try { dataUri = tmp.toDataURL('image/png'); }
    catch (e) { XUI.toast('生成境界卡失败'); return; }
    XP.saveImageToPhotosAlbum(dataUri, function (err) {
      XUI.toast(err ? '保存失败，请重试' : '境界卡已存入相册');
    });
  }

  /* ---------- 主循环 ---------- */
  function updateCore(dt) {
    if (hiddenAt) return; // Background time is settled once on return, never twice.
    nowSec += dt;

    /* 突破动画推进 */
    if (bt) {
      bt.t += dt;
      if (bt.t >= (bt.big ? 2.4 : 0.8)) {
        var wasBig = bt.big;
        if (!bt.transitionOnly) finishBreak();
        bt = null;
        if (!wasBig) checkBreakthroughAuto();
      }
    }

    /* 连击窗口衰减 */
    if (combo.n > 0) {
      combo.t += dt;
      if (combo.t > XB.COMBO_WINDOW) combo.n = 0;
    }

    /* 打坐修为增长（主） */
    if (scene === SCENE_PLAY && !(bt && bt.big)) {
      exp += medRate() * dt;
      /* 小境界修为满自动突破（周期检查即可） */
      autoBtT += dt;
      if (autoBtT >= 0.4) {
        autoBtT = 0;
        checkBreakthroughAuto();
      }
    }

    /* 灵气潮汐 */
    if (scene === SCENE_PLAY) updateTide(dt);

    /* 背景过渡 */
    if (bgTrans < 1) {
      bgTrans = Math.min(1, bgTrans + dt * 0.8);
      if (bgTrans >= 0.99) bgPrevBand = XD.bandOf(XB.realmIdx(S));
    }

    if (scene !== SCENE_PLAY) return;

    /* ---------- v4：日常 / 魔窟 状态机 ---------- */
    if (mode === 'home') {
      /* 养伤倒计时 */
      if (injuryT > 0) {
        injuryT = Math.max(0, injuryT - dt * sectHealMult());
        if (injuryT <= 0) { XUI.toast('伤愈 · 可再入魔窟'); ph = Math.max(ph, playerHpMax() * 0.3); }
      }
      /* 气血恢复 */
      var hpMax = playerHpMax();
      if (ph < hpMax) {
        var rate = injured() ? XB.INJURY_HEAL_RATE : XB.HEAL_RATE;
        ph = Math.min(hpMax, ph + hpMax * rate * sectHealMult() * dt);
      }
      /* 日常机缘：不靠杀怪，静极生动 */
      homeFateT -= dt;
      if (homeFateT <= 0) {
        homeFateT = 50 + Math.random() * 90;
        if (!modal && !bt && Math.random() < 0.7) openFateEvent();
      }
      /* 打坐呼吸浮动：只在修行页与山门 pill 下轻微提示 */
      breathT += dt;
      if (breathT >= 3.2 && !(bt && bt.big) && activeTab === 'cult') {
        breathT = 0;
        addFloat(150, MON_BASE_Y - 250, '入定 +' + XB.fmtRate(medRate() * 3.2) + ' 修为', 'rgba(61,74,92,0.45)', 22, 1.3);
      }
    } else {
      /* 魔窟：妖兽周期性扑咬主角（弹窗期间暂停，不打断执择） */
      if (monster && monster.dyingT < 0 && !modal && !(bt && bt.big)) {
        monAtkT += dt;
        var gap = XB.TOWER_ATK_GAP * (monster.boss ? 0.8 : 1);
        if (monAtkT >= gap) { monAtkT = 0; monsterHitsPlayer(); }
      }
    }

    /* 妖兽生命周期 */
    if (monster) {
      if (monster.spawnT < 1) monster.spawnT = Math.min(1, monster.spawnT + dt * 2.2);
      if (monster.hurtT > 0) monster.hurtT = Math.max(0, monster.hurtT - dt);
      if (monster.dyingT >= 0) {
        monster.dyingT += dt;
        if (monster.dyingT >= 0.5) advanceLevel();
      }
    }

    /* 剑侍自动伤害（弹窗期间暂停战斗） */
    var dps = curDps();
    if (dps > 0 && monster && monster.dyingT < 0 && !modal &&
        monster.spawnT >= 0.5 && !(bt && bt.big)) {
      dealDamage(dps * dt);
      dpsAccShow += dps * dt;
      dpsFloatT += dt;
      if (dpsFloatT >= 0.7 && monster && monster.dyingT < 0) {
        if (dpsAccShow > 0) {
          var c = monsterCenter();
          addFloat(c.x + 150, c.y - 20, '-' + XB.fmt(dpsAccShow), '#3d4a5c', 28);
        }
        dpsFloatT = 0;
        dpsAccShow = 0;
      }
    }

    /* 按住连斩 */
    if (hold.active && nowSec - hold.last >= SWING_GAP) {
      if (attackAt(hold.x + (Math.random() - 0.5) * 60,
                   hold.y + (Math.random() - 0.5) * 60)) {
        hold.last = nowSec;
      } else {
        hold.active = false;
      }
    }

    /* 坊市产出（灵石主产线） */
    var mkt = curMarketRate();
    if (mkt > 0) { stones += mkt * dt; accStones += mkt * dt; }

    /* 特效推进 */
    var i;
    for (i = slashes.length - 1; i >= 0; i--) {
      slashes[i].t += dt;
      if (slashes[i].t >= 0.18) slashes.splice(i, 1);
    }
    for (i = floats.length - 1; i >= 0; i--) {
      floats[i].t += dt;
      if (floats[i].t >= floats[i].life) floats.splice(i, 1);
    }
    for (i = smokes.length - 1; i >= 0; i--) {
      var p = smokes[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 30 * dt;
      p.r += 26 * dt;
      p.alpha = 0.34 * (1 - p.t / p.life);
      if (p.t >= p.life) smokes.splice(i, 1);
    }

    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    if (rebirthArmed) {
      rebirthArmT -= dt;
      if (rebirthArmT <= 0) rebirthArmed = false;
    }
    if (resetArmed) {
      resetArmT -= dt;
      if (resetArmT <= 0) resetArmed = false;
    }

    /* 自动存档 */
    autosaveT += dt;
    if (autosaveT >= AUTOSAVE_SEC) {
      autosaveT = 0;
      saveGame();
    }
  }

  function render(dt) {
    var dpr = resize._dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(
      dpr * viewScale, 0, 0, dpr * viewScale,
      dpr * viewOffsetX, dpr * viewOffsetY
    );

    if (shakeT > 0) {
      var amp = shakeT * 26;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }

    XUI.beginFrame(ctx, dt);

    if (scene === SCENE_TITLE) {
      XD.drawBackground(ctx, 0, nowSec, 0, 1, MON_BASE_Y);
      drawTitle();
    } else {
      /* 场景 */
      var prevForBg = bgTrans < 1 ? bgPrevBand : XD.bandOf(XB.realmIdx(S));
      XD.drawBackground(ctx, XB.realmIdx(S), nowSec, prevForBg, bgTrans, MON_BASE_Y);
      var sceneCy = monster ? monsterCenter().y : MON_BASE_Y - 210;
      XD.drawTide(ctx, tideStrength(), nowSec, sceneCy);
      if (mode === 'tower' && monster) {
        XD.drawMonster(ctx, monster, nowSec);
      } else if (mode === 'home') {
        /* 场景随页签而变：妖塔只在「魔窟」页现身 */
        if (activeTab === 'tower') {
          XD.drawTower(ctx, 375, MON_BASE_Y, nowSec, towerBest);
          var gy = MON_BASE_Y - 402;
          XUI.text(injured() ? '重伤未愈 · 塔门封闭' : '魔窟妖塔 · 以战养道',
                   375, gy - 16, { size: 19, color: injured() ? '#8f2b23' : IC.ink55, serif: false });
          XUI.register('tw-gate', 375 - 130, MON_BASE_Y - 330, 260, 330);
          if (XUI.button('tw-enter-main', 375 - 108, gy + 4, 216, 54, {
            label: injured() ? ('将养 ' + Math.ceil(injuryT) + 's') : ('入塔历练 · 第 ' + level + ' 层'),
            style: 'primary', size: 23, disabled: injured()
          })) enterTower('advance');
          else if (XUI.tapped('tw-gate')) enterTower('advance');
        } else if (activeTab === 'cult') {
          XD.drawCenser(ctx, 375, MON_BASE_Y, nowSec);
        } else if (activeTab === 'sect') {
          XD.drawPaifang(ctx, 375, MON_BASE_Y, nowSec, sectId ? XB.getSect(sectId).name : '');
        } else if (activeTab === 'gongfa') {
          var cols = [];
          for (var gi9 = 0; gi9 < XB.GONGFA.length; gi9++) {
            if (XB.realmIdx(S) >= XB.GONGFA[gi9].unlock)
              cols.push(XB.GONGFA[gi9].name);
          }
          XD.drawScroll(ctx, 375, MON_BASE_Y, nowSec, cols.slice(0, 8));
        } else if (activeTab === 'market') {
          XD.drawStall(ctx, 375, MON_BASE_Y, nowSec);
        } else {
          XD.drawPath(ctx, 375, MON_BASE_Y, nowSec);
        }
      }
      var i;
      for (i = 0; i < slashes.length; i++) XD.drawSlash(ctx, slashes[i]);
      for (i = 0; i < smokes.length; i++) XD.drawSmoke(ctx, smokes[i]);
      for (i = 0; i < floats.length; i++) XD.drawFloatText(ctx, floats[i]);

      /* 连击标签 */
      if (combo.n >= 5) {
        XD.drawComboTag(ctx, 375, sceneCy - 190, combo.n, combo.t);
      }

      /* HUD 与面板 */
      drawTopHUD();
      drawBottomPanel();
    }

    /* 突破演出置顶 */
    if (bt) XD.drawBreakthrough(ctx, bt);

    drawModals();
    XUI.drawToasts(dt);
  }

  var lastFrame = 0;
  function frame(ts) {
    var elapsed = lastFrame ? Math.max(0, (ts - lastFrame) / 1000) : 0.016;
    if (!isFinite(elapsed)) elapsed = 0.016;
    lastFrame = isFinite(ts) ? ts : 0;
    if (hiddenAt) { requestAnimationFrame(frame); return; }
    /* Keep physical steps small without throwing away a slow device's elapsed time. */
    try {
      if (scene !== SCENE_PLAY) updateCore(Math.min(0.05, elapsed));
      else if (elapsed > 5) {
        // A suspended or stalled foreground must not need thousands of catch-up frames.
        // It receives the same bounded, non-combat settlement as a returning player.
        hold.active = false; rebirthArmed = false; resetArmed = false;
        XUI.cancelPointer();
        settleOffline(computeOffline(currentSnapshot(), elapsed));
      } else {
        var count = Math.max(1, Math.ceil(elapsed / 0.05));
        for (var i = 0; i < count; i++) updateCore(elapsed / count);
      }
      render(Math.min(0.05, elapsed));
    } catch (e) {
      if (G0) { try { G0.__errs.push('frame: ' + (e && e.stack || e)); } catch (e2) {} }
      if (typeof console !== 'undefined' && console.error) console.error(e);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function toLogical(cx, cy) {
    /* client 坐标 → 逻辑坐标（canvas 全屏铺满） */
    return {
      x: (cx - viewOffsetX) / viewScale,
      y: (cy - viewOffsetY) / viewScale
    };
  }

  function onDown(cx, cy) {
    XAudio.init();
    var p = toLogical(cx, cy);
    var hitUI = XUI.pointerDown(p.x, p.y);
    hold.active = false;
    if (scene === SCENE_PLAY && mode === 'tower' && !hitUI) {
      if (attackAt(p.x, p.y)) {
        hold.active = true;
        hold.x = p.x;
        hold.y = p.y;
        hold.last = nowSec;
      }
    }
  }
  function onMove(cx, cy) {
    var p = toLogical(cx, cy);
    XUI.pointerMove(p.x, p.y);
  }
  function onUp(cx, cy) {
    var p = toLogical(cx, cy);
    XUI.pointerUp(p.x, p.y);
    hold.active = false;
  }

  if (!XP.isWx) {
    cv.addEventListener('pointerdown', function (ev) {
      onDown(ev.clientX, ev.clientY);
      ev.preventDefault();
    }, { passive: false });
    cv.addEventListener('pointermove', function (ev) {
      onMove(ev.clientX, ev.clientY);
    }, { passive: true });
    cv.addEventListener('pointerup', function (ev) {
      onUp(ev.clientX, ev.clientY);
    }, { passive: true });
    cv.addEventListener('pointerleave', function () {
      hold.active = false;
    }, { passive: true });
    cv.addEventListener('wheel', function (ev) {
      var p = toLogical(ev.clientX, ev.clientY);
      XUI.wheel(p.x, p.y, ev.deltaY);
      ev.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', function (ev) { ev.preventDefault(); });
  } else {
    wx.onTouchStart(function (e) {
      var t = e.touches[0];
      if (t) onDown(t.clientX != null ? t.clientX : t.pageX,
                    t.clientY != null ? t.clientY : t.pageY);
    });
    wx.onTouchMove(function (e) {
      var t = e.touches[0];
      if (t) onMove(t.clientX != null ? t.clientX : t.pageX,
                    t.clientY != null ? t.clientY : t.pageY);
    });
    wx.onTouchEnd(function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (t) onUp(t.clientX != null ? t.clientX : t.pageX,
                  t.clientY != null ? t.clientY : t.pageY);
      else { XUI.pointerUp(-100, -100); hold.active = false; }
    });
    wx.onTouchCancel(function () {
      XUI.pointerUp(-100, -100);
      hold.active = false;
    });
  }

  /* ---------- 前后台切换 ---------- */
  XP.onHide(function () {
    if (scene !== SCENE_PLAY || hiddenAt) return;
    hiddenAt = Date.now();
    hold.active = false;
    rebirthArmed = false; resetArmed = false;
    XUI.cancelPointer();
    saveGame();
  });
  XP.onShow(function () {
    if (!hiddenAt) return;
    var gap = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    lastFrame = 0;
    if (scene === SCENE_PLAY) settleOffline(computeOffline(currentSnapshot(), gap));
  });
  if (!XP.isWx && typeof document !== 'undefined') {
    window.addEventListener('pagehide', saveGame);
  }

  function currentSnapshot() {
    return {
      ts: Date.now() - 0,
      S: S, tn: tn, gf: gf.slice(), dj: dj, mk: mk.slice(),
      cmp: cmp.slice(), mp: mp.slice(), bond: bond, epip: epip,
      sectId: sectId, sectLv: Object.assign({}, sectLv),
      injuryT: injuryT, ph: ph, eq: eq, mode: mode
    };
  }

  /* ---------- 启动 ---------- */
  refreshTitleSave();
  requestAnimationFrame(frame);

  /* ---------- 测试钩子（浏览器自动化用） ---------- */
  var G = typeof window !== 'undefined' ? window
        : (typeof GameGlobal !== 'undefined' ? GameGlobal : null);
  if (G) {
    G.__test = {
      step: function (sec, noRender) {
        var steps = Math.ceil(sec / 0.05);
        var per = sec / steps;
        for (var i = 0; i < steps; i++) updateCore(per);
        if (!noRender) render(per);   /* 必须传 dt：否则 drawToasts 等依赖渲染计时的逻辑会被 NaN 污染 */
      },
      state: function () {
        return {
          scene: scene,
          stones: stones, exp: exp, S: S, level: level,
          sj: sj, ss: ss, ls: ls, tn: tn, gf: gf.slice(),
          dj: dj, rb: rb, bond: bond, sgn: sgn, best: best,
          mk: mk.slice(), accStones: accStones,
          mode: mode, towerPlan: towerPlan, epipFrontier: epipFrontier, ph: Math.round(ph), phMax: playerHpMax(),
          towerBest: towerBest, injuryT: injuryT, epip: epip,
          contrib: contrib, sectId: sectId, sectLv: JSON.parse(JSON.stringify(sectLv || {})),
          cmp: cmp.slice(), mp: mp.slice(),
          missions: (function () { var a = []; for (var mmi = 0; mmi < 3; mmi++) { var m = missions[mmi]; a.push(m ? { kind: m.kind, cur: Math.round(missionCur(m) * 100) / 100, need: missionNeed(m), done: missionDone(m) } : null); } return a; })(),
          quests: (function () { var a = questList(), r = []; for (var qi = 0; qi < a.length; qi++) r.push({ id: a[qi].id, done: !!questClaimed[a[qi].id], ready: a[qi].unlocked && !questClaimed[a[qi].id] && a[qi].progress >= a[qi].goal }); return r; })(),
          clickDmg: clickDamage(), dps: curDps(),
          medRate: medRate(), marketRate: curMarketRate(),
          critRate: critRate(), critMult: critMult(),
          equipTotal: equipPowerTotal(),
          equip: {
            sword: eq.sword ? Math.round(eq.sword.power) : null,
            armor: eq.armor ? Math.round(eq.armor.power) : null,
            talisman: eq.talisman ? Math.round(eq.talisman.power) : null,
            pendant: eq.pendant ? Math.round(eq.pendant.power) : null
          },
          expNeed: expNeed(),
          canBreak: canBreakthrough(), atGate: atRealmGate(),
          combo: combo.n, tideLeft: tide.left,
          totalPower: totalPower(),
          monsterHp: monster ? Math.ceil(monster.hp) : null,
          monsterMaxHp: monster ? monster.maxHp : null,
          isBoss: monster ? !!monster.boss : null,
          dying: monster ? monster.dyingT >= 0 : false,
          modal: modal, tab: activeTab,
          offline: offlineInfo,
          realmName: XB.realmName(S),
          errs: (G.__errs || []).slice()
        };
      },
      attack: function () {
        if (!monster) return false;
        var c = monsterCenter();
        return attackAt(c.x + (XD.srand(nowSec * 71) - 0.5) * 80, c.y);
      },
      rebirth: doRebirth,
      snapshot: currentSnapshot,
      computeOffline: computeOffline,
      buy: buyUpgrade,
      buyGongfa: buyGongfa,
      buyMarket: buyMarket,
      addStones: function (n) { stones += n; },
      addExp: function (n) { exp += n; checkBreakthroughAuto(); },
      jumpToLevel: function (n) { level = n; towerFloor = n; if (n > towerBest) towerBest = n; if (mode === 'tower') spawnMonster(); },
      breakthrough: function () { startBreak(true); while (bt && bt.t < 2.5) updateCore(0.05); },
      forceDrop: function () {
        if (!monster || monster.dyingT >= 0) return null;
        var slot = XB.EQUIP_SLOTS[Math.floor(dropRnd() * XB.EQUIP_SLOTS.length)];
        var qIdx = XB.rollQuality(dropRnd());
        var power = XB.equipPower(level, qIdx, dropRnd());
        var cur = eq[slot];
        if (!cur || power > cur.power) {
          eq[slot] = { slot: slot, name: XB.equipItemName(slot, qIdx), power: power, qIdx: qIdx };
          return { equipped: true, slot: slot, power: Math.round(power) };
        }
        return { equipped: false, power: Math.round(power) };
      },
      triggerTide: function () { tide.left = XB.TIDE_DUR; },
      enterTower: function (plan) { enterTower(plan); return mode; },
      leaveTower: function () { leaveTower(); return mode; },
      hurtPlayer: function (n) { ph -= n; if (ph <= 0) severeInjury(); return ph; },
      joinSect: joinSect, learnArt: learnArt, claimMission: claimMission,
      buyMarketProfit: buyMarketProfit,
      addContrib: function (n) { contrib += n; },
      setEpip: function (n) { epip = n; },
      fateReward: fateExpReward,
      fateStoneReward: fateStoneReward,
      persist: saveGame,
      rollMissions: function () { rollMissions(true); },
      openFateEvent: function (i) { return openFateEvent(i != null ? XB.FATE_EVENTS[i] : null); },
      fateOption: function (i) { resolveFateOption(i); },
      storyOk: function () { if (modal === 'story') modal = null; },
      claimQuest: claimQuest,
      addBond: function (n) { bond += n; },
      addSwordHeart: function (n) { sgn += n; },
      triggerFate: function (kind) {
        if (!monster) return null;
        var c = monsterCenter();
        if (kind === 0) {
          var gift = fateExpReward();
          exp += gift;
          return { exp: gift };
        }
        if (kind === 1) {
          var st = fateStoneReward();
          stones += st;
          return { stones: st };
        }
        return null;
      },
      openModal: function (m) { openModal(m); },
      closeModal: function () { modal = null; },
      dismissOffline: dismissOffline,
      switchTab: function (t) { activeTab = t; },
      getSaveRaw: function () { return XP.storageGet(STORE_KEY); },
      setSaveTs: function (msAgo) {
        try {
          var raw = XP.storageGet(STORE_KEY);
          if (!raw) return false;
          var d = JSON.parse(raw);
          d.ts = Date.now() - msAgo;
          XP.storageSet(STORE_KEY, JSON.stringify(d));
          return true;
        } catch (e) { return false; }
      },
      simulateReturn: function (secAgo) {
        /* 模拟离线归来：不落盘，直接按当前状态结算 */
        var info = computeOffline(currentSnapshot(), secAgo);
        if (!info) return null;
        settleOffline(info);
        return info;
      },
      resetAll: function () {
        clearSave();
        freshState();
        scene = SCENE_TITLE;
        refreshTitleSave();
      }
    };
  }
})();
