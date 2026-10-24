import { Switch } from "#/components/ui/switch";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Field } from "./controls";
import type { Workbench } from "#/hooks/use-workbench";
export function SettingsView({
  work,
  dark,
  setDark,
}: {
  work: Workbench;
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  return (
    <section className="settings-view">
      <div className="settings-section">
        <h2>外观</h2>
        <div className="settings-panel">
          <div className="switch-row">
            <Label htmlFor="dark-mode">深色模式</Label>
            <Switch id="dark-mode" checked={dark} onCheckedChange={setDark} />
          </div>
        </div>
      </div>
      <div className="settings-section">
        <h2>历史记录</h2>
        <div className="settings-panel">
          <div className="switch-row">
            <Label htmlFor="save-history">保存到此浏览器</Label>
            <Switch
              id="save-history"
              checked={work.history.remember}
              onCheckedChange={work.history.setPersistence}
            />
          </div>
          <p className="privacy-note">
            包含完整订阅链接。关闭后删除已保存记录，保留当前会话。
          </p>
        </div>
      </div>
      <div className="settings-section">
        <h2>外部服务</h2>
        <div className="settings-panel">
          <Field id="short-api" label="自定义短链 API">
            <Input
              id="short-api"
              value={work.shortApi}
              onChange={(e) => work.setShortApi(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Field id="upload-api" label="配置托管 API">
            <Input
              id="upload-api"
              value={work.uploadApi}
              onChange={(e) => work.setUploadApi(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <p className="privacy-note">
            仅在主动生成短链或上传配置时发送内容。服务地址只在当前会话生效。
          </p>
        </div>
      </div>
    </section>
  );
}
