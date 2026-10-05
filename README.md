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
node --test --test-concurrency=1 tests/*.test.cjs
node scripts/characterize.cjs
```

测试加载真实 production 脚本，使用确定性随机数、模拟时间、Canvas 空实现；验证核心游戏行为与存档兼容性，**不代表浏览器视觉/输入验收**。

- 数值基线：[`docs/balance-baseline.json`](docs/balance-baseline.json)
- 调研与设计依据：[`docs/progression-research.md`](docs/progression-research.md)
- 存档仍使用 `xiuxian_idle_v3`，保留 v1/v2 迁移；本次更新不清档
