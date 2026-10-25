import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "#/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "#/components/ui/tabs";
import { Field } from "./controls";
import { flagApplies, flagOptions } from "#/lib/converter";
import type { Flag } from "#/lib/converter";
import {
  advancedOptions,
  defaultAdvanced,
  validateAdvanced,
} from "#/lib/advanced-options";
import type { Workbench } from "#/hooks/use-workbench";
const panes = [
  {
    id: "nodes",
    name: "节点处理",
    fields: [
      ["include", "保留节点", "名称或正则表达式"],
      ["exclude", "排除节点", "名称或正则表达式"],
      ["rename", "重命名", "旧名称@新名称"],
    ],
    flags: ["emoji", "sort", "append_type", "fdn", "insert"],
  },
  {
    id: "connection",
    name: "连接设置",
    fields: [],
    flags: ["udp", "tfo", "xudp", "tls13", "scv"],
  },
  {
    id: "output",
    name: "输出设置",
    fields: [
      ["filename", "文件名", "config.yaml"],
      ["interval", "更新间隔（天）", "默认"],
      ["diyua", "User-Agent", "默认"],
      ["dev_id", "设备 ID", "可选"],
    ],
    flags: [
      "list",
      "expand",
      "new_name",
      "clash.doh",
      "surge.doh",
      "singbox.ipv6",
    ],
  },
] as const;
export function AdvancedDialog({
  work,
  close,
}: {
  work: Workbench;
  close: () => void;
}) {
  const [draft, setDraft] = useState(() => advancedOptions(work.form));
  const [error, setError] = useState("");
  const required = work.compatibility.template?.requiredFlags || {};
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="advanced-dialog">
        <DialogHeader>
          <DialogTitle>高级选项</DialogTitle>
          <DialogDescription>“默认”继承订阅或后端设置。</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="nodes" className="advanced-tabs">
          <TabsList variant="line">
            {panes.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {panes.map((p) => (
            <TabsContent value={p.id} key={p.id} className="advanced-tab-panel">
              <div className="advanced-inputs">
                {p.fields.map(([key, label, placeholder]) => (
                  <Field key={key} id={`advanced-${key}`} label={label}>
                    <Input
                      id={`advanced-${key}`}
                      value={draft[key]}
                      placeholder={placeholder}
                      onChange={(e) => {
                        setError("");
                        setDraft((d) => ({ ...d, [key]: e.target.value }));
                      }}
                    />
                  </Field>
                ))}
              </div>
              <div className="tri-state-list">
                {p.flags
                  .filter((key) => flagApplies(key, work.form.format))
                  .map((key) => {
                    const option = flagOptions.find((f) => f.key === key)!;
                    const locked = required[key as keyof typeof required];
                    return (
                      <div className="tri-state-row" key={key}>
                        <span id={`advanced-label-${key}`}>{option.label}</span>
                        <RadioGroup
                          className="tri-state-options"
                          name={key}
                          aria-labelledby={`advanced-label-${key}`}
                          value={
                            draft.flags[key as Flag] === null
                              ? "default"
                              : String(draft.flags[key as Flag])
                          }
                          onValueChange={(value) =>
                            setDraft((d) => ({
                              ...d,
                              flags: {
                                ...d.flags,
                                [key]:
                                  value === "default" ? null : value === "true",
                              },
                            }))
                          }
                        >
                          {[
                            ["default", "默认"],
                            ["true", "开启"],
                            ["false", "关闭"],
                          ].map(([value, label]) => {
                            const disabled =
                              locked !== undefined &&
                              value !== "default" &&
                              String(locked) !== value;
                            return (
                              <label
                                key={value}
                                className="tri-state-choice"
                                data-disabled={disabled || undefined}
                                title={
                                  disabled
                                    ? "当前模板不支持这个选项"
                                    : undefined
                                }
                              >
                                <RadioGroupItem
                                  className="sr-only"
                                  value={value}
                                  disabled={disabled}
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </RadioGroup>
                      </div>
                    );
                  })}
              </div>
              {p.id === "output" && Object.keys(required).length > 0 && (
                <p className="advanced-constraint">
                  不可选项由当前模板的完整配置与规则集合要求决定。
                </p>
              )}
              {p.id === "output" && draft.extraParams.length > 0 && (
                <div className="extra-params">
                  <span>保留 {draft.extraParams.length} 个导入参数</span>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        extraParams: [],
                        extraParamsTarget: null,
                      }))
                    }
                  >
                    清除
                  </Button>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="advanced-footer">
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(defaultAdvanced(required, work.form.format));
              setError("");
            }}
          >
            恢复推荐
          </Button>
          <div>
            <Button variant="outline" onClick={close}>
              取消
            </Button>
            <Button
              onClick={() => {
                const problem = validateAdvanced(draft);
                if (problem) {
                  setError(problem);
                  return;
                }
                work.applyOptions(draft);
                close();
              }}
            >
              应用设置
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
