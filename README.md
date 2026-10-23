# SubRule

参考 `sub-web-modify` 交互重新实现的现代订阅转换工作台。基于 React 19、TypeScript、TanStack Start、Tailwind CSS 4；交互组件统一使用官方 shadcn/ui（Radix UI）。

## 本地运行

需要 Node.js 22.18+ 或 24+ 与 pnpm。

```sh
pnpm install
pnpm dev
```

访问 http://localhost:3000 。

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

生产构建输出在 `.output`，使用 Node 服务运行。默认转换后端可通过 `?backend=https://your-backend.example` 设置，支持后端路径前缀。

## 功能

- 多订阅/单节点链接输入、换行或竖线分隔、自动去重。
- 25 个客户端选项（20 种转换目标），包括 Clash、Sing-Box、Surge 2/3/4/5、Quantumult X、Shadowrocket、Loon 等。
- 21 个预设后端（含本地部署）、自定义后端、96 条可搜索的社区远程规则、自定义规则 URL。
- 节点筛选、重命名、文件名、更新间隔、User-Agent、设备 ID 和协议高级选项。
- 生成与复制订阅链接，反向解析完整转换 URL 或支持跨域跳转的短链接。
- 短链接生成、自定义后缀、配置文本上传及本地配置文件导入。
- 后端连接检测、深浅色主题、移动端导航、实时配置摘要。
- 最近 20 条转换记录。默认仅保留本次会话，可主动开启当前浏览器的本地持久化。

## 外部服务

应用是转换前端。生成 URL 在浏览器本地完成；客户端使用该 URL 时由所选后端生成配置。传统后端代取订阅，SubConverter-Extended 可为现代客户端生成 Proxy Provider，由客户端自行拉取订阅。本项目不内置转换引擎。

现代客户端默认使用 Aethersailor 增强后端与标准模板；兼容客户端自动匹配传统转换后端。

| 用途     | 默认地址                       | 接口协议                                                                          |
| -------- | ------------------------------ | --------------------------------------------------------------------------------- |
| 兼容后端 | `https://api.v1.mk`            | `/sub` 与 `/version`                                                              |
| 备用后端 | `https://url.v1.mk`            | `/sub` 与 `/version`                                                              |
| 短链服务 | `https://v1.mk/short`          | POST FormData：`longUrl`（Base64）、可选 `shortKey`；返回 `Code: 1` 和 `ShortUrl` |
| 配置托管 | `https://subapi.v1.mk/sub.php` | POST FormData：`config`（URL 编码）；返回 `code: 0` 和 `data`（配置 URL）         |

短链、上传、版本检测和短链解析依赖目标服务允许 CORS；网络请求有超时和错误反馈。第三方 API 与社区规则的持续可用性由服务维护者决定。可在偏好设置中替换 API 地址，服务地址设置仅在当前会话生效。

生成短链会向短链服务发送完整转换 URL，上传配置会向托管服务发送配置内容。历史持久化包含完整订阅 URL，仅在用户开启后存入当前浏览器。

## 代码

- `src/components/converter-app.tsx`：工作台交互。
- `src/components/ui/`：官方 shadcn/ui 组件。
- `src/lib/converter.ts`：纯转换、校验及解析逻辑。
- `src/lib/converter.test.mjs`：编码、去重、客户端转换目标往返、参数隔离和非法输入测试。
- `src/lib/rules.json`：参考项目中的 88 条规则。
- `src/styles.css`：响应式主题和页面布局。

规则数据和 API 协议参考 [sub-web-modify](https://github.com/youshandefeiyang/sub-web-modify)，原项目 MIT 声明保留于 `THIRD_PARTY_LICENSE`。组件安装方式参考 [shadcn/ui TanStack Router 文档](https://ui.shadcn.com/docs/installation/tanstack-router)。

## Aethersailor 现代模板与后端检测

新增 [Custom_OpenClash_Rules 官方 INI 模板](https://github.com/Aethersailor/Custom_OpenClash_Rules/tree/main/cfg) 的标准、轻量、GFW、重度分流，以及各自故障转移版本，共 8 项。仅保存模板链接，不复制上游规则内容。参考示例中的“大陆优化模板”未出现在当前官方清单中，未加入未经核实的地址。

- 推荐分组：OpenClash / Mihomo / Clash Meta、Clash Verge Rev、FlClash、Nikki，统一发送 `target=clash`。
- 兼容分组：Clash for Windows、Clash for Android、ClashR、Surge、Quantumult、Sing-box 等，按原生目标格式处理。此分组描述转换路径，不代表所有客户端都已过时。
- 现代模板使用 `expand=false&list=false&new_name=true`，保留 MRS Rule Provider。切换客户端会提示并匹配后端与模板，自建后端地址会保留。
- 选择不兼容客户端、仅节点输出、旧字段或展开规则时，会显示明确提示并阻止生成错误组合。
- 直接导入转换 URL 可恢复转换参数；共享相同 `target=clash` 的客户端在 URL 中不能区分品牌，统一显示 Mihomo；本地新历史记录额外保存客户端选择。

2026-09-12 使用虚构 TEST-NET 节点和标准模板进行结构校验：

| 后端 | 实测版本 | 标准模板结果 |
| --- | --- | --- |
| https://api.asailor.org/sub | SubConverter-Extended v1.9.4 | 通过 |
| https://sub-server.v2rayssr.com/sub | SubConverter-Extended v1.6.1 | 通过 |
| https://api.v1.mk/sub | subconverter v1.9.9 | MRS Provider 缺少 format: mrs，未通过 |
| https://url.v1.mk/sub | subconverter v1.9.9 | MRS Provider 缺少 format: mrs，未通过 |
| https://subapi.cmliussss.net/sub | subconverter v0.9.9-ecb63a9 | 标准模板结构检查未通过 |
| https://subapi.fxxk.dedyn.io/sub | subconverter v0.9.9-ecb63a9 · subapi-hk-vps | 标准模板结构检查未通过 |
| https://edge-api-v1.ffqla.com/sub | subconverter v0.9.9-948f049 | MRS Provider 缺少 format: mrs |
| https://api.ytools.cc/sub | subconverter v0.9.9-948f049 | MRS Provider 缺少 format: mrs |
| https://pub-api-1.bianyuan.xyz/sub | subconverter v0.11.0-build114514 | 标准模板结构检查未通过 |
| https://api-suc.0z.gs/sub | subconverter v0.9.9-ecb63a9 | 标准模板结构检查未通过 |
| https://api.wcc.best/sub | subconverter v0.9.0 | 标准模板结构检查未通过 |
| https://api.dler.io/sub | subconverter v0.9.0-a0d4eab | 标准模板结构检查未通过 |
| https://bianyuan.xyz/sub | 未识别版本 | 返回内容未通过标准模板结构检查 |
| https://subconverters.com/sub | 兼容性尚未验证 | 请求超时 |
| https://sub.xeton.dev/sub | 兼容性尚未验证 | v0.9.0-a0d4eab；转换 HTTP 520 |
| https://sub.id9.cc/sub | 兼容性尚未验证 | 连接失败 |
| https://api.nexconvert.com/sub | 兼容性尚未验证 | 转换 HTTP 403 |
| https://sub.maoxiongnet.com/sub | 兼容性尚未验证 | 连接失败 |
| https://api.sublink.dev/sub | 兼容性尚未验证 | 转换 HTTP 522 |
| https://sub.xjz.im/sub | 兼容性尚未验证 | 转换 HTTP 402 |
| http://localhost:25500/sub | 兼容性尚未验证 | 需在本机启动服务后检测 |

结果是带日期的测试快照，不是未来版本的兼容保证。`expand=true` 的两个抽样请求丢失了 MRS Provider，因此现代模板保留远程规则。Mihomo 的 [Rule Provider 文档](https://wiki.metacubex.one/config/rule-providers/#format) 指出 format 默认是 yaml，二进制 MRS 需要显式声明 mrs。

页面的“检测后端兼容性”会并行读取 `/version` 和请求一次标准模板转换，识别纯文本及 SubConverter-Extended 的 HTML 版本页，并使用 YAML 解析器检查测试节点、GEOSITE、MRS 格式和策略组引用。检测从不发送用户输入的订阅。网络/CORS/超时会标为“尚未验证”，版本身份只作为线索；结构测试通过也不等于所有模板、新节点协议或客户端实际连通性都已验证。

检测代码位于 `src/lib/backend-probe.ts`，模板与带日期的后端信息位于 `src/lib/catalog.ts`。


## 多短链服务与本地后端

结果区内置 dwzhila.com、gfw.mom、gfw.lat、v1.mk、d1.mk、dlj.tf、suo.yt、sub.cm 共 8 个短链选项。参考项目与 [FFQ 配置接口](https://sub.ffq.la/api/config) 均为 sub.cm，未将未经核实的 sub.com 当作同一服务。

预设选项通过本站 `/api/shorten` 服务端端点调用 FFQ 的公开短链网关 `https://sub.ffq.la/api/shorten`，传入 service、longUrl、alias；完整链接会发送至本站服务端、FFQ 和所选短链服务。使用固定网关、服务白名单、URL/别名校验和请求超时，失败时不会自动将链接提交给其他服务。自定义 API 仍兼容原有 `/short` FormData 接口，从浏览器直接请求。生成短链需要运行本项目 Node 服务，不能只部署静态页面。

2026-09-12 使用 https://example.com/ 测试：6 个选项生成成功；dlj.tf 和 sub.cm 返回 HTTP 502，保留为可重试选项；dwzhila.com 当前返回 urlgo.run 域名。结果不保证未来可用性，也未验证每条短链的最终跳转。已有短链继续支持浏览器跟随重定向解析，需目标服务允许跨域。

本地后端预设为 http://localhost:25500，自动拼接 /sub；切换模板或客户端时保留本地及尚未验证的自建部署。浏览器检测受 CORS 与本地网络权限影响。localhost 指向运行客户端的设备；跨设备使用请填写局域网 IP 或部署域名。

CM 后端备注参考用户提供的 [CM 博客](https://blog.cmliussss.com/)。维护者名称仅作标识，不代表本站认证或服务稳定性保证。
