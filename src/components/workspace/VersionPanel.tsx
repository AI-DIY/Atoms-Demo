export type WorkspaceVersion = {
  id: string;
  version: number;
  title: string;
  html: string;
};

export function VersionPanel({
  currentVersion,
  onSelect,
  versions,
}: {
  currentVersion: number;
  onSelect: (version: number) => void;
  versions: WorkspaceVersion[];
}) {
  return (
    <div className="version-list">
      {versions.map((version) => (
        <button
          aria-label={`V${version.version}`}
          aria-pressed={version.version === currentVersion}
          className="version-button"
          key={version.id}
          onClick={() => onSelect(version.version)}
          type="button"
        >
          <span>V{version.version}</span>
        </button>
      ))}
    </div>
  );
}
