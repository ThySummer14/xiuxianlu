# 斩妖·修仙录

水墨风 Canvas 修仙增量小游戏，保留浏览器与微信小游戏双端接口。无需构建、无需依赖。

## 本地运行

```sh
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 验证与数值研究

需要 Node.js 20+，没有第三方测试依赖：

```sh
node scripts/check.cjs # 所有生产脚本语法检查 + 100项单进程回归测试
node scripts/characterize.cjs
node scripts/simulate.cjs --seconds=3600 --policy=active
node scripts/balance-matrix.cjs # 40次模拟，单进程，可能需要数分钟
node scripts/rebirth-study.cjs # 完整首世、配对轮回与无机缘/纯闭关测试
node scripts/session-study.cjs # 渲染节奏、24小时上限和重复归来测试
```

测试加载真实 production 脚本，使用确定性随机数、模拟时间、Canvas 空实现；验证核心游戏行为与存档兼容性，**不代表浏览器视觉/输入验收**。

- 当前数值的15/30/60分钟矩阵：[`docs/balance-final-matrix.json`](docs/balance-final-matrix.json)
- 首世/轮回、无幸运、纯闭关研究：[`docs/rebirth-study.json`](docs/rebirth-study.json)
- 原版与第二轮的四策略、五随机种子对照：[`docs/balance-matrix.json`](docs/balance-matrix.json)
- 数值基线：[`docs/balance-baseline.json`](docs/balance-baseline.json)
- 调研与设计依据：[`docs/progression-research.md`](docs/progression-research.md)
- 存档仍使用 `xiuxian_idle_v3`，保留 v1/v2 迁移；本次更新不清档

## 存档保护

设置里的「存档保险箱」可导出/导入JSON文件、预览本机备份，并在明确确认后恢复。恢复前会保留当前进度，允许撤回；写入失败会提示且不覆盖修行。损坏存档可从标题页进入保险箱。见[恢复说明](docs/save-recovery.md)。

## 手机竖屏

360 / 390 / 430px 宽与 360×480 短屏有独立布局；主要操作至少 44 CSS px，列表和弹窗可滑动，关闭/确认按钮留在安全区。旋转或切换后台会取消未完成手势，避免误购。浏览器视觉验收记录见[手机适配说明](docs/mobile-ui.md)。
