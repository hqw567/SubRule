# 维护范围与目录整理

核实日期：2026-10-24。目录只列当前保留的客户端、模板和后端，不维护已移除项的迁移或别名分支。

## 客户端

按「Mihomo 内核 / 其他客户端 / 通用格式」组织。Mihomo 内核包括 Clash Verge Rev、FlClash、Mihomo / OpenClash 和 Nikki，统一使用 target=clash。

排序是基于公开热度的推荐顺序，不是实际使用人数。Mihomo 项目的 GitHub stars 在本次核实中分别约为 Verge Rev 153,511、FlClash 57,760、Mihomo 35,143、OpenClash 27,909、Nikki 5,397；同一工具的 stars 与真实安装数不等同，跨 GitHub 与 App Store 的指标也不可直接比较。

其他客户端保留 Shadowrocket、Sing-box、Stash、Surge、Quantumult X、Loon、Surfboard；另保留 5 种通用导出格式。Apple 官方商店元数据显示 Stash、Surge、Quantumult X、Shadowrocket、Loon 在 2026 年仍有更新。Surge 使用 ver=4 是转换器的格式参数，不表示应用版本停留在 Surge 4。

移除 CFW、CFA、ClashR、Mellow、旧 Quantumult、Surge 2/3，以及 SSR、旧 SS Android、SSD 导出入口。CFW/CFA 原仓库目前不可用；Mellow 原仓库最后推送时间为 2022-12-10。保留 V2Ray 通用订阅，不将维护中的 V2Ray 核心当作废弃客户端。

主要核实来源：[Mihomo](https://github.com/MetaCubeX/mihomo)、[Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)、[FlClash](https://github.com/chen08209/FlClash)、[OpenClash](https://github.com/vernesong/OpenClash)、[Nikki](https://github.com/nikkinikki-org/OpenWrt-nikki)、[Sing-box](https://github.com/SagerNet/sing-box)、[Surfboard](https://getsurfboard.com/docs/installation/)、[Mellow](https://github.com/mellow-io/mellow)、[Surge](https://manual.nssurge.com/)。

## 模板库

取消「个人规则 / 社区模板」的所有权分类。SubRule 扩展、Aethersailor、ACL4SSR 与 ClashRule 使用同一套模板系列和详情交互，通过来源及用途筛选。

- SubRule 扩展是公开、可定制的规则集合。自定义规则、广告策略与模板同步由规则仓库维护。
- 同系列的客户端、手动/故障转移、INI/YAML 选择集中在详情中。
- Mainland 重复兼容入口从规则仓库生成器、快照与产物中删除；现有五种方案合计 180 项。
- 继承的 88 个社区预设缩减为 18 个：17 个 ACL4SSR 配置与 cutethotw/ClashRule 的流媒体配置。18 个地址均确认返回 INI，并含规则声明。
- 旧 Gist、中转地址、长期未维护或无法核实持续维护的历史专用预设退出内置目录。没有把所有移除来源都标成“已停更”。

[ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) 与 [ClashRule](https://github.com/cutethotw/ClashRule) 的仓库及保留文件已核实。一次 HTTP 成功只证明文件可获取和基础结构正确，不证明所有规则及客户端组合均有效。

## 后端

内置后端从 21 个缩减为 5 个，另提供自定义地址：

| 分类     | 后端                                     | 当前检查边界                                                     |
| -------- | ---------------------------------------- | ---------------------------------------------------------------- |
| 增强后端 | api.asailor.org、sub-server.v2rayssr.com | 使用合成节点对标准 Clash/Stash 模板检查通过，包含正确的 MRS 声明 |
| 通用后端 | api.v1.mk、url.v1.mk                     | GEOSITE 保留，但 MRS 缺少 format，Stash 请求未通过               |
| 自建后端 | localhost:25500 及自定义地址             | 无预先能力保证，可手动检测                                       |

选择需要 MRS 的模板或 Stash 时，已知不兼容项禁用；GFW 等 GEOSITE-only 模板按实际能力匹配。增强后端不会仅因切换到 Surge 等客户端就被替换成传统后端。导入已知不兼容组合后，生成操作会要求更换或重新验证后端。

动态检测结果绑定后端、目标、模板 URL 与模板版本；当前组合通过重新检测后可使用升级后的后端。网络或 CORS 错误只显示“尚未验证”，不视为不支持。后端检查使用合成 TEST-NET 节点，不提交用户订阅。

## 高级选项

按节点处理、连接设置、输出设置分组。使用 Base UI RadioGroup 的默认/开启/关闭分段控件；编辑为独立草稿，应用才改变表单，取消丢弃本次修改。模板要求决定不可选项。恢复推荐保留当前模板约束，不修改订阅、客户端、后端或模板选择。
