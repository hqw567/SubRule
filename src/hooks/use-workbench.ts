import { requireClient } from "#/lib/clients";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  applyClientPreset,
  applyRulePreset,
  buildSubscription,
  clients,
  defaultForm,
  httpUrl,
  parseSubscription,
  requestJson,
  ruleCompatibility,
  splitSources,
} from "#/lib/converter";
import type { FormState, Flag, FlagValue } from "#/lib/converter";
import { inspectBackend, probeKey, probeProfile } from "#/lib/backend-probe";
import type { BackendReport } from "#/lib/backend-probe";
import type { TemplateCatalog } from "#/lib/template-catalog";
import { backendCompatibility, backendOptions } from "#/lib/catalog";
import { useHistory } from "./use-history";
import type { HistoryEntry } from "./use-history";
export const message = (e: unknown) =>
  e instanceof Error ? e.message : "操作未完成，请重试";
export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("已复制");
  } catch {
    toast.error("无法访问剪贴板，请手动复制");
  }
}
export function useWorkbench(catalog: TemplateCatalog) {
  const [form, setForm] = useState<FormState>(() => ({
    ...defaultForm,
    flags: { ...defaultForm.flags },
    extraParams: [],
  }));
  const [result, setResult] = useState(""),
    [shortResult, setShortResult] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Record<string, BackendReport>>({});
  const [shortApi, setShortApi] = useState("https://v1.mk/short");
  const [uploadApi, setUploadApi] = useState("https://subapi.v1.mk/sub.php");
  const [shortService, setShortService] = useState("v1mk"),
    [shortKey, setShortKey] = useState("");
  const history = useHistory();
  const activeResult = useRef("");
  useEffect(() => {
    activeResult.current = "";
    setResult("");
    setShortResult("");
    setError("");
  }, [form]);
  useEffect(() => {
    const backend = new URLSearchParams(window.location.search).get("backend");
    if (backend)
      try {
        httpUrl(backend);
        setForm((f) => ({ ...f, backend }));
      } catch {
        toast.error("后端地址无效");
      }
  }, []);
  const profile = probeProfile(form, catalog);
  let report: BackendReport | undefined;
  try {
    if (profile) report = reports[probeKey(form.backend, profile)];
  } catch {
    /* Invalid URL is handled at submission. */
  }
  const compatibility = ruleCompatibility(form, catalog, {
    backendVerified: report?.status === "passed",
  });
  const backendChoices = backendOptions.map((backend) => {
    const support = backendCompatibility(
      backend.value,
      profile?.target || form.client,
      profile?.capabilities,
    );
    const verified =
      profile && reports[probeKey(backend.value, profile)]?.status === "passed";
    return {
      value: backend.value,
      label: backend.label,
      group:
        !support.supported && !verified
          ? `${backend.group} · 不适配此模板`
          : backend.group,
      disabled: !support.supported && !verified,
      reason: support.missing.length
        ? `缺少 ${support.missing.join(" / ")} 支持`
        : undefined,
    };
  });
  const sourceCount = new Set(splitSources(form.source)).size;
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function flag(key: Flag, value: FlagValue) {
    setForm((f) => ({ ...f, flags: { ...f.flags, [key]: value } }));
  }
  function chooseRule(config: string) {
    setForm((f) => applyRulePreset(f, config, catalog));
  }
  function chooseClient(client: string) {
    setForm((f) => applyClientPreset(f, client, catalog));
  }
  function generate() {
    try {
      const url = buildSubscription(form, catalog, {
        backendVerified: report?.status === "passed",
      });
      activeResult.current = url;
      setResult(url);
      setShortResult("");
      setError("");
      history.add({
        url,
        client:
          clients.find((c) => c.value === form.client)?.label || form.client,
        clientId: form.client,
        count: sourceCount,
        time: Date.now(),
      });
      return url;
    } catch (e) {
      setError(message(e));
      return "";
    }
  }
  async function inspect() {
    if (!profile) return;
    setBusy("probe");
    try {
      const next = await inspectBackend(form.backend, profile);
      setReports((previous) => ({ ...previous, [next.key]: next }));
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(null);
    }
  }
  async function shorten() {
    if (!result) return;
    const current = result;
    setBusy("short");
    try {
      let url: string;
      if (shortService === "custom") {
        const data = new FormData();
        data.set("longUrl", btoa(current));
        if (shortKey.trim()) data.set("shortKey", shortKey.trim());
        const response = await requestJson(shortApi, data);
        if (response.Code !== 1 || !response.ShortUrl)
          throw new Error("短链服务未返回有效链接");
        url = httpUrl(response.ShortUrl).href;
      } else {
        const response = await fetch("/api/shorten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service: shortService,
            longUrl: current,
            alias: shortKey,
          }),
          signal: AbortSignal.timeout(25000),
        });
        const data = await response.json();
        if (!response.ok || !data.shortUrl)
          throw new Error(data.message || "短链服务请求失败");
        url = httpUrl(data.shortUrl).href;
      }
      if (activeResult.current === current) {
        setShortResult(url);
        toast.success("短链接已生成");
      }
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(null);
    }
  }
  async function importLink(value: string) {
    setBusy("import");
    try {
      let url = httpUrl(value, "转换链接");
      if (!url.searchParams.has("target")) {
        const response = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("短链接解析失败，请检查跨域权限");
        url = new URL(response.url);
      }
      setForm(parseSubscription(url.href, catalog));
      toast.success("转换参数已恢复");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function applyConfig(value: string, upload: boolean) {
    setBusy("config");
    try {
      let url = value;
      if (upload) {
        if (!value.trim()) throw new Error("请填写配置内容");
        const data = new FormData();
        data.set("config", encodeURIComponent(value));
        const response = await requestJson(uploadApi, data);
        if (response.code !== 0 || !response.data)
          throw new Error("配置托管失败");
        url = response.data;
      }
      chooseRule(httpUrl(url, "模板地址").href);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  function restore(entry: HistoryEntry) {
    try {
      const next = parseSubscription(entry.url, catalog);
      if (entry.clientId) {
        requireClient(entry.clientId);
        next.client = entry.clientId;
      }
      setForm(next);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    }
  }
  return {
    form,
    update,
    flag,
    applyOptions: (
      options: Pick<
        FormState,
        | "include"
        | "exclude"
        | "rename"
        | "filename"
        | "interval"
        | "dev_id"
        | "diyua"
        | "flags"
        | "extraParams"
        | "extraParamsTarget"
      >,
    ) => setForm((f) => ({ ...f, ...options })),
    chooseRule,
    chooseClient,
    sourceCount,
    compatibility,
    backendChoices,
    profile,
    report,
    inspect,
    result,
    shortResult,
    busy,
    error,
    generate,
    shorten,
    importLink,
    applyConfig,
    restore,
    history,
    shortApi,
    setShortApi,
    uploadApi,
    setUploadApi,
    shortService,
    setShortService,
    shortKey,
    setShortKey,
    reset: () =>
      setForm({
        ...defaultForm,
        flags: { ...defaultForm.flags },
        extraParams: [],
      }),
  };
}
export type Workbench = ReturnType<typeof useWorkbench>;
