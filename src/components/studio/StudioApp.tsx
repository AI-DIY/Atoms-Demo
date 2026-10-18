"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  FolderClosed,
  Grid2X2,
  Home,
  LayoutList,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  createProject,
  listProjects,
  logoutUser,
  renameProject,
  type CurrentUser,
  type ProjectSummary,
} from "@/lib/client-api";
import { projectIdentityStorageKey } from "@/lib/project-session";
import { roles } from "@/lib/roles";
import { AuthPage } from "@/components/auth/AuthPage";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { AgentAvatar } from "./AgentAvatar";
import { Dialog } from "./Dialog";
import { ResourceArtwork } from "./ResourceArtwork";
import { resources, type Resource } from "./resources";

type View = "home" | "resources" | "projects" | `project/${string}`;
function readView(): View {
  const hash = window.location.hash.slice(1);
  return hash === "resources" ||
    hash === "projects" ||
    /^project\/[a-zA-Z0-9_-]+$/.test(hash)
    ? (hash as View)
    : "home";
}
const statusLabel: Record<string, string> = {
  draft: "草稿",
  ready: "已就绪",
  failed: "需要重试",
  planning: "规划中",
  building: "构建中",
  reviewing: "验收中",
  iterating: "迭代中",
  awaiting_approval: "构建中",
};

export function StudioApp({
  user,
  onAuthenticated,
}: {
  user: CurrentUser;
  onAuthenticated: (user: CurrentUser) => void;
}) {
  const [view, setView] = useState<View>("home");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("自由创作");
  const [creating, setCreating] = useState(false);
  const [pendingBuild, setPendingBuild] = useState(false);
  const [initialBuild, setInitialBuild] = useState<{
    id: string;
    request: string;
  } | null>(null);
  const [mode, setMode] = useState("正在检查生成服务");
  const [category, setCategory] = useState("全部");
  const [resourceTab, setResourceTab] = useState("发现");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [listView, setListView] = useState(false);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const createRef = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const isProject = view.startsWith("project/");
  const currentProjectId = isProject ? view.slice(8) : undefined;
  const userName = user.email?.split("@")[0] ?? "创作者";

  const refreshProjects = useCallback(async () => {
    if (!user.authenticated) return;
    setProjectsLoading(true);
    try {
      setProjects(await listProjects());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目列表加载失败");
    } finally {
      setProjectsLoading(false);
    }
  }, [user.authenticated]);

  useEffect(() => {
    const update = () => {
      setView(readView());
      setMenuOpen(false);
    };
    update();
    window.addEventListener("hashchange", update);
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("atoms-demo-bookmarks") ?? "[]",
      );
      if (Array.isArray(stored))
        setSaved(stored.filter((id): id is string => typeof id === "string"));
    } catch {
      /* optional preferences */
    }
    void fetch("/api/health")
      .then((r) => r.json())
      .then((h) =>
        setMode(
          h.status !== "ok"
            ? "生成服务未配置"
            : h.mode === "demo"
              ? "演示模式 · 内置模板"
              : "真实 AI · Responses API",
        ),
      )
      .catch(() => setMode("生成服务暂不可用"));
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  function navigate(next: View) {
    if (workspaceBusy) return;
    window.location.hash = next;
    setView(next);
    setMenuOpen(false);
    setError("");
    if (next === "projects" || next === "home") void refreshProjects();
  }
  async function build(justAuthenticated = false) {
    if (createRef.current || prompt.trim().length < 8) return;
    if (!user.authenticated && !justAuthenticated) {
      setPendingBuild(true);
      setAuthOpen(true);
      return;
    }
    createRef.current = true;
    setCreating(true);
    setError("");
    const request =
      prompt.trim() + (style === "自由创作" ? "" : `\n视觉风格：${style}。`);
    try {
      const project = await createProject({
        title: prompt.trim().replace(/\s+/g, " ").slice(0, 32),
        goal: request,
      });
      try {
        localStorage.setItem(
          projectIdentityStorageKey,
          JSON.stringify({
            projectId: project.id,
            ownerToken: project.ownerToken,
          }),
        );
      } catch {
        /* session auth remains available */
      }
      setInitialBuild({ id: project.id, request });
      setPrompt("");
      navigate(`project/${project.id}`);
      void refreshProjects();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "创建项目失败，请重试",
      );
    } finally {
      createRef.current = false;
      setCreating(false);
    }
  }
  function selectResource(resource: Resource) {
    setPrompt(resource.prompt);
    setSelected(null);
    navigate("home");
    requestAnimationFrame(() => promptRef.current?.focus());
  }
  function toggleSaved(id: string) {
    const next = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("atoms-demo-bookmarks", JSON.stringify(next));
    } catch {
      setError("浏览器未允许保存偏好，收藏仅在本次会话生效。");
    }
  }
  async function submitRename(event: React.FormEvent) {
    event.preventDefault();
    if (!renaming || renamingBusy) return;
    setRenamingBusy(true);
    setRenameError("");
    try {
      await renameProject(renaming.id, newTitle);
      await refreshProjects();
      setRenaming(null);
    } catch (caught) {
      setRenameError(caught instanceof Error ? caught.message : "重命名失败");
    } finally {
      setRenamingBusy(false);
    }
  }
  const displayedResources = resources.filter(
    (r) =>
      (category === "全部" || r.category === category) &&
      (resourceTab !== "模板" || r.template) &&
      (!savedOnly || saved.includes(r.id)) &&
      `${r.title}${r.description}`.includes(search.trim()),
  );
  const displayedProjects = projects
    .filter((p) =>
      `${p.title}${p.goal}`.toLowerCase().includes(projectSearch.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "zh")
        : (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
  function resourceCard(resource: Resource) {
    return (
      <article className="resource-card" key={resource.id}>
        <button
          className="artwork-button"
          aria-label={`查看${resource.title}`}
          onClick={() => setSelected(resource)}
        >
          <ResourceArtwork kind={resource.kind} />
          <span className="card-overlay">
            查看创意 <ArrowRight size={17} />
          </span>
        </button>
        <div className="resource-card-info">
          <span className={`resource-avatar avatar-${resource.kind}`}>
            {resource.title.slice(0, 1)}
          </span>
          <button className="card-title" onClick={() => setSelected(resource)}>
            <strong>{resource.title}</strong>
            <small>
              {resource.category} ·{" "}
              {resource.template ? "内置模板" : "创作灵感"}
            </small>
          </button>
          <button
            className={`icon-button bookmark-button${saved.includes(resource.id) ? " selected" : ""}`}
            aria-label={`${saved.includes(resource.id) ? "取消收藏" : "收藏"}${resource.title}`}
            aria-pressed={saved.includes(resource.id)}
            onClick={() => toggleSaved(resource.id)}
          >
            <Bookmark size={17} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className={`studio-shell${isProject ? " in-project" : ""}`}>
      <header className="mobile-topbar">
        <button
          aria-label="打开导航"
          className="icon-button"
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </button>
        <span className="brand-name">
          Atoms <small>Demo</small>
        </span>
        <span className="user-avatar">
          {userName.slice(0, 1).toUpperCase()}
        </span>
      </header>
      {menuOpen ? (
        <button
          className="sidebar-scrim"
          aria-label="关闭导航"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        className={`studio-sidebar${menuOpen ? " open" : ""}`}
        aria-label="主导航"
      >
        <button
          className="studio-brand"
          aria-label="Atoms Demo 首页"
          disabled={workspaceBusy}
          onClick={() => navigate("home")}
        >
          <span className="atoms-mark">✦</span>
          <span className="brand-name">
            Atoms <small>Demo</small>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-icon">⌘</span>
          <span>
            {user.authenticated ? `${userName} 的工作空间` : "你的创作空间"}
          </span>
          <ChevronDown size={14} />
        </div>
        <nav className="main-nav">
          {(
            [
              { id: "home", label: "首页", icon: Home },
              { id: "resources", label: "资源", icon: Compass },
              { id: "projects", label: "我的项目", icon: FolderClosed },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              title={nav.label}
              className={view === nav.id ? "active" : ""}
              aria-current={view === nav.id ? "page" : undefined}
              disabled={workspaceBusy}
              onClick={() => navigate(nav.id)}
            >
              <nav.icon size={18} />
              <span>{nav.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-recents">
          <p>最近</p>
          {projects.slice(0, 6).map((p) => (
            <button
              key={p.id}
              disabled={workspaceBusy}
              className={currentProjectId === p.id ? "current" : ""}
              title={p.title}
              onClick={() => navigate(`project/${p.id}`)}
            >
              {p.title}
            </button>
          ))}
          {!projects.length ? (
            <span className="muted">从一个想法开始</span>
          ) : null}
        </div>
        <div className="sidebar-bottom">
          <div className="studio-note">
            <Sparkles size={18} />
            <div>
              <strong>想法，值得被实现</strong>
              <small>构建 · 迭代 · 发布</small>
            </div>
          </div>
          <div className="account-row">
            <span className="user-avatar">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-name">
              {user.authenticated ? userName : "访客"}
            </span>
            {user.authenticated ? (
              <button
                className="icon-button"
                aria-label="退出登录"
                disabled={workspaceBusy}
                onClick={() =>
                  void logoutUser().then(() => window.location.assign("/"))
                }
              >
                <LogOut size={17} />
              </button>
            ) : (
              <button className="link-button" onClick={() => setAuthOpen(true)}>
                登录
              </button>
            )}
          </div>
          <small className="demo-label">全栈笔试演示 · 非 Atoms 官方产品</small>
        </div>
      </aside>

      <div className="studio-main">
        {!isProject ? (
          <div className="page-topline">
            <span className="provider-pill">
              <i />
              {mode}
            </span>
            {!user.authenticated ? (
              <button
                className="secondary-button compact"
                onClick={() => setAuthOpen(true)}
              >
                登录 / 注册
              </button>
            ) : (
              <span className="topline-caption">把灵感变成现实</span>
            )}
          </div>
        ) : null}
        {error ? (
          <div className="page-error" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="关闭提示"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        {view === "home" ? (
          <main className="home-page">
            <section className="home-hero">
              <span className="announcement">
                <span className="announcement-dot" />{" "}
                从第一句想法，到第一个可用版本 <ArrowRight size={13} />
              </span>
              <div className="team-portraits">
                {roles.map((r) => (
                  <span key={r.id} title={r.label}>
                    <AgentAvatar role={r.id} />
                  </span>
                ))}
              </div>
              <h1>
                你的下一个产品<span>从这里开始。</span>
              </h1>
              <p className="hero-subtitle">
                说出你的想法，让 AI 团队一起把它变成现实。
              </p>
              <form
                className="hero-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void build();
                }}
              >
                <textarea
                  ref={promptRef}
                  aria-label="描述你的产品想法"
                  placeholder="创建一个摄影预约网站，展示我的作品，让客户轻松预约…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  minLength={8}
                  maxLength={1900}
                  rows={3}
                  required
                  disabled={creating}
                />
                <div className="hero-composer-footer">
                  <span>
                    <Sparkles size={16} /> 团队协作构建
                  </span>
                  <div>
                    <select
                      aria-label="视觉风格"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                    >
                      <option>自由创作</option>
                      <option>极简留白</option>
                      <option>深色科技</option>
                      <option>温暖自然</option>
                    </select>
                    <button
                      className="hero-submit"
                      aria-label="开始构建"
                      disabled={creating || prompt.trim().length < 8}
                      title="开始构建"
                    >
                      <ArrowUp size={20} />
                    </button>
                  </div>
                </div>
              </form>
              <div className="idea-chips">
                {resources.slice(0, 3).map((r) => (
                  <button key={r.id} onClick={() => selectResource(r)}>
                    <Plus size={13} />
                    {r.title.split(" · ")[1]}
                  </button>
                ))}
              </div>
              <p className="hero-footnote">
                自动规划需求、生成代码并提供可交互预览
              </p>
            </section>
            <section className="home-gallery">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">MADE TO INSPIRE</span>
                  <h2>从一个好灵感开始</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("resources")}
                >
                  探索全部 <ArrowRight size={16} />
                </button>
              </div>
              <div className="resource-grid">
                {resources.slice(0, 3).map(resourceCard)}
              </div>
            </section>
            {projects.length ? (
              <section className="home-recent">
                <div className="section-heading">
                  <h2>继续你的创作</h2>
                  <button
                    className="text-button"
                    onClick={() => navigate("projects")}
                  >
                    我的项目 <ArrowRight size={16} />
                  </button>
                </div>
                <div className="recent-grid">
                  {projects.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`project/${p.id}`)}
                    >
                      <FolderClosed size={20} />
                      <span>
                        <strong>{p.title}</strong>
                        <small>
                          {p.currentVersion ? `V${p.currentVersion} · ` : ""}
                          {statusLabel[p.status] ?? p.status}
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </main>
        ) : null}

        {view === "resources" ? (
          <main className="library-page">
            <div className="page-heading">
              <div>
                <h1>资源</h1>
                <p>为下一个想法，找到一个好的起点。</p>
              </div>
            </div>
            <div className="library-toolbar">
              <div className="segmented">
                {["发现", "模板"].map((t) => (
                  <button
                    className={resourceTab === t ? "active" : ""}
                    onClick={() => setResourceTab(t)}
                    key={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="搜索资源"
                  placeholder="搜索灵感"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="category-toolbar">
              <div className="category-tabs">
                {["全部", "网站", "生产力", "数据分析", "原型设计"].map((t) => (
                  <button
                    className={category === t ? "active" : ""}
                    onClick={() => setCategory(t)}
                    key={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                className={`text-button${savedOnly ? " selected" : ""}`}
                aria-pressed={savedOnly}
                onClick={() => setSavedOnly(!savedOnly)}
              >
                <Bookmark size={16} />
                已收藏 {saved.length ? saved.length : ""}
              </button>
            </div>
            <div className="resource-grid">
              {displayedResources.map(resourceCard)}
            </div>
            {!displayedResources.length ? (
              <div className="empty-state">
                <Search />
                <h2>还没有匹配的灵感</h2>
                <p>试试其他关键词，或清除筛选条件。</p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setCategory("全部");
                    setSearch("");
                    setSavedOnly(false);
                  }}
                >
                  清除筛选
                </button>
              </div>
            ) : null}
            <p className="library-note">
              封面为原创设计示意。选择创意后，AI
              将根据你的描述生成应用；演示模式提供 3 个内置模板。
            </p>
          </main>
        ) : null}

        {view === "projects" ? (
          <main className="projects-page">
            <div className="page-heading">
              <div>
                <h1>
                  我的项目 <span>{projects.length}</span>
                </h1>
                <p>每一个想法，都在这里慢慢成形。</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  navigate("home");
                  requestAnimationFrame(() => promptRef.current?.focus());
                }}
              >
                <Plus size={16} />
                新建项目
              </button>
            </div>
            {!user.authenticated ? (
              <div className="empty-state">
                <FolderClosed />
                <h2>让创作有一个家</h2>
                <p>登录后，你的项目、对话和每一个版本都会保存在这里。</p>
                <button
                  className="primary-button"
                  onClick={() => setAuthOpen(true)}
                >
                  登录并开始
                </button>
              </div>
            ) : (
              <>
                <div className="projects-toolbar">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="搜索项目"
                      placeholder="搜索你的项目"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                  </label>
                  <div className="project-display-controls">
                    <select
                      aria-label="项目排序"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="recent">最近更新</option>
                      <option value="name">名称排序</option>
                    </select>
                    <button
                      className="icon-button"
                      aria-label={listView ? "切换网格视图" : "切换列表视图"}
                      onClick={() => setListView(!listView)}
                    >
                      {listView ? (
                        <Grid2X2 size={18} />
                      ) : (
                        <LayoutList size={18} />
                      )}
                    </button>
                  </div>
                </div>
                {projectsLoading ? (
                  <p className="muted" role="status">
                    正在加载项目…
                  </p>
                ) : null}
                <div className={`project-grid${listView ? " as-list" : ""}`}>
                  {displayedProjects.map((p, i) => (
                    <article className="project-card" key={p.id}>
                      <button
                        className={`project-cover cover-${i % 4}`}
                        aria-label={`打开项目 ${p.title}`}
                        onClick={() => navigate(`project/${p.id}`)}
                      >
                        <span className="project-cover-icon">
                          <CodeProjectIcon />
                        </span>
                        <span>
                          {p.currentVersion ? `V${p.currentVersion}` : "草稿"}
                        </span>
                        <strong>{p.title}</strong>
                      </button>
                      <div className="project-card-body">
                        <div>
                          <button
                            className="project-title-button"
                            onClick={() => navigate(`project/${p.id}`)}
                          >
                            {p.title}
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`重命名 ${p.title}`}
                            onClick={() => {
                              setRenaming(p);
                              setNewTitle(p.title);
                              setRenameError("");
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                        <p>{p.goal}</p>
                        <footer>
                          <span className={`project-status status-${p.status}`}>
                            <i />
                            {statusLabel[p.status] ?? p.status}
                          </span>
                          <span>
                            <Clock3 size={12} />
                            {p.updatedAt
                              ? new Date(p.updatedAt).toLocaleDateString(
                                  "zh-CN",
                                )
                              : "刚刚"}
                          </span>
                        </footer>
                      </div>
                    </article>
                  ))}
                </div>
                {!displayedProjects.length && !projectsLoading ? (
                  <div className="empty-state">
                    <FolderClosed />
                    <h2>
                      {projectSearch
                        ? "没有找到匹配的项目"
                        : "你的第一个作品，即将诞生"}
                    </h2>
                    <p>
                      {projectSearch
                        ? "换个关键词试试看。"
                        : "从一句简单的描述开始，剩下的交给团队。"}
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        projectSearch ? setProjectSearch("") : navigate("home")
                      }
                    >
                      {projectSearch ? "清除搜索" : "开始创作"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </main>
        ) : null}

        {isProject && user.authenticated ? (
          <WorkspaceShell
            key={currentProjectId}
            projectId={currentProjectId}
            userEmail={user.email}
            initialRequest={
              initialBuild && initialBuild.id === currentProjectId
                ? initialBuild.request
                : undefined
            }
            onInitialRequestConsumed={() => setInitialBuild(null)}
            onProjectUpdated={refreshProjects}
            onExit={() => navigate("projects")}
            onBusyChange={setWorkspaceBusy}
          />
        ) : null}
        {isProject && !user.authenticated ? (
          <div className="empty-state">
            <FolderClosed />
            <h1>登录后继续创作</h1>
            <button
              className="primary-button"
              onClick={() => setAuthOpen(true)}
            >
              登录
            </button>
          </div>
        ) : null}
      </div>
      {authOpen ? (
        <Dialog
          title="登录或注册"
          onClose={() => {
            setAuthOpen(false);
            setPendingBuild(false);
          }}
        >
          <AuthPage
            embedded
            onAuthenticated={(next) => {
              onAuthenticated(next);
              setAuthOpen(false);
              if (pendingBuild) {
                setPendingBuild(false);
                void build(true);
              }
            }}
          />
        </Dialog>
      ) : null}
      {selected ? (
        <Dialog title={selected.title} onClose={() => setSelected(null)}>
          <div className="resource-detail">
            <ResourceArtwork kind={selected.kind} />
            <div>
              <span className="section-kicker">{selected.tag}</span>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
              <p className="resource-prompt">{selected.prompt}</p>
              <div className="detail-actions">
                <button
                  className="secondary-button"
                  onClick={() => toggleSaved(selected.id)}
                >
                  {saved.includes(selected.id) ? (
                    <Check size={16} />
                  ) : (
                    <Bookmark size={16} />
                  )}{" "}
                  {saved.includes(selected.id) ? "已收藏" : "收藏创意"}
                </button>
                <button
                  className="primary-button"
                  onClick={() => selectResource(selected)}
                >
                  使用此创意 <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </Dialog>
      ) : null}
      {renaming ? (
        <Dialog
          title="重命名项目"
          busy={renamingBusy}
          onClose={() => setRenaming(null)}
        >
          <form className="rename-form" onSubmit={submitRename}>
            <h2>重命名项目</h2>
            <label>
              项目名称
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={80}
                minLength={1}
                required
              />
            </label>
            {renameError ? (
              <p role="alert" className="form-error">
                {renameError}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={renamingBusy || !newTitle.trim()}
            >
              保存名称
            </button>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
function CodeProjectIcon() {
  return <span aria-hidden>〈 / 〉</span>;
}
