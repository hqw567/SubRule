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
pnpm start
```

生产输出为 `.output`，需要 Node 服务。预设短链使用本站 `/api/shorten`，不能只部署静态文件。

## 规则与客户端

默认使用公开、可定制的 [SubWeave 扩展规则](https://github.com/hqw567/SubWeave-Rules) 标准版，包含自定义直连规则和秋风纯广告过滤。模板由规则仓库统一生成；本项目不重复维护规则合并逻辑。

- 共享 Clash INI 对应 Mihomo、OpenClash、Clash Verge Rev、FlClash、Nikki。
- Stash 使用 `target=stash` 和对应 Stash INI，保留同系列模板选择。
- 运行配置 YAML 单独展示，需在本地填入订阅；不能作为转换器 `config=`。
- 统一模板库按来源和用途筛选，系列详情内选择客户端与切换方式。保留 Aethersailor、ACL4SSR、ClashRule 与自定义 URL。
- 高级选项为“默认 / 开启 / 关闭”。默认省略参数，保留订阅或后端设置。
- 导入链接保留未知参数及重复的扩展参数；更换目标时提示确认其适用性。
- 后端探测按当前目标、模板和目录哈希记录，只使用虚构 TEST-NET 节点。结构检查通过不等于设备连通性通过。

## 模板目录

页面读取规则仓库的 `dist/catalog.json`，失败时保留内置目录。目录只包含公开模板元数据，无订阅或凭据。首次发布顺序：先发布规则仓库的目录，再发布前端；远程目录暂不可用时，内置模板仍能使用。

```sh
# 更新内置目录（需要规则仓库已发布 catalog.json）
pnpm catalog:update
# 开发时使用本地生成目录
pnpm catalog:update --from ../SubWeave-Rules/dist/catalog.json
```

`Check SubWeave` 验证测试、类型和生产构建；`Update template catalog` 每天约北京时间 07:30 刷新内置目录，通过验证后仅提交目录文件。GitHub 调度可能延迟。网页托管若监听每次提交，可按路径跳过仅目录更新的部署。

目录 schema、目标/格式约束和客户端校验在 `src/lib/template-catalog.ts`。更新目录不会修改正在填写的订阅或自动替用户提交转换。

## 数据边界

生成转换 URL 在浏览器完成，使用链接时由所选后端处理。预设短链会把完整 URL 发送至本站、FFQ 网关和所选短链服务；自定义短链 API 和配置托管从浏览器请求。配置上传仅在用户确认后执行。短链网关目标固定，并有输入字节上限、来源校验和请求超时；公开部署可在入口配置速率限制。

历史默认只保留当前页面会话。主动开启持久化后，完整订阅 URL 存入此浏览器；关闭时移除保存的数据。接口地址仅在当前会话生效。

默认后端可通过 `?backend=https://your-backend.example` 设置。本地后端 `http://localhost:25500` 指向运行浏览器/客户端的设备；跨设备请使用相应可访问地址。检测和外部上传受 CORS 与网络策略影响。

## 结构

- `src/components/workbench/`：转换、模板库、历史、设置与导入界面。
- `src/hooks/`：表单工作流、目录加载、历史状态。
- `src/lib/converter.ts`：URL 生成、解析和客户端匹配。
- `src/lib/backend-probe.ts`：按模板能力验证转换输出。
- `src/data/template-catalog.json`：规则仓库生成的目录快照。
- `src/components/ui/`：官方 shadcn Base UI 组件。

社区规则和接口参考 [sub-web-modify](https://github.com/youshandefeiyang/sub-web-modify)，其 MIT 声明保留于 `THIRD_PARTY_LICENSE`。目录数据的来源与许可见 [NOTICE.md](NOTICE.md)。历史后端快照标注的 2026-09-12 不是当前可用性承诺。

客户端、模板及后端的维护范围与检查来源见 [docs/maintained-presets.md](docs/maintained-presets.md)。高级选项使用分组草稿弹窗，点击应用后生效。

## 五种过滤方案

SubWeave 扩展提供仅自定义扩展、纯广告（默认）、完整防护、广告＋隐私、广告＋不受欢迎五种方案。后者的不受欢迎规则涉及强制更新、P2P/PCDN、推送、云控等连接，可能影响相应功能。方案在模板详情中选择；切换客户端和模板系列时保留已应用的方案与故障转移选择。

规则目录使用 schemaVersion 2，包含 180 项产物。新地址为 `dist/<profile>/<platform>/<variant>`；旧路径与旧配置不提供兼容入口。
