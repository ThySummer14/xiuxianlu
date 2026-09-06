/* ============================================================
 * 斩妖·修仙录 · audio.js
 * WebAudio 程序化音效（浏览器 / 微信小游戏通用，经 XP 平台层）
 * 挥剑 / 暴击 / 击杀 / 购买 / 突破 / 天劫 / 奇遇 / 潮汐
 * 首次用户手势后初始化；任何失败静默降级
 * ============================================================ */

'use strict';

var XAudio = (function () {
  var ac = null;
  var muted = false;

  function init() {
    if (ac) {
      if (ac.state === 'suspended' && ac.resume) ac.resume();
      return;
    }
    ac = XP.createAudioContext();
  }

  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  /* 单音：freq 起 → end 止，type 波形，dur 秒，vol 音量 */
  function tone(freq, end, type, dur, vol, delay) {
    if (!ac || muted) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      var t0 = ac.currentTime + (delay || 0);
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (end && end !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* 静默 */ }
  }

  /* 噪声脉冲（挥剑破空 / 雷鸣），hpFreq 高通截止 */
  function noise(dur, vol, hpFreq, delay) {
    if (!ac || muted) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      var t0 = ac.currentTime + (delay || 0);
      var n = Math.floor(ac.sampleRate * dur);
      var buf = ac.createBuffer(1, n, ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      }
      var src = ac.createBufferSource();
      src.buffer = buf;
      var hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = hpFreq || 1400;
      var g = ac.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(hp);
      hp.connect(g);
      g.connect(ac.destination);
      src.start(t0);
    } catch (e) { /* 静默 */ }
  }

  function slash() {
    noise(0.09, 0.10);
    tone(1500, 380, 'sawtooth', 0.08, 0.05);
  }

  /* 暴击：更锐的高频 + 低频重击 */
  function crit() {
    noise(0.12, 0.16, 2200);
    tone(1900, 500, 'sawtooth', 0.1, 0.08);
    tone(120, 45, 'sine', 0.22, 0.26);
  }

  function kill() {
    tone(180, 55, 'sine', 0.28, 0.22);
    noise(0.16, 0.08);
  }

  function buy() {
    tone(660, 660, 'triangle', 0.07, 0.14);
    tone(990, 990, 'triangle', 0.09, 0.12, 0.06);
  }

  function deny() {
    tone(200, 160, 'square', 0.08, 0.06);
  }

  /* 小境界：轻快双音 */
  function stageUp() {
    tone(784, 784, 'triangle', 0.09, 0.13);
    tone(1175, 1175, 'triangle', 0.14, 0.14, 0.08);
  }

  /* 大境界（天劫）：雷鸣 + 上行音阶 */
  function breakthrough() {
    noise(0.5, 0.3, 300, 0.02);
    noise(0.35, 0.22, 500, 0.5);
    noise(0.4, 0.26, 260, 1.0);
    tone(523, 523, 'triangle', 0.14, 0.16, 0.1);
    tone(659, 659, 'triangle', 0.14, 0.16, 0.55);
    tone(784, 784, 'triangle', 0.14, 0.16, 1.0);
    tone(1046, 1046, 'triangle', 0.34, 0.2, 1.35);
    tone(196, 60, 'sine', 0.5, 0.18, 1.35);
  }

  /* 奇遇：灵动的风铃琶音 */
  function fate() {
    tone(1318, 1318, 'sine', 0.12, 0.1, 0);
    tone(1568, 1568, 'sine', 0.12, 0.1, 0.07);
    tone(2093, 2093, 'sine', 0.18, 0.12, 0.14);
  }

  /* 灵气潮汐：低鸣泛音 */
  function tide() {
    tone(392, 523, 'sine', 0.6, 0.1);
    tone(196, 261, 'sine', 0.8, 0.08, 0.1);
  }

  return {
    init: init,
    slash: slash,
    crit: crit,
    kill: kill,
    buy: buy,
    deny: deny,
    stageUp: stageUp,
    breakthrough: breakthrough,
    fate: fate,
    tide: tide,
    setMuted: setMuted,
    isMuted: isMuted
  };
})();
