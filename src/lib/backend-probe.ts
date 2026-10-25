import { readTextLimited } from "./http-body.ts";
import { parseDocument } from "yaml";
import { normalizeBackend } from "./catalog.ts";
import { defaultForm, httpUrl } from "./converter.ts";
import type { FormState } from "./converter.ts";
import { bundledCatalog, findTemplate } from "./template-catalog.ts";
import type { TemplateCatalog } from "./template-catalog.ts";

export type ProbeProfile = {
  target: "clash" | "stash";
  config: string;
  name: string;
  revision: string;
  capabilities: string[];
};
export type BackendReport = {
  backend: string;
  key: string;
  profile: ProbeProfile;
  version: string;
  versionHint: boolean;
  testedAt: string;
  status: "passed" | "inconclusive";
  detail: string;
};
export function probeProfile(
  form: FormState,
  catalog: TemplateCatalog = bundledCatalog,
): ProbeProfile | undefined {
  const target = form.format;
  if (target !== "clash" && target !== "stash") return;
  const template = findTemplate(form.config, catalog);
  return {
    target,
    config: form.config,
    name: template?.name || "当前模板",
    revision: template?.sha256 || form.config,
    capabilities: template?.capabilities || [],
  };
}
export function probeKey(backend: string, profile: ProbeProfile) {
  return JSON.stringify([
    normalizeBackend(backend),
    profile.target,
    profile.config,
    profile.revision,
  ]);
}
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
  return { version: "未识别版本", hint: false };
}
export function validateRuleOutput(
  body: string,
  profile: Pick<ProbeProfile, "target" | "capabilities"> = {
    target: "clash",
    capabilities: ["mrs", "geosite"],
  },
) {
  try {
    const doc = parseDocument(body, { uniqueKeys: true });
    if (doc.errors.length) return false;
    const config = doc.toJS({ maxAliasCount: 50 });
    if (!config || typeof config !== "object") return false;
    const groups = config["proxy-groups"],
      rules = config.rules,
      providers = config["rule-providers"] || {},
      proxies = config.proxies;
    if (
      !Array.isArray(groups) ||
      !groups.length ||
      !Array.isArray(rules) ||
      !rules.length ||
      !providers ||
      typeof providers !== "object"
    )
      return false;
    if (
      !Array.isArray(proxies) ||
      !proxies.some((p) => p?.server === "198.51.100.1")
    )
      return false;
    const names = new Set(groups.map((g) => g?.name));
    if (
      names.size !== groups.length ||
      [...names].some((n) => typeof n !== "string")
    )
      return false;
    const policies = new Set([
      ...names,
      "DIRECT",
      "REJECT",
      "REJECT-DROP",
      ...(profile.target === "clash" ? ["PASS", "COMPATIBLE"] : []),
    ]);
    const nodes = new Set(proxies.map((p) => p?.name));
    if (
      groups.some(
        (g) =>
          Array.isArray(g.proxies) &&
          g.proxies.some((p: string) => !policies.has(p) && !nodes.has(p)),
      )
    )
      return false;
    const mrsNames = Object.entries(providers)
      .filter(
        ([, v]) =>
          v &&
          typeof v === "object" &&
          /\.mrs(?:\?|$)/.test(String((v as { url?: unknown }).url)),
      )
      .map(([name, v]) => {
        const p = v as { format?: string; behavior?: string };
        if (
          p.format !== "mrs" ||
          !["domain", "ipcidr"].includes(p.behavior || "")
        )
          throw new Error("Invalid MRS");
        return name;
      });
    if (profile.capabilities.includes("mrs") && !mrsNames.length) return false;
    if (
      profile.capabilities.includes("geosite") &&
      !rules.some((r) => typeof r === "string" && r.startsWith("GEOSITE,"))
    )
      return false;
    if (
      !rules.every((r) => {
        if (typeof r !== "string") return false;
        const fields = r.split(",");
        const policy = fields.at(fields.at(-1) === "no-resolve" ? -2 : -1);
        return (
          policies.has(policy) &&
          (fields[0] !== "RULE-SET" || Object.hasOwn(providers, fields[1]))
        );
      })
    )
      return false;
    return mrsNames.every((name) =>
      rules.some((r) => r.startsWith(`RULE-SET,${name},`)),
    );
  } catch {
    return false;
  }
}
export function backendProbeUrl(
  backend: string,
  profile: ProbeProfile = probeProfile(defaultForm)!,
) {
  const base = normalizeBackend(httpUrl(backend, "后端地址").href);
  const params = new URLSearchParams({
    target: profile.target,
    url: "ss://YWVzLTEyOC1nY206c3Vid2VhdmUtdGVzdA==@198.51.100.1:443#SubWeave-Test",
    expand: "false",
    list: "false",
  });
  if (profile.config)
    params.set("config", httpUrl(profile.config, "模板地址").href);
  if (profile.target === "clash") params.set("new_name", "true");
  return `${base}/sub?${params}`;
}
export async function inspectBackend(
  backend: string,
  profile: ProbeProfile = probeProfile(defaultForm)!,
): Promise<BackendReport> {
  const base = normalizeBackend(httpUrl(backend, "后端地址").href);
  const report: BackendReport = {
    backend: base,
    key: probeKey(base, profile),
    profile,
    version: "版本获取失败",
    versionHint: false,
    testedAt: new Date().toISOString(),
    status: "inconclusive",
    detail: "",
  };
  // The request contains only a synthetic TEST-NET node, never user subscriptions or extra parameters.
  const results = await Promise.allSettled([
    fetch(`${base}/version`, { signal: AbortSignal.timeout(10000) }).then(
      async (r) => {
        if (!r.ok) throw new Error("版本获取失败");
        return readBackendVersion(await readTextLimited(r, 100_000));
      },
    ),
    fetch(backendProbeUrl(base, profile), {
      signal: AbortSignal.timeout(20000),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`转换 HTTP ${r.status}`);
      const body = await readTextLimited(r, 2_000_000);
      return validateRuleOutput(body, profile);
    }),
  ]);
  if (results[0].status === "fulfilled") {
    report.version = results[0].value.version;
    report.versionHint = results[0].value.hint;
  }
  if (results[1].status === "fulfilled" && results[1].value) {
    report.status = "passed";
    report.detail = `${profile.name} · ${profile.target} 结构检查通过；未验证实际连通性。`;
  } else
    report.detail =
      results[1].status === "rejected"
        ? "暂无法验证，请检查网络、跨域或访问限制。"
        : "输出未通过当前模板结构检查。";
  return report;
}
