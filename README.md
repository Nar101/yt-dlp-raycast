# Media Saver

<p><img src="assets/icon.png" width="96" alt="Media Saver icon"></p>

## 从 Raycast 直接下载大量网站的媒体

Media Saver 把媒体下载能力放进 Raycast：打开 Raycast，粘贴链接，选择视频或音频，直接开始下载。

不需要先打开 Terminal，也不需要记住一长串命令。下载任务会进入队列；即使关闭 Raycast，后台任务也会继续运行。

底层当前提供 1,700+ 个站点/服务解析器。YouTube、X/Twitter、Instagram、TikTok、Bilibili、Vimeo、Facebook、Reddit、Twitch、SoundCloud、微博、Pinterest 等大量网站的媒体，都可以尝试直接下载。具体可用性会随网站规则、登录状态和当前版本变化。

## 你可以下载什么

- 视频：选择最佳画质、MP4 或保留原始格式；
- 音频：提取为 MP3；
- 字幕：有字幕时按需保存中文或英文字幕；
- 多个链接：一次粘贴多个链接，任务自动进入队列；
- 需要登录的内容：主动选择已登录的 Chrome、Safari 或 Firefox。

只要把链接交给 Media Saver，剩下的事情都从 Raycast 里完成。

## 为什么从 Raycast 下载

Raycast 本来就是 Mac 上最快的操作入口。Media Saver 把下载也放进这个入口里：

- `⌘ Space` 呼出 Raycast，搜索 `Save Media`；
- 可以直接读取剪贴板里的链接；
- 多个任务统一排队，不需要开多个 Terminal 窗口；
- 关闭 Raycast 后仍然继续下载；
- 在 `Download Queue` 里查看实时进度、失败原因和重试状态；
- 下载完成后直接打开文件、打开所在目录或在 Finder 中显示。

它解决的不只是“能不能下载”，而是下载开始以后还能不能看得见、管得住、找得到。

## 三个 Raycast 入口

| 入口 | 用来做什么 |
| --- | --- |
| `Save Media` | 粘贴链接，选择视频、音频或字幕并开始下载 |
| `Download Setup` | 检查这台 Mac 是否已经准备好下载 |
| `Download Queue` | 查看进行中、已完成、失败、取消和中断的任务 |

## 最短使用路径

1. 呼出 Raycast，搜索 `Download Setup`，确认显示 `Ready`；
2. 搜索 `Save Media`，粘贴一个或多个媒体链接；
3. 选择保存方式并提交；
4. 打开 `Download Queue` 查看进度。

第一次使用时，扩展不会偷偷替你安装系统组件。`Download Setup` 会告诉你缺什么，并提供复制命令、打开 Terminal 和重新检查等操作。

## 当前怎么安装

目前项目是公开源码版本，尚未进入 Raycast Store。现在可以通过 Raycast 开发模式使用：

```bash
git clone https://github.com/Nar101/yt-dlp-raycast.git
cd yt-dlp-raycast
npm install
npm run dev
```

启动后，Raycast 会加载 `Media Saver`。之后搜索 `Save Media`、`Download Setup` 或 `Download Queue` 即可。

### 在另一台 Mac 上安装

在 MacBook Air 上执行上面的命令即可。首次打开 Raycast 后运行 `Download Setup`；如果显示缺少依赖，在 Terminal 执行：

```bash
brew install yt-dlp ffmpeg
```

然后重新运行 `Download Setup`，确认显示 `Ready`。项目不保存浏览器 Cookie、账号凭证或下载内容到 GitHub。

等扩展进入 Raycast Store 后，普通用户可以直接从 Raycast 安装，不需要 clone 源码或运行开发命令。

## 失败时怎么办

任务不会悄悄消失。`Download Queue` 会保留任务，并尽量说明失败来自哪里：

- 链接无效或网站暂不支持；
- 内容已删除、设为私密或受到地区限制；
- 网站要求登录；
- 网络、代理或站点限流；
- 保存目录没有权限或磁盘空间不足；
- 视频处理失败。

打开任务详情查看建议，然后选择重试。重试会创建新的尝试，原记录仍然保留。

## 隐私与使用边界

- 链接、登录信息、任务状态和媒体文件只在本机处理；
- 不上传任务记录、浏览器登录信息或下载内容；
- 不绕过登录、付费墙、验证码或网站访问控制；
- 只保存你有权保存或处理的内容，并遵守来源网站规则。

## 想了解实现细节

普通使用不需要理解底层组件。想知道为什么需要额外组件、任务为什么能在关闭 Raycast 后继续、失败如何分类，以及本地状态如何保存，请阅读 [HOW_IT_WORKS.md](HOW_IT_WORKS.md)。

## 文件位置

新保存的文件默认在 `~/Downloads/Media Saver/`。任务记录和旧版本目录的完整说明见 [HOW_IT_WORKS.md](HOW_IT_WORKS.md)。

## 开发与检查

```bash
npm install
npm run build
npm run lint
node --check assets/worker.js
```

提交前可以检查公开内容中是否意外带入本机路径、凭证或任务记录：

```bash
rg -n "(/Users/|token|password|secret|Cookies|task state|downloaded media)" \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!package-lock.json' .
```
