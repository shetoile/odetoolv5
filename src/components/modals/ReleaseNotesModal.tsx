import { useEffect } from "react";
import { FileGlyphSmall } from "@/components/Icons";
import { UtilityModalShell } from "@/components/modals/UtilityModalShell";
import { isTauri } from "@tauri-apps/api/core";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { getReleaseCategoryLabel } from "@/lib/qaChecklistSupport";
import { getLocalizedReleaseText } from "@/lib/releaseNotesLocalization";
import releaseLogData from "../../../quality/release-log.json";

interface ReleaseNotesModalProps {
  open: boolean;
  language: LanguageCode;
  isUtilityPanelWindow: boolean;
  isWindowMaximized: boolean;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onClose: () => void;
}

export function ReleaseNotesModal({
  open,
  language,
  isUtilityPanelWindow,
  isWindowMaximized,
  onWindowMinimize,
  onWindowToggleMaximize,
  onClose
}: ReleaseNotesModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const showWindowControls = isTauri();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sortedRows = (Array.isArray(releaseLogData.entries) ? releaseLogData.entries : [])
    .map((entry, index) => ({
      ...getLocalizedReleaseText(language, entry),
      index,
      version: entry.id,
      date: entry.date.slice(0, 10),
      category: entry.category
    }))
    .sort((left, right) => {
      const byDate = right.date.localeCompare(left.date);
      if (byDate !== 0) return byDate;
      const byVersion = right.version.localeCompare(left.version, undefined, {
        numeric: true,
        sensitivity: "base"
      });
      if (byVersion !== 0) return byVersion;
      return left.index - right.index;
    });

  return (
    <UtilityModalShell
      t={t}
      title={t("release.modal_title")}
      icon={<FileGlyphSmall />}
      isUtilityPanelWindow={isUtilityPanelWindow}
      showWindowControls={showWindowControls}
      isWindowMaximized={isWindowMaximized}
      onWindowMinimize={onWindowMinimize}
      onWindowToggleMaximize={onWindowToggleMaximize}
      onClose={onClose}
    >
      <div className="ode-surface-panel min-h-0 flex-1 rounded-xl p-2">
        <div className="ode-release-table-wrap">
          <table className="ode-release-table">
            <colgroup>
              <col className="ode-release-col-version" />
              <col className="ode-release-col-date" />
              <col className="ode-release-col-category" />
              <col className="ode-release-col-title" />
              <col className="ode-release-col-details" />
            </colgroup>
            <thead>
              <tr>
                <th>{t("release.table.version")}</th>
                <th>{t("release.table.date")}</th>
                <th>{t("release.table.category")}</th>
                <th>{t("release.table.title")}</th>
                <th>{t("release.table.details")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={`${row.version}-${row.date}-${row.index}`}>
                  <td className="ode-release-version-cell">{row.version}</td>
                  <td className="ode-release-date-cell">{row.date}</td>
                  <td className="ode-release-category-cell">
                    {getReleaseCategoryLabel(row.category, t)}
                  </td>
                  <td>{row.title}</td>
                  <td>{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </UtilityModalShell>
  );
}
