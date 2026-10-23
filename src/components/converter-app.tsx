import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Clock3,
  Code2,
  Copy,
  FileCode2,
  FileSliders,
  Github,
  Globe2,
  History,
  Layers3,
  Link2,
  Loader2,
  Menu,
  Moon,
  Network,
  Plus,
  RotateCcw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Label } from "#/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "#/components/ui/alert";
import {
  Field as UiField,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "#/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "#/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "#/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "#/components/ui/accordion";
import { Separator } from "#/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import { Toaster } from "#/components/ui/sonner";
import {
  buildSubscription,
  applyRulePreset,
  applyClientPreset,
  isModernClient,
  getClientTarget,
  ruleCompatibility,
  clients,
  defaultForm,
  flagOptions,
  httpUrl,
  parseSubscription,
  requestJson,
  splitSources,
} from "#/lib/converter";
import type { FormState, Flag } from "#/lib/converter";
import legacyRules from "#/lib/rules.json";
import {
  aethersailorRules,
  aethersailorProject,
  aethersailorResource,
  backendOptions,
  backendSnapshot,
  shortServices,
  getBackendPreset,
  normalizeBackend,
} from "#/lib/catalog";
import { inspectBackend } from "#/lib/backend-probe";
import type { BackendReport } from "#/lib/backend-probe";
import { cn } from "#/lib/utils";

type Page = "convert" | "rules" | "history" | "settings";
type Modal = "parse" | "config" | "help" | null;
type HistoryEntry = {
  url: string;
  client: string;
  clientId?: string;
  time: number;
  count: number;
};
const navigation = [
  { id: "convert", label: "订阅转换", icon: ArrowLeftRight },
  { id: "rules", label: "规则配置", icon: FileSliders },
  { id: "history", label: "转换历史", icon: History },
] as const;
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败，请重试";
const rules = [...aethersailorRules, ...legacyRules];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ConverterApp() {
  const [form, setForm] = useState<FormState>(() => ({
    ...defaultForm,
    flags: { ...defaultForm.flags },
  }));
  const [page, setPage] = useState<Page>("convert");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(false);
  const [result, setResult] = useState("");
  const [shortResult, setShortResult] = useState("");
  const [shortApi, setShortApi] = useState("https://v1.mk/short");
  const [shortService, setShortService] = useState("v1mk");
  const [uploadApi, setUploadApi] = useState("https://subapi.v1.mk/sub.php");
  const [shortKey, setShortKey] = useState("");
  const [parseInput, setParseInput] = useState("");
  const [configInput, setConfigInput] = useState("");
  const [configContent, setConfigContent] = useState("");
  const [configTab, setConfigTab] = useState("url");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saveHistory, setSaveHistory] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [customBackend, setCustomBackend] = useState(false);
  const [resultTab, setResultTab] = useState("link");
  const [backendStatus, setBackendStatus] = useState("尚未检测");
  const [backendReports, setBackendReports] = useState<
    Record<string, BackendReport>
  >({});
  const resultRef = useRef<HTMLDivElement>(null);
  const activeResult = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sources = splitSources(form.source);
  const client = clients.find((c) => c.value === form.client) || clients[0];
  const selectedRule = rules.find((r) => r.url === form.config);
  const compatibility = ruleCompatibility(form);
  const modern = isModernClient(form.client);
  const backendPreset = getBackendPreset(form.backend);
  const backendReport = (() => {
    try {
      return backendReports[normalizeBackend(form.backend)];
    } catch {
      return undefined;
    }
  })();
  const activeFlags = flagOptions.filter(
    (f) =>
      form.flags[f.key] &&
      (!f.key.startsWith("clash.") ||
        getClientTarget(form.client) === "clash") &&
      (!f.key.startsWith("surge.") || form.client.startsWith("surge")) &&
      (!f.key.startsWith("singbox.") || form.client === "singbox") &&
      (f.key !== "new_name" || getClientTarget(form.client) === "clash"),
  );

  useEffect(() => {
    try {
      const theme = localStorage.getItem("subrule-theme");
      setDark(
        theme === "dark" ||
          (!theme && matchMedia("(prefers-color-scheme: dark)").matches),
      );
      const remember =
        localStorage.getItem("subrule-history-enabled") === "true";
      setSaveHistory(remember);
      const stored = JSON.parse(
        localStorage.getItem("subrule-history") || "[]",
      );
      if (remember && Array.isArray(stored))
        setHistory(
          stored
            .filter(
              (e) =>
                typeof e.url === "string" &&
                typeof e.time === "number" &&
                typeof e.client === "string" &&
                typeof e.count === "number",
            )
            .slice(0, 20),
        );
    } catch {
      /* Storage can be unavailable in private contexts. */
    }
    const backend = new URLSearchParams(window.location.search).get("backend");
    if (backend) {
      try {
        httpUrl(backend);
        setForm((f) => ({ ...f, backend }));
        setCustomBackend(!getBackendPreset(backend));
      } catch {
        toast.error("URL 中的后端地址无效，已使用默认后端");
      }
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    activeResult.current = "";
    setResult("");
    setShortResult("");
    setResultTab("link");
  }, [form]);
  useEffect(() => {
    setBackendStatus("尚未检测");
  }, [form.backend]);
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function flag(key: Flag, value: boolean) {
    setForm((f) => ({ ...f, flags: { ...f.flags, [key]: value } }));
  }
  function go(next: Page) {
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("无法访问剪贴板，请选中链接手动复制");
    }
  }
  function persist(entries: HistoryEntry[], enabled = saveHistory) {
    if (enabled) {
      try {
        localStorage.setItem("subrule-history", JSON.stringify(entries));
      } catch {
        toast.error("浏览器无法保存历史，记录仅保留在本次会话");
      }
    }
  }
  function generate() {
    try {
      const url = buildSubscription(form);
      activeResult.current = url;
      setResult(url);
      setShortResult("");
      setResultTab("link");
      const next = [
        {
          url,
          client: client.label,
          clientId: form.client,
          time: Date.now(),
          count: new Set(sources).size,
        },
        ...history.filter((e) => e.url !== url),
      ].slice(0, 20);
      setHistory(next);
      persist(next);
      toast.success("订阅链接已生成");
      setTimeout(
        () =>
          resultRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        50,
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function shorten() {
    if (!result) return;
    const sourceResult = result;
    setBusy("short");
    try {
      let shortUrl: string;
      if (shortService !== "custom") {
        const response = await fetch("/api/shorten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: shortService, longUrl: result, alias: shortKey }),
          signal: AbortSignal.timeout(25000),
        });
        const data = await response.json();
        if (!response.ok || !data.shortUrl) throw new Error(data.message || "短链服务暂不可用");
        shortUrl = httpUrl(data.shortUrl, "返回短链").href;
      } else {
      const data = new FormData();
      data.append("longUrl", btoa(result));
      if (shortKey.trim()) data.append("shortKey", shortKey.trim());
      const res = await requestJson(shortApi, data);
      if (res.Code !== 1 || !res.ShortUrl)
        throw new Error(res.Message || "短链服务未返回有效链接");
        shortUrl = httpUrl(res.ShortUrl, "返回短链").href;
      }
      if (activeResult.current !== sourceResult) return;
      setShortResult(shortUrl);
      toast.success("短链接已生成");
    } catch (e) {
      toast.error(`${errorMessage(e)}。${shortService === "custom" ? "请检查短链 API 与跨域设置。" : "请稍后重试或切换短链服务。"}`);
    } finally {
      setBusy(null);
    }
  }
  async function parse() {
    setBusy("parse");
    try {
      let url = httpUrl(parseInput, "订阅链接");
      if (!url.searchParams.has("target")) {
        const res = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`解析失败（HTTP ${res.status}）`);
        url = new URL(res.url);
      }
      const parsed = parseSubscription(url.href);
      setForm(parsed);
      setCustomBackend(!backendOptions.some((b) => b.value === parsed.backend));
      setModal(null);
      go("convert");
      toast.success("已解析并恢复所有订阅参数");
    } catch (e) {
      toast.error(`${errorMessage(e)}。短链接解析需要服务支持跨域。`);
    } finally {
      setBusy(null);
    }
  }
  async function applyConfig() {
    setBusy("config");
    try {
      let url = configInput;
      if (configTab === "upload") {
        if (!configContent.trim()) throw new Error("请填写配置内容或导入文件");
        const data = new FormData();
        data.append("config", encodeURIComponent(configContent));
        const res = await requestJson(uploadApi, data);
        if (res.code !== 0 || !res.data)
          throw new Error(res.msg || "配置上传失败");
        url = res.data;
      }
      chooseRule(httpUrl(url, "配置地址").href);
      setModal(null);
      toast.success("自定义配置已应用");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function checkBackend() {
    setBusy("backend");
    setBackendStatus("检测中…");
    try {
      const report = await inspectBackend(form.backend);
      setBackendReports((previous) => ({
        ...previous,
        [report.backend]: report,
      }));
      setBackendStatus(
        report.status === "passed" ? "标准模板实测通过" : "尚未验证",
      );
      if (report.status === "passed")
        toast.success(`${report.version} · 标准模板实测通过`);
      else toast.info(report.detail);
    } catch (e) {
      setBackendStatus("尚未验证");
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("subrule-theme", next ? "dark" : "light");
    } catch {}
  }
  function reset() {
    setForm({ ...defaultForm, flags: { ...defaultForm.flags } });
    setCustomBackend(false);
    toast.success("已恢复默认配置");
  }
  function chooseRule(config: string) {
    const next = applyRulePreset(form, config);
    setForm(next);
    setCustomBackend(!getBackendPreset(next.backend));
    if (aethersailorResource(config) === "template")
      toast.success("已匹配现代客户端，保留 MRS 规则并输出完整配置");
  }
  function chooseClient(value: string) {
    const next = applyClientPreset(form, value);
    setForm(next);
    setCustomBackend(!getBackendPreset(next.backend));
    if (next.backend !== form.backend || next.config !== form.config)
      toast.info("已按客户端匹配转换后端与模板");
  }
  const compatibilityNotice = compatibility.resource && (
    <Alert
      variant={compatibility.errors.length ? "destructive" : "default"}
      className="my-4"
    >
      <ShieldCheck />
      <AlertTitle>
        {compatibility.errors.length
          ? "当前组合需要调整"
          : "Aethersailor · 现代规则配置"}
      </AlertTitle>
      <AlertDescription>
        <p>
          适用于 OpenClash / Mihomo / Clash Meta、Clash Verge
          Rev、FlClash、Nikki；旧 Clash 内核不支持完整规则。保留 MRS
          Provider，不展开规则。
        </p>
        {compatibility.errors.map((message) => (
          <p key={message}>{message}</p>
        ))}
        {!(backendReport?.status === "passed") &&
          compatibility.warnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
        <p>
          {backendReport
            ? `${backendReport.version} · ${backendReport.detail}`
            : backendPreset
              ? backendSnapshot(backendPreset)
              : "自建后端可使用下方检测按钮验证。"}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {(compatibility.errors.length > 0 ||
            compatibility.warnings.length > 0) &&
            compatibility.resource === "template" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = applyRulePreset(form, form.config);
                  setForm({ ...next, backend: backendOptions[0].value });
                  setCustomBackend(false);
                }}
              >
                使用配套转换设置
              </Button>
            )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={checkBackend}
          >
            {busy === "backend" ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Network data-icon="inline-start" />
            )}
            检测后端兼容性
          </Button>
          <Button variant="link" size="sm" asChild>
            <a
              href={`${aethersailorProject}/tree/main/cfg`}
              target="_blank"
              rel="noreferrer"
            >
              模板说明
              <ArrowUpRight data-icon="inline-end" />
            </a>
          </Button>
        </div>
        <p>
          检测仅发送虚构测试节点，不使用你的订阅；验证标准模板结构，不代表所有模板或节点协议都已验证。
        </p>
      </AlertDescription>
    </Alert>
  );

  const sidebarContent = (
    <>
      <a className="brand" href="/" aria-label="SubRule 首页">
        <span className="brand-symbol">
          <ArrowLeftRight size={21} />
        </span>
        <span>
          Sub<span className="brand-light">Rule</span>
          <small>连接，从简。</small>
        </span>
        <Badge variant="outline" className="version-badge">
          2.0
        </Badge>
      </a>
      <div className="workspace-label">
        工作空间 <span>WORKSPACE</span>
      </div>
      <nav className="main-nav">
        {navigation.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn("nav-item", page === item.id && "active")}
            onClick={() => go(item.id)}
            aria-current={page === item.id ? "page" : undefined}
          >
            <item.icon size={18} />
            {item.label}
            {item.id === "convert" ? (
              <span className="nav-dot" />
            ) : item.id === "history" && history.length > 0 ? (
              <span className="nav-count">{history.length}</span>
            ) : null}
          </Button>
        ))}
      </nav>
      <Separator className="nav-separator" />
      <div className="workspace-label">更多</div>
      <nav className="main-nav">
        <Button
          variant="ghost"
          className={cn("nav-item", page === "settings" && "active")}
          onClick={() => go("settings")}
        >
          <Settings2 size={18} />
          偏好设置
        </Button>
        <Button
          variant="ghost"
          className="nav-item"
          onClick={() => {
            setMobileNav(false);
            setModal("help");
          }}
        >
          <BookOpen size={18} />
          使用指南
          <ArrowUpRight size={14} className="ml-auto opacity-45" />
        </Button>
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="local-note-icon">
            <ShieldCheck size={20} />
          </span>
          <h3>你的订阅，由你掌控</h3>
          <p>
            链接在浏览器内生成
            <br />
            自由选择可信赖的转换后端
          </p>
          <Button
            variant="link"
            onClick={() => {
              setMobileNav(false);
              setModal("help");
            }}
          >
            了解工作原理 <ArrowRight size={13} />
          </Button>
        </div>
        <div className="sidebar-foot">
          <span className="tiny-logo">
            <Layers3 size={15} />
            为自由连接而构建
          </span>
          <span className="green-dot" />
        </div>
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <div className="app-shell">
        <aside className="sidebar">{sidebarContent}</aside>
        <Dialog open={mobileNav} onOpenChange={setMobileNav}>
          <DialogContent className="mobile-nav-panel">
            <DialogTitle className="sr-only">工作空间导航</DialogTitle>
            <DialogDescription className="sr-only">
              选择订阅转换、规则配置、转换历史或偏好设置。
            </DialogDescription>
            {sidebarContent}
          </DialogContent>
        </Dialog>

        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <Button
                variant="ghost"
                size="icon"
                className="mobile-menu"
                aria-label="展开导航"
                onClick={() => setMobileNav(true)}
              >
                <Menu />
              </Button>
              <span>工作空间</span>
              <ChevronRight size={13} />
              <strong>
                {page === "settings"
                  ? "偏好设置"
                  : navigation.find((n) => n.id === page)?.label}
              </strong>
            </div>
            <div className="top-actions">
              <Badge variant="outline" className="local-badge">
                <span className="green-dot" />
                浏览器本地运行
              </Badge>
              <Separator orientation="vertical" className="h-4! mx-1" />
              <IconButton
                label={dark ? "切换浅色模式" : "切换深色模式"}
                onClick={toggleTheme}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label="参考项目 GitHub"
              >
                <a
                  href="https://github.com/youshandefeiyang/sub-web-modify"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github size={18} />
                </a>
              </Button>
            </div>
          </header>
          <main className="main-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span />
                  {page === "convert"
                    ? "LESS CONFIGURATION, MORE CONNECTION."
                    : "YOUR CONNECTION, YOUR WAY."}
                </div>
                <h1>
                  {page === "convert"
                    ? "让订阅转换，简单一点。"
                    : page === "rules"
                      ? "好规则，让连接更有序。"
                      : page === "history"
                        ? "每一次连接，都有迹可循。"
                        : "按照你的习惯，开始连接。"}
                </h1>
                <p>
                  {page === "convert"
                    ? "一个入口，连接所有客户端。轻松合并、定制并转换你的订阅。"
                    : page === "rules"
                      ? "从 96 个社区配置中找到适合你的规则，包含 Aethersailor 现代模板。"
                      : page === "history"
                        ? "找回最近生成的订阅链接，随时恢复配置。"
                        : "管理外部服务与本地存储，打造适合自己的工作空间。"}
                </p>
              </div>
              {page === "convert" && (
                <Button
                  variant="outline"
                  className="heading-button"
                  onClick={() => setModal("parse")}
                >
                  <Link2 size={15} />从 URL 导入
                  <ArrowUpRight size={14} />
                </Button>
              )}
            </div>

            {page === "convert" && (
              <div className="converter-grid">
                <div className="form-column">
                  <Card className="form-card">
                    <CardContent className="p-0">
                      <section className="form-section source-section">
                        <div className="section-heading">
                          <span className="step-number">01</span>
                          <div>
                            <h2>添加订阅</h2>
                            <p>粘贴你的订阅链接，剩下的交给我们。</p>
                          </div>
                          <Badge variant="secondary" className="section-badge">
                            支持多订阅合并
                          </Badge>
                        </div>
                        <div className="source-box">
                          <Textarea
                            aria-label="订阅链接"
                            value={form.source}
                            onChange={(e) => update("source", e.target.value)}
                            placeholder={
                              "在这里粘贴订阅链接或单节点链接\nhttps://example.com/subscribe?token=…\n\n多个链接请换行，或使用 | 分隔"
                            }
                            spellCheck={false}
                          />
                          <div className="source-toolbar">
                            <span>
                              <Link2 size={13} />
                              {sources.length
                                ? `已添加 ${sources.length} 个链接`
                                : "支持 HTTP、SS、VMess、VLESS 等链接"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const text =
                                    await navigator.clipboard.readText();
                                  if (!text.trim()) {
                                    toast.info("剪贴板为空");
                                    return;
                                  }
                                  update(
                                    "source",
                                    form.source
                                      ? `${form.source}\n${text}`
                                      : text,
                                  );
                                } catch {
                                  toast.error(
                                    "无法读取剪贴板，请使用 Ctrl / ⌘ + V 粘贴",
                                  );
                                }
                              }}
                            >
                              <Clipboard size={13} />
                              粘贴
                            </Button>
                            {form.source && (
                              <IconButton
                                label="清空订阅"
                                onClick={() => update("source", "")}
                              >
                                <X size={13} />
                              </IconButton>
                            )}
                          </div>
                        </div>
                        <div className="input-note">
                          <ShieldCheck size={13} />
                          <span>
                            生成链接时不会发送订阅内容，使用链接时由所选后端进行转换。
                          </span>
                        </div>
                      </section>
                      <Separator />
                      <section className="form-section">
                        <div className="section-heading">
                          <span className="step-number">02</span>
                          <div>
                            <h2>选择目标客户端</h2>
                            <p>推荐客户端与兼容客户端，自动匹配转换方式。</p>
                          </div>
                        </div>
                        <FieldGroup>
                          <UiField>
                            <FieldLabel htmlFor="client-type">
                              客户端
                            </FieldLabel>
                            <Select
                              value={form.client}
                              onValueChange={chooseClient}
                            >
                              <SelectTrigger
                                id="client-type"
                                aria-label="客户端"
                                className="w-full"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>
                                    推荐客户端（现代 Mihomo 内核）
                                  </SelectLabel>
                                  {clients
                                    .filter((c) => isModernClient(c.value))
                                    .map((c) => (
                                      <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>
                                    兼容客户端（按目标格式转换）
                                  </SelectLabel>
                                  {clients
                                    .filter((c) => !isModernClient(c.value))
                                    .map((c) => (
                                      <SelectItem key={c.value} value={c.value}>
                                        {c.label}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FieldDescription>
                              {modern
                                ? "使用现代 Mihomo 转换方式，支持 GEOSITE / MRS，推荐搭配 Aethersailor 模板。"
                                : "按客户端原生格式转换；实际协议支持取决于客户端版本。Aethersailor 的 Mihomo 模板不适用于此分组。"}
                            </FieldDescription>
                          </UiField>
                        </FieldGroup>
                      </section>
                      <Separator />
                      <section className="form-section config-section">
                        <div className="section-heading">
                          <span className="step-number">03</span>
                          <div>
                            <h2>配置转换选项</h2>
                            <p>使用默认配置，或按需微调。</p>
                          </div>
                        </div>
                        <div className="two-fields">
                          <Field label="转换后端">
                            <Select
                              value={
                                customBackend || !backendPreset
                                  ? "custom"
                                  : backendPreset.value
                              }
                              onValueChange={(v) => {
                                setCustomBackend(v === "custom");
                                if (v !== "custom") update("backend", v);
                              }}
                            >
                              <SelectTrigger
                                aria-label="转换后端"
                                className="w-full"
                              >
                                <Server
                                  size={15}
                                  className="text-muted-foreground"
                                />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[true, false, null].map((status) => (
                                <SelectGroup key={String(status)}>
                                  <SelectLabel>{status === true ? "现代模板 · 实测通过" : status === false ? "其他后端 · 现代模板未通过" : "其他后端 · 尚未验证"}</SelectLabel>
                                  {backendOptions.filter((b) => b.supportsAethersailor === status).map((b) => (
                                    <SelectItem key={b.value} value={b.value}>
                                      {b.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                ))}
                                <SelectGroup>
                                  <SelectItem value="custom">
                                    自定义后端地址
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            {customBackend && (
                              <Input
                                aria-label="自定义后端地址"
                                value={form.backend}
                                onChange={(e) =>
                                  update("backend", e.target.value)
                                }
                                placeholder="https://your-backend.com"
                              />
                            )}
                            {backendPreset?.value === "http://localhost:25500" && (
                              <p className="field-hint">连接本机自行部署的后端，自动使用 /sub。检测需允许跨域；在其他设备使用生成链接时，localhost 指向该设备，可改填局域网 IP。</p>
                            )}
                          </Field>
                          <Field label="远程规则配置">
                            <Select
                              value={
                                form.config === ""
                                  ? "none"
                                  : selectedRule
                                    ? form.config
                                    : "custom"
                              }
                              onValueChange={(v) => {
                                if (v === "custom") {
                                  setConfigInput(form.config);
                                  setModal("config");
                                } else chooseRule(v === "none" ? "" : v);
                              }}
                            >
                              <SelectTrigger
                                aria-label="远程规则配置"
                                className="w-full"
                              >
                                <FileSliders />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>
                                    Aethersailor · 现代 Mihomo 模板
                                  </SelectLabel>
                                  {aethersailorRules.map((r) => (
                                    <SelectItem key={r.url} value={r.url}>
                                      {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>通用与兼容模板</SelectLabel>
                                  {legacyRules.map((r, i) => (
                                    <SelectItem
                                      key={`${r.url}-${i}`}
                                      value={r.url}
                                    >
                                      {r.name === "默认"
                                        ? "ACL4SSR · 全分组默认版"
                                        : r.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                <SelectGroup>
                                  <SelectLabel>其他配置</SelectLabel>
                                  <SelectItem value="none">
                                    使用后端默认配置
                                  </SelectItem>
                                  <SelectItem value="custom">
                                    自定义远程配置
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        <div className="config-links">
                          <span>
                            <Globe2 size={12} /> 支持自建 Subconverter 后端
                          </span>
                          <Button variant="link" onClick={() => go("rules")}>
                            浏览规则库 <ArrowUpRight size={12} />
                          </Button>
                        </div>
                        {compatibilityNotice}
                        <div className="quick-flags">
                          {flagOptions.slice(0, 3).map((f) => (
                            <div className="quick-flag" key={f.key}>
                              <Label htmlFor={f.key}>{f.label}</Label>
                              <Switch
                                id={f.key}
                                checked={form.flags[f.key]}
                                onCheckedChange={(v) => flag(f.key, v)}
                              />
                            </div>
                          ))}
                        </div>
                        <Accordion
                          type="single"
                          collapsible
                          className="advanced-accordion"
                        >
                          <AccordionItem value="advanced" className="border-0">
                            <AccordionTrigger className="advanced-trigger">
                              <span>
                                <SlidersHorizontal size={16} />
                                高级设置<small>筛选、重命名及更多选项</small>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <Tabs defaultValue="filter">
                                <TabsList className="w-full">
                                  <TabsTrigger value="filter">
                                    节点处理
                                  </TabsTrigger>
                                  <TabsTrigger value="options">
                                    协议选项
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="filter">
                                  <div className="two-fields advanced-fields">
                                    {(
                                      [
                                        {
                                          key: "include",
                                          label: "包含节点",
                                          placeholder: "香港|日本，支持正则",
                                        },
                                        {
                                          key: "exclude",
                                          label: "排除节点",
                                          placeholder:
                                            "到期|剩余流量，支持正则",
                                        },
                                        {
                                          key: "rename",
                                          label: "节点重命名",
                                          placeholder: "原名称@新名称",
                                        },
                                        {
                                          key: "filename",
                                          label: "订阅文件名",
                                          placeholder: "我的订阅",
                                        },
                                        {
                                          key: "interval",
                                          label: "更新间隔（天）",
                                          placeholder: "例如 1",
                                        },
                                        {
                                          key: "diyua",
                                          label: "自定义 User-Agent",
                                          placeholder: "例如 ShadowRocket",
                                        },
                                        {
                                          key: "dev_id",
                                          label: "Quantumult X 设备 ID",
                                          placeholder: "可选",
                                        },
                                      ] as const
                                    ).map((f) => (
                                      <Field key={f.key} label={f.label}>
                                        <Input
                                          aria-label={f.label}
                                          value={form[f.key]}
                                          placeholder={f.placeholder}
                                          onChange={(e) =>
                                            update(f.key, e.target.value)
                                          }
                                        />
                                      </Field>
                                    ))}
                                  </div>
                                </TabsContent>
                                <TabsContent value="options">
                                  <div className="advanced-flags">
                                    {flagOptions.slice(3).map((f) => (
                                      <div
                                        className="advanced-flag"
                                        key={f.key}
                                      >
                                        <div>
                                          <Label htmlFor={f.key}>
                                            {f.label}
                                          </Label>
                                          <p>{f.hint}</p>
                                        </div>
                                        <Switch
                                          id={f.key}
                                          checked={form.flags[f.key]}
                                          onCheckedChange={(v) =>
                                            flag(f.key, v)
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </section>
                      <div className="form-actions">
                        <Button variant="ghost" onClick={reset}>
                          <RotateCcw size={14} />
                          重置配置
                        </Button>
                        <Button
                          className="generate-button"
                          onClick={generate}
                          disabled={
                            busy !== null || compatibility.errors.length > 0
                          }
                        >
                          <WandSparkles size={17} />
                          生成订阅链接
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    ref={resultRef}
                    className={cn("result-card", result && "has-result")}
                  >
                    <CardContent>
                      <div className="result-heading">
                        <div>
                          <span className="result-icon">
                            <Link2 size={16} />
                          </span>
                          <h2>转换结果</h2>
                          {result && <Badge variant="secondary">已生成</Badge>}
                        </div>
                        <span>READY TO CONNECT</span>
                      </div>
                      <Tabs value={resultTab} onValueChange={setResultTab}>
                        <TabsList>
                          <TabsTrigger value="link">订阅链接</TabsTrigger>
                          <TabsTrigger value="short">短链接</TabsTrigger>
                        </TabsList>
                        <TabsContent value="link">
                          {result ? (
                            <div className="result-output">
                              <Textarea
                                aria-label="生成的订阅链接"
                                value={result}
                                readOnly
                              />
                              <Button onClick={() => copy(result)}>
                                <Copy size={15} />
                                复制链接
                              </Button>
                            </div>
                          ) : (
                            <div className="result-empty">
                              <span className="empty-link">
                                <Link2 size={23} />
                              </span>
                              <div>
                                <p>下一次连接，从这里开始</p>
                                <small>
                                  填写订阅并点击「生成订阅链接」，结果将显示在这里。
                                </small>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="short">
                          <Field label="短链服务">
                            <Select value={shortService} disabled={busy !== null} onValueChange={(value) => { setShortService(value); setShortResult(""); }}>
                              <SelectTrigger aria-label="短链服务" className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectGroup><SelectLabel>预设服务 · FFQ 网关</SelectLabel>
                                {shortServices.map((service) => <SelectItem key={service.value} value={service.value}>{service.label}{["dljtf", "subcm"].includes(service.value) ? " · 暂不可用" : ""}</SelectItem>)}
                                <SelectItem value="custom">自定义 API（偏好设置）</SelectItem>
                              </SelectGroup></SelectContent>
                            </Select>
                            <p className="field-hint">{shortService === "custom" ? "使用偏好设置中的自定义 /short API。" : `2026-09-12 测试：${shortServices.find((service) => service.value === shortService)?.note}`}</p>
                          </Field>
                          <div className="short-form">
                            <Input
                              aria-label="自定义短链后缀"
                              placeholder="自定义短链后缀（可选）"
                              value={shortKey}
                              onChange={(e) => setShortKey(e.target.value)}
                            />
                            <Button
                              disabled={!result || busy !== null}
                              onClick={shorten}
                            >
                              {busy === "short" ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Zap size={15} />
                              )}
                              生成短链
                            </Button>
                          </div>
                          <p className="field-hint">
                            {result
                              ? shortService === "custom" ? "生成时将完整订阅链接发送至偏好设置中的短链服务。" : "生成时完整订阅链接经本站服务端发送至 FFQ 网关及所选短链服务。"
                              : "请先生成订阅链接。"}
                          </p>
                          {shortResult && (
                            <div className="short-form mt-3">
                              <Input
                                aria-label="生成的短链接"
                                value={shortResult}
                                readOnly
                              />
                              <Button
                                variant="outline"
                                onClick={() => copy(shortResult)}
                              >
                                <Copy size={15} />
                                复制
                              </Button>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
                <aside className="summary-column">
                  <Card className="summary-card">
                    <CardContent>
                      <div className="summary-heading">
                        <span>
                          <Settings2 size={17} />
                          配置概览
                        </span>
                        <Badge variant="outline">
                          <span className="green-dot" />
                          实时
                        </Badge>
                      </div>
                      <div className="flow-visual">
                        <div className="flow-source">
                          <span>
                            <Link2 size={20} />
                          </span>
                          <small>订阅来源</small>
                        </div>
                        <div className="flow-line">
                          <span />
                          <ArrowRight size={14} />
                          <span />
                        </div>
                        <div className="flow-target">
                          <span>{client.mark}</span>
                          <small>
                            {form.client === "clash"
                              ? "Mihomo / Meta"
                              : client.label}
                          </small>
                        </div>
                      </div>
                      <dl className="summary-details">
                        <div>
                          <dt>订阅数量</dt>
                          <dd>
                            {sources.length || "0"} <span>个链接</span>
                          </dd>
                        </div>
                        <div>
                          <dt>目标格式</dt>
                          <dd>
                            {form.client === "clash"
                              ? "Mihomo / Meta"
                              : client.label}
                            <Badge variant="secondary">
                              {getClientTarget(form.client) === "clash"
                                ? "YAML"
                                : form.client === "singbox"
                                  ? "JSON"
                                  : "CONFIG"}
                            </Badge>
                          </dd>
                        </div>
                        <div>
                          <dt>转换后端</dt>
                          <dd>
                            {backendOptions.find(
                              (b) => b.value === form.backend,
                            )?.label || "自定义后端"}
                          </dd>
                        </div>
                        <div>
                          <dt>远程配置</dt>
                          <dd
                            className="truncate max-w-40"
                            title={selectedRule?.name || form.config}
                          >
                            {selectedRule
                              ? selectedRule.name === "默认"
                                ? "ACL4SSR 默认规则"
                                : selectedRule.name
                              : form.config
                                ? "自定义配置"
                                : "后端默认"}
                          </dd>
                        </div>
                      </dl>
                      <Separator />
                      <div className="summary-flags">
                        <span>已启用选项</span>
                        <div>
                          {activeFlags.map((f) => (
                            <Badge variant="secondary" key={f.key}>
                              <Check size={10} />
                              {f.label}
                            </Badge>
                          ))}
                          {!activeFlags.length && <small>暂无</small>}
                        </div>
                      </div>
                      <div className="summary-foot">
                        <span className="green-dot" />
                        {sources.length
                          ? "已添加订阅，可以生成链接"
                          : "等待添加你的第一个订阅"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="tip-card">
                    <CardContent>
                      <div className="tip-heading">
                        <span>
                          <Sparkles size={17} />
                        </span>
                        <h3>少一点配置，多一点自由。</h3>
                      </div>
                      <p>
                        一个订阅，多个客户端。
                        <br />
                        切换设备，也不用重新开始。
                      </p>
                      <div className="tip-orbit">
                        <span className="orbit-node">
                          <Globe2 size={16} />
                        </span>
                        <span className="orbit-path" />
                        <span className="orbit-main">
                          <ArrowLeftRight size={22} />
                        </span>
                        <span className="orbit-path" />
                        <span className="orbit-node">
                          <Layers3 size={16} />
                        </span>
                      </div>
                      <Button
                        variant="link"
                        onClick={() => {
                          setMobileNav(false);
                          setModal("help");
                        }}
                      >
                        第一次使用？查看快速指南 <ArrowUpRight size={13} />
                      </Button>
                    </CardContent>
                  </Card>
                  <div className="sidebar-resource">
                    <div className="resource-icon">
                      <Code2 size={17} />
                    </div>
                    <div>
                      <h3>有自己的配置？</h3>
                      <p>导入远程规则，让订阅更懂你。</p>
                      <Button
                        variant="link"
                        onClick={() => {
                          setConfigInput(form.config);
                          setModal("config");
                        }}
                      >
                        自定义配置 <ArrowRight size={12} />
                      </Button>
                    </div>
                  </div>
                  <div className="compatibility">
                    <span>兼容主流订阅协议</span>
                    <p>
                      SS <i /> VMess <i /> VLESS <i /> Trojan
                    </p>
                    <p>
                      Hysteria <i /> TUIC <i /> 更多
                    </p>
                  </div>
                </aside>
              </div>
            )}

            {page === "rules" && (
              <>
                <div className="library-toolbar">
                  <div className="search-field">
                    <Search size={17} />
                    <Input
                      aria-label="搜索规则"
                      placeholder="搜索规则名称或地址…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      setConfigInput("");
                      setModal("config");
                    }}
                  >
                    <Plus size={16} />
                    自定义配置
                  </Button>
                </div>
                <div className="rule-grid">
                  {rules
                    .filter((r) =>
                      `${r.name} ${r.url}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((r, i) => (
                      <Card
                        key={`${r.url}-${i}`}
                        className={cn(
                          "rule-card",
                          form.config === r.url && "selected-rule",
                        )}
                      >
                        <CardContent>
                          <div className="rule-icon">
                            <FileSliders size={21} />
                          </div>
                          <h3>
                            {r.name === "默认"
                              ? "ACL4SSR · 全分组默认版"
                              : r.name}
                          </h3>
                          <p>
                            {aethersailorResource(r.url) === "template"
                              ? "现代 Mihomo 内核 · 保留 MRS Provider"
                              : r.url.includes("ACL4SSR")
                                ? "ACL4SSR 社区规则"
                                : "社区远程配置"}
                          </p>
                          <div className="rule-url" title={r.url}>
                            {r.url}
                          </div>
                          <Button
                            variant={
                              form.config === r.url ? "secondary" : "outline"
                            }
                            onClick={() => {
                              chooseRule(r.url);
                              go("convert");
                              toast.success(`已应用「${r.name}」`);
                            }}
                          >
                            {form.config === r.url ? (
                              <Check size={14} />
                            ) : (
                              <Plus size={14} />
                            )}
                            {form.config === r.url ? "当前配置" : "使用此配置"}
                            <ArrowRight size={14} />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
                {!rules.some((r) =>
                  `${r.name} ${r.url}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ) && (
                  <div className="large-empty">
                    <Search size={32} />
                    <h3>没有找到匹配的规则</h3>
                    <p>换个关键词，或添加自己的配置。</p>
                    <Button variant="outline" onClick={() => setQuery("")}>
                      清空搜索
                    </Button>
                  </div>
                )}
              </>
            )}

            {page === "history" && (
              <Card className="history-card">
                <CardContent>
                  <div className="panel-title">
                    <h2>
                      最近转换{" "}
                      <Badge variant="secondary">{history.length}</Badge>
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!history.length}
                      onClick={() => {
                        setHistory([]);
                        persist([]);
                        toast.success("历史记录已清空");
                      }}
                    >
                      <Trash2 size={14} />
                      清空历史
                    </Button>
                  </div>
                  <p className="muted-paragraph">
                    {saveHistory
                      ? "最多保存 20 条记录，仅保存在当前浏览器。"
                      : "当前仅保留本次会话记录。可在偏好设置中开启本地保存。"}
                  </p>
                  {history.length ? (
                    <div className="history-list">
                      {history.map((e) => (
                        <div className="history-row" key={e.time}>
                          <span className="history-symbol">
                            <Clock3 size={19} />
                          </span>
                          <div>
                            <h3>
                              {e.client} 订阅{" "}
                              <Badge variant="outline">{e.count} 个来源</Badge>
                            </h3>
                            <p>{new Date(e.time).toLocaleString("zh-CN")}</p>
                          </div>
                          <div className="history-actions">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                try {
                                  const parsed = parseSubscription(e.url);
                                  if (
                                    e.clientId &&
                                    clients.some(
                                      (c) => c.value === e.clientId,
                                    ) &&
                                    getClientTarget(e.clientId) ===
                                      getClientTarget(parsed.client)
                                  ) {
                                    parsed.client = e.clientId;
                                    buildSubscription(parsed);
                                  }
                                  setForm(parsed);
                                  setCustomBackend(
                                    !backendOptions.some(
                                      (b) => b.value === parsed.backend,
                                    ),
                                  );
                                  go("convert");
                                  toast.success("历史配置已恢复");
                                } catch (err) {
                                  toast.error(errorMessage(err));
                                }
                              }}
                            >
                              恢复配置
                            </Button>
                            <IconButton
                              label="复制历史订阅"
                              onClick={() => copy(e.url)}
                            >
                              <Copy size={16} />
                            </IconButton>
                            <IconButton
                              label="删除此条记录"
                              onClick={() => {
                                const next = history.filter(
                                  (h) => h.time !== e.time,
                                );
                                setHistory(next);
                                persist(next);
                              }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="large-empty">
                      <History size={35} />
                      <h3>新的连接，值得记录</h3>
                      <p>生成你的第一个订阅后，记录会出现在这里。</p>
                      <Button onClick={() => go("convert")}>
                        开始转换 <ArrowRight size={15} />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {page === "settings" && (
              <div className="settings-grid">
                <Card>
                  <CardContent>
                    <div className="panel-title">
                      <h2>
                        <Server size={19} />
                        外部服务
                      </h2>
                    </div>
                    <p className="muted-paragraph">
                      沿用参考项目的 API 协议，可替换为自己部署的服务。
                    </p>
                    <Field label="转换后端">
                      <div className="short-form">
                        <Input
                          aria-label="设置转换后端"
                          value={form.backend}
                          onChange={(e) => {
                            update("backend", e.target.value);
                            setCustomBackend(true);
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={checkBackend}
                          disabled={busy !== null}
                        >
                          {busy === "backend" ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Network size={15} />
                          )}
                          检测
                        </Button>
                      </div>
                      <span className="field-hint">
                        {backendReport
                          ? `${backendReport.version} · ${backendReport.status === "passed" ? "标准模板实测通过" : "尚未验证"}`
                          : backendStatus}
                      </span>
                      {backendReport && (
                        <Alert>
                          <Network />
                          <AlertTitle>
                            {backendReport.status === "passed"
                              ? "标准模板实测通过"
                              : backendReport.versionHint
                                ? "版本具备兼容线索，实测尚未通过"
                                : "兼容性尚未验证"}
                          </AlertTitle>
                          <AlertDescription>
                            <p>{backendReport.detail}</p>
                            <p>
                              检测时间：
                              {new Date(backendReport.testedAt).toLocaleString(
                                "zh-CN",
                              )}
                            </p>
                          </AlertDescription>
                        </Alert>
                      )}
                      <p className="field-hint">
                        检测会读取版本并使用虚构节点验证标准模板，不发送当前订阅。
                      </p>
                    </Field>
                    <Field
                      label="自定义短链接 API"
                      hint="在结果区选择「自定义 API」时使用；兼容 /short 的 longUrl 与 shortKey 参数。预设域名通过 FFQ 网关生成。"
                    >
                      <Input
                        aria-label="短链接 API"
                        value={shortApi}
                        onChange={(e) => setShortApi(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="配置上传 API"
                      hint="兼容 sub-web-api /sub.php 接口。"
                    >
                      <Input
                        aria-label="配置上传 API"
                        value={uploadApi}
                        onChange={(e) => setUploadApi(e.target.value)}
                      />
                    </Field>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <div className="panel-title">
                      <h2>
                        <Settings2 size={19} />
                        使用偏好
                      </h2>
                    </div>
                    <div className="preference-row">
                      <div>
                        <Label htmlFor="theme-switch">深色模式</Label>
                        <p>让夜间使用更舒适</p>
                      </div>
                      <Switch
                        id="theme-switch"
                        checked={dark}
                        onCheckedChange={toggleTheme}
                      />
                    </div>
                    <Separator />
                    <div className="preference-row">
                      <div>
                        <Label htmlFor="history-switch">本地保存转换历史</Label>
                        <p>包含完整订阅链接，仅在此浏览器保存</p>
                      </div>
                      <Switch
                        id="history-switch"
                        checked={saveHistory}
                        onCheckedChange={(v) => {
                          setSaveHistory(v);
                          try {
                            localStorage.setItem(
                              "subrule-history-enabled",
                              String(v),
                            );
                            if (v) persist(history, true);
                            else localStorage.removeItem("subrule-history");
                          } catch {
                            toast.error("浏览器存储不可用");
                          }
                        }}
                      />
                    </div>
                    <Separator />
                    <div className="settings-note">
                      <ShieldCheck size={19} />
                      <p>
                        表单不会自动上传。访问转换链接时，所选后端会读取你的订阅；生成短链或上传配置时，内容会发送至对应服务。
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <footer className="footer">
              <span>
                SubRule <span className="footer-dot">·</span> 让每一次连接更简单
              </span>
              <div>
                <span>Built with shadcn/ui</span>
                <span className="footer-dot">/</span>
                <Button
                  variant="link"
                  onClick={() => {
                    setMobileNav(false);
                    setModal("help");
                  }}
                >
                  使用帮助 <ArrowUpRight size={12} />
                </Button>
              </div>
            </footer>
          </main>
        </div>

        <Dialog
          open={modal !== null}
          onOpenChange={(open) => {
            if (!open && !busy) setModal(null);
          }}
        >
          <DialogContent className={cn(modal === "help" && "help-dialog")}>
            <DialogHeader>
              <DialogTitle>
                {modal === "parse"
                  ? "从 URL 导入"
                  : modal === "config"
                    ? "自定义远程配置"
                    : "连接，只需三步"}
              </DialogTitle>
              <DialogDescription>
                {modal === "parse"
                  ? "粘贴已转换的订阅链接，自动恢复客户端、规则和高级参数。"
                  : modal === "config"
                    ? "使用已有配置链接，或将配置上传到你指定的托管服务。"
                    : "沿用熟悉的订阅转换流程，适配你喜欢的客户端。"}
              </DialogDescription>
            </DialogHeader>
            {modal === "parse" && (
              <>
                <Textarea
                  aria-label="待解析的订阅链接"
                  className="min-h-36"
                  placeholder="https://your-backend.com/sub?target=clash&url=…"
                  value={parseInput}
                  onChange={(e) => setParseInput(e.target.value)}
                />
                <div className="dialog-note">
                  <CircleHelp size={16} />
                  <span>
                    支持完整转换链接与短链接。解析短链需要该服务允许跨域访问。
                  </span>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setModal(null)}
                    disabled={busy !== null}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={parse}
                    disabled={!parseInput.trim() || busy !== null}
                  >
                    {busy === "parse" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <WandSparkles size={15} />
                    )}
                    解析并导入
                  </Button>
                </DialogFooter>
              </>
            )}
            {modal === "config" && (
              <>
                <Tabs value={configTab} onValueChange={setConfigTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="url">
                      <Link2 size={14} />
                      远程链接
                    </TabsTrigger>
                    <TabsTrigger value="upload">
                      <Upload size={14} />
                      上传配置
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="url">
                    <Field label="配置文件 URL">
                      <Input
                        aria-label="配置文件 URL"
                        placeholder="https://example.com/config.ini"
                        value={configInput}
                        onChange={(e) => setConfigInput(e.target.value)}
                      />
                    </Field>
                  </TabsContent>
                  <TabsContent value="upload">
                    <div className="upload-toolbar">
                      <span>INI / YAML / JSON</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        <FileCode2 size={14} />
                        导入文件
                      </Button>
                      <Input
                        type="file"
                        ref={fileRef}
                        className="hidden"
                        accept=".ini,.yaml,.yml,.json,.txt"
                        aria-label="导入配置文件"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 50000)
                              toast.error("文件不能超过 50 KB");
                            else setConfigContent(await file.text());
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <Textarea
                      aria-label="配置文件内容"
                      className="min-h-52 font-mono text-xs"
                      value={configContent}
                      maxLength={50000}
                      onChange={(e) => setConfigContent(e.target.value)}
                      placeholder={"[custom]\n; 在此粘贴你的配置内容"}
                    />
                    <p className="field-hint">
                      {configContent.length} / 50,000 字符 · 上传至 {uploadApi}
                    </p>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setModal(null)}
                    disabled={busy !== null}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={applyConfig}
                    disabled={
                      busy !== null ||
                      !(configTab === "url"
                        ? configInput.trim()
                        : configContent.trim())
                    }
                  >
                    {busy === "config" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {configTab === "upload" ? "上传并应用" : "应用配置"}
                  </Button>
                </DialogFooter>
              </>
            )}
            {modal === "help" && (
              <>
                <div className="guide-steps">
                  {[
                    {
                      title: "添加你的订阅",
                      text: "粘贴订阅地址或单节点链接。多个订阅换行输入，将自动去重合并。",
                      icon: Clipboard,
                    },
                    {
                      title: "选择客户端与规则",
                      text: "选择目标格式、可信的转换后端以及远程配置，需要时展开高级设置。",
                      icon: SlidersHorizontal,
                    },
                    {
                      title: "生成并复制链接",
                      text: "点击生成，将结果粘贴到客户端的订阅地址中，即可获取转换后的配置。",
                      icon: ArrowDown,
                    },
                  ].map((s, i) => (
                    <div key={s.title}>
                      <span className="guide-number">0{i + 1}</span>
                      <div>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                      </div>
                      <s.icon size={20} />
                    </div>
                  ))}
                </div>
                <div className="dialog-note">
                  <ShieldCheck size={18} />
                  <span>
                    生成转换 URL
                    在本地完成，实际转换由所选后端执行。第三方后端与规则的可用性由各服务维护者提供。
                  </span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setModal(null);
                    go("convert");
                  }}
                >
                  开始我的第一次转换 <ArrowRight size={15} />
                </Button>
                <Button variant="link" asChild>
                  <a
                    href="https://github.com/youshandefeiyang/sub-web-modify"
                    target="_blank"
                    rel="noreferrer"
                  >
                    参考项目与使用文档 <ArrowUpRight size={13} />
                  </a>
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Toaster
          position="top-center"
          richColors
          theme={dark ? "dark" : "light"}
        />
      </div>
    </TooltipProvider>
  );
}
