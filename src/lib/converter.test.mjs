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
  assert.equal(new Set(backendOptions.map((b) => b.value)).size, backendOptions.length);
  for (const backend of ["http://localhost:25500/sub", "https://edge-api-v1.ffqla.com/sub", "https://api.ytools.cc/sub", "https://subapi.cmliussss.net/sub", "https://subapi.fxxk.dedyn.io/sub"]) {
    assert.ok(getBackendPreset(backend));
    assert.equal(new URL(buildSubscription(form({ backend }))).pathname, "/sub");
  }
  const local = form({ backend: "http://localhost:25500/sub", client: "clash-legacy" });
  assert.equal(applyClientPreset(local, "clash").backend, local.backend);
  assert.equal(applyRulePreset(local, aethersailorRules[0].url).backend, local.backend);
  assert.match(ruleCompatibility(form({ backend: local.backend })).warnings[0], /尚未验证/);
  assert.doesNotMatch(backendSnapshot(getBackendPreset(local.backend)), /未通过/);
});

test("short gateway validates service IDs and URLs before making requests", async () => {
  for (const input of [null, { service: "evil", longUrl: "https://example.com" }, { service: "v1mk", longUrl: "file:///etc/passwd" }, { service: "v1mk", longUrl: "https://example.com", alias: "https://bad" }])
    assert.throws(() => shortLinkPayload(input));
  let called = false;
  const response = await handleShortLink(new Request("http://localhost/api/shorten", { method: "POST", body: JSON.stringify({ service: "unknown" }) }), async () => { called = true; throw new Error("unexpected fetch"); });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("short gateway uses a fixed endpoint, preserves encoded URLs, and handles upstream failures", async () => {
  const payload = { service: "gfwmom", longUrl: "https://example.com/sub?url=a%2Bb", alias: "demo" };
  const request = () => new Request("http://localhost/api/shorten", { method: "POST", body: JSON.stringify(payload) });
  const response = await handleShortLink(request(), async (url, init) => {
    assert.equal(url, "https://sub.ffq.la/api/shorten");
    assert.equal(init.redirect, "error");
    assert.deepEqual(JSON.parse(init.body), payload);
    return Response.json({ success: true, shortUrl: "https://gfw.mom/demo" });
  });
  assert.deepEqual(await response.json(), { shortUrl: "https://gfw.mom/demo" });
  for (const upstream of [new Response("bad gateway", { status: 502 }), Response.json({ success: true, shortUrl: "javascript:alert(1)" }), Response.json({ success: false, message: "alias exists" })]) {
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
    assert.equal(next.config, aethersailorRules[0].url);
    assert.equal(
      new URL(buildSubscription(next)).searchParams.get("target"),
      "clash",
    );
    assert.equal(
      new URL(buildSubscription(next)).searchParams.get("expand"),
      "false",
    );
  }
  const legacy = applyClientPreset(form(), "clash-legacy");
  assert.equal(legacy.backend, "https://api.v1.mk");
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
    ruleCompatibility(form({ backend: "https://api.v1.mk" })).warnings.length,
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
    getBackendPreset("https://api.asailor.org/sub/")?.supportsAethersailor,
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
    "clash-legacy",
    "clash-android",
    "clashr",
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
