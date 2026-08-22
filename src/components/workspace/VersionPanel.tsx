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
          <span>V{version.version}</span>
        </button>
      ))}
      {error ? <p className="workspace-error" role="alert">{error}</p> : null}
    </div>
  );
}
