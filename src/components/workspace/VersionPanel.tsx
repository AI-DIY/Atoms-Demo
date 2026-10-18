export type WorkspaceVersion = {
  id: string;
  version: number;
  title: string;
  html: string;
};

export function VersionPanel({
  currentVersion,
  error = null,
  onSelect,
  restoring = false,
  versions,
}: {
  currentVersion: number;
  error?: string | null;
  onSelect: (version: number) => void;
  restoring?: boolean;
  versions: WorkspaceVersion[];
}) {
  return (
    <div className="version-list">
      {versions.map((version) => (
        <button
          aria-label={`V${version.version}`}
          aria-pressed={version.version === currentVersion}
          className="version-button"
          disabled={restoring}
          key={version.id}
          onClick={() => onSelect(version.version)}
          type="button"
        >
          <span className="version-number">V{version.version}</span>
          <span className="version-description">
            <strong>{version.title}</strong>
            <small>
              {version.version === currentVersion
                ? "当前工作版本"
                : "点击恢复此版本"}
            </small>
          </span>
          <span aria-hidden>
            {version.version === currentVersion ? "✓" : "↶"}
          </span>
        </button>
      ))}
      {!versions.length ? <p>完成首次构建后，版本会自动保存在这里。</p> : null}
      {error ? (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
