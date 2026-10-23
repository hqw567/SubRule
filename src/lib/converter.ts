import {
  aethersailorResource,
  aethersailorRules,
  backendOptions,
  getBackendPreset,
} from "./catalog.ts";

export const clients = [
  {
    value: "clash",
    label: "OpenClash / Mihomo / Clash Meta",
    description: "现代 Mihomo 内核",
    mark: "M",
  },
  {
    value: "clash-verge",
    label: "Clash Verge Rev",
    description: "现代 Mihomo 内核",
    mark: "V",
  },
  {
    value: "flclash",
    label: "FlClash",
    description: "现代 Mihomo 内核",
    mark: "F",
  },
  {
    value: "nikki",
    label: "Nikki",
    description: "现代 Mihomo 内核",
    mark: "N",
  },
  {
    value: "clash-legacy",
    label: "Clash for Windows",
    description: "传统 Clash 内核",
    mark: "C",
  },
  {
    value: "clash-android",
    label: "Clash for Android",
    description: "传统 Clash 内核",
    mark: "C",
  },
  {
    value: "singbox",
    label: "Sing-Box",
    description: "跨平台通用客户端",
    mark: "S",
  },
  {
    value: "surge&ver=4",
    label: "Surge",
    description: "Surge 4 / 5",
    mark: "↗",
  },
  {
    value: "quanx",
    label: "Quantumult X",
    description: "iOS / iPadOS",
    mark: "Q",
  },
  {
    value: "shadowrocket",
    label: "Shadowrocket",
    description: "iOS / macOS",
    mark: "↟",
  },
  { value: "loon", label: "Loon", description: "iOS / iPadOS", mark: "L" },
  ...Object.entries({
    mixed: "混合订阅",
    v2ray: "V2Ray",
    trojan: "Trojan",
    ssr: "ShadowsocksR",
    surfboard: "Surfboard",
    quan: "Quantumult",
    mellow: "Mellow",
    "surge&ver=3": "Surge 3",
    "surge&ver=2": "Surge 2",
    clashr: "ClashR",
    ss: "Shadowsocks (SIP002)",
    sssub: "Shadowsocks Android",
    ssd: "ShadowsocksD",
    auto: "自动判断客户端",
  }).map(([value, label]) => ({
    value,
    label,
    description: "其他客户端",
    mark: label[0],
  })),
];
export const modernClientIds = ["clash", "clash-verge", "flclash", "nikki"];
export function isModernClient(client: string) {
  return modernClientIds.includes(client);
}
export function getClientTarget(client: string) {
  return isModernClient(client) ||
    ["clash-legacy", "clash-android"].includes(client)
    ? "clash"
    : client;
}

export const flagOptions = [
  { key: "emoji", label: "国旗 Emoji", hint: "为节点名称添加地区标识" },
  { key: "udp", label: "启用 UDP", hint: "支持游戏与实时通信" },
  { key: "sort", label: "节点排序", hint: "按节点名称进行排序" },
  { key: "list", label: "仅输出节点", hint: "不包含规则与策略组" },
  { key: "insert", label: "插入默认节点", hint: "使用后端预设节点" },
  { key: "xudp", label: "启用 XUDP", hint: "扩展 UDP 转发" },
  { key: "tfo", label: "TCP Fast Open", hint: "加速 TCP 连接建立" },
  { key: "append_type", label: "显示节点类型", hint: "在名称中插入协议类型" },
  { key: "tls13", label: "TLS 1.3", hint: "使用 TLS 1.3" },
  { key: "expand", label: "展开规则", hint: "输出完整规则内容" },
  { key: "scv", label: "跳过证书验证", hint: "仅在信任节点时启用" },
  { key: "fdn", label: "过滤不支持节点", hint: "移除客户端不支持的协议" },
  { key: "new_name", label: "Clash 新字段", hint: "使用新版配置字段" },
  { key: "clash.doh", label: "Clash DoH", hint: "通过 HTTPS 查询 DNS" },
  { key: "surge.doh", label: "Surge DoH", hint: "通过 HTTPS 查询 DNS" },
  { key: "singbox.ipv6", label: "Sing-Box IPv6", hint: "启用 IPv6 支持" },
] as const;
export type Flag = (typeof flagOptions)[number]["key"];
export type FormState = {
  source: string;
  client: string;
  backend: string;
  config: string;
  include: string;
  exclude: string;
  rename: string;
  filename: string;
  interval: string;
  dev_id: string;
  diyua: string;
  flags: Record<Flag, boolean>;
};
export const defaultForm: FormState = {
  source: "",
  client: "clash",
  backend: backendOptions[0].value,
  config: aethersailorRules[0].url,
  include: "",
  exclude: "",
  rename: "",
  filename: "",
  interval: "",
  dev_id: "",
  diyua: "",
  flags: Object.fromEntries(
    flagOptions.map(({ key }) => [key, ["emoji", "new_name"].includes(key)]),
  ) as Record<Flag, boolean>,
};
export function splitSources(source: string) {
  return source
    .split(/[\r\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
export function httpUrl(value: string, label = "地址") {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${label}必须是完整的 HTTP 或 HTTPS 链接`);
  }
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error(`${label}仅支持 HTTP 或 HTTPS`);
  if (url.username || url.password)
    throw new Error(`${label}不支持内嵌用户名和密码`);
  return url;
}
const textKeys = [
  "include",
  "exclude",
  "rename",
  "filename",
  "dev_id",
  "diyua",
] as const;
export function ruleCompatibility(form: FormState) {
  const resource = aethersailorResource(form.config);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (resource === "unsupported")
    errors.push(
      "请选择 Aethersailor 的 Custom_Clash INI 转换模板；仓库页面、规则文件、YAML 配置或覆写模块不能用于此转换流程。",
    );
  if (resource === "template") {
    if (!isModernClient(form.client))
      errors.push(
        "此规则需要 OpenClash / Mihomo / Clash Meta 等现代客户端，不能直接转换为当前客户端格式。",
      );
    if (form.flags.list)
      errors.push("此规则需要完整配置，请关闭「仅输出节点」。");
    if (!form.flags.new_name)
      errors.push("此规则需要新版 Clash 字段，请开启「Clash 新字段」。");
    if (form.flags.expand)
      errors.push(
        "此规则使用 MRS Rule Provider，请关闭「展开规则」，避免转换时丢失远程规则。",
      );
    const backend = getBackendPreset(form.backend);
    if (backend && backend.supportsAethersailor === false)
      warnings.push(
        "此后端在 2026-09-12 的标准模板测试中未通过结构检查。建议选用配套后端，也可重新检测新版本。",
      );
    else if (!backend || backend.supportsAethersailor === null)
      warnings.push(
        "此后端兼容性尚未验证，可检测 GEOSITE / MRS 扩展；连接失败或版本号均不能作为不支持的依据。",
      );
  }
  return { resource, errors, warnings };
}
export function applyRulePreset(form: FormState, config: string): FormState {
  if (aethersailorResource(config) !== "template") return { ...form, config };
  const preset = getBackendPreset(form.backend);
  return {
    ...form,
    config,
    client: isModernClient(form.client) ? form.client : "clash",
    // Preserve custom deployments and either of the compatible service choices.
    backend:
      preset && preset.supportsAethersailor === false
        ? backendOptions[0].value
        : form.backend,
    flags: { ...form.flags, list: false, new_name: true, expand: false },
  };
}
export function applyClientPreset(form: FormState, client: string): FormState {
  const modern = isModernClient(client);
  const backend = getBackendPreset(form.backend);
  return {
    ...form,
    client,
    backend:
      backend && backend.supportsAethersailor !== null && modern !== backend.modern
        ? modern
          ? backendOptions[0].value
          : "https://api.v1.mk"
        : form.backend,
    config:
      !modern && aethersailorResource(form.config) !== null
        ? "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full_NoAuto.ini"
        : modern && !isModernClient(form.client)
          ? aethersailorRules[0].url
          : form.config,
    flags: modern
      ? { ...form.flags, list: false, new_name: true, expand: false }
      : { ...form.flags, expand: true },
  };
}
export function buildSubscription(form: FormState) {
  const compatibility = ruleCompatibility(form);
  if (compatibility.errors.length)
    throw new Error(compatibility.errors.join(" "));
  const sources = splitSources(form.source);
  if (!sources.length) throw new Error("请先添加至少一个订阅链接");
  const invalid = sources.find(
    (s) =>
      !/^(https?|ss|ssr|vmess|vless|trojan|hysteria2?|hy2|tuic|socks5?|snell|anytls|mieru):\/\/\S+$/i.test(
        s,
      ),
  );
  if (invalid)
    throw new Error("订阅格式不正确，请使用完整的订阅链接或节点链接");
  if (!clients.some((c) => c.value === form.client))
    throw new Error("请选择支持的客户端");
  const backend = httpUrl(form.backend, "后端地址");
  backend.search = "";
  backend.hash = "";
  backend.pathname = backend.pathname.replace(/\/(sub\/?)?$/, "") + "/sub";
  const target = getClientTarget(form.client);
  const params = new URLSearchParams(`target=${target}`);
  params.set("url", [...new Set(sources)].join("|"));
  if (form.config.trim())
    params.set("config", httpUrl(form.config, "远程配置").href);
  for (const key of textKeys)
    if (form[key].trim()) params.set(key, form[key].trim());
  if (form.interval) {
    const days = Number(form.interval);
    if (!Number.isFinite(days) || days <= 0)
      throw new Error("更新间隔必须是大于 0 的天数");
    params.set("interval", String(Math.round(days * 86400)));
  }
  for (const { key } of flagOptions) {
    if ((key.startsWith("clash.") || key === "new_name") && target !== "clash")
      continue;
    if (key.startsWith("surge.") && !form.client.startsWith("surge")) continue;
    if (key.startsWith("singbox.") && form.client !== "singbox") continue;
    params.set(
      key,
      key === "singbox.ipv6"
        ? form.flags[key]
          ? "1"
          : "0"
        : String(form.flags[key]),
    );
  }
  backend.search = params.toString();
  return backend.href;
}
export function parseSubscription(value: string): FormState {
  const url = httpUrl(value, "订阅地址"),
    p = url.searchParams;
  if (!p.get("target") || !p.get("url"))
    throw new Error("链接中缺少 target 或 url 参数，请输入已转换的订阅链接");
  const client =
    p.get("target") === "surge"
      ? `surge&ver=${p.get("ver") || "4"}`
      : p.get("target")!;
  if (!clients.some((c) => c.value === client))
    throw new Error(`暂不支持客户端：${client}`);
  const form: FormState = {
    ...defaultForm,
    flags: { ...defaultForm.flags },
    client,
    source: p.get("url")!.split("|").join("\n"),
    backend: url.origin + url.pathname.replace(/\/sub\/?$/, ""),
    config: p.get("config") || "",
  };
  for (const key of textKeys) form[key] = p.get(key) || "";
  if (p.has("interval"))
    form.interval = String(Number(p.get("interval")) / 86400);
  for (const { key } of flagOptions)
    if (p.has(key)) form.flags[key] = ["true", "1"].includes(p.get(key)!);
  buildSubscription(form);
  return form;
}

export async function requestJson(endpoint: string, data: FormData) {
  const response = await fetch(httpUrl(endpoint, "API 地址"), {
    method: "POST",
    body: data,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`服务请求失败（HTTP ${response.status}）`);
  return response.json();
}
