import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  CodeXml,
  History,
  Layers3,
  Menu,
  Moon,
  Settings2,
  Sun,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { TooltipProvider } from "#/components/ui/tooltip";
import { Toaster } from "#/components/ui/sonner";
import { useTemplateCatalog } from "#/hooks/use-template-catalog";
import { useWorkbench } from "#/hooks/use-workbench";
import { RouteMark } from "./workbench/controls";
import { ConvertView } from "./workbench/convert-view";
import { LibraryView } from "./workbench/library-view";
import { HistoryView } from "./workbench/history-view";
import { SettingsView } from "./workbench/settings-view";
import { ImportDialog } from "./workbench/import-dialog";
type Page = "convert" | "library" | "history" | "settings";
const navigation = [
  { id: "convert", label: "订阅转换", icon: ArrowLeftRight },
  { id: "library", label: "模板库", icon: Layers3 },
  { id: "history", label: "历史记录", icon: History },
  { id: "settings", label: "设置", icon: Settings2 },
] as const;
export function ConverterApp() {
  const templates = useTemplateCatalog();
  const work = useWorkbench(templates.catalog);
  const [page, setPage] = useState<Page>("convert");
  const [modal, setModal] = useState<"link" | "template" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("subweave-theme");
      setDarkState(
        saved
          ? saved === "dark"
          : matchMedia("(prefers-color-scheme: dark)").matches,
      );
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  function setDark(value: boolean) {
    setDarkState(value);
    try {
      localStorage.setItem("subweave-theme", value ? "dark" : "light");
    } catch {}
  }
  function go(next: Page) {
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const nav = (
    <nav aria-label="主导航">
      {navigation.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={page === id ? "page" : undefined}
          className={`nav-item ${page === id ? "active" : ""}`}
          onClick={() => go(id)}
        >
          <Icon />
          <span>{label}</span>
          {id === "history" && work.history.entries.length > 0 && (
            <span className="nav-count">{work.history.entries.length}</span>
          )}
        </button>
      ))}
    </nav>
  );
  return (
    <TooltipProvider>
      <div className="app-shell">
        <a href="#main" className="skip-link">
          跳到内容
        </a>
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("convert");
            }}
          >
            <RouteMark />
            <span>
              SubWeave<span className="brand-period">.</span>
            </span>
          </a>
          {nav}
          <div className="sidebar-bottom">
            <a
              href="https://github.com/hqw567/SubWeave"
              target="_blank"
              rel="noreferrer"
            >
              <CodeXml />
              GitHub
              <ArrowUpRight />
            </a>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "切换浅色模式" : "切换深色模式"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </aside>
        <div className="workspace-frame">
          <header className="topbar">
            <div className="mobile-brand">
              <Button
                variant="ghost"
                size="icon"
                aria-label="打开导航"
                onClick={() => setMobileNav(true)}
              >
                <Menu />
              </Button>
              <RouteMark />
              <span>SubWeave</span>
            </div>
            <span className="topbar-context">
              {navigation.find((n) => n.id === page)?.label}
            </span>
            <a
              href="https://github.com/hqw567/SubWeave-Rules"
              target="_blank"
              rel="noreferrer"
              className="rules-source"
            >
              规则源
              <ArrowUpRight />
            </a>
          </header>
          <main id="main" className="workspace-sheet">
            <div className="page-heading">
              <h1>{navigation.find((n) => n.id === page)?.label}</h1>
              {page === "convert" && (
                <Button variant="outline" onClick={() => setModal("link")}>
                  <ArrowDownToLine />
                  导入链接
                </Button>
              )}
            </div>
            <div className="page-content" key={page}>
              {page === "convert" ? (
                <ConvertView
                  work={work}
                  catalog={templates.catalog}
                  onTemplateSelect={() => go("library")}
                />
              ) : page === "library" ? (
                <LibraryView
                  catalog={templates.catalog}
                  status={templates.status}
                  refresh={() => void templates.refresh()}
                  selected={work.form.config}
                  apply={(url) => {
                    work.chooseRule(url);
                    go("convert");
                  }}
                  custom={() => setModal("template")}
                  back={() => go("convert")}
                />
              ) : page === "history" ? (
                <HistoryView
                  history={work.history}
                  restore={(entry) => {
                    if (work.restore(entry)) go("convert");
                  }}
                />
              ) : (
                <SettingsView work={work} dark={dark} setDark={setDark} />
              )}
            </div>
            <footer className="workspace-footer">
              <span>SubWeave</span>
              <a
                href="https://github.com/hqw567/SubWeave-Rules/blob/main/NOTICE.md"
                target="_blank"
                rel="noreferrer"
              >
                规则来源与许可
                <ArrowUpRight />
              </a>
            </footer>
          </main>
        </div>
        <Dialog open={mobileNav} onOpenChange={setMobileNav}>
          <DialogContent className="mobile-navigation">
            <DialogTitle>
              <span className="brand">
                <RouteMark />
                SubWeave
              </span>
            </DialogTitle>
            {nav}
          </DialogContent>
        </Dialog>
        <ImportDialog
          key={modal || "closed"}
          kind={modal}
          close={() => setModal(null)}
          work={work}
        />
        <Toaster position="bottom-right" theme={dark ? "dark" : "light"} />
      </div>
    </TooltipProvider>
  );
}
