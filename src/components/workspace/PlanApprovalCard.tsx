const roleLabels: Record<string, string> = {
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
};

export function PlanApprovalCard({
  disabled = false,
  roles,
  onApprove,
}: {
  disabled?: boolean;
  roles: string[];
  onApprove: () => void;
}) {
  return (
    <section
      aria-label="团队计划审批"
      className="plan-approval"
      style={{
        background: "#1a211a",
        border: "1px solid #5d704d",
        borderRadius: 7,
        marginTop: 14,
        padding: "12px 14px",
      }}
    >
      <p className="feed-heading" style={{ color: "var(--text)", margin: "0 0 7px" }}>团队计划已就绪</p>
      <p className="plan-roles" style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 12px" }}>
        {roles.map((role) => roleLabels[role] ?? role).join("、")}
      </p>
      <button
        className="action-button"
        disabled={disabled}
        onClick={onApprove}
        style={{
          background: "var(--lime)",
          borderColor: "var(--lime)",
          color: "#152014",
          fontSize: 12,
          fontWeight: 700,
          padding: "8px 12px",
        }}
        type="button"
      >
        开始构建
      </button>
    </section>
  );
}
