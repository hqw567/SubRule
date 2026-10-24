import { AdvancedDialog } from "./advanced-dialog";
import { advancedCount } from "#/lib/advanced-options";
import { templateSource } from "#/lib/template-library";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RotateCcw,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { ChoiceSelect, Field, RouteMark } from "./controls";
import { clients, getClientTarget } from "#/lib/converter";
import { backendOptions, communityRules, shortServices } from "#/lib/catalog";
import type { TemplateCatalog } from "#/lib/template-catalog";
import type { Workbench } from "#/hooks/use-workbench";
import { copyText } from "#/hooks/use-workbench";

export function ConvertView({
  work,
  catalog,
  onTemplateSelect,
}: {
  work: Workbench;
  catalog: TemplateCatalog;
  onTemplateSelect: () => void;
}) {
  const { form, update, compatibility } = work;
  const [customBackend, setCustomBackend] = useState(false);
  const [shortOpen, setShortOpen] = useState(false);
  const target = getClientTarget(form.client);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const source = form.config ? templateSource(form.config, catalog) : "";
  const templateName = (
    compatibility.template?.name ||
    communityRules.find((rule) => rule.url === form.config)?.name ||
    (form.config ? "自定义模板" : "后端默认")
  ).replace(/^Aethersailor · /, "");
  const filterProfile = catalog.profiles.find(
    (p) => p.id === compatibility.template?.profile,
  );
  const overrides = advancedCount(form, compatibility.template?.requiredFlags);
  const clientLabel =
    clients.find((c) => c.value === form.client)?.label || form.client;
  const result = work.shortResult || work.result;
  return (
    <div className="conversion-layout">
      <section className="editor-column" aria-label="订阅配置">
        <div className="source-heading">
          <label htmlFor="subscription-source">订阅链接</label>
          {work.sourceCount > 0 && (
            <span className="source-count">{work.sourceCount} 个来源</span>
          )}
        </div>
        <div className="source-editor">
          <Textarea
            id="subscription-source"
            value={form.source}
            onChange={(e) => update("source", e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                work.generate();
              }
            }}
            placeholder={"https://…\n\n每行一个订阅，或粘贴节点链接"}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="source-editor-foot">
            <span aria-hidden="true" />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  update("source", await navigator.clipboard.readText());
                } catch {
                  /* Native paste remains available. */
                }
              }}
            >
              粘贴
            </Button>
          </div>
        </div>
        <div className="configuration-fields">
          <div className="two-fields">
            <ChoiceSelect
              id="client"
              label="客户端"
              value={form.client}
              onChange={work.chooseClient}
              choices={clients.map((c) => ({
                value: c.value,
                label: c.label,
                group: c.group,
              }))}
            />
            <Field id="choose-template" label="分流模板">
              <Button
                id="choose-template"
                variant="outline"
                className="template-picker"
                onClick={onTemplateSelect}
              >
                <span>{templateName}</span>
                <span>{filterProfile?.name || source}</span>
                <ArrowRight />
              </Button>
            </Field>
          </div>
          <div className="backend-row">
            <ChoiceSelect
              id="backend"
              label="转换后端"
              value={
                customBackend ||
                !backendOptions.some((b) => b.value === form.backend)
                  ? "__custom"
                  : form.backend
              }
              onChange={(v) => {
                if (v === "__custom") setCustomBackend(true);
                else {
                  setCustomBackend(false);
                  update("backend", v);
                }
              }}
              choices={[
                ...work.backendChoices,
                { value: "__custom", label: "填写后端地址", group: "自建后端" },
              ]}
            />
            <Button
              variant="outline"
              className="probe-button"
              disabled={!work.profile || !!work.busy}
              onClick={() => void work.inspect()}
              aria-label="检测当前模板与后端"
            >
              {work.busy === "probe" ? (
                <Loader2 className="spin" />
              ) : work.report?.status === "passed" ? (
                <Check />
              ) : (
                <ScanLine />
              )}
              <span>检测</span>
            </Button>
          </div>
          {(customBackend ||
            !backendOptions.some((b) => b.value === form.backend)) && (
            <Field id="custom-backend" label="后端地址">
              <Input
                id="custom-backend"
                value={form.backend}
                onChange={(e) => update("backend", e.target.value)}
                placeholder="https://your-backend.example"
              />
            </Field>
          )}
          {work.report && (
            <p
              className={`inline-status ${work.report.status === "passed" ? "success" : ""}`}
              role="status"
            >
              {work.report.detail}
            </p>
          )}
          {!!compatibility.errors.length && (
            <div className="inline-error" role="alert">
              {compatibility.errors.join(" ")}
            </div>
          )}
          {!!compatibility.warnings.length && (
            <p className="compatibility-note">
              {compatibility.warnings.join(" ")}
            </p>
          )}
        </div>
        <div className="advanced-entry">
          <Button variant="ghost" onClick={() => setAdvancedOpen(true)}>
            <SlidersHorizontal />
            高级选项
            {overrides > 0 && (
              <span className="advanced-count">{overrides}</span>
            )}
          </Button>
          <span>{overrides > 0 ? "已自定义" : "推荐配置"}</span>
        </div>
        {advancedOpen && (
          <AdvancedDialog work={work} close={() => setAdvancedOpen(false)} />
        )}
        <div className="generate-row">
          <Button
            variant="ghost"
            size="icon"
            aria-label="重置配置"
            onClick={work.reset}
          >
            <RotateCcw />
          </Button>
          <Button
            className="generate-button"
            title="生成订阅（Ctrl / ⌘ + Enter）"
            onClick={() => {
              const url = work.generate();
              if (url)
                document.getElementById("conversion-result")?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "instant"
                    : "smooth",
                  block: "nearest",
                });
            }}
            disabled={compatibility.errors.length > 0}
          >
            生成订阅
            <ArrowRight />
          </Button>
        </div>
        {work.error && (
          <p className="inline-error" role="alert">
            {work.error}
          </p>
        )}
      </section>
      <aside className="output-column" aria-label="转换结果">
        <div className="recipe-panel">
          <div className="recipe-heading">
            <RouteMark />
            <span>当前配置</span>
            <span className="live-dot" aria-hidden="true" />
          </div>
          <ol className="recipe-path">
            <li>
              <span className="path-pin" />
              <div>
                <span className="recipe-key">来源</span>
                <strong>
                  {work.sourceCount ? `${work.sourceCount} 个订阅` : "等待输入"}
                </strong>
              </div>
            </li>
            <li>
              <span className="path-pin" />
              <div>
                <span className="recipe-key">规则</span>
                <strong>{templateName}</strong>
                {filterProfile && (
                  <span className="recipe-tags">{filterProfile.name}</span>
                )}
              </div>
            </li>
            <li>
              <span className="path-pin final" />
              <div>
                <span className="recipe-key">输出</span>
                <strong>{clientLabel}</strong>
              </div>
              <span className="format-tag">
                {["clash", "stash"].includes(target)
                  ? "YAML"
                  : target.toUpperCase().split("&")[0]}
              </span>
            </li>
          </ol>
        </div>
        <div
          id="conversion-result"
          className={`result-panel ${result ? "has-result" : ""}`}
          aria-live="polite"
        >
          <div className="result-heading">
            <span>订阅地址</span>
            {result && (
              <span className="result-ready">
                <Check />
                已生成
              </span>
            )}
          </div>
          {result ? (
            <>
              <Textarea
                aria-label="生成的订阅地址"
                value={result}
                readOnly
                className="result-url"
                spellCheck={false}
              />
              <div className="result-actions">
                <Button variant="outline" onClick={() => void copyText(result)}>
                  <Copy />
                  复制链接
                </Button>
                <Button variant="ghost" onClick={() => setShortOpen((v) => !v)}>
                  <Link2 />
                  短链接
                </Button>
              </div>
            </>
          ) : (
            <div className="result-empty">
              <Link2 />
              <p>生成的链接会出现在这里</p>
              <span>导入客户端即可使用</span>
            </div>
          )}
          {result && shortOpen && (
            <div className="short-panel">
              <ChoiceSelect
                id="short-service"
                label="短链服务"
                value={work.shortService}
                onChange={work.setShortService}
                choices={[
                  ...shortServices.map((s) => ({
                    value: s.value,
                    label: s.label,
                  })),
                  { value: "custom", label: "自定义 API" },
                ]}
              />
              <Field id="short-key" label="自定义后缀">
                <Input
                  id="short-key"
                  value={work.shortKey}
                  onChange={(e) => work.setShortKey(e.target.value)}
                  placeholder="可选"
                />
              </Field>
              <p className="privacy-note">
                完整订阅链接将由浏览器直接发送至所选短链服务。
              </p>
              <Button
                variant="outline"
                disabled={!!work.busy}
                onClick={() => void work.shorten()}
              >
                {work.busy === "short" && <Loader2 className="spin" />}
                生成短链接
              </Button>
            </div>
          )}
        </div>
        <a
          className="source-credit"
          href="https://github.com/hqw567/SubWeave-Rules"
          target="_blank"
          rel="noreferrer"
        >
          查看规则源文件
          <ExternalLink />
        </a>
      </aside>
    </div>
  );
}
