import {
  resolveUpdaterProgressPercent,
  resolveUpdaterStatusTone,
  resolveUpdaterToastTitle,
  type AppUpdaterStatusPayload
} from "@/lib/appUpdater";

interface AppUpdateToastProps {
  open: boolean;
  status: AppUpdaterStatusPayload | null;
  onDismiss: () => void;
}

export function AppUpdateToast({ open, status, onDismiss }: AppUpdateToastProps) {
  if (!open || !status) return null;

  const tone = resolveUpdaterStatusTone(status);
  const progressPercent = resolveUpdaterProgressPercent(status.downloadedBytes, status.contentLength);
  const showVersionChip = Boolean(status.version || status.currentVersion);

  return (
    <div
      className={`ode-update-toast ode-update-toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className="ode-update-toast-header">
        <div className="min-w-0">
          <div className="ode-update-toast-eyebrow">Automatic update</div>
          <div className="ode-update-toast-title">{resolveUpdaterToastTitle(status)}</div>
        </div>
        {status.stage !== "installing" && status.stage !== "installed" ? (
          <button type="button" className="ode-update-toast-close" onClick={onDismiss} aria-label="Dismiss update status">
            x
          </button>
        ) : null}
      </div>

      <p className="ode-update-toast-message">{status.message}</p>

      {showVersionChip ? (
        <div className="ode-update-toast-version-row">
          {status.currentVersion ? (
            <span className="ode-update-toast-chip ode-update-toast-chip-muted">Current {status.currentVersion}</span>
          ) : null}
          {status.version ? <span className="ode-update-toast-chip">Next {status.version}</span> : null}
        </div>
      ) : null}

      {progressPercent !== null ? (
        <div className="ode-update-toast-progress">
          <div className="ode-update-toast-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
