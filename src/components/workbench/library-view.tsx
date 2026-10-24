import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button, buttonVariants } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { ChoiceSelect } from "./controls";
import { copyText } from "#/hooks/use-workbench";
import {
  templateFamilies,
  targetLabels,
  presetLabel,
} from "#/lib/template-library";
import type { TemplateFamily, LibraryEntry } from "#/lib/template-library";
import type { TemplateCatalog } from "#/lib/template-catalog";

function TemplateDetails({
  family,
  selected,
  apply,
  prefix,
  preferred,
}: {
  family: TemplateFamily;
  selected: string;
  apply: (url: string) => void;
  prefix: string;
  preferred?: LibraryEntry;
}) {
  const current = family.entries.find((e) => e.url === selected) || preferred;
  const [profile, setProfile] = useState(
    current?.profile || family.defaultProfile || "",
  );
  const profileIds = (
    family.profileOrder || [
      ...new Set(
        family.entries.map((e) => e.profile).filter((id): id is string => !!id),
      ),
    ]
  ).filter((id) => family.entries.some((e) => e.profile === id));
  const scheme = profileIds.includes(profile) ? profile : profileIds[0];
  const profiled = scheme
    ? family.entries.filter((e) => e.profile === scheme)
    : family.entries;
  const [kind, setKind] = useState(
    current?.kind ||
      (profiled.some((e) => e.kind === "conversion-template")
        ? "conversion-template"
        : "runtime-template"),
  );
  const [target, setTarget] = useState(current?.target || "clash");
  const [variant, setVariant] = useState(current?.variant || "");
  const kinds = [...new Set(profiled.map((e) => e.kind))];
  const mode = kinds.includes(kind) ? kind : kinds[0];
  const entries = profiled.filter((e) => e.kind === mode);
  const targets = [...new Set(entries.map((e) => e.target))];
  const platform = targets.includes(target)
    ? target
    : targets.includes("clash")
      ? "clash"
      : targets[0];
  const variants = entries.filter((e) => e.target === platform);
  const entry =
    variants.find((e) => e.variant === variant) ||
    variants.find(
      (e) => e.variant.endsWith("-fallback") === variant.endsWith("-fallback"),
    ) ||
    variants[0];
  return (
    <div className="template-detail-content">
      <div className="template-detail-title">
        <div className="template-detail-source">
          <span>{family.source}</span>
          {selected === entry.url && (
            <span className="success">
              <Check />
              当前使用
            </span>
          )}
        </div>
        <h2>{family.name}</h2>
      </div>
      <div className="template-detail-fields">
        {profileIds.length > 0 && (
          <div className="template-profile-field">
            <ChoiceSelect
              id={`${prefix}-profile`}
              label="过滤方案"
              value={scheme}
              onChange={setProfile}
              choices={profileIds.map((id) => ({
                value: id,
                label:
                  family.entries.find((e) => e.profile === id)?.profileName ||
                  id,
              }))}
            />
            <p className="template-requirement">{entry.profileDescription}</p>
          </div>
        )}

        {kinds.length > 1 ? (
          <ChoiceSelect
            id={`${prefix}-kind`}
            label="使用方式"
            value={mode}
            onChange={(value) => setKind(value as typeof kind)}
            choices={[
              { value: "conversion-template", label: "生成订阅链接" },
              { value: "runtime-template", label: "下载运行配置" },
            ]}
          />
        ) : (
          <div className="template-fact">
            <span>使用方式</span>
            <strong>
              {mode === "conversion-template" ? "生成订阅链接" : "下载运行配置"}
            </strong>
          </div>
        )}
        {targets.length > 1 ? (
          <ChoiceSelect
            id={`${prefix}-target`}
            label="客户端"
            value={platform}
            onChange={setTarget}
            choices={targets.map((t) => ({ value: t, label: targetLabels[t] }))}
          />
        ) : (
          <div className="template-fact">
            <span>适用客户端</span>
            <strong>{targetLabels[platform]}</strong>
          </div>
        )}
        {variants.length > 1 && (
          <ChoiceSelect
            id={`${prefix}-variant`}
            label={platform === "generic" ? "分流预设" : "切换方式"}
            value={entry.variant}
            onChange={setVariant}
            choices={variants.map((e) => ({
              value: e.variant,
              label: presetLabel(e),
            }))}
          />
        )}
      </div>
      {entry.capabilities.includes("mrs") && mode === "conversion-template" && (
        <p className="template-requirement">使用增强后端以保留远程规则集合。</p>
      )}
      {mode === "runtime-template" && (
        <p className="template-requirement">下载后在本地填入订阅地址。</p>
      )}
      <div className="template-detail-actions">
        {mode === "conversion-template" ? (
          <Button onClick={() => apply(entry.url)}>
            使用此模板
            <ArrowRight />
          </Button>
        ) : (
          <a
            className={buttonVariants()}
            href={entry.url}
            target="_blank"
            rel="noreferrer"
          >
            打开配置
            <ExternalLink />
          </a>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="复制模板链接"
          onClick={() => void copyText(entry.url)}
        >
          <Copy />
        </Button>
      </div>
      <a
        className="template-source-link"
        href={entry.url}
        target="_blank"
        rel="noreferrer"
      >
        查看源文件
        <ExternalLink />
      </a>
    </div>
  );
}

export function LibraryView({
  catalog,
  status,
  refresh,
  selected,
  apply,
  custom,
  back,
}: {
  catalog: TemplateCatalog;
  status: string;
  refresh: () => void;
  selected: string;
  apply: (url: string) => void;
  custom: () => void;
  back: () => void;
}) {
  const families = templateFamilies(catalog);
  const preferred = families
    .flatMap((f) => f.entries)
    .find((e) => e.url === selected);
  const [query, setQuery] = useState(""),
    [source, setSource] = useState("all"),
    [kind, setKind] = useState("all");
  const [familyId, setFamilyId] = useState(
    () =>
      families.find((f) => f.entries.some((e) => e.url === selected))?.id ||
      families[0]?.id,
  );
  const [mobile, setMobile] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    const media = matchMedia("(max-width: 900px)");
    const changed = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    changed();
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const visible = families
    .filter((f) => source === "all" || f.source === source)
    .map((f) => ({
      ...f,
      entries: f.entries.filter((e) => kind === "all" || e.kind === kind),
    }))
    .filter(
      (f) =>
        f.entries.length &&
        `${f.name} ${f.source} ${f.summary} ${f.entries.map((e) => e.name).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const active = visible.find((f) => f.id === familyId) || visible[0];
  return (
    <section className="template-browser">
      <div className="template-browser-toolbar">
        <Button variant="ghost" onClick={back}>
          <ArrowLeft />
          返回转换
        </Button>
        <div>
          <Button
            variant="ghost"
            aria-label="刷新模板目录"
            disabled={status === "loading"}
            onClick={refresh}
          >
            {status === "loading" ? (
              <Loader2 className="spin" />
            ) : (
              <RefreshCw />
            )}
          </Button>
          <Button variant="outline" onClick={custom}>
            <Plus />
            添加模板
          </Button>
        </div>
      </div>
      <div className="template-browser-filters">
        <div className="search-field">
          <Search />
          <Input
            aria-label="搜索模板"
            placeholder="搜索模板或服务"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ChoiceSelect
          id="模板来源"
          value={source}
          onChange={setSource}
          choices={[
            { value: "all", label: "全部来源" },
            ...[...new Set(families.map((f) => f.source))].map((s) => ({
              value: s,
              label: s,
            })),
          ]}
        />
        <ChoiceSelect
          id="模板用途"
          value={kind}
          onChange={setKind}
          choices={[
            { value: "all", label: "全部用途" },
            { value: "conversion-template", label: "订阅转换" },
            { value: "runtime-template", label: "运行配置" },
          ]}
        />
      </div>
      <div className="template-browser-layout">
        <div className="template-family-list" aria-label="模板系列">
          {visible.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`template-family ${active?.id === f.id ? "selected" : ""}`}
              aria-pressed={active?.id === f.id}
              onClick={() => {
                setFamilyId(f.id);
                if (mobile) setOpen(true);
              }}
            >
              <div>
                <span className="template-family-source">{f.source}</span>
                <strong>{f.name}</strong>
                {f.summary && (
                  <span className="template-family-summary">{f.summary}</span>
                )}
              </div>
              <ArrowRight />
            </button>
          ))}
          {!visible.length && (
            <div className="template-no-results">
              <p>没有匹配的模板</p>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setSource("all");
                  setKind("all");
                }}
              >
                清除筛选
              </Button>
            </div>
          )}
        </div>
        {active && !mobile && (
          <aside className="template-detail" aria-label="模板设置">
            <TemplateDetails
              key={active.id + kind}
              prefix="template-detail"
              preferred={preferred}
              family={active}
              selected={selected}
              apply={apply}
            />
          </aside>
        )}
      </div>
      <div className="catalog-foot">
        <span>{visible.length} 个模板系列</span>
        <span>
          {status === "loading"
            ? "正在更新目录"
            : status === "current"
              ? "目录已更新"
              : "内置目录"}
        </span>
      </div>
      <Dialog open={open && mobile} onOpenChange={setOpen}>
        <DialogContent className="template-mobile-detail">
          <DialogHeader>
            <DialogTitle className="sr-only">模板设置</DialogTitle>
          </DialogHeader>
          {active && (
            <TemplateDetails
              key={active.id + kind}
              prefix="mobile-template"
              preferred={preferred}
              family={active}
              selected={selected}
              apply={(url) => {
                setOpen(false);
                apply(url);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
