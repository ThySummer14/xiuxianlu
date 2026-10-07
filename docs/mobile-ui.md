# 手机竖屏适配（2026-10-06）

## 发现的具体问题

原版把750逻辑宽的桌面面板整体缩到手机。360px宽时，50高购买按钮仅24px，18号说明文字仅8.64px，宗门30高拜入按钮仅14.4px。功法、坊市、任务的说明和操作横向挤在同一行；900高固定画卷在短屏里缩小，不能保证触控尺寸。网页未读取安全区或 visualViewport，旋转期间按下的按钮可能在新坐标处完成释放。

## 改动

- 保留水墨场景与六个入口，手机面板独立重排。修行/拜师为两列卡片；功法、坊市、宗门任务、仙途以大行卡片滑动查看。
- 手机主要按钮至少44 CSS像素高，360px下通常46px；核心标签约14px，次要文字约12.5–13px。长说明换行，买入/升阶分列，显示回本时间。
- HUD分开显示境界、修为、气血、收入与战力，不再把数段长文本挤进条内。手机场景随可用高度缩放，不缩小操作区域。
- 七类弹窗使用安全区内的大卡片和独立滚动正文；关闭、离线收取、恢复确认和轮回按钮固定在底部。恢复前先预览，轮回/清档保留限时再次确认。轮回确认时警告重新滚到顶部。
- 网页读取 `env(safe-area-inset-*)` 和 `visualViewport`，浏览器工具栏收缩/恢复时重新布局。旋转、pointercancel、离开画布、切后台都撤销未完成触摸；第二根手指不能完成首指购买。列表上拖动不购买。
- 增加细滚动条和手机字号提示消息。桌面保留原布局。没有修改数值、解锁、奖励或存档格式。

## 验证

`node scripts/check.cjs`：100项单进程回归测试。新增真实生产脚本的尺寸/输入检查：360×800、390×844、430×932、360×480；弹窗额外覆盖320×480、600×300和安全区。检查≥44px操作尺寸、按钮相交、末行商铺滑动购买、切换尺寸/取消/第二指不误购、弹窗阻挡底层滑动、重复确认、恢复与撤回。

Canvas测试使用近似中文字体测量和无绘图上下文。它证明布局几何与游戏输入逻辑，不证明实际字体渲染、手机浏览器或物理触屏效果。实际云浏览器截图与输入验收待发布后补充。未声称真实手机、音频或横屏完整体验验收。

## 优先手动流程

1. 保留老存档，设置→保险箱导出。360/390/430宽竖屏进入修行，确认四卡可读、滑动第二行不买入。
2. 功法滑至底部，点击可见功法，确认升级对象正确；坊市最后商铺分别购买/升阶。
3. 宗门/仙途滑动、领取、重复点；切回修行确认资源和境界不变。
4. 打开画卷，滚到底再点轮回，确认归零/保留警告从顶部出现；取消应保留全部进度。
5. 保险箱恢复预览→返回；确认恢复后再从「恢复前的进度」撤回，重启验证。
6. 在短屏/浏览器工具栏展开、旋转、文件选择取消后回到页面；按下按钮后改变尺寸再抬起，不应购买。

## Android touch-release hotfix

An actual reported regression exposed a gap in the first test matrix: touch release emits `pointerup` and then `pointerleave` before the next render. The mobile pointerleave handler incorrectly cleared the already-completed tap queue, so the Start and other buttons could appear inert on touch devices even while direct logical-coordinate tests passed.

The hotfix only cancels pointerleave/pointercancel when its pointer ID still belongs to an active press. Completed taps survive; a held finger leaving, canceled touch, drag, outside release and secondary fingers still cannot purchase. Six full event-path regressions cover start/settings/close at360/390/430px, one purchase, held leave, secondary pointer cancellation, and an explicit old-code counterexample. All106 tests pass. Save format/economy and artwork are unchanged; no cache clearing or save reset is required.

## Published checkpoint

Phone layout and recovery reached main `eb2d6d0199571a19a9fe25eda3ec433f4889a020`. Pages run37407385615 completed successfully; its deploy logs identify https://thysummer14.github.io/xiuxianlu/ . HTTP200 responses for index/main/platform/ui matched that commit byte-for-byte. After the Android fix, cloud Chromium narrow-window mouse checks passed Start, Settings, Close, reload/Continue with retained realm and cultivation, and scrolling to lower cards. Device emulation was unavailable by browser policy; these checks are not physical-phone or touch-device validation.


## Hotfix deployment verified

Main `43d8e9be0f0daa4ec0d47c3b852b29e3ace8171b` deployed successfully in Pages run37408244445. Its index and main script returned HTTP200 and matched the tested commit byte-for-byte. The art integration preserves these pointer handlers unchanged and adds explicit image-load/error-during-touch checks, rather than relying on direct logical clicks alone.

## 2026-10-07 横向拖动防误购

已复现：从购买按钮横向滑出、再回到原处抬手，旧输入只记录纵向拖动，会错误购买一次。现在任何方向累计离开起点超过10逻辑像素都会取消本次点按；只有纵向移动才接管竖直列表。回到按钮不会恢复已取消的点按，下一次干净轻点正常。右/中键也不再触发购买或挥剑。

新增390×844与844×390回归，覆盖滑出后返回、轻微手抖与下一次正常购买；保留原列表滚动、Android抬手离开、多指取消、存档及怪物测试。全量语法检查及184项测试通过。境界、温养循环、怪物数值与存档格式未改。手机真机触摸与性能仍未实测。
