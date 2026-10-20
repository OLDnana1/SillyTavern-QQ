# QQ Bridge (SnowLuma)

一个 SillyTavern 第三方扩展：把 QQ 私聊接成当前角色卡聊天的“远程输入框 + 远程显示器”。

- QQ 私聊消息 → 写入酒馆当前聊天（作为当前 persona）→ 触发生成
- 酒馆 AI 回复 → 通过 QQ 机器人发回给你
- 酒馆网页里手动发的用户消息不会同步到 QQ
- 只处理文本，不处理图片、语音、表情、伪前端角色卡

## 前置条件

1. **SillyTavern** 已安装并能正常运行（本扩展在 1.12.13+ 上开发）。
2. **SnowLuma** 已启动，QQ 已登录。
3. SnowLuma 的 **OneBot WebSocket 服务端**已启用，默认地址 `ws://127.0.0.1:3001/`，并记下 access token。
4. 酒馆页面在 `http://127.0.0.1:8000` 打开，并保持常开。

SnowLuma 端口速查：

| 端口 | 用途 |
| --- | --- |
| 5099 | SnowLuma WebUI |
| 3000 | OneBot HTTP（本扩展不用） |
| 3001 | OneBot WebSocket（本扩展使用） |
| 6081 | Docker 镜像的 noVNC；Windows 原生安装不需要 |

## 安装

### 开发期：目录联接（推荐）

在管理员命令提示符里执行（路径按你的实际安装位置调整）：

```bat
mklink /J "D:\SillyTavern-1.18.0\public\scripts\extensions\third-party\SillyTavern-QQ" "D:\SillyTavern-QQ"
```

然后刷新酒馆页面。扩展目录名必须是 `SillyTavern-QQ`，因为 `settings.html` 的模板路径依赖它。

### 发布期：Git URL 安装

把本仓库推到 GitHub，保证仓库根目录有 `manifest.json`，然后在酒馆：

`扩展程序 → 安装扩展程序 → 输入 Git URL`

填 `https://github.com/<你的用户名>/SillyTavern-QQ`，选择“只给我安装”。

## 配置

打开酒馆的“扩展程序”面板，展开 **QQ Bridge (SnowLuma)**：

| 配置项 | 说明 |
| --- | --- |
| 启用桥接 | 打开后才会连接 OneBot 并处理消息 |
| OneBot WebSocket 地址 | 默认 `ws://127.0.0.1:3001/`，端口以 SnowLuma WebUI 为准 |
| Access Token | SnowLuma 里 OneBot 的 access token |
| 允许的 QQ 号 | 逗号分隔；留空时只接受“默认接收 QQ”的私聊 |
| 默认接收 QQ | 你的主 QQ 号。酒馆手动生成时，AI 回复发到这里 |
| 使用当前 persona 名 | 勾选后 QQ 消息写入时用酒馆 persona 名，`{{user}}` 保持一致 |
| 酒馆手动触发的 AI 回复也发送到 QQ | 默认开启；关闭后只有 QQ 触发的回复才发回 QQ |
| 剥离思考内容 | 去掉 `<thinking>`、`<thought>` 等块 |
| 单条消息长度上限 | 默认 3000；正常回复整段一条，超过才按段落切分 |

填完后点“测试连接”，状态应显示机器人昵称和 QQ 号。也可以点“发送测试消息”验证出站链路。

## 使用

1. 在酒馆里打开任意角色卡和聊天。
2. 扩展面板里勾选“启用桥接”。
3. 用你的主 QQ 私聊机器人。
4. 消息会出现在酒馆当前聊天里，角色卡生成回复后，回复会由机器人发回 QQ。

## 行为说明

- 只处理 QQ **私聊**，群聊暂不支持。
- 只发送 AI 回复；QQ 消息写入酒馆时产生的用户消息不会回声到 QQ。
- `first_message`、`swipe`、`regenerate`、`continue` 产生的内容不会自动发送，避免重复刷屏。
- 酒馆正在生成时，QQ 消息会排队，等当前生成结束后再写入并触发，不会打断酒馆。
- 超长回复会按空行、换行、句号依次切分，避免 QQ 单条消息过长发送失败。
- 角色卡输出里的 HTML 标签、`style`/`script` 块会被剥离，`*动作*` 和括号旁白会保留。

## 排障

**状态一直“连接中”或“连接错误”**

- 确认 SnowLuma WebUI 里 OneBot 的 WebSocket 服务端已启用。
- 确认端口是 3001（或你在 SnowLuma 里改过的端口）。
- 确认 token 正确；浏览器 WebSocket 只能用 `?access_token=`，扩展已自动拼接。
- 浏览器控制台看是否有 `[ST-QQ]` 开头的错误。

**能连上但收不到 QQ 消息**

- 确认机器人 QQ 已登录，且你用**私聊**发消息。
- 检查“允许的 QQ 号”和“默认接收 QQ”是否填的是你的主 QQ 号。
- 查看扩展面板日志里是否有“忽略未授权 QQ”。

**QQ 消息到了酒馆但不生成**

- 确认酒馆当前打开的是角色卡聊天，而不是角色列表页。
- 确认酒馆没有处于“正在生成”状态；消息会排队等待。
- 确认酒馆后端 API 正常，手动发一条消息能正常生成。

**回复没有发回 QQ**

- 确认“默认接收 QQ”已填写。
- 查看日志里是否有“发送到 QQ 失败”。
- 如果关闭了“酒馆手动触发的 AI 回复也发送到 QQ”，只有 QQ 触发的回复才会发回。

## 已知限制

- 酒馆页面必须保持打开，且当前聊天就是你想接管的角色卡聊天。
- 同一时间只支持一个 QQ 会话映射到当前聊天。
- 不支持群聊、图片、语音、表情、文件、伪前端角色卡。
- Access token 以明文存在酒馆的用户设置里，不要分享 `settings.json`。

## 目录结构

```
manifest.json          酒馆扩展清单
index.js               扩展入口
settings.html          设置面板模板
style.css              设置面板样式
st-api.js              酒馆内部 API 统一出口
src/config.js          配置默认值与读写
src/logger.js          日志缓冲与订阅
src/onebot-client.js   OneBot WebSocket 客户端
src/message-utils.js   消息解析、清洗、长度保护
src/generation-queue.js QQ 消息串行队列与生成触发
src/inbound.js         QQ -> 酒馆
src/outbound.js        酒馆 -> QQ
src/ui.js              设置面板、状态、日志
```
