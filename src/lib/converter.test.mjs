import { outputFormats, requireFormat, formatForUrl } from "./formats.ts";
import { templateFamilies } from "./template-library.ts";
import {
  advancedOptions,
  defaultAdvanced,
  advancedCount,
  validateAdvanced,
} from "./advanced-options.ts";
import {
  bundledCatalog,
  defaultTemplate,
  parseCatalog,
  findTemplate,
} from "./template-catalog.ts";
import { probeProfile, probeKey } from "./backend-probe.ts";
import { readTextLimited } from "./http-body.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSubscription,
  parseSubscription,
  defaultForm,
  httpUrl,
  applyFormatPreset,
  applyRulePreset,
  ruleCompatibility,
} from "./converter.ts";
import {
  aethersailorRules,
  aethersailorResource,
  getBackendPreset,
  backendOptions,
  backendSnapshot,
  backendCompatibility,
  communityRules,
} from "./catalog.ts";
import { DEFAULT_SHORT_API, requestShortLink } from "./short-link.ts";
import {
  backendProbeUrl,
  readBackendVersion,
  validateRuleOutput,
} from "./backend-probe.ts";

const form = (extra = {}) => ({
  ...defaultForm,
  flags: { ...defaultForm.flags },
  source: "https://example.com/sub?token=a%2Bb&name=测试",
  ...extra,
});

test("backend presets are unique; local deployments stay selected when matching modern templates", () => {
  assert.equal(
    new Set(backendOptions.map((b) => b.value)).size,
    backendOptions.length,
  );
  for (const backend of backendOptions.map((b) => b.value + "/sub")) {
    assert.ok(getBackendPreset(backend));
    assert.equal(
      new URL(buildSubscription(form({ backend, config: "" }))).pathname,
      "/sub",
    );
  }
  const local = form({
    backend: "http://localhost:25500/sub",
    format: "surge",
  });
  assert.equal(applyFormatPreset(local, "clash").backend, local.backend);
  assert.equal(
    applyRulePreset(local, aethersailorRules[0].url).backend,
    local.backend,
  );
  assert.match(
    ruleCompatibility(form({ backend: local.backend })).warnings[0],
    /尚未验证/,
  );
  assert.doesNotMatch(
    backendSnapshot(getBackendPreset(local.backend)),
    /未通过/,
  );
});

test("browser short links validate input before contacting a service", async () => {
  let calls = 0;
  const send = async () => { calls++; throw new Error("unexpected fetch"); };
  for (const [endpoint, url, alias] of [
    ["file:///etc/passwd", "https://example.com", ""],
    [DEFAULT_SHORT_API, "", ""],
    [DEFAULT_SHORT_API, "javascript:alert(1)", ""],
    [DEFAULT_SHORT_API, "https://example.com", "https://bad"],
    [DEFAULT_SHORT_API, "https://example.com/" + "x".repeat(60000), ""],
  ]) await assert.rejects(requestShortLink(endpoint, url, alias, send));
  assert.equal(calls, 0);
});

test("browser short links post FormData directly and preserve encoded URLs", async () => {
  const url = "https://example.com/sub?url=a%2Bb&name=测试";
  for (const endpoint of [DEFAULT_SHORT_API, "https://example.org/short"]) {
    const result = await requestShortLink(endpoint, url, " demo ", async (target, init) => {
      assert.equal(target, endpoint);
      assert.equal(init.method, "POST");
      assert.equal(init.headers, undefined);
      assert.equal(init.credentials, "omit");
      assert.ok(init.body instanceof FormData);
      assert.equal(atob(init.body.get("longUrl")), new URL(url).href);
      assert.equal(init.body.get("shortKey"), "demo");
      return Response.json({ Code: 1, ShortUrl: "https://example.org/demo" });
    });
    assert.equal(result, "https://example.org/demo");
  }
});

test("short-link failures and invalid replies do not trigger another service", async () => {
  for (const upstream of [
    new Response("bad gateway", { status: 502 }),
    new Response("<html>not JSON</html>"),
    Response.json(null),
    Response.json({ Code: 1, ShortUrl: "javascript:alert(1)" }),
    Response.json({ Code: 0 }),
    new Response("x".repeat(100001)),
  ]) {
    let calls = 0;
    await assert.rejects(requestShortLink(DEFAULT_SHORT_API, "https://example.com", "", async () => {
      calls++;
      return upstream;
    }));
    assert.equal(calls, 1);
  }
  await assert.rejects(requestShortLink(DEFAULT_SHORT_API, "https://example.com", "", async () => {
    throw new TypeError("Failed to fetch");
  }), /跨域/);
  await assert.rejects(requestShortLink(DEFAULT_SHORT_API, "https://example.com", "", async () => {
    throw new DOMException("Timeout", "TimeoutError");
  }), /超时/);
});

test("combines multiline sources, preserves embedded query parameters and removes duplicates", () => {
  const source = "https://example.com/sub?token=a%2Bb&name=测试";
  const url = new URL(
    buildSubscription(
      form({ source: ` ${source}\r\n\n${source}|vless://uuid@host:443#香港` }),
    ),
  );
  assert.equal(
    url.searchParams.get("url"),
    `${source}|vless://uuid@host:443#香港`,
  );
  assert.equal(url.searchParams.get("target"), "clash");
});
test("all output formats round trip without losing target or version", () => {
  for (const format of outputFormats) {
    const generated = buildSubscription(
      form({ format: format.value, config: "" }),
    );
    assert.equal(
      parseSubscription(generated).format,
      format.value,
    );
    assert.equal(buildSubscription(parseSubscription(generated)), generated);
    assert.equal(formatForUrl(generated)?.value, format.value);
    assert.equal(new URL(generated).searchParams.get("ver"), format.version || null);
  }
});
test("advanced parameters round trip unicode, regex, fractional days, and false flags", () => {
  const original = form({
    include: "香港|日本",
    exclude: "剩余.*",
    rename: "香港@HK",
    filename: "我的订阅.yaml",
    interval: "0.5",
    dev_id: "test-id",
    diyua: "Custom UA/1.0",
  });
  original.flags.emoji = false;
  original.flags.udp = true;
  original.flags.tls13 = true;
  const generated = buildSubscription(original);
  assert.equal(new URL(generated).searchParams.get("interval"), "43200");
  assert.deepEqual(parseSubscription(generated), original);
});
test("preserves backend subpaths and avoids duplicate sub endpoint", () => {
  for (const backend of [
    "https://example.com/api",
    "https://example.com/api/",
    "https://example.com/api/sub",
  ]) {
    const generated = buildSubscription(form({ backend }));
    assert.equal(new URL(generated).pathname, "/api/sub");
    assert.equal(
      parseSubscription(generated).backend,
      "https://example.com/api",
    );
  }
});
test("only includes format-specific flags for their matching target", () => {
  const f = form({ format: "singbox", config: "" });
  f.flags["singbox.ipv6"] = true;
  const p = new URL(buildSubscription(f)).searchParams;
  assert.equal(p.get("singbox.ipv6"), "1");
  assert.equal(p.has("clash.doh"), false);
  assert.equal(p.has("surge.doh"), false);
  assert.equal(p.has("new_name"), false);
});

test("Mihomo format selects a supported backend and keeps its required template flags", () => {
  const next = applyFormatPreset(
    form({ format: "surge", backend: "https://api.v1.mk" }),
    "clash",
  );
  assert.equal(next.backend, "https://api.asailor.org");
  assert.equal(next.config, defaultTemplate.url);
  const params = new URL(buildSubscription(next)).searchParams;
  assert.equal(params.get("target"), "clash");
  assert.equal(params.get("expand"), "false");
  const surge = applyFormatPreset(form(), "surge");
  assert.equal(surge.backend, "https://api.asailor.org");
  assert.match(surge.config, /ACL4SSR/);
  assert.equal(ruleCompatibility(surge).errors.length, 0);
});
test("all eight templates apply safe flags and preserve verified or custom backends", () => {
  for (const rule of aethersailorRules) {
    const original = form({
      format: "surge",
      backend: "https://sub-server.v2rayssr.com/sub/",
    });
    original.flags.expand = true;
    original.flags.list = true;
    original.flags.new_name = false;
    const next = applyRulePreset(original, rule.url);
    assert.equal(next.backend, original.backend);
    assert.equal(next.format, "clash");
    assert.equal(next.flags.expand, false);
    assert.equal(next.flags.list, false);
    assert.equal(next.flags.new_name, true);
    assert.equal(new URL(buildSubscription(next)).pathname, "/sub");
  }
  const custom = applyRulePreset(
    form({ backend: "https://self.example/api/sub" }),
    aethersailorRules[0].url,
  );
  assert.equal(custom.backend, "https://self.example/api/sub");
  assert.equal(ruleCompatibility(custom).warnings.length, 1);
  assert.equal(
    ruleCompatibility(form({ backend: "https://api.v1.mk" })).errors.length,
    1,
  );
});
test("detects Raw and CDN template URLs without matching unrelated hosts or YAML", () => {
  for (const url of [
    aethersailorRules[0].url,
    "https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/cfg/Custom_Clash_Lite.ini",
    "https://cdn.jsdelivr.net/gh/Aethersailor/Custom_OpenClash_Rules@main/cfg/Custom_Clash.ini",
    "https://cdn.jsdelivr.net/gh/Aethersailor/Custom_OpenClash_Rules@refs/heads/main/cfg/Custom_Clash.ini",
  ])
    assert.equal(aethersailorResource(url), "template", url);
  assert.equal(
    aethersailorResource(
      "https://example.com/Aethersailor/Custom_OpenClash_Rules/main/cfg/Custom_Clash.ini",
    ),
    null,
  );
  assert.equal(
    aethersailorResource(
      "https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/cfg/yaml/Custom_Clash.yaml",
    ),
    "unsupported",
  );
  assert.equal(
    getBackendPreset("https://api.asailor.org/sub/")?.capabilities.mrs,
    true,
  );
  assert.equal(
    getBackendPreset("https://api.asailor.org.evil.example"),
    undefined,
  );
});
test("incompatible format, list-only, old fields, or expansion cannot silently discard COR rules", () => {
  for (const format of [
    "surge",
    "singbox",
    "quanx",
    "shadowrocket",
    "loon",
  ])
    assert.throws(() => buildSubscription(form({ format })), /Mihomo 格式/);
  for (const [key, value] of [
    ["expand", true],
    ["list", true],
    ["new_name", false],
  ]) {
    const invalid = form();
    invalid.flags[key] = value;
    assert.throws(() => buildSubscription(invalid));
  }
});
test("version is a hint only and recognizes Extended HTML version pages", () => {
  assert.deepEqual(
    readBackendVersion(
      '<title>SubConverter-Extended</title><div class="info-value">v1.9.4</div>',
    ),
    { version: "SubConverter-Extended v1.9.4", hint: true },
  );
  assert.equal(
    readBackendVersion("subconverter v1.9.9 TG@feiyangdigital backend").hint,
    false,
  );
  assert.equal(readBackendVersion("<html>Access denied</html>").hint, false);
  assert.equal(validateRuleOutput("<html>HTTP 200 but no YAML</html>"), false);
  assert.equal(validateRuleOutput("rules: [GEOSITE,cn,DIRECT]"), false);
  const probe = new URL(backendProbeUrl("https://api.asailor.org/sub"));
  assert.equal(probe.pathname, "/sub");
  assert.match(probe.searchParams.get("url"), /198\.51\.100\.1/);
  assert.equal(probe.searchParams.get("expand"), "false");
});
test("probe requires real structured nodes, GEOSITE, MRS, and matching strategy references", () => {
  const output = `proxies: [{name: Test, server: 198.51.100.1}]
proxy-groups: [{name: Group, type: select, proxies: [Test]}]
rule-providers:
  test: {format: mrs, behavior: domain, url: 'https://example.com/test.mrs'}
rules: ['GEOSITE,cn,DIRECT', 'RULE-SET,test,Group']`;
  assert.equal(validateRuleOutput(output), true);
  assert.equal(
    validateRuleOutput(
      output.replace("RULE-SET,test,Group", "RULE-SET,test,Missing"),
    ),
    false,
  );
  assert.equal(
    validateRuleOutput(output.replace("format: mrs", "format: text")),
    false,
  );
});
test("rejects empty or malformed sources, invalid service schemes and invalid intervals", () => {
  for (const source of ["", "   \n|", "invalid link", "javascript://alert(1)"])
    assert.throws(() => buildSubscription(form({ source })));
  for (const interval of ["0", "-1", "NaN", "Infinity"])
    assert.throws(() => buildSubscription(form({ interval })));
  assert.throws(() => httpUrl("javascript:alert(1)"));
  assert.throws(() => httpUrl("https://user:password@example.com"));
  assert.throws(() =>
    parseSubscription(
      "https://example.com/sub?target=unknown&url=https://example.com",
    ),
  );
  assert.throws(() => parseSubscription("https://example.com/no-params"));
});

test("all extension conversion templates enforce their target and runtime YAML stays out of config", () => {
  for (const entry of bundledCatalog.templates) {
    const next = applyRulePreset(form(), entry.url);
    if (entry.kind === "runtime-template") {
      assert.throws(() => buildSubscription(next), /INI 转换模板/);
      continue;
    }
    assert.equal(ruleCompatibility(next).resource, "template");
    const output = new URL(buildSubscription(next));
    assert.equal(output.searchParams.get("target"), entry.target);
    assert.equal(output.searchParams.get("config"), entry.url);
    for (const [key, value] of Object.entries(entry.requiredFlags))
      assert.equal(output.searchParams.get(key), String(value));
    for (const key of ["emoji", "udp", "tfo", "tls13", "scv"])
      assert.equal(output.searchParams.has(key), false);
    if (entry.target === "stash")
      assert.equal(output.searchParams.has("new_name"), false);
    assert.equal(
      buildSubscription(parseSubscription(output.href)),
      output.href,
    );
  }
});
test("switching formats preserves custom templates and pairs extension variants with Stash", () => {
  const original = applyRulePreset(
    form(),
    bundledCatalog.templates.find(
      (t) => t.id === "ads-only/clash/lite-fallback",
    ).url,
  );
  const stash = applyFormatPreset(original, "stash");
  assert.equal(findTemplate(stash.config).id, "ads-only/stash/lite-fallback");
  assert.equal(applyFormatPreset(stash, "clash").config, original.config);
  const unknown = form({
    format: "surge",
    config: "https://example.com/custom.ini",
  });
  assert.equal(applyFormatPreset(unknown, "clash").config, unknown.config);
  const raw = defaultTemplate.url.replace("/main/", "/refs/heads/main/");
  assert.equal(findTemplate(raw).id, defaultTemplate.id);
  assert.equal(
    findTemplate(
      defaultTemplate.url
        .replace("raw.githubusercontent.com/", "cdn.jsdelivr.net/gh/")
        .replace("/main/", "@main/"),
    ).id,
    defaultTemplate.id,
  );
  const upstream = applyRulePreset(form(), aethersailorRules[3].url);
  assert.equal(
    findTemplate(applyFormatPreset(upstream, "stash").config).id,
    "custom-only/stash/lite-fallback",
  );
});
test("URL import preserves omitted, explicit false, and repeated extension parameters", () => {
  for (const target of ["clash", "stash"]) {
    const input = new URL("https://example.com/sub");
    input.searchParams.set("target", target);
    input.searchParams.set("url", "https://example.org/source");
    input.searchParams.append("custom", "a+b");
    input.searchParams.append("custom", "测试");
    input.searchParams.set("udp", "false");
    const output = new URL(buildSubscription(parseSubscription(input.href)));
    assert.deepEqual(
      [...output.searchParams],
      [...input.searchParams]
        .filter(([k]) => k !== "custom")
        .concat(input.searchParams.getAll("custom").map((v) => ["custom", v])),
    );
    assert.equal(output.searchParams.has("emoji"), false);
    assert.equal(output.searchParams.has("tfo"), false);
    assert.equal(output.searchParams.get("udp"), "false");
  }
  assert.throws(
    () =>
      parseSubscription(
        "https://example.com/sub?target=clash&url=https://example.org&udp=maybe",
      ),
    /无效/,
  );
  assert.throws(
    () =>
      parseSubscription(
        "https://example.com/sub?target=clash&url=https://example.org&udp=true&udp=false",
      ),
    /重复/,
  );
});
test("catalog rejects incompatible versions, duplicate entries and mismatched target metadata", () => {
  for (const mutate of [
    (c) => {
      c.schemaVersion = 1;
    },
    (c) => {
      c.templates.push(c.templates[0]);
    },
    (c) => {
      c.templates[0].target = "stash";
    },
    (c) => {
      c.templates[0].url = "https://example.com/malicious.ini";
    },
    (c) => {
      c.templates[0].requiredFlags = { expand: true };
    },
  ]) {
    const copy = structuredClone(bundledCatalog);
    mutate(copy);
    assert.throws(() => parseCatalog(copy));
  }
  assert.equal(
    findTemplate(defaultTemplate.url.replace("/main/", `/${"a".repeat(40)}/`))
      .sha256,
    "",
  );
});
test("Stash probe accepts provider-based rules and isolates template and target reports", () => {
  const stash = applyFormatPreset(form(), "stash"),
    profile = probeProfile(stash);
  const output = `proxies: [{name: Test, server: 198.51.100.1}]
proxy-groups: [{name: Group, type: select, proxies: [Test]}]
rule-providers:
  test: {format: mrs, behavior: domain, url: 'https://example.com/test.mrs'}
rules: ['RULE-SET,test,Group', 'MATCH,Group']`;
  assert.equal(validateRuleOutput(output, profile), true);
  const gfwOutput = output
    .replace("format: mrs", "format: yaml")
    .replace("test.mrs", "test.yaml")
    .replace("MATCH,Group", "GEOSITE,cn,DIRECT");
  assert.equal(
    validateRuleOutput(
      gfwOutput,
      bundledCatalog.templates.find((t) => t.id === "ads-only/clash/gfw"),
    ),
    true,
  );
  assert.equal(validateRuleOutput(output), false);
  assert.equal(
    validateRuleOutput(
      output.replace("proxies: [Test]", "proxies: [PASS]"),
      profile,
    ),
    false,
  );
  const probe = new URL(backendProbeUrl(stash.backend, profile));
  assert.equal(probe.searchParams.get("target"), "stash");
  assert.equal(probe.searchParams.get("config"), stash.config);
  assert.equal(probe.searchParams.has("udp"), false);
  assert.equal(probe.searchParams.has("new_name"), false);
  assert.doesNotMatch(probe.href, /token=/);
  assert.notEqual(
    probeKey(stash.backend, profile),
    probeKey(stash.backend, probeProfile(form())),
  );
  assert.notEqual(
    probeKey(stash.backend, profile),
    probeKey(stash.backend, { ...profile, revision: "changed" }),
  );
});
test("HTTP body cap cancels oversized streamed responses", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    pull(c) {
      c.enqueue(encoder.encode("中文"));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readTextLimited(new Response(stream), 10), /过大/);
  assert.equal(cancelled, true);
});

test("removed targets and application aliases have no selection, import, or preset compatibility path", () => {
  for (const format of [
    "clash-verge",
    "flclash",
    "nikki",
    "clash-legacy",
    "clash-android",
    "surge&ver=2",
    "surge&ver=3",
    "quan",
    "mellow",
    "clashr",
    "ssr",
    "sssub",
    "ssd",
  ]) {
    assert.equal(
      outputFormats.some((c) => c.value === format),
      false,
    );
    assert.throws(() => applyFormatPreset(form(), format), /暂不支持/);
    assert.throws(
      () => buildSubscription(form({ format, config: "" })),
      /暂不支持/,
    );
    assert.throws(
      () =>
        parseSubscription(
          `https://example.com/sub?target=${format}&url=https://example.org/source`,
        ),
      /暂不支持/,
    );
  }
  assert.equal(outputFormats.filter((format) => format.value === "clash").length, 1);
  const signatures = outputFormats.map((format) => {
    const url = new URL(buildSubscription(form({ format: format.value, config: "" })));
    return `${url.searchParams.get("target")}/${url.searchParams.get("ver") || ""}`;
  });
  assert.equal(new Set(signatures).size, outputFormats.length);
  assert.equal(requireFormat("clash").value, "clash");
  assert.equal(formatForUrl("https://example.org/sub?target=clash-verge"), undefined);
  assert.equal(formatForUrl("not a URL"), undefined);
});
test("backend requirements reject known MRS failures but allow GEOSITE-only and current verified results", () => {
  const unsupported = form({ backend: "https://api.v1.mk" });
  assert.deepEqual(
    backendCompatibility(unsupported.backend, "clash", ["mrs", "geosite"])
      .missing,
    ["mrs"],
  );
  assert.throws(() => buildSubscription(unsupported), /MRS/);
  assert.doesNotThrow(() =>
    buildSubscription(unsupported, bundledCatalog, { backendVerified: true }),
  );
  const gfw = bundledCatalog.templates.find(
    (t) => t.id === "ads-only/clash/gfw",
  );
  const supported = applyRulePreset(unsupported, gfw.url);
  assert.equal(supported.backend, unsupported.backend);
  assert.doesNotThrow(() => buildSubscription(supported));
  const stash = applyFormatPreset(supported, "stash");
  assert.equal(stash.backend, "https://api.asailor.org");
  const input = new URL("https://api.v1.mk/sub");
  input.searchParams.set("target", "clash");
  input.searchParams.set("url", "https://example.org/source");
  input.searchParams.set("config", defaultTemplate.url);
  const imported = parseSubscription(input.href);
  assert.equal(imported.backend, "https://api.v1.mk");
  assert.throws(() => buildSubscription(imported), /MRS/);
  assert.equal(
    backendCompatibility("https://custom.example", "clash", ["mrs"]).verified,
    false,
  );
});
test("FFQ official endpoints accept GFW templates while incompatible MRS and Stash templates stay blocked", () => {
  const gfw = bundledCatalog.templates.find((item) => item.id === "ads-only/clash/gfw");
  for (const backend of ["https://edge-api-v1.ffqla.com/sub", "https://api.ytools.cc/sub"]) {
    assert.ok(getBackendPreset(backend));
    assert.doesNotThrow(() => buildSubscription(form({ backend, config: gfw.url })));
    assert.throws(() => buildSubscription(form({ backend })), /MRS/);
    const stash = applyFormatPreset(form({ config: gfw.url }), "stash");
    assert.throws(() => buildSubscription({ ...stash, backend }), /Stash/);
  }
});

test("unified template families keep source, runtime purpose and variants together without retired entries", () => {
  const families = templateFamilies();
  const extension = families.find((f) => f.id === "subweave/standard");
  assert.deepEqual(
    new Set(extension.entries.map((e) => e.target)),
    new Set(["clash", "stash", "mihomo", "openclash"]),
  );
  assert.equal(extension.entries.length, 40);
  assert.equal(
    families.some((f) => f.source.includes("个人")),
    false,
  );
  const urls = families.flatMap((f) => f.entries.map((e) => e.url));
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(
    urls.some((u) => u.includes("mainland")),
    false,
  );
  assert.equal(communityRules.length, 18);
  assert.ok(
    communityRules.every(
      (r) =>
        r.url.endsWith(".ini") && ["ACL4SSR", "ClashRule"].includes(r.source),
    ),
  );
});
test("advanced options are isolated drafts, reset to template defaults and preserve nullable flags", () => {
  const original = form();
  const draft = advancedOptions(original);
  draft.flags.udp = true;
  draft.include = "Tokyo";
  draft.extraParams.push(["custom", "value"]);
  assert.equal(original.flags.udp, null);
  assert.equal(original.include, "");
  assert.equal(original.extraParams.length, 0);
  assert.equal("source" in draft, false);
  assert.equal("backend" in draft, false);
  assert.equal(advancedCount(original, defaultTemplate.requiredFlags), 0);
  assert.equal(
    advancedCount({ ...original, ...draft }, defaultTemplate.requiredFlags),
    3,
  );
  const reset = defaultAdvanced(defaultTemplate.requiredFlags);
  assert.equal(reset.flags.new_name, true);
  assert.equal(reset.flags.udp, null);
  assert.equal(reset.extraParams.length, 0);
  assert.ok(validateAdvanced({ ...draft, interval: "0.00000001" }));
  assert.equal(validateAdvanced({ ...draft, interval: "0.5" }), "");
});

test("recommended modern flags preserve full rules and native-provider negotiation", () => {
  for (const format of ["clash", "stash"]) {
    const flags = defaultAdvanced({}, format).flags;
    assert.equal(flags.list, false);
    assert.equal(flags.expand, false);
    assert.equal(flags.insert, false);
    assert.equal(flags.new_name, format === "stash" ? null : true);
    for (const key of [
      "udp",
      "tfo",
      "tls13",
      "scv",
      "xudp",
      "emoji",
      "sort",
      "fdn",
    ])
      assert.equal(flags[key], null);
    const generated = new URL(
      buildSubscription(form({ format, config: "", flags })),
    );
    assert.equal(generated.searchParams.get("insert"), "false");
    assert.equal(generated.searchParams.has("udp"), false);
  }
  const imported = parseSubscription(
    "https://example.com/sub?target=clash&url=https://example.org/source",
  );
  assert.equal(
    new URL(buildSubscription(imported)).searchParams.has("insert"),
    false,
  );
});

test("filter profile is preserved when switching formats and all five schemes are discoverable", () => {
  assert.equal(bundledCatalog.schemaVersion, 2);
  assert.equal(bundledCatalog.profiles.length, 5);
  for (const profile of bundledCatalog.profiles) {
    const entry = bundledCatalog.templates.find(
      (t) => t.id === `${profile.id}/clash/lite-fallback`,
    );
    const selected = applyRulePreset(form(), entry.url);
    const stash = applyFormatPreset(selected, "stash");
    assert.equal(
      findTemplate(stash.config).id,
      `${profile.id}/stash/lite-fallback`,
    );
    assert.equal(applyFormatPreset(stash, "clash").config, entry.url);
    const input = new URL(buildSubscription(stash));
    assert.ok(
      input.searchParams.get("config").includes(`/dist/${profile.id}/`),
    );
    assert.equal(parseSubscription(input.href).config, stash.config);
  }
  const family = templateFamilies().find((f) => f.id === "subweave/standard");
  assert.deepEqual(
    family.profileOrder,
    bundledCatalog.profiles.map((p) => p.id),
  );
  assert.equal(family.entries.length, 40);
  const custom = bundledCatalog.profiles.find((p) => p.id === "custom-only");
  assert.equal(custom.ruleUrl, null);
  assert.deepEqual(custom.categories, []);
  const invalid = structuredClone(bundledCatalog);
  invalid.templates[0].profile = "missing";
  assert.throws(() => parseCatalog(invalid));
});

test("retired publisher paths are rejected rather than treated as custom compatibility templates", () => {
  const retired =
    "https://raw.githubusercontent.com/hqw567/SubWeave-Rules/main/dist/subconverter/standard.ini";
  assert.throws(
    () => buildSubscription(form({ config: retired })),
    /INI 转换模板/,
  );
  assert.doesNotThrow(() =>
    buildSubscription(form({ config: "https://example.com/custom.ini" })),
  );
});
