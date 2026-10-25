# SubWeave

订阅与规则工作台。React 19、TypeScript、TanStack Start，交互组件采用官方 shadcn/ui **Base UI** 版本。

## 开发

需要 Node.js 24 和 pnpm 12.4.2。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

保留 TanStack Start 的路由与组件，在构建时将首页预渲染为 HTML，后续交互全部由浏览器执行。发布目录为 **`dist/client`**，运行时只需要静态文件托管。Nitro 和本站短链接口已移除，不需要 Hono、Node 服务或 Worker 脚本。

`pnpm preview` 使用独立的静态预览配置，在 `http://127.0.0.1:4319` 提供产物，不启用 SSR 回退。构建过程中的 `dist/server` 只用于预渲染，不发布。

## Cloudflare 自动发布

GitHub Actions 是默认发布入口。代码或配置推送到 `main` 后，`Check and deploy SubWeave` 会依次安装锁定依赖、运行测试与类型检查、构建静态页面、检查部署包，然后上传 `dist/client`。发布后逐一比对线上首页与静态资源的 SHA-256，访问地址显示在该次 Actions 的 Summary 中。

在本仓库 **Settings → Secrets and variables → Actions** 配置：

| Secret | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 限定到部署账户的 Cloudflare API Token，具有 Workers Scripts 编辑及 Account Settings 读取权限 |
| `CLOUDFLARE_ACCOUNT_ID` | 部署目标的 Cloudflare Account ID |

不要把 Token 写入仓库或普通 Actions Variables。本地 `wrangler login` 不会给 GitHub Actions 提供凭据。

PR 和其他分支只验证，不发布。主分支的发布按顺序执行；被更新主分支取代的旧提交会跳过发布。也可以在 Actions 页面手动运行 `Check and deploy SubWeave`，选择 `main`。仅 Markdown 文档变更不触发自动发布。

模板目录定时任务提交新快照后会显式触发发布流程，因为使用 `GITHUB_TOKEN` 的提交不会自动触发新的 push 工作流。无需在 Cloudflare 再开启一套 Git 自动构建。

`wrangler.jsonc` 只声明静态资源目录，没有 Worker 入口，不需要数据库或付费 Workers 套餐。手动发布仍可使用：

```sh
pnpm build
pnpm deploy:check  # 本地打包验证，不发布、不需要登录
pnpm deploy       # 配置本地 Cloudflare 身份后，构建并发布静态资源
```

也可以手动部署到 Cloudflare Pages：构建命令 `pnpm build`，输出目录 `dist/client`，Node.js 版本 24。其他静态托管平台同样可用；为前端路由配置回退到 `index.html` 即可。

[Cloudflare GitHub Actions 文档](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) · [静态资源文档](https://developers.cloudflare.com/workers/static-assets/) · [TanStack Start 静态预渲染](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)

## 输出格式与规则

默认使用公开、可定制的 [SubWeave 扩展规则](https://github.com/hqw567/SubWeave-Rules) 标准版，包含自定义直连规则和秋风纯广告过滤。模板由规则仓库统一生成；本项目不重复维护规则合并逻辑。

- 输出格式按转换目标组织。Mihomo、OpenClash、Clash Verge Rev、FlClash、Nikki 共用一个 **Mihomo / Clash** 选项，不再重复列出应用品牌。
- sing-box、Stash、Surge、Quantumult X、Loon、Surfboard 保留独立格式。Stash 使用 `target=stash` 和对应 Stash INI。节点分享订阅与完整配置分组展示。
- 运行配置 YAML 单独展示，需在本地填入订阅；不能作为转换器 `config=`。
- 统一模板库按来源和用途筛选，系列详情内选择输出格式与切换方式；运行配置按 Mihomo / OpenClash 环境选择。保留 Aethersailor、ACL4SSR、ClashRule 与自定义 URL。
- 高级选项为“默认 / 开启 / 关闭”。默认省略参数，保留订阅或后端设置。
- 导入链接保留未知参数及重复的扩展参数；更换格式时提示确认其适用性。
- 后端探测按当前目标、模板和目录哈希记录，只使用虚构 TEST-NET 节点。结构检查通过不等于设备连通性通过。

## 模板目录

页面读取规则仓库的 `dist/catalog.json`，失败时保留内置目录。目录只包含公开模板元数据，无订阅或凭据。首次发布顺序：先发布规则仓库的目录，再发布前端；远程目录暂不可用时，内置模板仍能使用。

```sh
# 更新内置目录（需要规则仓库已发布 catalog.json）
pnpm catalog:update
# 开发时使用本地生成目录
pnpm catalog:update --from ../SubWeave-Rules/dist/catalog.json
```

`Check and deploy SubWeave` 验证并发布静态产物；`Update template catalog` 每天约北京时间 07:30 刷新内置目录，通过验证后提交目录文件并触发静态站点发布。GitHub 调度可能延迟。

目录 schema、目标/格式约束和客户端校验在 `src/lib/template-catalog.ts`。更新目录不会修改正在填写的订阅或自动替用户提交转换。

## 数据边界

生成转换 URL 在浏览器完成，使用链接时由所选转换后端处理。短链默认由浏览器直接请求 `https://v1.mk/short`，也可在设置中填写支持跨域访问的自定义短链 API。完整转换 URL 会发送给所选短链服务，网站托管端不接收短链 POST，也不经过聚合网关。配置托管仍由浏览器在用户确认后请求第三方服务。

短链使用 FormData：`longUrl` 为完整 URL 的 Base64，`shortKey` 为可选后缀；返回值为 `{ "Code": 1, "ShortUrl": "https://..." }`。自定义 API 必须允许网站来源的 CORS 请求。响应有体积上限和超时，失败后不会自动把链接发送给其他服务。

2026-10-25 使用公开示例 URL 验证了 v1.mk 的浏览器跨域 POST 和成功响应；这不代表第三方服务永久可用。需要本站聚合网关的其他预设已移除。

历史默认只保留当前页面会话。主动开启持久化后，完整订阅 URL 存入此浏览器；关闭时移除保存的数据。接口地址仅在当前会话生效。

默认后端可通过 `?backend=https://your-backend.example` 设置。本地后端 `http://localhost:25500` 指向运行浏览器/客户端的设备；跨设备请使用相应可访问地址。检测和外部上传受 CORS 与网络策略影响。

## 结构

- `src/components/workbench/`：转换、模板库、历史、设置与导入界面。
- `src/hooks/`：表单工作流、目录加载、历史状态。
- `src/lib/formats.ts`：唯一的输出格式目录，每个 target / 版本只出现一次。
- `src/lib/converter.ts`：URL 生成、解析和输出格式匹配。
- `src/lib/backend-probe.ts`：按模板能力验证转换输出。
- `src/data/template-catalog.json`：规则仓库生成的目录快照。
- `src/components/ui/`：官方 shadcn Base UI 组件。

社区规则和接口参考 [sub-web-modify](https://github.com/youshandefeiyang/sub-web-modify)，其 MIT 声明保留于 `THIRD_PARTY_LICENSE`。目录数据的来源与许可见 [NOTICE.md](NOTICE.md)。历史后端快照标注的 2026-09-12 不是当前可用性承诺。

输出格式、模板及后端的维护范围与检查来源见 [docs/maintained-presets.md](docs/maintained-presets.md)。高级选项使用分组草稿弹窗，点击应用后生效。

## 五种过滤方案

SubWeave 扩展提供仅自定义扩展、纯广告（默认）、完整防护、广告＋隐私、广告＋不受欢迎五种方案。后者的不受欢迎规则涉及强制更新、P2P/PCDN、推送、云控等连接，可能影响相应功能。方案在模板详情中选择；切换输出格式和模板系列时保留已应用的方案与故障转移选择。

规则目录使用 schemaVersion 2，包含 180 项产物。新地址为 `dist/<profile>/<platform>/<variant>`；旧路径与旧配置不提供兼容入口。
