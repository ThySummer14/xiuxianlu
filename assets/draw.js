/* ============================================================
 * 斩妖·修仙录 · draw.js
 * 全程序化水墨绘制：背景三境 / 妖兽剪影 / 剑光 / 粒子 / 天劫 / 境界卡
 * 经典脚本，挂 window.XD
 * ============================================================ */

'use strict';

var XD = (function () {

  /* ---------- 配色 ---------- */
  var C = {
    paper: '#f4ecdc',
    ink: '#2f2a24',
    cinnabar: '#b03a30',
    indigo: '#3d4a5c',
    gold: '#c9a05a'
  };

  /* ---------- 伪随机 ---------- */
  function srand(seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var VIEW_W = 750;
  var VIEW_H = 1334;

  /* 逻辑画布高度自适应（main.js resize 时调用）：
     宽度恒 750 贴合屏宽，高度随视口伸缩，地面元素整体平移 */
  function setView(w, h) { VIEW_W = w; VIEW_H = h; }
  /* 地面带位移量：所有锚定旧画布底部（y≥860）的元素加 dy */
  function groundDy() { return VIEW_H - 1334; }

  /* 背景带：0 山村（炼气~金丹）1 云海（元婴~渡劫）2 仙宫（真仙起） */
  function bandOf(realm) {
    if (realm <= 2) return 0;
    if (realm <= 8) return 1;
    return 2;
  }

  /* 宣纸底 + 陈年斑点（种子固定，稳定不闪） */
  function paintPaper(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#f6efe0');
    g.addColorStop(1, C.paper);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (var i = 0; i < 130; i++) {
      var sx = srand(i * 3 + 7) * VIEW_W;
      var sy = srand(i * 3 + 8) * VIEW_H;
      var sr = 1 + srand(i * 3 + 9) * 2.2;
      ctx.fillStyle = 'rgba(47,42,36,' + (0.02 + srand(i * 7) * 0.03) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- 背景 0：淡墨山村 ---------- */
  function drawVillage(ctx, t) {
    var dy = groundDy();
    /* 远山两叠 */
    var i;
    for (i = 0; i < 2; i++) {
      var baseY = 430 + i * 90;
      ctx.fillStyle = i === 0 ? 'rgba(61,74,92,0.22)' : 'rgba(61,74,92,0.34)';
      ctx.beginPath();
      ctx.moveTo(-40, baseY);
      ctx.bezierCurveTo(140, baseY - 190 - i * 40, 260, baseY - 60, 400, baseY - 120);
      ctx.bezierCurveTo(560, baseY - 190, 640, baseY - 40, 800, baseY - 110);
      ctx.lineTo(800, baseY + 200);
      ctx.lineTo(-40, baseY + 200);
      ctx.closePath();
      ctx.fill();
    }
    /* 淡金日轮 */
    ctx.fillStyle = 'rgba(201,160,90,0.30)';
    ctx.beginPath();
    ctx.arc(585, 250, 78, 0, Math.PI * 2);
    ctx.fill();
    /* 中景丘陵 */
    ctx.fillStyle = 'rgba(47,42,36,0.14)';
    ctx.beginPath();
    ctx.moveTo(0, 980 + dy);
    ctx.bezierCurveTo(200, 900 + dy, 420, 1010 + dy, 750, 930 + dy);
    ctx.lineTo(750, 1120 + dy);
    ctx.lineTo(0, 1120 + dy);
    ctx.closePath();
    ctx.fill();
    /* 村舍剪影 */
    drawHouse(ctx, 150, 1064 + dy, 96, 0);
    drawHouse(ctx, 285, 1090 + dy, 72, 11);
    drawHouse(ctx, 520, 1078 + dy, 84, 23);
    /* 近景坡地墨色 */
    ctx.fillStyle = 'rgba(47,42,36,0.20)';
    ctx.beginPath();
    ctx.moveTo(0, 1130 + dy);
    ctx.bezierCurveTo(240, 1080 + dy, 500, 1150 + dy, 750, 1110 + dy);
    ctx.lineTo(750, VIEW_H);
    ctx.lineTo(0, VIEW_H);
    ctx.closePath();
    ctx.fill();
    /* 左上斜枝 */
    ctx.strokeStyle = 'rgba(47,42,36,0.55)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-10, 150);
    ctx.quadraticCurveTo(120, 190, 230, 300);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (i = 0; i < 4; i++) {
      var bx = 40 + i * 52;
      ctx.beginPath();
      ctx.moveTo(bx, 172 + i * 26);
      ctx.quadraticCurveTo(bx + 24, 150 + i * 26, bx + 44, 158 + i * 30);
      ctx.stroke();
    }
  }

  function drawHouse(ctx, x, y, w, seed) {
    ctx.fillStyle = 'rgba(47,42,36,0.62)';
    /* 屋顶 */
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 12, y);
    ctx.quadraticCurveTo(x, y - 46 - srand(seed) * 14, x + w / 2 + 12, y);
    ctx.closePath();
    ctx.fill();
    /* 墙身 */
    ctx.fillRect(x - w / 2, y, w, 54);
    /* 门 */
    ctx.fillStyle = C.paper;
    ctx.fillRect(x - 9, y + 22, 18, 32);
  }

  /* ---------- 背景 1：云海 ---------- */
  function drawCloudSea(ctx, t) {
    var i, j;
    var dy = groundDy();
    /* 淡金日轮更高 */
    ctx.fillStyle = 'rgba(201,160,90,0.35)';
    ctx.beginPath();
    ctx.arc(375, 210, 92, 0, Math.PI * 2);
    ctx.fill();
    /* 远峰刺出云面 */
    ctx.fillStyle = 'rgba(61,74,92,0.30)';
    for (i = 0; i < 4; i++) {
      var px = 70 + i * 190 + srand(i * 17) * 50;
      var ph = 180 + srand(i * 31) * 160;
      ctx.beginPath();
      ctx.moveTo(px - 110, 700 + dy);
      ctx.quadraticCurveTo(px, 700 + dy - ph, px + 110, 700 + dy);
      ctx.closePath();
      ctx.fill();
    }
    /* 云浪三层，随时间缓慢漂移 */
    for (j = 0; j < 3; j++) {
      var cy = 760 + j * 170 + dy;
      var drift = (t * (8 + j * 5)) % 300;
      ctx.fillStyle = 'rgba(61,74,92,' + (0.16 + j * 0.07) + ')';
      ctx.beginPath();
      ctx.moveTo(-80, cy + 90);
      for (var k = -1; k < 5; k++) {
        var wx = k * 220 + drift - 100;
        ctx.arc(wx, cy, 95 + srand(j * 13 + k) * 40, Math.PI, 0, false);
      }
      ctx.lineTo(820, cy + 200);
      ctx.lineTo(-80, cy + 200);
      ctx.closePath();
      ctx.fill();
    }
    /* 云上平台感墨晕 */
    ctx.fillStyle = 'rgba(47,42,36,0.08)';
    ctx.beginPath();
    ctx.ellipse(375, 960 + dy, 330, 60, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- 背景 2：金顶仙宫 ---------- */
  function drawPalace(ctx, t) {
    var dy = groundDy();
    var g = ctx.createRadialGradient(375, 320, 40, 375, 320, 620);
    g.addColorStop(0, 'rgba(201,160,90,0.38)');
    g.addColorStop(1, 'rgba(201,160,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    /* 金乌日轮 */
    ctx.fillStyle = 'rgba(201,160,90,0.55)';
    ctx.beginPath();
    ctx.arc(375, 280, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.arc(375, 280, 86, 0, Math.PI * 2);
    ctx.fill();
    /* 云海托底 */
    drawCloudSea(ctx, t);
    /* 悬崖仙宫两组 */
    drawTemple(ctx, 165, 880 + dy, 0.9, 5);
    drawTemple(ctx, 555, 930 + dy, 1.15, 19);
  }

  function drawTemple(ctx, x, y, s, seed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    /* 台基 */
    ctx.fillStyle = 'rgba(47,42,36,0.55)';
    ctx.fillRect(-95, 0, 190, 26);
    /* 两层殿身 + 翘檐 */
    var lv;
    for (lv = 0; lv < 2; lv++) {
      var ly = -lv * 88;
      var lw = 150 - lv * 34;
      ctx.fillStyle = 'rgba(47,42,36,0.78)';
      ctx.fillRect(-lw / 2 + 14, ly - 62, lw - 28, 56);
      /* 屋顶：贝塞尔翘檐 */
      ctx.beginPath();
      ctx.moveTo(-lw / 2 - 26, ly - 58);
      ctx.quadraticCurveTo(-lw / 2 - 6, ly - 66, -lw / 2 + 10, ly - 96);
      ctx.quadraticCurveTo(0, ly - 128 - srand(seed + lv) * 10, lw / 2 - 10, ly - 96);
      ctx.quadraticCurveTo(lw / 2 + 6, ly - 66, lw / 2 + 26, ly - 58);
      ctx.quadraticCurveTo(0, ly - 76, -lw / 2 - 26, ly - 58);
      ctx.closePath();
      ctx.fillStyle = 'rgba(176,58,48,0.82)';
      ctx.fill();
      /* 檐下金饰 */
      ctx.strokeStyle = 'rgba(201,160,90,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-lw / 2 + 12, ly - 60);
      ctx.lineTo(lw / 2 - 12, ly - 60);
      ctx.stroke();
    }
    /* 顶刹 */
    ctx.strokeStyle = 'rgba(201,160,90,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -176 - 88);
    ctx.lineTo(0, -300);
    ctx.stroke();
    ctx.restore();
  }

  /* 主入口：按当前境界画背景，支持与上一背景带交叉淡化
     baseY：妖兽脚底基线（随动态画布高度传入） */
  function drawBackground(ctx, realm, t, prevRealm, transT, baseY) {
    var by = baseY || 905;
    paintPaper(ctx);
    if (transT < 1 && prevRealm !== realm) {
      drawBand(ctx, bandOf(prevRealm), t);
      ctx.globalAlpha = 1 - transT;
      drawBand(ctx, bandOf(realm), t);
      ctx.globalAlpha = 1;
    } else {
      drawBand(ctx, bandOf(realm), t);
    }
    /* 妖兽脚下墨晕 */
    ctx.fillStyle = 'rgba(47,42,36,0.13)';
    ctx.beginPath();
    ctx.ellipse(375, by + 30, 250, 46, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBand(ctx, band, t) {
    if (band === 0) drawVillage(ctx, t);
    else if (band === 1) drawCloudSea(ctx, t);
    else drawPalace(ctx, t);
  }

  /* ============================================================
   * 妖兽剪影
   * ============================================================ */

  function ink(alpha) { return 'rgba(47,42,36,' + alpha + ')'; }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function eyeRed(ctx, x, y, r, slit) {
    ctx.save();
    ctx.fillStyle = C.cinnabar;
    if (slit) {
      ctx.translate(x, y);
      ctx.rotate(-0.25);
      ctx.scale(1, 0.45);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 狐妖：尖耳 · 长尾三叠 · 修长四肢 */
  function drawFox(ctx, s, jitter, t) {
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = ink(0.88);
    /* 尾巴（三条圆渐远渐细，随呼吸轻摆） */
    var wag = Math.sin(t * 2.2) * 6;
    blob(ctx, 128, -30 + wag, 46, 30, 0.5);
    blob(ctx, 176, -64 + wag, 38, 26, 0.65);
    blob(ctx, 212, -100 + wag, 27, 20, 0.8);
    /* 身体 */
    blob(ctx, 0, -62, 104, 62, 0.06);
    /* 四肢 */
    ctx.fillRect(-70, -20, 16, 66);
    ctx.fillRect(-30, -14, 16, 60);
    ctx.fillRect(30, -14, 16, 60);
    ctx.fillRect(64, -22, 16, 66);
    /* 头颈 */
    blob(ctx, -86, -118, 52, 46, -0.15);
    /* 双耳（含抖动） */
    var tw = jitter * 3;
    ctx.beginPath();
    ctx.moveTo(-122, -148); ctx.lineTo(-136 - tw, -206); ctx.lineTo(-92, -166);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-70, -156); ctx.lineTo(-58 - tw, -214); ctx.lineTo(-34, -162);
    ctx.closePath(); ctx.fill();
    /* 尖吻 */
    ctx.beginPath();
    ctx.moveTo(-126, -116); ctx.lineTo(-164, -102); ctx.lineTo(-120, -94);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* 蛇妖：盘绕三圈 · 昂首吐信 */
  function drawSnake(ctx, s, jitter, t) {
    ctx.save();
    ctx.scale(s, s);
    var sway = Math.sin(t * 1.6) * 8;
    ctx.strokeStyle = ink(0.88);
    ctx.lineCap = 'round';
    /* 由粗到细三段盘绕弧 */
    ctx.lineWidth = 52;
    ctx.beginPath();
    ctx.arc(10, -70, 92, Math.PI * 0.9, Math.PI * 2.25, false);
    ctx.stroke();
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.arc(-14, -86, 58, Math.PI * 1.7, Math.PI * 3.45, false);
    ctx.stroke();
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.arc(6, -100, 34, Math.PI * 3.2, Math.PI * 4.5, false);
    ctx.stroke();
    /* 颈 + 头 */
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(28, -128);
    ctx.quadraticCurveTo(70 + sway, -178, 52 + sway, -222);
    ctx.stroke();
    ctx.fillStyle = ink(0.88);
    blob(ctx, 46 + sway, -238 + jitter * 2, 40, 26, -0.35);
    /* 红信 */
    ctx.strokeStyle = C.cinnabar;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(14 + sway, -240);
    ctx.lineTo(-16 + sway, -248);
    ctx.moveTo(-16 + sway, -248);
    ctx.lineTo(-30 + sway, -256);
    ctx.moveTo(-16 + sway, -248);
    ctx.lineTo(-32 + sway, -240);
    ctx.stroke();
    ctx.restore();
  }

  /* 山魈：独角 · 魁伟持杵 */
  function drawShanxiao(ctx, s, jitter, t) {
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = ink(0.88);
    var br = Math.sin(t * 2.4) * 3;
    /* 躯干 */
    blob(ctx, 0, -108 + br, 96, 118, 0);
    /* 双腿 */
    ctx.fillRect(-64, -10, 44, 58);
    ctx.fillRect(22, -10, 44, 58);
    /* 左臂垂握 */
    ctx.lineWidth = 34;
    ctx.strokeStyle = ink(0.88);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-78, -140);
    ctx.quadraticCurveTo(-124, -80, -118, -20);
    ctx.stroke();
    blob(ctx, -116, -8, 26, 24, 0);
    /* 右臂举杵 */
    ctx.beginPath();
    ctx.moveTo(70, -150);
    ctx.quadraticCurveTo(128, -170, 138, -216);
    ctx.stroke();
    blob(ctx, 142, -224, 24, 22, 0);
    /* 石杵 */
    ctx.save();
    ctx.translate(150, -250);
    ctx.rotate(0.35);
    ctx.fillStyle = ink(0.8);
    ctx.fillRect(-9, -120, 18, 190);
    blob(ctx, 0, -132, 26, 30, 0);
    ctx.restore();
    /* 头 */
    blob(ctx, -6, -248 + br, 58, 52, 0);
    /* 独角 */
    ctx.beginPath();
    ctx.moveTo(-14, -292);
    ctx.lineTo(-4 + jitter, -352);
    ctx.lineTo(16, -288);
    ctx.closePath();
    ctx.fill();
    /* 怒眉獠牙留白 */
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.moveTo(-34, -216); ctx.lineTo(-24, -198); ctx.lineTo(-14, -216);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* 蛛妖：圆腹 · 八足 · 丝线垂天 */
  function drawSpider(ctx, s, jitter, t) {
    ctx.save();
    ctx.scale(s, s);
    /* 天丝 */
    ctx.strokeStyle = 'rgba(47,42,36,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -560);
    ctx.lineTo(6, -170);
    ctx.stroke();
    ctx.fillStyle = ink(0.88);
    var legT = Math.sin(t * 2.8) * 8;
    /* 八足：两侧各四，两段折线 */
    var i;
    ctx.strokeStyle = ink(0.85);
    ctx.lineCap = 'round';
    for (i = 0; i < 4; i++) {
      var ang = -0.5 + i * 0.42;
      var lx = 40 + i * 8;
      var lift = (i === 1 ? legT : 0);
      /* 右侧腿 */
      ctx.lineWidth = 13 - i;
      ctx.beginPath();
      ctx.moveTo(lx - 20, -80);
      ctx.quadraticCurveTo(lx + 70, -140 - i * 26 + lift, lx + 96, -60 - i * 18);
      ctx.lineTo(lx + 88, 6 + i * 6);
      ctx.stroke();
      /* 左侧腿 */
      ctx.beginPath();
      ctx.moveTo(-lx + 20, -80);
      ctx.quadraticCurveTo(-lx - 70, -140 - i * 26 - lift, -lx - 96, -60 - i * 18);
      ctx.lineTo(-lx - 88, 6 + i * 6);
      ctx.stroke();
      void ang;
    }
    /* 圆腹 */
    blob(ctx, 34, -128, 88, 74, 0.2);
    /* 头胸 */
    blob(ctx, -62, -96, 48, 42, -0.1);
    /* 螯肢 */
    ctx.beginPath();
    ctx.moveTo(-96, -76); ctx.lineTo(-122, -48); ctx.lineTo(-100, -44);
    ctx.closePath(); ctx.fill();
    /* 朱红斑纹 */
    ctx.fillStyle = 'rgba(176,58,48,0.55)';
    blob(ctx, 52, -140, 16, 13, 0);
    blob(ctx, 24, -112, 10, 8, 0);
    ctx.restore();
  }

  var MON_DRAWERS = { fox: drawFox, snake: drawSnake, shanxiao: drawShanxiao, spider: drawSpider };
  /* 各类妖兽眼睛位置（相对剪影坐标系） */
  var MON_EYES = {
    fox: [{ x: -102, y: -122, r: 7, slit: true }],
    snake: [{ x: 58, y: -242, r: 6.5, slit: false }],
    shanxiao: [{ x: -22, y: -256, r: 8, slit: false }, { x: 14, y: -254, r: 6, slit: true }],
    spider: [
      { x: -78, y: -108, r: 5, slit: false },
      { x: -64, y: -98, r: 6.5, slit: false },
      { x: -80, y: -90, r: 4.5, slit: false },
      { x: -64, y: -82, r: 5, slit: false }
    ]
  };

  /*
   * m = {
   *   type, boss, scale, seed,
   *   x, y,            逻辑坐标（脚底基线）
   *   hp, maxHp,
   *   spawnT (0→1), dyingT (-1 或 0→1),
   *   hurtT (受击白闪)
   * }
   */
  function drawMonster(ctx, m, t) {
    var appear = m.spawnT < 1 ? easeOut(m.spawnT) : 1;
    var alpha = 1;
    if (m.dyingT >= 0) alpha = Math.max(0, 1 - m.dyingT / 0.7);

    var sc = m.scale * (0.7 + 0.3 * easeOut(m.spawnT));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(m.x, m.y);

    /* Boss 气场（画在剪影下层） */
    if (m.boss && alpha > 0) {
      var pulse = 0.06 + 0.03 * Math.sin(t * 3);
      ctx.fillStyle = 'rgba(176,58,48,' + pulse.toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(0, -180 * sc, 250 * sc, 210 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.scale(sc, sc);
    /* 出场淡入时整体略下沉 */
    ctx.translate(0, (1 - appear) * 30);
    /* 受击后仰 */
    if (m.hurtT > 0) {
      var hk = Math.max(0, m.hurtT / 0.12);
      ctx.translate(-14 * hk, 2 * hk);
      ctx.rotate(-0.02 * hk);
    }

    /* 剪影本体 */
    var fn = MON_DRAWERS[m.type] || drawFox;
    fn(ctx, 1, srand(Math.floor(t * 10) + m.seed) * 4 - 2, t);
    /* 朱红眼 */
    var eyes = MON_EYES[m.type] || [];
    for (var ei = 0; ei < eyes.length; ei++) {
      var e = eyes[ei];
      eyeRed(ctx, e.x, e.y, e.r, e.slit);
    }
    ctx.restore();

    /* 血条与名号（不受妖兽缩放影响） */
    drawMonsterHud(ctx, m, t);
  }

  function drawMonsterHud(ctx, m, t) {
    var w = m.boss ? 420 : 320;
    var hx = m.x - w / 2;
    /* 收紧悬浮高度：矮画布（桌面宽窗）下避免撞进顶部 HUD */
    var hy = m.y - (295 * m.scale + (m.boss ? 56 : 34));
    var ratio = Math.max(0, m.hp / m.maxHp);
    var name = XB.monsterName(m.type, m.boss, m.level || 1);

    ctx.textAlign = 'center';
    ctx.font = (m.boss ? 'bold 34px' : '30px') +
      ' "Songti SC","STSong","Noto Serif SC",serif';
    ctx.fillStyle = ink(0.8);
    ctx.fillText(m.boss ? '「' + name + '」' : name, m.x, hy - 16);

    /* 血槽底 */
    roundRectPath(ctx, hx, hy, w, 20, 10);
    ctx.fillStyle = 'rgba(47,42,36,0.14)';
    ctx.fill();
    if (ratio > 0) {
      roundRectPath(ctx, hx + 2, hy + 2, (w - 4) * ratio, 16, 8);
      ctx.fillStyle = m.boss ? C.cinnabar : ink(0.72);
      ctx.fill();
    }
    /* 血量数字 */
    ctx.font = '22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = ink(0.55);
    ctx.fillText(XB.fmt(Math.ceil(m.hp)) + ' / ' + XB.fmt(m.maxHp), m.x, hy + 48);
    if (m.boss) {
      ctx.font = 'bold 20px "PingFang SC",sans-serif';
      ctx.fillStyle = C.cinnabar;
      ctx.fillText('BOSS', m.x, hy + 78);
    }
    void t;
  }

  /* ============================================================
   * 特效
   * ============================================================ */

  /* fx = { x,y,ang,t }  白色剑光斜劈 */
  function drawSlash(ctx, f) {
    var p = f.t / 0.18;
    if (p >= 1) return;
    var len = 130 + 190 * p;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(47,42,36,0.6)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 9 * (1 - p * 0.6);
    ctx.beginPath();
    ctx.moveTo(-len / 2, -len * 0.28);
    ctx.lineTo(len / 2, len * 0.28);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.globalAlpha = (1 - p) * 0.7;
    ctx.beginPath();
    ctx.moveTo(-len * 0.36, -len * 0.2);
    ctx.lineTo(len * 0.36, len * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  /* p = { x,y,r,alpha } 击杀墨烟 */
  function drawSmoke(ctx, p) {
    ctx.fillStyle = 'rgba(47,42,36,' + p.alpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ft = { x,y,txt,color,size,t,life } 飘字 */
  function drawFloatText(ctx, ft) {
    var p = ft.t / ft.life;
    ctx.save();
    ctx.globalAlpha = 1 - p * p;
    ctx.font = 'bold ' + (ft.size || 34) + 'px "Songti SC","STSong",serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.txt, ft.x, ft.y - p * 90);
    ctx.restore();
  }

  /* ============================================================
   * 突破演出（v3 分档）
   * bt = { t, big, name }
   *   big=false 小境界：0.8s 金环 + 境界文字
   *   big=true  大境界：2.4s 天劫三雷 + 金光 + 大字
   * ============================================================ */
  function drawBreakthrough(ctx, bt) {
    var t = bt.t;
    var big = !!bt.big;
    var dur = big ? 2.4 : 0.8;
    var cy = bt.cy || 620;   /* 演出中心（妖兽中心，随动态画布传入） */

    /* 金光 */
    var flash = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / (dur - 0.4));
    var g = ctx.createRadialGradient(375, cy, 60, 375, cy, 760);
    g.addColorStop(0, 'rgba(201,160,90,' + (flash * (big ? 0.9 : 0.5)).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(201,160,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* 天劫三雷（仅大境界） */
    if (big) {
      var boltXs = [255, 500, 375];
      var boltTs = [0.25, 0.75, 1.25];
      for (var bi = 0; bi < 3; bi++) {
        var bt2 = t - boltTs[bi];
        if (bt2 >= 0 && bt2 < 0.3) {
          drawLightning(ctx, boltXs[bi], bt2, bi * 17 + 3, cy - 40);
        }
      }
    }

    /* 扩散金环 */
    var ringP = Math.min(1, t / (big ? 1.4 : 0.7));
    ctx.strokeStyle = 'rgba(201,160,90,' + ((1 - ringP) * 0.9).toFixed(3) + ')';
    ctx.lineWidth = (big ? 12 : 8) * (1 - ringP) + 2;
    ctx.beginPath();
    ctx.arc(375, cy, 80 + ringP * 560, 0, Math.PI * 2);
    ctx.stroke();

    /* 境界大字 */
    if (t < dur - 0.1) {
      var tp = Math.min(1, t / 0.35);
      var a = t < dur - 0.5 ? 1 : 1 - (t - (dur - 0.5)) / 0.4;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(375, cy);
      var scl = 0.6 + 0.4 * easeOutBack(tp);
      ctx.scale(scl, scl);
      ctx.font = 'bold ' + (big ? 150 : 92) + 'px "Songti SC","STSong","Noto Serif SC",serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.cinnabar;
      ctx.shadowColor = 'rgba(201,160,90,0.9)';
      ctx.shadowBlur = 30;
      ctx.fillText(bt.name || '', 0, 0);
      if (big) {
        ctx.font = '34px "Songti SC","STSong",serif';
        ctx.fillStyle = ink(0.75);
        ctx.shadowBlur = 0;
        ctx.fillText('天 劫 已 渡 · 道 行 大 进', 0, 128);
      }
      ctx.restore();
    }
  }

  /* 天劫闪电：x 落点，t 0→0.28 内可见，endY 落点底端 */
  function drawLightning(ctx, x, t, seed, endY) {
    var p = t / 0.28;
    if (p < 0 || p >= 1) return;
    var alpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha * 0.95);
    ctx.strokeStyle = '#f9edc8';
    ctx.shadowColor = 'rgba(201,160,90,1)';
    ctx.shadowBlur = 26;
    ctx.lineWidth = 8 * (1 - p * 0.4);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    var y0 = 130, y1 = endY || 720, segs = 8;
    for (var i = 0; i <= segs; i++) {
      var yy = y0 + (y1 - y0) * i / segs;
      var xx = x + (i > 0 && i < segs ? (srand(seed * 13 + i * 7) - 0.5) * 90 : 0);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* 灵气潮汐：金色雾气边缘涌动，k∈[0,1] 强度淡入淡出，cy 演出中心 */
  function drawTide(ctx, k, t, cy) {
    if (k <= 0) return;
    var cc = cy || 640;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    var a = k * (0.12 + 0.07 * pulse);
    var g = ctx.createRadialGradient(375, cc, 240, 375, cc, 800);
    g.addColorStop(0, 'rgba(201,160,90,0)');
    g.addColorStop(1, 'rgba(201,160,90,' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    /* 上缘灵气丝带（锚在场景区，避开顶部 HUD） */
    var ribbonY = Math.max(260, cc - 460);
    ctx.save();
    ctx.globalAlpha = k * 0.5;
    ctx.strokeStyle = 'rgba(201,160,90,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var i = 0; i <= 30; i++) {
      var x = i / 30 * VIEW_W;
      var y = ribbonY + Math.sin(i * 0.5 + t * 2.4) * 9 + Math.sin(i * 0.13 - t) * 14;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* 连击标签：n 连击，t 为自最后一次命中起的时间（弹跳） */
  function drawComboTag(ctx, x, y, n, t) {
    var pop = 1 + 0.3 * Math.max(0, 1 - t * 5);
    var hot = n >= 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = 0.95;
    ctx.font = 'bold ' + (hot ? 46 : 38) + 'px "Songti SC","STSong",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hot ? C.cinnabar : C.goldDeep;
    ctx.shadowColor = 'rgba(47,42,36,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillText('连击 ×' + n, 0, 0);
    ctx.restore();
  }

  /* ============================================================
   * 境界卡（保存到相册）
   * ============================================================ */
  function drawRealmCard(cv, info) {
    cv.width = 750;
    cv.height = 1000;
    var c = cv.getContext('2d');
    var FONT_S = '"Songti SC","STSong","Noto Serif SC",serif';
    var FONT_H = '"PingFang SC","Microsoft YaHei",sans-serif';

    /* ---------- 底色 ---------- */
    var g = c.createLinearGradient(0, 0, 0, 1000);
    g.addColorStop(0, '#f7f1e3');
    g.addColorStop(1, C.paper);
    c.fillStyle = g;
    c.fillRect(0, 0, 750, 1000);
    var wash = c.createRadialGradient(375, 320, 60, 375, 320, 560);
    wash.addColorStop(0, 'rgba(201,160,90,0.10)');
    wash.addColorStop(1, 'rgba(201,160,90,0)');
    c.fillStyle = wash;
    c.fillRect(0, 0, 750, 1000);

    /* ---------- 边框（外墨内金） ---------- */
    c.strokeStyle = ink(0.8);
    c.lineWidth = 5;
    c.strokeRect(24, 24, 702, 952);
    c.strokeStyle = C.gold;
    c.lineWidth = 1.5;
    c.strokeRect(38, 38, 674, 924);

    /* ---------- 顶部标题区（y 60~180） ---------- */
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.font = '600 32px ' + FONT_S;
    c.fillStyle = ink(0.78);
    c.fillText('斩 妖 · 修 仙 录', 375, 108);
    c.font = '18px ' + FONT_H;
    c.fillStyle = ink(0.45);
    c.fillText('修 仙 放 置 · 水 墨 战 绩', 375, 142);
    /* 金线 + 菱形 */
    c.strokeStyle = C.gold;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(140, 172);
    c.lineTo(355, 172);
    c.moveTo(395, 172);
    c.lineTo(610, 172);
    c.stroke();
    c.save();
    c.translate(375, 172);
    c.rotate(Math.PI / 4);
    c.fillStyle = C.gold;
    c.fillRect(-5, -5, 10, 10);
    c.restore();

    /* ---------- 妖兽水印（垫在境界字后，若隐若现） ---------- */
    c.save();
    c.globalAlpha = 0.07;
    c.translate(375, 300);
    c.scale(1.5, 1.5);
    c.fillStyle = '#2f2a24';
    c.beginPath();
    c.ellipse(0, 0, 58, 40, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(-44, -32, 22, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(62, -52, 40, 18, -0.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* ---------- 境界大字（横排，自适应字号） ---------- */
    var realmStr = String(info.realm || '炼气');
    var rSize = realmStr.length <= 2 ? 148 : (realmStr.length === 3 ? 112 : 88);
    c.font = 'bold ' + rSize + 'px ' + FONT_S;
    c.fillStyle = C.cinnabar;
    c.fillText(realmStr, 375, 352);
    c.font = '22px ' + FONT_H;
    c.fillStyle = ink(0.5);
    c.fillText('— 当 前 境 界' + (info.stage ? ' · ' + info.stage : '') + ' —', 375, 398);

    /* ---------- 数据网格 2×2（列中心 205/545，格宽 260，零重叠） ---------- */
    var cells = [
      { label: '关卡', value: '第 ' + info.level + ' 关' },
      { label: '灵石', value: XB.fmt(info.stones) },
      { label: '总战力', value: XB.fmt(info.power || 0) },
      { label: '道基', value: (info.dj || 0) + (info.rb ? ' · 轮回' + info.rb + '世' : '') }
    ];
    var colXs = [205, 545];
    var rowYs = [448, 592];
    var cw = 260, ch = 116;
    for (var ci = 0; ci < 4; ci++) {
      var ox = colXs[ci % 2], oy = rowYs[Math.floor(ci / 2)];
      roundRectPath(c, ox - cw / 2, oy, cw, ch, 14);
      c.fillStyle = 'rgba(47,42,36,0.045)';
      c.fill();
      c.strokeStyle = 'rgba(47,42,36,0.3)';
      c.lineWidth = 1.2;
      c.stroke();
      c.font = '21px ' + FONT_H;
      c.fillStyle = ink(0.5);
      c.fillText(cells[ci].label, ox, oy + 36);
      c.font = 'bold 38px ' + FONT_S;
      c.fillStyle = ink(0.92);
      c.fillText(cells[ci].value, ox, oy + 86);
    }

    /* ---------- 底部：日期居中 + 印章右下 ---------- */
    c.font = '22px ' + FONT_H;
    c.fillStyle = ink(0.5);
    c.fillText(info.date, 300, 912);
    c.save();
    c.translate(590, 878);
    c.rotate(-0.06);
    c.fillStyle = C.cinnabar;
    roundRectPath(c, -46, -46, 92, 92, 10);
    c.fill();
    c.strokeStyle = C.paper;
    c.lineWidth = 2;
    roundRectPath(c, -38, -38, 76, 76, 6);
    c.stroke();
    c.font = 'bold 52px ' + FONT_S;
    c.fillStyle = C.paper;
    c.fillText('斩', 0, 19);
    c.restore();

    /* 左下角小字点缀 */
    c.font = '18px ' + FONT_S;
    c.fillStyle = ink(0.4);
    c.fillText('斩妖除魔 · 得道飞升', 160, 905);
  }

  /* ---------- 缓动 ---------- */
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeOutBack(p) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  }

  /* ---------- 香炉入定（修行页） ---------- */
  function drawCenser(ctx, cx, baseY, t) {
    ctx.save();
    /* 蒲团 */
    ctx.beginPath();
    ctx.ellipse(cx - 150, baseY - 14, 62, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(61,74,92,0.25)'; ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - 150, baseY - 20, 52, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(61,74,92,0.38)'; ctx.fill();
    /* 炉身 */
    roundRectPath(ctx, cx - 46, baseY - 92, 92, 62, 16);
    ctx.fillStyle = 'rgba(47,42,36,0.82)'; ctx.fill();
    /* 炉口 */
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 92, 46, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,28,25,0.95)'; ctx.fill();
    /* 双耳与足 */
    ctx.strokeStyle = 'rgba(47,42,36,0.82)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(cx - 56, baseY - 70, 12, Math.PI * 0.4, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 56, baseY - 70, 12, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(cx - 26, baseY - 30); ctx.lineTo(cx - 32, baseY - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 26, baseY - 30); ctx.lineTo(cx + 32, baseY - 8); ctx.stroke();
    /* 三炷香与火星 */
    for (var i = -1; i <= 1; i++) {
      var ix = cx + i * 18;
      ctx.strokeStyle = 'rgba(120,60,40,0.9)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(ix, baseY - 96); ctx.lineTo(ix + i * 3, baseY - 158); ctx.stroke();
      var glow = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 2);
      ctx.beginPath(); ctx.arc(ix + i * 3, baseY - 159, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,120,60,' + (0.5 + glow * 0.5).toFixed(2) + ')'; ctx.fill();
    }
    /* 烟三缕 */
    for (var s = -1; s <= 1; s++) {
      ctx.beginPath();
      var top = baseY - 300, down = baseY - 162;
      ctx.moveTo(cx + s * 18, down);
      for (var k = 1; k <= 6; k++) {
        var yy = down + (top - down) * k / 6;
        var xx = cx + s * 18 + Math.sin(t * 0.9 + k * 1.1 + s * 2.4) * (8 + k * 3.5) + s * k * 6;
        ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = 'rgba(120,120,120,' + (0.26 - Math.abs(s) * 0.06).toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 宗门牌坊（宗门页） ---------- */
  function drawPaifang(ctx, cx, baseY, t, sectName) {
    ctx.save();
    var pw2 = 250, pillH = 190, py2 = baseY - pillH;
    ctx.fillStyle = 'rgba(74,40,36,0.85)';
    ctx.fillRect(cx - pw2 / 2 - 12, py2, 24, pillH);
    ctx.fillRect(cx + pw2 / 2 - 12, py2, 24, pillH);
    ctx.fillStyle = 'rgba(47,42,36,0.7)';
    ctx.fillRect(cx - pw2 / 2 - 22, baseY - 14, 44, 14);
    ctx.fillRect(cx + pw2 / 2 - 22, baseY - 14, 44, 14);
    roundRectPath(ctx, cx - pw2 / 2 - 40, py2 - 56, pw2 + 80, 40, 6);
    ctx.fillStyle = 'rgba(30,28,26,0.92)'; ctx.fill();
    roundRectPath(ctx, cx - 96, py2 - 48, 192, 26, 4);
    ctx.fillStyle = 'rgba(47,42,36,0.95)'; ctx.fill();
    ctx.strokeStyle = 'rgba(201,160,90,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.font = '700 21px "Songti SC",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(201,160,90,0.95)';
    ctx.fillText(sectName || '待定仙宗', cx, py2 - 34);
    for (var e = 0; e < 2; e++) {
      var ey = py2 - 62 - e * 26;
      var ew = pw2 + 90 - e * 46;
      ctx.beginPath();
      ctx.moveTo(cx - ew / 2, ey);
      ctx.quadraticCurveTo(cx, ey - 22 - e * 4, cx + ew / 2, ey);
      ctx.quadraticCurveTo(cx, ey + 12, cx - ew / 2, ey);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,28,26,' + (0.9 - e * 0.12) + ')';
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, py2 - 116, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(176,58,48,0.9)'; ctx.fill();
    var sw = Math.sin(t * 1.3) * 6;
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var ax = cx + s2 * (pw2 / 2 + 22);
      ctx.strokeStyle = 'rgba(47,42,36,0.5)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax, py2 - 20); ctx.lineTo(ax + sw, py2 + 8); ctx.stroke();
      ctx.beginPath(); ctx.arc(ax + sw, py2 + 18, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(176,58,48,0.82)'; ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 悬浮经卷（功法页） ---------- */
  function drawScroll(ctx, cx, baseY, t, cols) {
    ctx.save();
    var bob = Math.sin(t * 0.8) * 8;
    var x0 = cx - 170, y0 = baseY - 330 + bob, w0 = 340, h0 = 230;
    ctx.fillStyle = 'rgba(47,42,36,0.14)';
    ctx.fillRect(x0 + 8, y0 + 10, w0, h0);
    ctx.fillStyle = 'rgba(248,242,228,0.96)';
    ctx.fillRect(x0, y0, w0, h0);
    roundRectPath(ctx, x0 - 14, y0 - 14, w0 + 28, 20, 10);
    ctx.fillStyle = 'rgba(74,50,36,0.9)'; ctx.fill();
    roundRectPath(ctx, x0 - 14, y0 + h0 - 6, w0 + 28, 20, 10);
    ctx.fillStyle = 'rgba(74,50,36,0.9)'; ctx.fill();
    cols = cols || [];
    for (var i = 0; i < 8; i++) {
      var lx = x0 + w0 - 34 - i * 38;
      if (i < cols.length && cols[i]) {
        ctx.font = '600 22px "Songti SC",serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(47,42,36,0.85)';
        for (var c = 0; c < cols[i].length && c < 5; c++) {
          ctx.fillText(cols[i][c], lx, y0 + 40 + c * 34);
        }
      } else {
        ctx.strokeStyle = 'rgba(47,42,36,0.14)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, y0 + 30); ctx.lineTo(lx, y0 + h0 - 30); ctx.stroke();
      }
    }
    roundRectPath(ctx, x0 + 22, y0 + h0 - 62, 36, 36, 5);
    ctx.fillStyle = 'rgba(176,58,48,0.85)'; ctx.fill();
    ctx.font = '700 19px "Songti SC",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4ecdc';
    ctx.fillText('道', x0 + 40, y0 + h0 - 43);
    ctx.restore();
  }

  /* ---------- 市招幌子（坊市页） ---------- */
  function drawStall(ctx, cx, baseY, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(74,50,36,0.8)';
    ctx.fillRect(cx - 110, baseY - 74, 220, 14);
    ctx.fillRect(cx - 96, baseY - 60, 12, 60);
    ctx.fillRect(cx + 84, baseY - 60, 12, 60);
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(cx - 60 + i * 36, baseY - 84 - (i % 2) * 8, 14, 10, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,160,90,' + (0.55 + (i % 2) * 0.25) + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(138,106,48,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    var px0 = cx + 150;
    ctx.strokeStyle = 'rgba(47,42,36,0.85)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(px0, baseY); ctx.lineTo(px0, baseY - 300); ctx.stroke();
    ctx.strokeStyle = 'rgba(47,42,36,0.8)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(px0, baseY - 292); ctx.lineTo(px0 - 66, baseY - 284); ctx.stroke();
    var fx = px0 - 62, fy = baseY - 282;
    var sway = Math.sin(t * 1.6) * 8;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx - 8 + sway, fy + 40, fx + sway * 1.2, fy + 92);
    ctx.lineTo(fx - 52 + sway, fy + 100);
    ctx.quadraticCurveTo(fx - 60 + sway * 0.6, fy + 46, fx - 52 + sway * 0.4, fy + 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(176,58,48,0.88)'; ctx.fill();
    ctx.font = '800 34px "Songti SC",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4ecdc';
    ctx.fillText('市', fx - 27 + sway * 0.8, fy + 52);
    ctx.restore();
  }

  /* ---------- 山道石阶（仙途页） ---------- */
  function drawPath(ctx, cx, baseY, t) {
    ctx.save();
    for (var c = 0; c < 3; c++) {
      var cxx = cx - 130 + c * 150 + Math.sin(t * 0.4 + c * 2.2) * 26;
      var cyy = baseY - 260 - c * 26;
      ctx.beginPath();
      ctx.ellipse(cxx, cyy, 64, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244,236,220,0.5)'; ctx.fill();
    }
    for (var i = 0; i < 9; i++) {
      var sw2 = 150 - i * 12;
      var sx = cx + (i % 2 - 0.5) * 44 - sw2 / 2 + 22;
      var sy = baseY - 16 - i * 30;
      roundRectPath(ctx, sx, sy, sw2, 18, 6);
      ctx.fillStyle = 'rgba(47,42,36,' + (0.66 - i * 0.05).toFixed(2) + ')';
      ctx.fill();
    }
    var mx = cx - 150, my = baseY - 100;
    ctx.fillStyle = 'rgba(60,55,50,0.85)';
    roundRectPath(ctx, mx - 9, my - 46, 18, 58, 4); ctx.fill();
    roundRectPath(ctx, mx - 30, my - 62, 60, 22, 5); ctx.fill();
    ctx.font = '700 15px "Songti SC",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(244,236,220,0.92)';
    ctx.fillText('仙途', mx, my - 50);
    var glow = 0.2 + 0.12 * Math.sin(t * 0.9);
    var g = ctx.createRadialGradient(cx + 40, baseY - 300, 8, cx + 40, baseY - 300, 90);
    g.addColorStop(0, 'rgba(201,160,90,' + glow.toFixed(2) + ')');
    g.addColorStop(1, 'rgba(201,160,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 60, baseY - 400, 200, 200);
    ctx.restore();
  }

  /* ============================================================
   * 魔窟妖塔（v4 山门主场景）
   * ============================================================ */
  function drawTower(ctx, cx, baseY, t, best) {
    var n = 6, wBase = 192, hStep = 46;
    ctx.save();
    ctx.translate(cx, baseY);

    /* 塔基阴影 */
    ctx.beginPath();
    ctx.ellipse(0, 4, wBase * 0.72, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(47,42,36,0.18)';
    ctx.fill();

    /* 塔身逐层 */
    for (var i = 0; i < n; i++) {
      var w = wBase * (1 - i * 0.105);
      var y = -i * hStep;
      /* 壁体 */
      roundRectPath(ctx, -w / 2, y - hStep + 8, w, hStep - 10, 5);
      ctx.fillStyle = 'rgba(54,49,42,' + (0.74 - i * 0.055) + ')';
      ctx.fill();
      /* 壁画线 */
      ctx.strokeStyle = 'rgba(244,236,220,0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
      /* 檐 */
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 17, y - hStep + 12);
      ctx.quadraticCurveTo(-w / 4, y - hStep - 8, 0, y - hStep - 12);
      ctx.quadraticCurveTo(w / 4, y - hStep - 8, w / 2 + 17, y - hStep + 12);
      ctx.quadraticCurveTo(0, y - hStep + 24, -w / 2 - 17, y - hStep + 12);
      ctx.closePath();
      ctx.fillStyle = 'rgba(28,26,24,' + (0.92 - i * 0.05) + ')';
      ctx.fill();
      /* 檐角灵灯（随层闪暗） */
      if (i > 0 && i < 6) {
        var glow = 0.28 + 0.5 * Math.abs(Math.sin(t * 0.7 + i * 2.1));
        ctx.fillStyle = 'rgba(201,160,90,' + glow.toFixed(3) + ')';
        ctx.fillRect(-4, y - hStep + 22, 8, 10);
      }
    }

    /* 塔门（妖气红芒） */
    var doorPulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    roundRectPath(ctx, -26, -50, 52, 50, 24);
    var dg = ctx.createLinearGradient(0, -50, 0, 0);
    dg.addColorStop(0, 'rgba(20,10,10,0.95)');
    dg.addColorStop(1, 'rgba(' + Math.round(110 + doorPulse * 50) + ',30,24,0.9)');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,236,220,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* 门楣牌枛 */
    roundRectPath(ctx, -34, -68, 68, 18, 4);
    ctx.fillStyle = 'rgba(30,28,26,0.95)';
    ctx.fill();
    ctx.font = '700 13px "Songti SC",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(201,160,90,0.95)';
    ctx.fillText('魔窟妖塔', 0, -59);

    /* 塔刹 */
    var topY = -n * hStep - 10;
    ctx.strokeStyle = 'rgba(47,42,36,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, topY + 16);
    ctx.lineTo(0, topY - 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, topY - 26, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(176,58,48,0.9)';
    ctx.fill();

    /* 塔身妖气缠绕 */
    for (var k = 0; k < 3; k++) {
      var ph2 = (t * 0.22 + k * 0.33) % 1;
      var ry = -ph2 * n * hStep;
      var rw = wBase * (1 - ph2 * 0.55) * 0.7;
      ctx.beginPath();
      ctx.ellipse(0, ry, rw, 7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(120,40,36,' + (0.18 * (1 - ph2)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    COLORS: C,
    srand: srand,
    roundRectPath: roundRectPath,
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
    setView: setView,
    bandOf: bandOf,
    drawBackground: drawBackground,
    drawMonster: drawMonster,
    drawSlash: drawSlash,
    drawSmoke: drawSmoke,
    drawFloatText: drawFloatText,
    drawBreakthrough: drawBreakthrough,
    drawLightning: drawLightning,
    drawTide: drawTide,
    drawTower: drawTower,
    drawCenser: drawCenser,
    drawPaifang: drawPaifang,
    drawScroll: drawScroll,
    drawStall: drawStall,
    drawPath: drawPath,
    drawComboTag: drawComboTag,
    drawRealmCard: drawRealmCard,
    easeOut: easeOut,
    easeOutBack: easeOutBack
  };
})();
