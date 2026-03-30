type OdeAiMarkProps = {
  detail?: string | null;
  compact?: boolean;
  className?: string;
  showLogo?: boolean;
};

export function OdeAiMark({
  detail = null,
  compact = false,
  className = "",
  showLogo = true
}: OdeAiMarkProps) {
  return (
    <span className={`ode-ai-mark ${compact ? "ode-ai-mark-compact" : ""} ${className}`.trim()}>
      {showLogo ? (
        <span className="ode-ai-mark-logo-shell" aria-hidden="true">
          <img src="/ode-logo-ui.png" alt="" className="ode-ai-mark-logo" />
        </span>
      ) : null}
      <span className="ode-ai-mark-copy">
        <span className="ode-ai-mark-title">ODE AI</span>
        {detail ? <span className="ode-ai-mark-detail">{detail}</span> : null}
      </span>
    </span>
  );
}
