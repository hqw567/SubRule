import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Field } from "./controls";
import type { Workbench } from "#/hooks/use-workbench";
export function ImportDialog({
  kind,
  close,
  work,
}: {
  kind: "link" | "template" | null;
  close: () => void;
  work: Workbench;
}) {
  const [value, setValue] = useState(""),
    [mode, setMode] = useState("url");
  const upload = kind === "template" && mode === "upload";
  return (
    <Dialog
      open={!!kind}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="import-dialog">
        <DialogHeader>
          <DialogTitle>
            {kind === "link" ? "导入转换链接" : "自定义模板"}
          </DialogTitle>
          <DialogDescription className={upload ? "" : "sr-only"}>
            {upload
              ? "配置内容将上传至所选托管服务，请勿包含订阅凭据。"
              : kind === "link"
                ? "恢复已有转换链接的参数。"
                : "填写远程 INI 转换模板地址。"}
          </DialogDescription>
        </DialogHeader>
        {kind === "template" && (
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(String(v));
              setValue("");
            }}
          >
            <TabsList variant="line">
              <TabsTrigger value="url">远程地址</TabsTrigger>
              <TabsTrigger value="upload">上传配置</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <Field
          id="import-value"
          label={
            upload
              ? "配置内容"
              : kind === "link"
                ? "转换链接或短链接"
                : "INI 模板地址"
          }
        >
          {upload || kind === "link" ? (
            <Textarea
              id="import-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              spellCheck={false}
              placeholder={upload ? "[custom]" : "https://…"}
            />
          ) : (
            <Input
              id="import-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://…/template.ini"
              spellCheck={false}
            />
          )}
        </Field>
        {upload && (
          <label className="file-upload">
            <Upload />
            选择本地文件
            <input
              aria-label="选择配置文件"
              type="file"
              accept=".ini,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1_000_000) {
                  toast.error("配置文件不能超过 1 MB");
                  return;
                }
                try {
                  setValue(await file.text());
                } catch {
                  toast.error("文件读取失败，请重新选择");
                }
              }}
            />
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            取消
          </Button>
          <Button
            disabled={!value.trim() || !!work.busy}
            onClick={async () => {
              const done =
                kind === "link"
                  ? await work.importLink(value)
                  : await work.applyConfig(value, upload);
              if (done) {
                setValue("");
                close();
              }
            }}
          >
            {work.busy && <Loader2 className="spin" />}
            {upload ? "上传并使用" : "应用"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
