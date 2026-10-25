import {
  aethersailorResource,
  backendCompatibility,
  defaultCommunityTemplate,
  backendOptions,
} from "./catalog.ts";

import {
  bundledCatalog,
  defaultTemplate,
  findTemplate,
  resourceIdentity,
} from "./template-catalog.ts";
import type { TemplateCatalog } from "./template-catalog.ts";

import { isMihomoFormat, requireFormat } from "./formats.ts";

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
  { key: "fdn", label: "过滤不支持节点", hint: "移除目标格式不支持的协议" },
  { key: "new_name", label: "Mihomo 字段", hint: "使用新版配置字段" },
  { key: "clash.doh", label: "Mihomo DoH", hint: "通过 HTTPS 查询 DNS" },
  { key: "surge.doh", label: "Surge DoH", hint: "通过 HTTPS 查询 DNS" },
  { key: "singbox.ipv6", label: "sing-box IPv6", hint: "启用 IPv6 支持" },
] as const;
export type Flag = (typeof flagOptions)[number]["key"];
export type FlagValue = boolean | null;
export type FormState = {
  source: string;
  format: string;
  backend: string;
  config: string;
  include: string;
  exclude: string;
  rename: string;
  filename: string;
  interval: string;
  dev_id: string;
  diyua: string;
  flags: Record<Flag, FlagValue>;
  extraParams: [string, string][];
  extraParamsTarget: string | null;
};
export const defaultForm: FormState = {
  source: "",
  format: "clash",
  backend: backendOptions[0].value,
  config: defaultTemplate.url,
  include: "",
  exclude: "",
  rename: "",
  filename: "",
  interval: "",
  dev_id: "",
  diyua: "",
  flags: recommendedFlags("clash", defaultTemplate.requiredFlags),
  extraParams: [],
  extraParamsTarget: null,
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
export function emptyFlags(): Record<Flag, FlagValue> {
  return Object.fromEntries(
    flagOptions.map(({ key }) => [key, null]),
  ) as Record<Flag, FlagValue>;
}
export function recommendedFlags(
  format: string,
  required: Partial<Record<Flag, boolean>> = {},
): Record<Flag, FlagValue> {
  const flags = emptyFlags();
  flags.insert = false;
  if (isMihomoFormat(format) || format === "stash") {
    flags.list = false;
    flags.expand = false;
    if (isMihomoFormat(format)) flags.new_name = true;
  }
  // Explicit UDP/TFO/TLS/certificate/rename overrides change the converter's
  // native-provider routing. Inherit these unless the user requests otherwise.
  return { ...flags, ...required };
}
export function flagApplies(key: string, format: string) {
  const target = format;
  return (
    !((key.startsWith("clash.") || key === "new_name") && target !== "clash") &&
    !(key.startsWith("surge.") && !format.startsWith("surge")) &&
    !(key.startsWith("singbox.") && format !== "singbox")
  );
}
export function ruleCompatibility(
  form: FormState,
  catalog: TemplateCatalog = bundledCatalog,
  options: { backendVerified?: boolean } = {},
) {
  const template = findTemplate(form.config, catalog);
  const identity = resourceIdentity(form.config);
  const missingPublishedTemplate =
    !template &&
    identity?.repository === catalog.repository.toLowerCase() &&
    identity.ref === catalog.ref;
  const resource =
    template?.kind === "conversion-template"
      ? "template"
      : template ||
          missingPublishedTemplate ||
          aethersailorResource(form.config) === "unsupported"
        ? "unsupported"
        : null;
  const errors: string[] = [],
    warnings: string[] = [];
  if (resource === "unsupported")
    errors.push("此地址不是当前支持的 INI 转换模板，请从模板库重新选择。");
  if (template?.kind === "conversion-template") {
    if (
      template.target === "clash"
        ? !isMihomoFormat(form.format)
        : form.format !== "stash"
    )
      errors.push(
        `此模板需要${template.target === "stash" ? " Stash 格式" : " Mihomo 格式"}，请更换输出格式或模板。`,
      );
    for (const [key, expected] of Object.entries(template.requiredFlags)) {
      const value = form.flags[key as Flag];
      // Omission keeps backend defaults; reject explicit contradictory requests only.
      if (value !== null && value !== expected)
        errors.push(
          `此模板要求「${flagOptions.find((f) => f.key === key)?.label}」${expected ? "开启" : "关闭"}。`,
        );
    }
    const support = backendCompatibility(
      form.backend,
      template.target,
      template.capabilities,
    );
    if (!options.backendVerified && !support.supported)
      errors.push(
        `此后端缺少当前模板需要的 ${support.missing.map((c) => (c === "stash" ? "Stash" : c.toUpperCase())).join(" / ")} 支持，请选择增强后端；后端更新后可重新检测。`,
      );
    else if (!options.backendVerified && !support.verified)
      warnings.push("当前后端尚未验证，可先检测模板兼容性。");
  }
  if (
    form.extraParams.length &&
    form.extraParamsTarget &&
    form.extraParamsTarget !== form.format
  )
    warnings.push(
      "已保留原链接的扩展参数；更换格式后请确认其适用性，或清除扩展参数。",
    );
  return { resource, errors, warnings, template };
}
export function applyRulePreset(
  form: FormState,
  config: string,
  catalog: TemplateCatalog = bundledCatalog,
): FormState {
  const template = findTemplate(config, catalog);
  if (template?.kind !== "conversion-template") return { ...form, config };
  return {
    ...form,
    config,
    format:
      template.target === "stash"
        ? "stash"
        : isMihomoFormat(form.format)
          ? form.format
          : "clash",
    backend: !backendCompatibility(
      form.backend,
      template.target,
      template.capabilities,
    ).supported
      ? backendOptions[0].value
      : form.backend,
    flags: { ...form.flags, ...template.requiredFlags },
  };
}
export function applyFormatPreset(
  form: FormState,
  format: string,
  catalog: TemplateCatalog = bundledCatalog,
): FormState {
  requireFormat(format);
  const managed = isMihomoFormat(format) || format === "stash";
  const current = findTemplate(form.config, catalog);
  const counterpart =
    current &&
    catalog.templates.find(
      (t) =>
        t.kind === "conversion-template" &&
        t.variant === current.variant &&
        t.profile === (current.profile || "custom-only") &&
        t.target === format,
    );
  let config = form.config;
  if (managed && current?.target === format)
    config = form.config;
  else if (managed && counterpart) config = counterpart.url;
  else if (managed && !form.config)
    config =
      catalog.templates.find(
        (t) =>
          t.id ===
          `${catalog.defaultProfile}/${format}/standard`,
      )?.url || "";
  else if (!managed && current) config = defaultCommunityTemplate.url;
  const selected = findTemplate(config, catalog);
  return {
    ...form,
    format,
    config,
    backend:
      selected &&
      !backendCompatibility(
        form.backend,
        selected.target,
        selected.capabilities,
      ).supported
        ? backendOptions[0].value
        : form.backend,
    flags: {
      ...form.flags,
      ...(selected?.kind === "conversion-template"
        ? selected.requiredFlags
        : {}),
    },
  };
}
export function buildSubscription(
  form: FormState,
  catalog: TemplateCatalog = bundledCatalog,
  options: { backendVerified?: boolean; checkBackend?: boolean } = {},
) {
  const definition = requireFormat(form.format);
  const compatibility = ruleCompatibility(form, catalog, {
    backendVerified: options.backendVerified || options.checkBackend === false,
  });
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

  const backend = httpUrl(form.backend, "后端地址");
  backend.search = "";
  backend.hash = "";
  backend.pathname = backend.pathname.replace(/\/(sub\/?)?$/, "") + "/sub";
  const params = new URLSearchParams({ target: definition.value });
  if (definition.version) params.set("ver", definition.version);
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
    const value = form.flags[key];
    if (value === null || !flagApplies(key, form.format)) continue;
    params.set(
      key,
      key === "singbox.ipv6" ? (value ? "1" : "0") : String(value),
    );
  }
  const reserved = new Set([
    "target",
    "url",
    "config",
    "interval",
    ...textKeys,
    ...flagOptions
      .filter((f) => flagApplies(f.key, form.format))
      .map((f) => f.key),
    ...(definition.version ? ["ver"] : []),
  ]);
  for (const [key, value] of form.extraParams) {
    if (reserved.has(key))
      throw new Error("扩展参数与表单字段冲突，请清除扩展参数后重试");
    params.append(key, value);
  }
  backend.search = params.toString();
  return backend.href;
}
export function parseSubscription(
  value: string,
  catalog: TemplateCatalog = bundledCatalog,
): FormState {
  const url = httpUrl(value, "订阅地址"),
    p = url.searchParams;
  if (!p.get("target") || !p.get("url"))
    throw new Error("链接中缺少 target 或 url 参数，请输入已转换的订阅链接");
  const format = p.get("target")!;
  const definition = requireFormat(format);
  if (definition.version && p.has("ver") && p.get("ver") !== definition.version)
    throw new Error("暂不支持此 Surge 格式版本");
  const form: FormState = {
    ...defaultForm,
    flags: emptyFlags(),
    extraParams: [],
    extraParamsTarget: null,
    format,
    source: p.get("url")!.split("|").join("\n"),
    backend: url.origin + url.pathname.replace(/\/sub\/?$/, ""),
    config: p.get("config") || "",
  };
  for (const key of textKeys) form[key] = p.get(key) || "";
  if (p.has("interval"))
    form.interval = String(Number(p.get("interval")) / 86400);
  const known = new Set([
    "target",
    "url",
    "config",
    "interval",
    ...textKeys,
    ...(definition.version ? ["ver"] : []),
  ]);
  for (const { key } of flagOptions) {
    if (!flagApplies(key, format)) continue;
    known.add(key);
    if (p.has(key)) {
      const raw = p.get(key)!.toLowerCase();
      if (!["true", "false", "1", "0"].includes(raw))
        throw new Error(`选项 ${key} 的值无效`);
      form.flags[key] = ["true", "1"].includes(raw);
    }
  }
  for (const key of known)
    if (p.getAll(key).length > 1)
      throw new Error(`参数 ${key} 重复，请先确认链接`);
  form.extraParams = [...p.entries()].filter(([key]) => !known.has(key));
  if (form.extraParams.length) form.extraParamsTarget = format;
  buildSubscription(form, catalog, { checkBackend: false });
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
