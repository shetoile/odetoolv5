import type { TranslationParams } from "@/lib/i18n";
import {
  isUpdaterBlocking,
  normalizeUpdaterVersion,
  resolveUpdaterProgressLabel,
  resolveUpdaterProgressPercent,
  resolveUpdaterStatusMessage,
  resolveUpdaterStatusTone,
  resolveUpdaterTechnicalDetail,
  resolveUpdaterToastTitle,
  type AppUpdaterStatusPayload
} from "@/lib/appUpdater";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface AppUpdateToastProps {
  open: boolean;
  status: AppUpdaterStatusPayload | null;
  t: TranslateFn;
  onDismiss: () => void;
}

function resolveFallbackProgressPercent(status: AppUpdaterStatusPayload): number | null {
  if (status.stage === "available") return 8;
  if (status.stage === "installing") return 92;
  if (status.stage === "installed") return 100;
  return null;
}

export function AppUpdateToast({ open, status, t, onDismiss }: AppUpdateToastProps) {
  if (!open || !status) return null;

  const tone = resolveUpdaterStatusTone(status);
  const blocking = isUpdaterBlocking(status);
  const title = resolveUpdaterToastTitle(status, t);
  const message = resolveUpdaterStatusMessage(status, t);
  const progressPercent =
    resolveUpdaterProgressPercent(status.downloadedBytes, status.contentLength) ?? resolveFallbackProgressPercent(status);
  const progressLabel = resolveUpdaterProgressLabel(status, t);
  const technicalDetail = resolveUpdaterTechnicalDetail(status);
  const currentVersion = normalizeUpdaterVersion(status.currentVersion);
  const nextVersion = normalizeUpdaterVersion(status.version);
  const showVersionChip = Boolean(currentVersion || nextVersion);

  if (blocking) {
    return (
      <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[rgba(2,10,18,0.74)] px-4 py-6 backdrop-blur-md">
        <div
          className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[rgba(95,220,255,0.26)] bg-[linear-gradient(180deg,rgba(5,29,46,0.97),rgba(3,18,31,0.97))] shadow-[0_32px_100px_rgba(0,0,0,0.46)]"
          role="status"
          aria-live="polite"
        >
          <div className="border-b border-[rgba(95,220,255,0.14)] px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(95,220,255,0.22)] bg-[rgba(8,52,82,0.5)]">
                <span className="h-5 w-5 rounded-full border-[3px] border-[rgba(95,220,255,0.18)] border-t-[var(--ode-accent)] animate-spin" />
              </span>
              <div className="min-w-0">
                <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[var(--ode-text-dim)]">
                  {t("updater.card_title")}
                </div>
                <h2 className="mt-1 text-[1.22rem] font-semibold leading-7 text-[var(--ode-text)]">{title}</h2>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            {message ? <p className="text-[0.96rem] leading-7 text-[var(--ode-text-muted)]">{message}</p> : null}

            {showVersionChip ? (
              <div className="flex flex-wrap gap-2">
                {currentVersion ? (
                  <span className="rounded-full border border-[rgba(95,220,255,0.18)] bg-[rgba(8,52,82,0.38)] px-3 py-1.5 text-[0.76rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                    {t("updater.current_version", { version: currentVersion })}
                  </span>
                ) : null}
                {nextVersion ? (
                  <span className="rounded-full border border-[rgba(95,220,255,0.28)] bg-[rgba(12,72,112,0.34)] px-3 py-1.5 text-[0.76rem] uppercase tracking-[0.14em] text-[var(--ode-text)]">
                    {t("updater.next_version", { version: nextVersion })}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[22px] border border-[rgba(95,220,255,0.14)] bg-[rgba(4,22,35,0.72)] px-4 py-4">
              <div className="flex items-center justify-between gap-3 text-[0.8rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                <span>{t("updater.progress_label")}</span>
                <span>{progressLabel ?? t("updater.progress.preparing")}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full border border-[rgba(95,220,255,0.14)] bg-[rgba(7,34,54,0.9)]">
                <div
                  className={`h-full rounded-full bg-[linear-gradient(90deg,rgba(39,183,255,0.78),rgba(125,233,255,0.96))] transition-[width] duration-500 ${
                    progressPercent === null ? "w-[36%] animate-pulse" : ""
                  }`}
                  style={progressPercent !== null ? { width: `${progressPercent}%` } : undefined}
                />
              </div>
            </div>

            <p className="text-[0.82rem] leading-6 text-[var(--ode-text-dim)]">{t("updater.overlay_hint")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[180] w-[min(420px,calc(100vw-1.5rem))] overflow-hidden rounded-[24px] border border-[rgba(95,220,255,0.22)] bg-[linear-gradient(180deg,rgba(5,29,46,0.97),rgba(3,18,31,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[rgba(95,220,255,0.14)] px-5 py-4">
        <div className="min-w-0">
          <div className="text-[0.72rem] uppercase tracking-[0.2em] text-[var(--ode-text-dim)]">
            {t("updater.card_title")}
          </div>
          <div className="mt-1 text-[1rem] font-semibold leading-6 text-[var(--ode-text)]">{title}</div>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(95,220,255,0.18)] bg-[rgba(8,52,82,0.42)] text-[1rem] text-[var(--ode-text-muted)] transition hover:border-[rgba(95,220,255,0.32)] hover:text-[var(--ode-text)]"
          onClick={onDismiss}
          aria-label={t("updater.dismiss")}
        >
          x
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {message ? <p className="text-[0.92rem] leading-7 text-[var(--ode-text-muted)]">{message}</p> : null}

        {showVersionChip ? (
          <div className="flex flex-wrap gap-2">
            {currentVersion ? (
              <span className="rounded-full border border-[rgba(95,220,255,0.18)] bg-[rgba(8,52,82,0.38)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                {t("updater.current_version", { version: currentVersion })}
              </span>
            ) : null}
            {nextVersion ? (
              <span className="rounded-full border border-[rgba(95,220,255,0.28)] bg-[rgba(12,72,112,0.34)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text)]">
                {t("updater.next_version", { version: nextVersion })}
              </span>
            ) : null}
          </div>
        ) : null}

        {progressPercent !== null ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full border border-[rgba(95,220,255,0.14)] bg-[rgba(7,34,54,0.9)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(39,183,255,0.78),rgba(125,233,255,0.96))] transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progressLabel ? (
              <div className="text-[0.76rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">{progressLabel}</div>
            ) : null}
          </div>
        ) : null}

        {technicalDetail ? (
          <div className="rounded-[18px] border border-[rgba(255,138,138,0.16)] bg-[rgba(60,15,22,0.42)] px-3.5 py-3 text-[0.82rem] leading-6 text-[rgba(255,220,220,0.88)]">
            {technicalDetail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
