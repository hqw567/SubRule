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
  clients,
  httpUrl,
  applyClientPreset,
  applyRulePreset,
  getClientTarget,
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
import { handleShortLink, shortLinkPayload } from "./short-link.ts";
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
    client: "surge&ver=4",
  });
  assert.equal(applyClientPreset(local, "clash").backend, local.backend);
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

test("short gateway validates service IDs and URLs before making requests", async () => {
  for (const input of [
    null,
    { service: "evil", longUrl: "https://example.com" },
    { service: "v1mk", longUrl: "file:///etc/passwd" },
    { service: "v1mk", longUrl: "https://example.com", alias: "https://bad" },
  ])
    assert.throws(() => shortLinkPayload(input));
  let called = false;
  const response = await handleShortLink(
    new Request("http://localhost/api/shorten", {
      method: "POST",
      body: JSON.stringify({ service: "unknown" }),
    }),
    async () => {
      called = true;
      throw new Error("unexpected fetch");
    },
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("short gateway uses a fixed endpoint, preserves encoded URLs, and handles upstream failures", async () => {
  const payload = {
    service: "gfwmom",
    longUrl: "https://example.com/sub?url=a%2Bb",
    alias: "demo",
  };
  const request = () =>
    new Request("http://localhost/api/shorten", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  const response = await handleShortLink(request(), async (url, init) => {
    assert.equal(url, "https://sub.ffq.la/api/shorten");
    assert.equal(init.redirect, "error");
    assert.deepEqual(JSON.parse(init.body), payload);
    return Response.json({ success: true, shortUrl: "https://gfw.mom/demo" });
  });
  assert.deepEqual(await response.json(), { shortUrl: "https://gfw.mom/demo" });
  for (const upstream of [
    new Response("bad gateway", { status: 502 }),
    Response.json({ success: true, shortUrl: "javascript:alert(1)" }),
    Response.json({ success: false, message: "alias exists" }),
  ]) {
    const failed = await handleShortLink(request(), async () => upstream);
    assert.equal(failed.status, 502);
    assert.ok((await failed.json()).message);
  }
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
test("all supported clients round trip without losing target or version", () => {
  for (const client of clients) {
    const generated = buildSubscription(
      form({ client: client.value, config: "" }),
    );
    assert.equal(
      getClientTarget(parseSubscription(generated).client),
      getClientTarget(client.value),
    );
    assert.equal(buildSubscription(parseSubscription(generated)), generated);
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
test("only includes client-specific flags for their matching target", () => {
  const f = form({ client: "singbox", config: "" });
  f.flags["singbox.ipv6"] = true;
  const p = new URL(buildSubscription(f)).searchParams;
  assert.equal(p.get("singbox.ipv6"), "1");
  assert.equal(p.has("clash.doh"), false);
  assert.equal(p.has("surge.doh"), false);
  assert.equal(p.has("new_name"), false);
});

test("modern choices share target=clash and switch known backends and templates", () => {
  for (const client of ["clash", "clash-verge", "flclash", "nikki"]) {
    const next = applyClientPreset(
      form({ client: "surge&ver=4", backend: "https://api.v1.mk" }),
      client,
    );
    assert.equal(next.backend, "https://api.asailor.org");
    assert.equal(next.config, defaultTemplate.url);
    assert.equal(
      new URL(buildSubscription(next)).searchParams.get("target"),
      "clash",
    );
    assert.equal(
      new URL(buildSubscription(next)).searchParams.get("expand"),
      "false",
    );
  }
  const legacy = applyClientPreset(form(), "surge&ver=4");
  assert.equal(legacy.backend, "https://api.asailor.org");
  assert.match(legacy.config, /ACL4SSR/);
  assert.equal(ruleCompatibility(legacy).errors.length, 0);
});
test("all eight templates apply safe flags and preserve verified or custom backends", () => {
  for (const rule of aethersailorRules) {
    const original = form({
      client: "surge&ver=4",
      backend: "https://sub-server.v2rayssr.com/sub/",
    });
    original.flags.expand = true;
    original.flags.list = true;
    original.flags.new_name = false;
    const next = applyRulePreset(original, rule.url);
    assert.equal(next.backend, original.backend);
    assert.equal(next.client, "clash");
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
test("incompatible client, list-only, old fields, or expansion cannot silently discard COR rules", () => {
  for (const client of [
    "surge&ver=4",
    "singbox",
    "quanx",
    "shadowrocket",
    "loon",
  ])
    assert.throws(() => buildSubscription(form({ client })), /现代客户端/);
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
test("switching clients preserves custom templates and pairs extension variants with Stash", () => {
  const original = applyRulePreset(
    form(),
    bundledCatalog.templates.find(
      (t) => t.id === "ads-only/clash/lite-fallback",
    ).url,
  );
  const stash = applyClientPreset(original, "stash");
  assert.equal(findTemplate(stash.config).id, "ads-only/stash/lite-fallback");
  assert.equal(applyClientPreset(stash, "clash").config, original.config);
  const unknown = form({
    client: "surge&ver=4",
    config: "https://example.com/custom.ini",
  });
  assert.equal(applyClientPreset(unknown, "clash").config, unknown.config);
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
    findTemplate(applyClientPreset(upstream, "stash").config).id,
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
  const stash = applyClientPreset(form(), "stash"),
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
test("HTTP body cap stops oversized streamed requests before calling the short-link gateway", async () => {
  let called = false;
  const req = new Request("https://example.com/api/shorten", {
    method: "POST",
    body: "x".repeat(65001),
  });
  const response = await handleShortLink(req, async () => {
    called = true;
    throw new Error("unexpected");
  });
  assert.equal(response.status, 400);
  assert.equal(called, false);
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

test("removed clients have no selection, import, or preset compatibility path", () => {
  for (const client of [
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
      clients.some((c) => c.value === client),
      false,
    );
    assert.throws(() => applyClientPreset(form(), client), /暂不支持/);
    assert.throws(
      () => buildSubscription(form({ client, config: "" })),
      /暂不支持/,
    );
    assert.throws(
      () =>
        parseSubscription(
          `https://example.com/sub?target=${client}&url=https://example.org/source`,
        ),
      /暂不支持/,
    );
  }
  const mihomo = clients.filter((c) => c.group === "Mihomo 内核");
  assert.deepEqual(
    mihomo.map((c) => getClientTarget(c.value)),
    Array(mihomo.length).fill("clash"),
  );
  assert.ok(
    clients.some((c) => c.value === "stash" && c.group === "其他客户端"),
  );
  assert.ok(clients.some((c) => c.value === "v2ray" && c.group === "通用格式"));
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
  const stash = applyClientPreset(supported, "stash");
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
  for (const client of ["clash", "clash-verge", "flclash", "nikki", "stash"]) {
    const flags = defaultAdvanced({}, client).flags;
    assert.equal(flags.list, false);
    assert.equal(flags.expand, false);
    assert.equal(flags.insert, false);
    assert.equal(flags.new_name, client === "stash" ? null : true);
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
      buildSubscription(form({ client, config: "", flags })),
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

test("filter profile is preserved when switching clients and all five schemes are discoverable", () => {
  assert.equal(bundledCatalog.schemaVersion, 2);
  assert.equal(bundledCatalog.profiles.length, 5);
  for (const profile of bundledCatalog.profiles) {
    const entry = bundledCatalog.templates.find(
      (t) => t.id === `${profile.id}/clash/lite-fallback`,
    );
    const selected = applyRulePreset(form(), entry.url);
    const stash = applyClientPreset(selected, "stash");
    assert.equal(
      findTemplate(stash.config).id,
      `${profile.id}/stash/lite-fallback`,
    );
    assert.equal(applyClientPreset(stash, "clash-verge").config, entry.url);
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
