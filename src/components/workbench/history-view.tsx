import { ArrowUpRight, Copy, History, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { copyText } from "#/hooks/use-workbench";
import type { Workbench } from "#/hooks/use-workbench";
import type { HistoryEntry } from "#/hooks/use-history";
export function HistoryView({
  history,
  restore,
}: {
  history: Workbench["history"];
  restore: (entry: HistoryEntry) => void;
}) {
  return (
    <section className="history-view">
      <div className="section-toolbar">
        <span>{history.entries.length} 条记录</span>
        <Button
          variant="ghost"
          onClick={history.clear}
          disabled={!history.entries.length}
        >
          清空记录
        </Button>
      </div>
      {history.entries.length ? (
        <div className="history-list">
          {history.entries.map((entry) => (
            <div className="history-row" key={entry.time}>
              <div>
                <strong>{entry.client}</strong>
                <span>
                  {entry.count} 个来源 ·{" "}
                  {new Date(entry.time).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="history-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="复制历史链接"
                  onClick={() => void copyText(entry.url)}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="删除记录"
                  onClick={() => history.remove(entry.time)}
                >
                  <Trash2 />
                </Button>
                <Button variant="outline" onClick={() => restore(entry)}>
                  恢复
                  <ArrowUpRight />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-history">
          <History />
          <h2>还没有转换记录</h2>
          <p>生成订阅后，可在这里恢复配置。</p>
        </div>
      )}
      <p className="privacy-note">
        {history.remember
          ? "记录保存在此浏览器，包含完整订阅链接。"
          : "记录仅在当前页面会话中保留。"}
      </p>
    </section>
  );
}
