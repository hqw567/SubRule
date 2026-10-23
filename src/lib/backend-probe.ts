import { parseDocument } from "yaml";
import { aethersailorRules, normalizeBackend } from "./catalog.ts";
import { httpUrl } from "./converter.ts";

export type BackendReport = {
  backend: string;
  version: string;
  versionHint: boolean;
  testedAt: string;
  status: "passed" | "inconclusive";
  detail: string;
};
export function readBackendVersion(body: string) {
  if (/SubConverter-Extended/i.test(body)) {
    const version =
      body.match(/class=["']info-value["'][^>]*>\s*(v[\d.]+[^<\s]*)/i)?.[1] ||
      body.match(/SubConverter-Extended\s+(v?[\d.]+)/i)?.[1] ||
      "";
    return { version: `SubConverter-Extended ${version}`.trim(), hint: true };
  }
  if (!/<(?:!doctype|html)\b/i.test(body) && /subconverter/i.test(body))
    return { version: body.trim().slice(0, 180), hint: false };
  return { version: "未识别版本（可能是代理页面或其他 fork）", hint: false };
}
export function validateRuleOutput(body: string) {
  const doc = parseDocument(body, { uniqueKeys: true });
  if (doc.errors.length) return false;
  const config = doc.toJS({ maxAliasCount: 50 });
  if (!config || typeof config !== "object") return false;
  const groups = config["proxy-groups"];
  const rules = config.rules;
  const providers = config["rule-providers"];
  const proxies = config.proxies;
  if (
    !Array.isArray(groups) ||
    !groups.length ||
    !Array.isArray(rules) ||
    !providers ||
    typeof providers !== "object"
  )
    return false;
  const nodePresent =
    Array.isArray(proxies) && proxies.some((p) => p?.server === "198.51.100.1");
  const groupNames = new Set(groups.map((g) => g?.name));
  const mrsProviders = Object.entries(providers).filter(
    ([, p]) =>
      p &&
      typeof p === "object" &&
      typeof (p as { url?: unknown }).url === "string" &&
      /\.mrs(?:\?|$)/.test((p as { url: string }).url),
  );
  if (
    !mrsProviders.length ||
    !mrsProviders.every(([, p]) => {
      const provider = p as {
        format?: string;
        url?: string;
        behavior?: string;
      };
      return (
        provider.format === "mrs" &&
        ["domain", "ipcidr"].includes(provider.behavior || "")
      );
    })
  )
    return false;
  const mrsNames = mrsProviders.map(([name]) => name);
  return (
    nodePresent &&
    mrsNames.length > 0 &&
    rules.some((r) => typeof r === "string" && r.startsWith("GEOSITE,")) &&
    mrsNames.every((name) =>
      rules.some(
        (r) =>
          typeof r === "string" &&
          r.startsWith(`RULE-SET,${name},`) &&
          groupNames.has(r.split(",")[2]),
      ),
    )
  );
}
export function backendProbeUrl(backend: string) {
  const base = normalizeBackend(httpUrl(backend, "后端地址").href);
  const params = new URLSearchParams({
    target: "clash",
    url: "ss://YWVzLTEyOC1nY206c3VicnVsZS10ZXN0@198.51.100.1:443#SubRule-Test",
    config: aethersailorRules[0].url,
    expand: "false",
    new_name: "true",
    list: "false",
  });
  return `${base}/sub?${params}`;
}
export async function inspectBackend(backend: string): Promise<BackendReport> {
  const base = normalizeBackend(httpUrl(backend, "后端地址").href);
  const report: BackendReport = {
    backend: base,
    version: "版本获取失败",
    versionHint: false,
    testedAt: new Date().toISOString(),
    status: "inconclusive",
    detail: "",
  };
  // Probe contains only a synthetic TEST-NET node, never the user's subscription.
  const results = await Promise.allSettled([
    fetch(`${base}/version`, { signal: AbortSignal.timeout(10000) }).then(
      async (r) => {
        if (!r.ok) throw new Error(`版本 HTTP ${r.status}`);
        return readBackendVersion(await r.text());
      },
    ),
    fetch(backendProbeUrl(base), { signal: AbortSignal.timeout(20000) }).then(
      async (r) => {
        if (!r.ok) throw new Error(`转换 HTTP ${r.status}`);
        const body = await r.text();
        if (body.length > 2_000_000) throw new Error("测试配置过大");
        return validateRuleOutput(body);
      },
    ),
  ]);
  if (results[0].status === "fulfilled") {
    report.version = results[0].value.version;
    report.versionHint = results[0].value.hint;
  }
  if (results[1].status === "fulfilled" && results[1].value) {
    report.status = "passed";
    report.detail =
      "标准模板实测通过：YAML、测试节点、GEOSITE、MRS Provider 和策略组引用均已检查。";
  } else
    report.detail =
      results[1].status === "rejected"
        ? `暂无法验证：${results[1].reason instanceof Error ? results[1].reason.message : "请求失败"}。请检查网络、跨域或访问限制；不代表后端不支持。`
        : "返回配置未通过标准模板结构检查，请检查后端版本、模板获取与 MRS 支持；暂不判定为兼容。";
  return report;
}
