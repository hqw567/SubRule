# 维护范围与目录整理

整理日期：2026-10-25；服务检查日期见各项。目录只列当前保留的格式、模板和后端，不维护已移除项的迁移或别名分支。

## 输出格式

2026-10-25 改为按转换后端实际接收的目标格式组织，不按应用品牌重复列项。输出格式和转换后端是两个独立选择：前者决定配置结构，后者决定生成服务与规则能力。

| 分组 | 选项 | 输出 |
| --- | --- | --- |
| 配置文件 | Mihomo / Clash | `target=clash`，用于 Mihomo、OpenClash、Clash Verge Rev、FlClash、Nikki 等 |
| 配置文件 | sing-box、Stash、Surge、Quantumult X、Loon、Surfboard | 各自独立的 JSON / YAML / 配置语法 |
| 节点订阅 | Shadowrocket 分享订阅、混合分享链接、VMess（V2Ray）、Shadowsocks（SIP002）、Trojan | 各目标的分享链接与协议过滤结果 |
| 自动识别 | 自动识别 | 根据访问订阅时的 User-Agent 选择；默认仍显式使用 Mihomo |

共 13 项，每个后端 target / 格式版本只出现一次。Clash Verge Rev、FlClash、Nikki 不再有独立选项或别名。Surge 的 `ver=4` 单独存放在格式参数中，不再编码在选项 ID 内。

Stash 的 `target=stash`、sing-box 的 `target=singbox` 与 Mihomo 的 `target=clash` 不能只因支持类似协议就合并。它们的字段、Provider 与规则表示不同。Shadowrocket 专用分享订阅也包含目标能力过滤，与无目标限制的混合分享链接分开。

运行配置 YAML 的 Mihomo / OpenClash 选择标为「运行环境」，用于区分独立运行配置与 OpenClash 覆写，避免与订阅输出格式混淆。历史记录只保存 URL、来源数量和时间；格式由 URL 的 target 推导，无需重复保存应用品牌。

已经移除的 ClashR、旧 Quantumult、Mellow、Surge 2/3、SSR、旧 SS Android、SSD 等目标没有兼容分支。

主要依据：[SubConverter-Extended 目标格式矩阵](https://github.com/Aethersailor/SubConverter-Extended/wiki/Compatibility)、[Mihomo](https://github.com/MetaCubeX/mihomo)、[sing-box](https://github.com/SagerNet/sing-box)。

## 模板库

取消「个人规则 / 社区模板」的所有权分类。SubWeave 扩展、Aethersailor、ACL4SSR 与 ClashRule 使用同一套模板系列和详情交互，通过来源及用途筛选。

- SubWeave 扩展是公开、可定制的规则集合。自定义规则、广告策略与模板同步由规则仓库维护。
- 同系列的输出格式或运行环境、手动/故障转移、INI/YAML 选择集中在详情中。
- Mainland 重复兼容入口从规则仓库生成器、快照与产物中删除；现有五种方案合计 180 项。
- 继承的 88 个社区预设缩减为 18 个：17 个 ACL4SSR 配置与 cutethotw/ClashRule 的流媒体配置。18 个地址均确认返回 INI，并含规则声明。
- 旧 Gist、中转地址、长期未维护或无法核实持续维护的历史专用预设退出内置目录。没有把所有移除来源都标成“已停更”。

[ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) 与 [ClashRule](https://github.com/cutethotw/ClashRule) 的仓库及保留文件已核实。一次 HTTP 成功只证明文件可获取和基础结构正确，不证明所有规则及客户端组合均有效。

## 后端

内置 7 个后端，另提供自定义地址。FFQ 两个官方地址由用户指定，能力依据 2026-10-25 的合成节点请求记录：

| 分类     | 后端                                     | 当前检查边界                                                     |
| -------- | ---------------------------------------- | ---------------------------------------------------------------- |
| 增强后端 | api.asailor.org、sub-server.v2rayssr.com | 使用合成节点对标准 Clash/Stash 模板检查通过，包含正确的 MRS 声明 |
| 通用后端 | edge-api-v1.ffqla.com、api.ytools.cc | 返回 subconverter v0.9.9-948f049；GFW 检查通过，标准模板 3 个 MRS Provider 均缺少 format，Stash 返回 HTTP 400 Invalid target |
| 通用后端 | api.v1.mk、url.v1.mk                     | GEOSITE 保留，但 MRS 缺少 format，Stash 请求未通过               |
| 自建后端 | localhost:25500 及自定义地址             | 无预先能力保证，可手动检测                                       |

选择需要 MRS 的模板或 Stash 时，已知不兼容项禁用；GFW 等 GEOSITE-only 模板按实际能力匹配。增强后端不会仅因切换到 Surge 等客户端就被替换成传统后端。导入已知不兼容组合后，生成操作会要求更换或重新验证后端。

动态检测结果绑定后端、目标、模板 URL 与模板版本；当前组合通过重新检测后可使用升级后的后端。网络或 CORS 错误只显示“尚未验证”，不视为不支持。后端检查使用合成 TEST-NET 节点，不提交用户订阅。

## 高级选项

按节点处理、连接设置、输出设置分组。使用 Base UI RadioGroup 的默认/开启/关闭分段控件；编辑为独立草稿，应用才改变表单，取消丢弃本次修改。模板要求决定不可选项。恢复推荐保留当前模板约束，不修改订阅、输出格式、后端或模板选择。

## 短链接

2026-10-25 使用 `https://example.com/` 在浏览器中验证，v1.mk 的 FormData POST 可跨域读取，并返回 `Code: 1` 与有效短网址。内置预设仅保留该服务，同时保留自定义 API 设置。

现有 FFQ 聚合网关在浏览器跨域请求中未通过验证。移除依赖该网关的其他短链预设和本站代理接口，避免静态部署后仍依赖隐含的后端。这里的移除只说明与本次纯静态架构不匹配，不代表这些服务已经停更。
