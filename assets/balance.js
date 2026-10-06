/* 斩妖·修仙录：数值、节奏与纯函数。
 * BALANCE 是可调入口；docs/progression-research.md 记录依据与测量。
 * 小境界积累 → 大境界释放；魔窟提供装备/领悟，坊市提供投资选择。
 * 60 个小境界，前2小时离线全额、之后50%、24小时封顶；不清除旧存档。
 */

'use strict';

var XB = (function () {

  /* ================= 境界 ================= */
  /* 人界九境 → 仙界六境（凡人修仙传式主流体系） */
  var REALM_LIST = [
    '炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫',
    '真仙', '玄仙', '金仙', '太乙', '大罗', '道祖'
  ];
  var STAGE_NAMES = ['初期', '中期', '后期', '大圆满'];
  var MORTAL_REALMS = 9;          /* 人界大境界数（飞升分界） */
  var STAGES_PER_REALM = 4;
  var MAX_STAGE = REALM_LIST.length * STAGES_PER_REALM - 1;  /* 59 */

  /* 大境界序号 / 小境界序号 / 全局序号 S */
  function realmIdx(S) { return Math.min(REALM_LIST.length - 1, Math.floor(S / STAGES_PER_REALM)); }
  function stageIdx(S) { return S % STAGES_PER_REALM; }
  function realmName(S) {
    var r = realmIdx(S), st = stageIdx(S);
    return REALM_LIST[r] + '·' + STAGE_NAMES[st];
  }
  function realmShort(S) { return REALM_LIST[realmIdx(S)]; }
  function isMortal(S) { return realmIdx(S) < MORTAL_REALMS; }
  /* 是否大境界之门（大圆满 → 下一大境界初期） */
  function isRealmGate(S) { return stageIdx(S) === STAGES_PER_REALM - 1; }

  /* ================= 可调数值（以时间与回本衡量） ================= */
  var BALANCE_VERSION = 1;
  var BALANCE = {
    stageMult: 1.3, realmGateMult: 2.25,
    expBase: 35, expGrowth: 1.92, gateNeedMult: 1.6,
    marketRealmGrowth: 1.18, profitCostGrowth: 2.4,
    insightPerPoint: 0.005,
    encounterSeconds: 120, encounterStageFraction: 0.35, encounterStoneSeconds: 45,
    rebirthBaseGain: 4, rebirthRealmGain: 3,
    recoveryReserve: 0.2
  };
  var STAGE_MULT = BALANCE.stageMult;
  var REALM_GATE_MULT = BALANCE.realmGateMult;
  function realmMult(S) {
    return Math.pow(STAGE_MULT, S) * Math.pow(REALM_GATE_MULT / STAGE_MULT, Math.floor(S / 4));
  }
  function expNeed(S) {
    return Math.round(BALANCE.expBase * Math.pow(BALANCE.expGrowth, S) *
      (isRealmGate(S) ? BALANCE.gateNeedMult : 1));
  }
  function legacyExpNeed(S) { return Math.round(25 * Math.pow(1.75, S)); }
  function marketRealmMult(S) { return Math.pow(BALANCE.marketRealmGrowth, S); }
  function fateExpReward(S, steadyRate) {
    return Math.min(Math.max(0, steadyRate) * BALANCE.encounterSeconds,
      expNeed(S) * BALANCE.encounterStageFraction);
  }
  function breakthroughPreview(S) {
    if (S >= MAX_STAGE) return null;
    var next = S + 1;
    return { next: next, name: realmName(next), major: isRealmGate(S),
      powerMult: realmMult(next) / realmMult(S),
      incomeMult: marketRealmMult(next) / marketRealmMult(S),
      unlocks: GONGFA.filter(function (g) { return g.unlock === realmIdx(next) && isRealmGate(S); })
        .map(function (g) { return g.name; }) };
  }
  // Cleared, non-boss five-floor loop: a recoverable alternative to repeated injury.
  function temperStart(best, dps, maxHp) {
    var limit = Math.max(5, best - 1);
    if (dps > 0) limit = Math.min(limit, Math.log(Math.max(18, dps * 0.8) / 18) / Math.log(1.24) + 1);
    if (maxHp > 0) limit = Math.min(limit, Math.log(Math.max(7, maxHp * 0.15) / 7) / Math.log(1.155) + 1);
    return Math.max(1, Math.floor(Math.max(0, limit - 5) / 10) * 10 + 1);
  }

  /* ================= 打坐（修为主来源） ================= */
  /* 基础吐纳0.5修为/秒，随境界战力同步；门槛另有准备段。 */
  var MEDITATE_BASE = 0.5;
  function meditationRate(S, tnLv, gongfaMed, daoJiMult, eventMult) {
    var m = MEDITATE_BASE * realmMult(S);
    m *= 1 + 0.06 * (tnLv || 0);            /* 吐纳术：+6%/级 */
    m *= gongfaMed || 1;
    m *= daoJiMult || 1;
    m *= eventMult || 1;
    return m;
  }

  /* ================= 关卡 / 妖兽 ================= */
  function isBoss(level) { return level % 10 === 0; }

  /* 妖兽血量：22 × 1.26^(L-1)，Boss ×7（旧版 1.32^L×8 放缓） */
  function hp(level) {
    var v = 22 * Math.pow(1.26, level - 1);
    return Math.round(isBoss(level) ? v * 7 : v);
  }

  /* 击杀灵石（已削弱为实践补贴）：线性小额，灵石主产在坊市 */
  function stonesReward(level) {
    var v = 3 + 1.5 * (level - 1);
    return Math.round(isBoss(level) ? v * 4 : v);
  }
  /* 击杀修为（辅助）：随境界战力缩放，Boss ×3。
     与境界脱钩的高关卡加成会导致杀怪修为碾压突破需求（模拟器实证）；
     推图的额外回报放在灵石与装备线上。 */
  function expGain(level, S) {
    var v = 3 * realmMult(S || 0);
    return Math.round(isBoss(level) ? v * 3 : v);
  }

  /* 妖兽名号前缀：随关卡成长（百年/千年/万年/太古） */
  var AGE_PREFIX = [
    [45, '百年'], [90, '千年'], [150, '万年'], [240, '太古']
  ];
  function agePrefix(level) {
    var prefix = '';
    for (var i = 0; i < AGE_PREFIX.length; i++) {
      if (level < AGE_PREFIX[i][0]) break;
      prefix = AGE_PREFIX[i][1];
    }
    return prefix;
  }

  /* ================= 三线升级（攻击线） =================
   * 软上限：超过 SOFT_CAP 后成本陡增（×HARD_R/级），
   * 防止灵石经济随关卡指数膨胀把乘区买穿（模拟器实证）。 */
  function softCost(base, r, n, cap, hardR) {
    var m = Math.min(n, cap);
    var over = Math.max(0, n - cap);
    return Math.round(base * Math.pow(r, m) * Math.pow(hardR, over));
  }

  function swordJueDmg(lv) { return 5 * Math.pow(1.16, lv); }
  function costSwordJue(lv) { return softCost(12, 1.15, lv, 60, 2.5); }

  function swordShiDps(lv) { return 2.5 * Math.pow(1.18, lv); }
  function costSwordShi(lv) { return softCost(28, 1.17, lv, 60, 2.5); }

  function beastMult(lv) { return 1 + 0.25 * lv; }
  function costBeast(lv) { return softCost(80, 1.3, lv, 40, 3); }
  /* 灵兽附带暴击率 +0.4%/级（上限 50% 由调用方裁剪） */
  function beastCrit(lv) { return 0.004 * lv; }

  /* 吐纳术（打坐效率，修行面板第 4 线） */
  function costTuna(lv) { return softCost(30, 1.24, lv, 50, 4); }

  /* ================= 功法经书 ================= */
  /* unlock：大境界序号（realmIdx）≥ unlock 才可见可修 */
  var GONGFA = [
    { id: 'sword',  name: '青元剑诀',   icon: '剑', unlock: 0,
      desc: '挥剑伤害 +10%/层', base: 200,  r: 1.85,
      eff: function (lv) { return 1 + 0.10 * lv; } },
    { id: 'shadow', name: '太虚剑意',   icon: '意', unlock: 1,
      desc: '剑侍每秒伤害 +10%/层', base: 400,  r: 1.85,
      eff: function (lv) { return 1 + 0.10 * lv; } },
    { id: 'breath', name: '玄清吐纳法', icon: '气', unlock: 2,
      desc: '打坐修为 +12%/层', base: 600,  r: 1.9,
      eff: function (lv) { return 1 + 0.12 * lv; } },
    { id: 'gold',   name: '点石成金术', icon: '金', unlock: 3,
      desc: '灵石获取 +12%/层', base: 900,  r: 1.9,
      eff: function (lv) { return 1 + 0.12 * lv; } },
    { id: 'body',   name: '天罡战体',   icon: '体', unlock: 4,
      desc: '暴击率 +1.5%/层 · 暴伤 +0.25×/层', base: 1400, r: 1.95,
      eff: function (lv) { return lv; } },
    { id: 'dao',    name: '太上悟道经', icon: '道', unlock: 8,
      desc: '全部修为获取 +10%/层', base: 3000, r: 2.0,
      eff: function (lv) { return 1 + 0.10 * lv; } },
    { id: 'map',    name: '山河社稷图', icon: '图', unlock: 9,
      desc: '坊市产出 +15%/层', base: 5000, r: 2.0,
      eff: function (lv) { return 1 + 0.15 * lv; } }
  ];
  var GONGFA_COUNT = GONGFA.length;

  /* 成本软上限：25 层后 ×5/层（防灵石经济膨胀买穿乘区） */
  function gongfaCost(g, lv) {
    var m = Math.min(lv, 25);
    var over = Math.max(0, lv - 25);
    return Math.round(g.base * Math.pow(g.r, m) * Math.pow(5, over));
  }

  /* ================= 暴击 / 连击 ================= */
  var CRIT_BASE = 0.06;          /* 基础暴击率 6% */
  var CRIT_CAP = 0.5;
  var CRIT_MULT = 6;             /* 基础暴伤 ×6 */
  var COMBO_WINDOW = 0.9;        /* 连击判定窗口秒 */
  var COMBO_MAX = 50;
  function comboMult(combo) { return 1 + Math.min(combo, COMBO_MAX) * 0.01; }

  /* ================= 装备 ================= */
  var EQUIP_SLOTS = ['sword', 'armor', 'talisman', 'pendant'];
  var SLOT_NAMES = { sword: '剑', armor: '甲', talisman: '符', pendant: '佩' };

  var QUALITIES = [
    { name: '凡品', coef: 1,   w: 40 },
    { name: '良品', coef: 1.5, w: 30 },
    { name: '上品', coef: 2.2, w: 18 },
    { name: '极品', coef: 3.2, w: 9 },
    { name: '仙品', coef: 5,   w: 3 }
  ];

  var ITEM_NAMES = {
    sword:    ['铁剑', '精钢剑', '法剑', '名剑', '诛仙剑'],
    armor:    ['布袍', '皮甲', '灵甲', '宝甲', '仙绫'],
    talisman: ['黄符', '灵符', '妖符', '宝符', '封妖符'],
    pendant:  ['木佩', '玉佩', '灵佩', '宝佩', '仙玉']
  };

  function equipItemName(slot, qIdx) {
    var pool = ITEM_NAMES[slot] || ITEM_NAMES.sword;
    return QUALITIES[qIdx].name + (pool[qIdx] || pool[pool.length - 1]);
  }

  function rollQuality(rnd) {
    var roll = rnd * 100;
    var acc = 0;
    for (var i = 0; i < QUALITIES.length; i++) {
      acc += QUALITIES[i].w;
      if (roll < acc) return i;
    }
    return 0;
  }

  /* 装备战力 = (3 + L×1.35) × 品质系数 × 浮动(0.85~1.15) */
  function equipPower(level, qIdx, floatRnd) {
    var base = (3 + level * 1.35) * QUALITIES[qIdx].coef;
    return base * (0.85 + floatRnd * 0.30);
  }

  var DROP_CHANCE = 0.25;
  function salvageStones(power) { return Math.max(1, Math.floor(power)); }

  /* ================= 坊市生意（灵石主产线） ================= */
  var MARKET_UNLOCK_LEVEL = 5;
  var MARKET_SHOPS = [
    { id: 'tea',   name: '茶摊',   cost: 50,     rate: 1.8 },
    { id: 'inn',   name: '酒馆',   cost: 600,    rate: 6 },
    { id: 'store', name: '杂货铺', cost: 6000,   rate: 21 },
    { id: 'pawn',  name: '当铺',   cost: 60000,  rate: 72 },
    { id: 'bank',  name: '钱庄',   cost: 600000, rate: 240 }
  ];
  var MARKET_PROFIT_UP = [0, 4, 10, 18, 30, 46, 66, 90];   /* 第 n 次升级所需拥有数 */
  var MARKET_PROFIT_R = 1.55;                               /* 每级利润 ×1.55 */
  var MARKET_PROFIT_COST = [800, 9000, 110000, 1500000, 2.4e7]; /* 固定配方阶梯，不随突破涨价 */
  function marketProfitCost(shopIdx, up, S) {
    var base = MARKET_PROFIT_COST[shopIdx] || 1e6;
    return Math.round(base * Math.pow(BALANCE.profitCostGrowth, up));
  }
  function marketCost(shopIdx, owned) {
    /* 软上限：60 间后 ×4/间 */
    var m = Math.min(owned, 60);
    var over = Math.max(0, owned - 60);
    return Math.round(MARKET_SHOPS[shopIdx].cost * Math.pow(1.35, m) * Math.pow(4, over));
  }
  /* 经济随境界温和增长；战斗释放与财富增长分开，避免一次突破买穿全部升级。 */
  function marketRate(counts, S, gongfaMap, daoJiMult, profits) {
    var total = 0;
    for (var j = 0; j < MARKET_SHOPS.length; j++) {
      var p = (profits && profits[j]) || 0;
      total += (counts[j] || 0) * MARKET_SHOPS[j].rate * Math.pow(MARKET_PROFIT_R, p);
    }
    return total * marketRealmMult(S) * (gongfaMap || 1) * (daoJiMult || 1);
  }

  /* ================= 灵石获取总乘区 ================= */
  function stoneMult(gongfaGold, daoJiMult, eventMult) {
    return (gongfaGold || 1) * (daoJiMult || 1) * (eventMult || 1);
  }

  /* ================= 轮回转世（道基） ================= */
  var REBIRTH_UNLOCK_S = 32;     /* 渡劫初期 */
  function daoJiGain(S) {
    if (S < REBIRTH_UNLOCK_S) return 0;
    var progress = S - REBIRTH_UNLOCK_S;
    return BALANCE.rebirthBaseGain + Math.floor(progress / 4) * BALANCE.rebirthRealmGain + Math.floor((progress % 4) / 2);
  }
  var DAOJI_RATE = 0.12;         /* 每点道基：全属性 +12% */
  function daoJiMult(dj) { return 1 + DAOJI_RATE * (dj || 0); }
  /* 轮回出生礼包灵石 */
  function rebirthStones(dj) { return 60 * (dj || 0); }

  /* ================= 灵气潮汐 / 奇遇 ================= */
  var TIDE_GAP_MIN = 70, TIDE_GAP_RAND = 100;   /* 下次潮汐 70~170s */
  var TIDE_DUR = 18;                            /* 潮汐持续秒 */
  var TIDE_MED_MULT = 3, TIDE_EXP_MULT = 2, TIDE_STONE_MULT = 2;

  /* 击杀触发奇遇概率 */
  var FATE_CHANCE = 0.012;
  /* 传功至多120秒稳定修炼，且不超过当前小境界35%；不连跳整段内容。 */
  function fateExpGift(S, tnLv, gongfaMed, daoJiMult) {
    return fateExpReward(S, meditationRate(S, tnLv, gongfaMed, daoJiMult, 1));
  }
  /* 奇遇灵石：随境界缩放（与坊市经济同轨），塔层小额加成 */
  function fateStones(S, floor) {
    return Math.round(30 * marketRealmMult(S || 0) * (1 + 0.15 * (floor || 1)));
  }

  /* ================= 仙缘 / 剑心（选择型机缘的永久积累） ============ */
  /* 轮回不清空：与道基构成第二层 meta 成长。
     仙缘：打坐与击杀修为 +3%/点；剑心：挥剑伤害 +2%/点 */
  var BOND_RATE = 0.03;
  var SWORDHEART_RATE = 0.02;
  function bondMult(bond) { return 1 + BOND_RATE * (bond || 0); }
  function swordHeartMult(sgn) { return 1 + SWORDHEART_RATE * (sgn || 0); }

  /* ================= 选择型机缘事件 ============ */
  /* apply 为语义 key，具体结算在 main.js：
     bond/sgn 永久 +1 · exp 即时修为 · stones 即时灵石 · tide 灵气潮汐 */
  var FATE_EVENTS = [
    { id: 'sword-crest', title: '断剑残碑',
      text: '山道旁斜插着半柄断剑，锈迹下剑意未冷，碑上刻着四个字：\n“剑去久矣。”',
      options: [
        { label: '以剑意祭碑', desc: '剑心 +1（永久）', apply: 'sgn' },
        { label: '掘碑下三尺', desc: '得埋藏灵石', apply: 'stones' }
      ] },
    { id: 'white-fox', title: '白狐拜月',
      text: '月下一只白狐对着山尖拜月，见你不惊不惧，眉间一点灵光。\n是妖，也是修道之妖。',
      options: [
        { label: '绕道而行', desc: '仙缘 +1（永久）', apply: 'bond' },
        { label: '点化它一场', desc: '得灵石与一段因果', apply: 'stones-exp' }
      ] },
    { id: 'old-fisherman', title: '蓑衣老翁',
      text: '寒江上孤舟蓑翁，钓的不是鱼，是一江风雪。\n他问你：“后生，急什么？”',
      options: [
        { label: '坐下陪他钓鱼', desc: '修为机缘（至多本境35%）', apply: 'exp' },
        { label: '讨教一句', desc: '仙缘 +1（永久）', apply: 'bond' }
      ] },
    { id: 'dark-cave', title: '幽窟微光',
      text: '崖壁上有个洞口，里头的灵气浓得化不开。\n剑心告诉你：机缘往往和危险长在一起。',
      options: [
        { label: '冒险一探', desc: '大笔灵石与修为', apply: 'big-stones-exp' },
        { label: '稳守本心', desc: '剑心 +1（永久）', apply: 'sgn' }
      ] },
    { id: 'sword-tide', title: '剑气潮汐',
      text: '天际一道剑光横贯云海，所过之处灵气如浪。\n是古修斗法余波，可遇不可求。',
      options: [
        { label: '迎着剑光行', desc: '剑心 +1（永久）', apply: 'sgn' },
        { label: '顺势吐纳', desc: '灵气潮汐（修为灵石暴增）', apply: 'tide' }
      ] },
    { id: 'cast-off-treasure', title: '遗宝无主',
      text: '一具古修枯坐坐化已久，身前悬着一件仍带灵光的法宝。\n取与不取，都在一念。',
      options: [
        { label: '取宝，为他敬一炷香', desc: '获得一件装备', apply: 'equip' },
        { label: '不拿无痕', desc: '仙缘 +1（永久）', apply: 'bond' }
      ] },
    { id: 'wounded-cultivator', title: '重伤的道人',
      text: '一个道人倒在官道旁，气息弱得如风残烛。\n他怀里揣着一半地图，一半是宝藏，一半是追兵的线索。',
      options: [
        { label: '背他回山门', desc: '仙缘 +1，获赠装备', apply: 'bond-equip' },
        { label: '拿地图去宝藏', desc: '大笔灵石，但风险未知', apply: 'big-stones-exp' }
      ] }
  ];

  /* ================= 境界剧情（初入大境界时弹出） ============ */
  var REALM_STORY = [
    '【炼气】山门收你做了杂役弟子。灵根一般，但剑在手，路就在脚下。',
    '【筑基】引气成液，道基初成。师兄说：筑基易，筑基后的心难。',
    '【金丹】丹成之日，你听见了自己剑鸣。从此人间称一声“道友”。',
    '【元婴】婴成人灭，旧我如壳。你在洞里坐了三天，不知自己在想什么。',
    '【化神】神魂离体那夜，你看见了这片天地的纹路——原来妖与人，本就同根。',
    '【炼虚】虚空里走出第一步，你才知从前的天有多小。',
    '【合体】法相合一，山海为剑。宗门旧事如今看来，不过一局未终的棋。',
    '【大乘】人间已至顶。你开始听风，听雨，听那些从前不屑听的东西。',
    '【渡劫】劫云压城。三雷之后，若你还站着，便不再是人了。',
    '【真仙】仙界第一日，你连方向都看不见。这里的一粒尘，曾是一个下界的千年。',
    '【玄仙】仙宫聘你讲剑，你讲了三天。下山时想明白：剑不是用来赢的。',
    '【金仙】金身不灭，因果却重。你开始偿还当年在人间欠下的人情。',
    '【太乙】你收了一个徒。他灵根很差，像极了当年的你。',
    '【大罗】过去未来在你眼中如长卷。你翻到第一页：山门杂役，抱剑而眠。',
    '【道祖】天地与你同名。你最后做了一件事：把剑插回那座山，等下一个少年。'
  ];


  /* ================= 魔窟妖塔（v4：战斗主场景） ================= */
  /* 平日打坐修行，战斗移入塔内：层越高怪越难；血量跨层不重置，
     归零重伤强制归家；装备只在塔层里程碑（每 5 层）掉。 */
  var TOWER_UNLOCK_LEVEL = 1;          /* 首斩后解锁 */
  var TOWER_MILESTONE = 5;             /* 每 5 层里程碑：必掉装备 */
  function towerHp(f) {
    var v = 18 * Math.pow(1.24, f - 1);
    return Math.round(f % 10 === 0 ? v * 6 : v);
  }
  function towerAtk(f) {              /* 妖兽每次扑咬对主角的伤害 */
    var v = 7 * Math.pow(1.155, f - 1);
    return Math.round(f % 10 === 0 ? v * 2.5 : v);
  }
  var TOWER_ATK_GAP = 1.35;           /* 扑咬间隔秒 */
  /* 灵石：线性小额（实践补贴）；贡献：宗门认可 */
  function towerStones(f) {
    var v = 3 + 1.2 * (f - 1);
    return Math.round(f % 10 === 0 ? v * 4 : v);
  }
  function towerContrib(f) { return f % 10 === 0 ? 8 : 1; }
  /* 修为：仍与境界锁步，Boss ×3 */
  function towerExp(f, S) {
    var v = 3 * realmMult(S || 0);
    return Math.round(f % 10 === 0 ? v * 3 : v);
  }
  /* 领悟：斩妖实践加深功法理解，每层塔提供的理解点 */
  function towerInsight(f) { return Math.max(1, Math.round(1 + f * 0.35)); }
  var INSIGHT_CAP = 100;              /* 单部功法领悟上限 */
  function insightBonus(lv) {         /* 领悟有界，避免多乘区堆叠吞掉整段境界 */
    return 1 + BALANCE.insightPerPoint * Math.min(lv || 0, INSIGHT_CAP);
  }

  /* ================= 主角血量 / 重伤 / 顿悟 ================= */
  function playerHpMax(S, armorPower, sectHpMult) {
    var v = 120 * Math.pow(1.30, S) + (armorPower || 0) * 3;
    return Math.round(v * (sectHpMult || 1));
  }
  var INJURE_DUR = 40;                /* 重伤基秒 */
  var INJURE_PENALTY = 0.7;           /* 重伤中战力/打坐 ×0.7 */
  var HEAL_RATE = 0.10;               /* 居家恢复：每秒回 10% 上限（伤愈后） */
  var INJURY_HEAL_RATE = 0.03;        /* 重伤倒计时期间血条慢回 */
  var EPIPHANY_CHANCE = 0.45;         /* 重伤后生死顿悟概率 */
  var EPIPHANY_MAX = 20;
  function epiphanyMult(n) { return 1 + 0.05 * (n || 0); }  /* 每次顿悟：战力与修行 +5% */

  /* ================= 宗门 ================= */
  var SECTS = [
    { id: 'qingyuan', name: '青元剑宗', icon: '剑',
      motto: '一剑破万法',
      passive: '挥剑伤害 +8%',
      arts: [
        { id: 'qy1', name: '青元剑典·初卷', desc: '挥剑伤害 +10%/层', icon: '初',
          cost: 80,   r: 1.5,  reqS: 0,
          eff: function (lv) { return 1 + 0.10 * lv; } },
        { id: 'qy2', name: '青元剑典·心解', desc: '暴击伤害 +0.6×/层', icon: '心',
          cost: 320,  r: 1.6,  reqS: 8,
          critDmg: function (lv) { return 0.6 * lv; } }
      ] },
    { id: 'dantang', name: '丹霞丹堂', icon: '丹',
      motto: '药石辅仙途',
      passive: '伤愈时间 -30% · 恢复 +50%',
      arts: [
        { id: 'dt1', name: '本草纳气诀', desc: '打坐修为 +12%/层', icon: '纳',
          cost: 80,   r: 1.5,  reqS: 0,
          eff: function (lv) { return 1 + 0.12 * lv; } },
        { id: 'dt2', name: '九转还元篇', desc: '全部修为 +8%/层', icon: '元',
          cost: 360,  r: 1.6,  reqS: 8,
          allExp: function (lv) { return 1 + 0.08 * lv; } }
      ] },
    { id: 'wanbei', name: '万碑塔院', icon: '碑',
      motto: '以战养道',
      passive: '斩妖领悟 +40%',
      arts: [
        { id: 'wb1', name: '破阵式', desc: '剑侍每秒伤害 +12%/层', icon: '阵',
          cost: 90,   r: 1.5,  reqS: 2,
          eff: function (lv) { return 1 + 0.12 * lv; } },
        { id: 'wb2', name: '天罡残篇', desc: '暴击率 +1.5%/层', icon: '罡',
          cost: 380,  r: 1.6,  reqS: 10,
          critRate: function (lv) { return 0.015 * lv; } }
      ] },
    { id: 'tianshu', name: '天枢商阁', icon: '枢',
      motto: '财侣法地，财在先',
      passive: '坊市产出 +10% · 塔层灵石 +25%',
      arts: [
        { id: 'ts1', name: '云阜养肥诀', desc: '坊市产出 +15%/层', icon: '肥',
          cost: 100,  r: 1.5,  reqS: 3,
          eff: function (lv) { return 1 + 0.15 * lv; } },
        { id: 'ts2', name: '点灵成金手', desc: '灵石获取 +10%/层', icon: '金',
          cost: 400,  r: 1.6,  reqS: 10,
          stone: function (lv) { return 1 + 0.10 * lv; } }
      ] }
  ];
  function sectArtCost(art, lv) {
    var m = Math.min(lv, 20);
    var over = Math.max(0, lv - 20);
    return Math.round(art.cost * Math.pow(art.r, m) * Math.pow(4, over));
  }
  function getSect(id) {
    for (var i = 0; i < SECTS.length; i++) if (SECTS[i].id === id) return SECTS[i];
    return null;
  }

  /* ================= 宗门任务 ================= */
  var MISSION_KINDS = [
    { kind: 'kill',  text: function (n) { return '魔窟斩妖 ' + n + ' 只'; }, base: 30,  grow: 1.6 },
    { kind: 'floor', text: function (n) { return '魔窟推进至第 ' + n + ' 层'; }, base: 60, grow: 1.4 },
    { kind: 'stone', text: function (n) { return '累计获得灵石 ' + n; }, base: 50, grow: 1.8 },
    { kind: 'shop',  text: function (n) { return '坊市店铺总数达 ' + n + ' 间'; }, base: 40, grow: 1.5 },
    { kind: 'realm', text: function (n) { return '修为本境界再进一步'; }, base: 80, grow: 1.0 }
  ];
  function missionReward(kind, S) {
    var k = 0;
    for (var i = 0; i < MISSION_KINDS.length; i++) if (MISSION_KINDS[i].kind === kind) k = i;
    var m = MISSION_KINDS[k];
    return { contrib: Math.round(m.base * Math.pow(m.grow, S * 0.35)),
             stones: Math.round(m.base * 8 * Math.pow(1.6, S * 0.5)) };
  }

  /* ================= 离线闭关 ================= */
  /* 前 OFFLINE_FULL_H 小时全额，之后 50%，上限 24h。
     旧版 bug：上限 8h 且超过后收益恒定 → 挂多久都一样。 */
  var OFFLINE_CAP_SEC = 24 * 3600;
  var OFFLINE_FULL_SEC = 2 * 3600;
  var OFFLINE_LATE_RATE = 0.5;
  function offlineWeightedSec(sec) {
    var s = Math.min(Math.max(sec, 0), OFFLINE_CAP_SEC);
    if (s <= OFFLINE_FULL_SEC) return s;
    return OFFLINE_FULL_SEC + (s - OFFLINE_FULL_SEC) * OFFLINE_LATE_RATE;
  }

  /* ================= 中文数字格式化 ================= */
  /* 万 亿 兆 京 垓 秭（1e4 起，每档 ×1e4），超出用科学计数 */
  var UNITS = ['', '万', '亿', '兆', '京', '垓', '秭'];

  function trimDot(s) {
    if (s.indexOf('.') < 0) return s;
    return s.replace(/0+$/, '').replace(/\.$/, '');
  }

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    n = Math.floor(n);
    if (n < 10000) return String(n);
    var tier = Math.floor(Math.log(n) / Math.LN10 / 4);
    /* 浮点误差兜底：1e12 可能算成 3.99 → tier 1 */
    if (tier < UNITS.length - 1 && n >= Math.pow(10, (tier + 1) * 4)) tier += 1;
    if (tier >= UNITS.length) {
      var e = n.toExponential(2);
      return e.replace('e+', 'e');
    }
    var v = n / Math.pow(10, tier * 4);
    var s;
    if (v >= 100) s = String(Math.floor(v));
    else if (v >= 10) s = v.toFixed(1);
    else s = v.toFixed(2);
    return trimDot(s) + UNITS[tier];
  }

  /* 每秒类小数显示（<10 保留 1 位） */
  function fmtRate(n) {
    if (n >= 100) return fmt(Math.round(n));
    if (n >= 10) return trimDot(n.toFixed(1));
    return trimDot(n.toFixed(2));
  }

  /* ================= 时长 ================= */
  function formatDur(sec) {
    if (!isFinite(sec)) return '暂不可达';
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + '秒';
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (d > 0) return d + '天' + h + '小时';
    if (h > 0) return h + '小时' + m + '分';
    return m + '分钟';
  }

  /* Mountain-spirit intent: a slower, readable third strike, never extra attacks. */
  var SHANXIAO = {unlockFloor: 6, windup: 3.2, hits: 3, hitSpacing: 0.22,
    damageMult: 1.6, damageCap: 0.35, stagger: 1.5, exposedMult: 1.2, wardCap: 3};
  function monsterIntent(type, floor) {
    return {enabled: type === 'shanxiao' && floor >= SHANXIAO.unlockFloor,
      phase: 'ready', timer: 0, left: 0, attacks: 0, hits: 0, lastHit: -1e9};
  }
  function advanceIntent(intent, dt, gap) {
    if (intent.phase === 'charging' || intent.phase === 'staggered') {
      intent.left = Math.max(0, intent.left - dt);
      if (intent.left > 1e-9) return 0;
      var charged = intent.phase === 'charging';
      intent.phase = 'ready'; intent.timer = 0; intent.hits = 0;
      if (charged) { intent.attacks++; return SHANXIAO.damageMult; }
      return 0;
    }
    intent.timer += dt;
    if (intent.timer + 1e-9 < gap) return 0;
    intent.timer = Math.max(0, intent.timer - gap);
    if (intent.enabled && intent.attacks % 3 === 2) {
      intent.phase = 'charging'; intent.left = SHANXIAO.windup; intent.hits = 0; intent.lastHit = -1e9;
      return 0;
    }
    intent.attacks++; return 1;
  }
  function strikeIntent(intent, now) {
    if (!intent || intent.phase !== 'charging' || now - intent.lastHit + 1e-9 < SHANXIAO.hitSpacing) return false;
    intent.lastHit = now; intent.hits++;
    if (intent.hits < SHANXIAO.hits) return false;
    intent.phase = 'staggered'; intent.left = SHANXIAO.stagger; intent.timer = 0; intent.attacks++;
    return true;
  }
  var HUNT_EVENTS = {
    prepare: {id: 'hunt-prepare', title: '山道猎妖人',
      text: '猎妖人指着岩壁上三道拳印：“山魈两击之后必蓄势。见它举拳，三次挥剑便能打断。”\n他只剩两张护山符，也愿将破招心得传你。',
      options: [
        {label: '带上护山符', desc: '获得2张符，自动抵消山魈蓄力重击；最多持有3张', apply: 'hunt-ward'},
        {label: '当场参悟破招心得', desc: '一部已解锁功法领悟最多 +6；若皆圆满则转为修为，不获得护符', apply: 'hunt-insight'}]},
    return: {id: 'hunt-return', title: '三剑破镇岳',
      text: '你将拳影中的破绽讲给猎妖人听。他把旧剑谱摊在石上：“今日以后，你已不是只会硬闯山门的后生。”',
      options: [
        {label: '将破绽化为剑心', desc: '剑心 +1（挥剑伤害永久 +2%）', apply: 'hunt-sword'},
        {label: '以经验换取护山符', desc: '护山符补满至3张，留作以后闯关之用', apply: 'hunt-refill'}]}
  };

  /* ================= 妖兽种类 ================= */
  var MONSTER_TYPES = [
    { id: 'fox',      name: '狐妖' },
    { id: 'snake',    name: '蛇妖' },
    { id: 'shanxiao', name: '山魈' },
    { id: 'spider',   name: '蛛妖' }
  ];
  function monsterName(typeId, boss, level) {
    for (var i = 0; i < MONSTER_TYPES.length; i++) {
      if (MONSTER_TYPES[i].id === typeId) {
        var n = AGE_PREFIX.length && agePrefix(level || 1);
        var base = n ? n + MONSTER_TYPES[i].name : MONSTER_TYPES[i].name;
        return boss ? base + '王' : base;
      }
    }
    return '妖';
  }

  return {
    BALANCE_VERSION: BALANCE_VERSION, BALANCE: BALANCE,
    legacyExpNeed: legacyExpNeed, marketRealmMult: marketRealmMult,
    fateExpReward: fateExpReward, breakthroughPreview: breakthroughPreview, temperStart: temperStart,
    REALM_LIST: REALM_LIST,
    STAGE_NAMES: STAGE_NAMES,
    MORTAL_REALMS: MORTAL_REALMS,
    STAGES_PER_REALM: STAGES_PER_REALM,
    MAX_STAGE: MAX_STAGE,
    realmIdx: realmIdx,
    stageIdx: stageIdx,
    realmName: realmName,
    realmShort: realmShort,
    isMortal: isMortal,
    isRealmGate: isRealmGate,
    STAGE_MULT: STAGE_MULT,
    REALM_GATE_MULT: REALM_GATE_MULT,
    realmMult: realmMult,
    expNeed: expNeed,
    MEDITATE_BASE: MEDITATE_BASE,
    meditationRate: meditationRate,
    isBoss: isBoss,
    hp: hp,
    stonesReward: stonesReward,
    expGain: expGain,
    swordJueDmg: swordJueDmg,
    costSwordJue: costSwordJue,
    swordShiDps: swordShiDps,
    costSwordShi: costSwordShi,
    beastMult: beastMult,
    costBeast: costBeast,
    beastCrit: beastCrit,
    costTuna: costTuna,
    GONGFA: GONGFA,
    GONGFA_COUNT: GONGFA_COUNT,
    gongfaCost: gongfaCost,
    CRIT_BASE: CRIT_BASE,
    CRIT_CAP: CRIT_CAP,
    CRIT_MULT: CRIT_MULT,
    COMBO_WINDOW: COMBO_WINDOW,
    COMBO_MAX: COMBO_MAX,
    comboMult: comboMult,
    EQUIP_SLOTS: EQUIP_SLOTS,
    SLOT_NAMES: SLOT_NAMES,
    QUALITIES: QUALITIES,
    equipItemName: equipItemName,
    rollQuality: rollQuality,
    equipPower: equipPower,
    DROP_CHANCE: DROP_CHANCE,
    salvageStones: salvageStones,
    MARKET_UNLOCK_LEVEL: MARKET_UNLOCK_LEVEL,
    MARKET_SHOPS: MARKET_SHOPS,
    MARKET_PROFIT_UP: MARKET_PROFIT_UP,
    MARKET_PROFIT_R: MARKET_PROFIT_R,
    marketCost: marketCost,
    marketProfitCost: marketProfitCost,
    marketRate: marketRate,
    stoneMult: stoneMult,
    REBIRTH_UNLOCK_S: REBIRTH_UNLOCK_S,
    daoJiGain: daoJiGain,
    DAOJI_RATE: DAOJI_RATE,
    daoJiMult: daoJiMult,
    rebirthStones: rebirthStones,
    TIDE_GAP_MIN: TIDE_GAP_MIN,
    TIDE_GAP_RAND: TIDE_GAP_RAND,
    TIDE_DUR: TIDE_DUR,
    TIDE_MED_MULT: TIDE_MED_MULT,
    TIDE_EXP_MULT: TIDE_EXP_MULT,
    TIDE_STONE_MULT: TIDE_STONE_MULT,
    FATE_CHANCE: FATE_CHANCE,
    fateExpGift: fateExpGift,
    fateStones: fateStones,
    BOND_RATE: BOND_RATE,
    SWORDHEART_RATE: SWORDHEART_RATE,
    bondMult: bondMult,
    swordHeartMult: swordHeartMult,
    FATE_EVENTS: FATE_EVENTS,
    REALM_STORY: REALM_STORY,
    OFFLINE_CAP_SEC: OFFLINE_CAP_SEC,
    OFFLINE_FULL_SEC: OFFLINE_FULL_SEC,
    OFFLINE_LATE_RATE: OFFLINE_LATE_RATE,
    offlineWeightedSec: offlineWeightedSec,
    fmt: fmt,
    fmtRate: fmtRate,
    formatDur: formatDur,
    SHANXIAO: SHANXIAO, monsterIntent: monsterIntent, advanceIntent: advanceIntent, strikeIntent: strikeIntent, HUNT_EVENTS: HUNT_EVENTS,
    MONSTER_TYPES: MONSTER_TYPES,
    monsterName: monsterName,
    TOWER_UNLOCK_LEVEL: TOWER_UNLOCK_LEVEL,
    TOWER_MILESTONE: TOWER_MILESTONE,
    TOWER_ATK_GAP: TOWER_ATK_GAP,
    towerHp: towerHp, towerAtk: towerAtk, towerStones: towerStones,
    towerContrib: towerContrib, towerExp: towerExp, towerInsight: towerInsight,
    INSIGHT_CAP: INSIGHT_CAP, insightBonus: insightBonus,
    playerHpMax: playerHpMax,
    INJURE_DUR: INJURE_DUR, INJURE_PENALTY: INJURE_PENALTY,
    HEAL_RATE: HEAL_RATE, INJURY_HEAL_RATE: INJURY_HEAL_RATE,
    EPIPHANY_CHANCE: EPIPHANY_CHANCE, EPIPHANY_MAX: EPIPHANY_MAX,
    epiphanyMult: epiphanyMult,
    SECTS: SECTS, sectArtCost: sectArtCost, getSect: getSect,
    MISSION_KINDS: MISSION_KINDS, missionReward: missionReward
  };
})();
