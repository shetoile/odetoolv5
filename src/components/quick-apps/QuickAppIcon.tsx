import { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { FolderGlyph, LinkGlyphSmall, OpenGlyphSmall } from "@/components/Icons";
import {
  buildWindowsFileIconCacheKey,
  hydratePersistedWindowsFileIconCache,
  resolveWindowsFileIcon,
  WINDOWS_FILE_ICON_CACHE
} from "@/lib/iconSupport";
import {
  getQuickAppTargetLeafName,
  resolveQuickAppFaviconUrl,
  resolveQuickAppPreferredIconKey,
  type NodeQuickAppItem
} from "@/lib/nodeQuickApps";

type QuickAppIconVariant = "dock" | "editor";

type QuickAppVisual = {
  label: string;
  bg: string;
  text: string;
};

const QUICK_APP_VISUALS: Record<string, QuickAppVisual> = {
  office: { label: "365", bg: "linear-gradient(180deg,rgba(255,134,66,0.98),rgba(211,84,23,0.96))", text: "#fff4e6" },
  teams: { label: "T", bg: "linear-gradient(180deg,rgba(120,126,255,0.98),rgba(79,83,221,0.96))", text: "#f4f5ff" },
  whatsapp: { label: "WA", bg: "linear-gradient(180deg,rgba(49,194,104,0.98),rgba(26,143,76,0.96))", text: "#effff4" },
  telegram: { label: "TG", bg: "linear-gradient(180deg,rgba(68,193,255,0.98),rgba(24,129,189,0.96))", text: "#effbff" },
  outlook: { label: "O", bg: "linear-gradient(180deg,rgba(73,153,255,0.98),rgba(37,103,218,0.96))", text: "#eff6ff" },
  sharepoint: { label: "SP", bg: "linear-gradient(180deg,rgba(29,184,159,0.98),rgba(14,123,104,0.96))", text: "#f0fffb" },
  excel: { label: "X", bg: "linear-gradient(180deg,rgba(56,172,99,0.98),rgba(28,116,66,0.96))", text: "#effff4" },
  word: { label: "W", bg: "linear-gradient(180deg,rgba(72,136,255,0.98),rgba(30,86,207,0.96))", text: "#f1f6ff" },
  powerpoint: { label: "P", bg: "linear-gradient(180deg,rgba(243,119,74,0.98),rgba(193,77,37,0.96))", text: "#fff1ea" },
  drive: { label: "D", bg: "linear-gradient(180deg,rgba(116,205,88,0.98),rgba(67,148,45,0.96))", text: "#f4ffef" },
  notion: { label: "N", bg: "linear-gradient(180deg,rgba(126,136,152,0.98),rgba(76,85,101,0.96))", text: "#f3f8ff" },
  jira: { label: "J", bg: "linear-gradient(180deg,rgba(54,145,255,0.98),rgba(19,94,205,0.96))", text: "#eef7ff" },
  chat: { label: "C", bg: "linear-gradient(180deg,rgba(137,120,255,0.98),rgba(86,68,216,0.96))", text: "#f4f0ff" },
  mail: { label: "M", bg: "linear-gradient(180deg,rgba(88,177,244,0.98),rgba(42,118,197,0.96))", text: "#eff9ff" },
  link: { label: "L", bg: "linear-gradient(180deg,rgba(74,175,231,0.98),rgba(38,125,177,0.96))", text: "#eefaff" },
  app: { label: "A", bg: "linear-gradient(180deg,rgba(136,156,178,0.98),rgba(83,99,118,0.96))", text: "#f2f8ff" },
  folder: { label: "F", bg: "linear-gradient(180deg,rgba(224,183,86,0.98),rgba(170,126,37,0.96))", text: "#fff7de" }
};

const VARIANT_CLASSES: Record<
  QuickAppIconVariant,
  {
    shell: string;
    image: string;
    glyph: string;
    letter: string;
    radius: string;
  }
> = {
  dock: {
    shell: "h-8 w-8",
    image: "h-8 w-8",
    glyph: "h-5 w-5",
    letter: "text-[0.64rem]",
    radius: "rounded-[10px]"
  },
  editor: {
    shell: "h-11 w-11",
    image: "h-6 w-6",
    glyph: "h-[18px] w-[18px]",
    letter: "text-[0.7rem]",
    radius: "rounded-[12px]"
  }
};

function QuickAppPresetIcon({
  iconKey,
  variant
}: {
  iconKey: string;
  variant: QuickAppIconVariant;
}) {
  const classes = VARIANT_CLASSES[variant];
  const dockVariant = variant === "dock";

  if (iconKey === "folder") {
    return (
      <span
        className={`inline-flex items-center justify-center ${classes.shell} ${classes.radius} ${
          dockVariant
            ? "bg-[linear-gradient(180deg,rgba(232,196,107,0.98),rgba(183,139,52,0.96))] text-[#fff8e4] shadow-[0_8px_18px_rgba(209,155,42,0.2)]"
            : "border border-[rgba(214,182,97,0.42)] bg-[rgba(132,104,49,0.2)]"
        }`}
      >
        <span className={classes.glyph}>
          <FolderGlyph active state="filled" />
        </span>
      </span>
    );
  }

  if (iconKey === "link") {
    return (
      <span
        className={`inline-flex items-center justify-center text-[var(--ode-text)] ${classes.shell} ${classes.radius} ${
          dockVariant
            ? "bg-[linear-gradient(180deg,rgba(82,183,237,0.98),rgba(33,119,172,0.96))] text-[#effaff] shadow-[0_8px_18px_rgba(39,126,180,0.24)]"
            : "border border-[rgba(93,191,241,0.4)] bg-[rgba(57,150,210,0.18)]"
        }`}
      >
        <span className={classes.glyph}>
          <LinkGlyphSmall />
        </span>
      </span>
    );
  }

  if (iconKey === "app") {
    return (
      <span
        className={`inline-flex items-center justify-center text-[var(--ode-text)] ${classes.shell} ${classes.radius} ${
          dockVariant
            ? "bg-[linear-gradient(180deg,rgba(149,168,188,0.98),rgba(87,102,122,0.96))] text-[#f3f8ff] shadow-[0_8px_18px_rgba(55,78,102,0.24)]"
            : "border border-[rgba(151,178,206,0.4)] bg-[rgba(92,111,132,0.22)]"
        }`}
      >
        <span className={classes.glyph}>
          <OpenGlyphSmall />
        </span>
      </span>
    );
  }

  const visual = QUICK_APP_VISUALS[iconKey] ?? QUICK_APP_VISUALS.link;
  return (
    <span
      className={`inline-flex items-center justify-center font-semibold tracking-[0.01em] ${classes.shell} ${classes.radius} ${classes.letter}`}
      style={{
        background: visual.bg,
        color: visual.text,
        boxShadow: dockVariant ? "0 8px 18px rgba(0,0,0,0.18)" : undefined
      }}
      aria-hidden
    >
      {visual.label}
    </span>
  );
}

export function QuickAppIcon({
  item,
  variant = "dock"
}: {
  item: NodeQuickAppItem;
  variant?: QuickAppIconVariant;
}) {
  hydratePersistedWindowsFileIconCache();

  const classes = VARIANT_CLASSES[variant];
  const dockVariant = variant === "dock";
  const preferredIconKey = resolveQuickAppPreferredIconKey(item);
  const customIconDataUrl = item.customIconDataUrl?.trim() || null;
  const shouldTryLocalIcon = !customIconDataUrl && item.iconKey === "auto" && item.kind === "local_path";
  const shouldTryFavicon = !customIconDataUrl && item.iconKey === "auto" && item.kind === "url";
  const quickAppLeafName = useMemo(() => getQuickAppTargetLeafName(item.target) || item.label, [item.label, item.target]);
  const localIconCacheKey = useMemo(
    () =>
      shouldTryLocalIcon
        ? buildWindowsFileIconCacheKey(item.target, quickAppLeafName || item.label || "app", 32)
        : "",
    [item.label, item.target, quickAppLeafName, shouldTryLocalIcon]
  );
  const faviconUrl = useMemo(
    () => (shouldTryFavicon ? resolveQuickAppFaviconUrl(item.target) : null),
    [item.target, shouldTryFavicon]
  );
  const [localIconDataUrl, setLocalIconDataUrl] = useState<string | null>(() => {
    if (!shouldTryLocalIcon || !localIconCacheKey) return null;
    return WINDOWS_FILE_ICON_CACHE.get(localIconCacheKey) ?? null;
  });
  const [faviconBroken, setFaviconBroken] = useState(false);

  useEffect(() => {
    setFaviconBroken(false);
  }, [faviconUrl]);

  useEffect(() => {
    if (!shouldTryLocalIcon || !localIconCacheKey) {
      setLocalIconDataUrl(null);
      return;
    }

    const cached = WINDOWS_FILE_ICON_CACHE.get(localIconCacheKey) ?? null;
    if (cached) {
      setLocalIconDataUrl(cached);
      return;
    }

    if (!isTauri()) {
      setLocalIconDataUrl(null);
      return;
    }

    let cancelled = false;
    void resolveWindowsFileIcon(item.target, quickAppLeafName || item.label || "app", 32).then((iconDataUrl) => {
      if (cancelled) return;
      setLocalIconDataUrl(iconDataUrl ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [item.label, item.target, localIconCacheKey, quickAppLeafName, shouldTryLocalIcon]);

  const resolvedImage = customIconDataUrl || localIconDataUrl;
  const unresolvedLocalAutoFallbackIconKey =
    shouldTryLocalIcon && !resolvedImage ? (quickAppLeafName && !quickAppLeafName.includes(".") ? "folder" : "app") : null;
  if (resolvedImage) {
    return (
      <img
        src={resolvedImage}
        alt=""
        className={`${classes.shell} ${classes.radius} object-contain ${
          dockVariant ? "shadow-[0_8px_18px_rgba(0,0,0,0.22)]" : ""
        }`}
        draggable={false}
      />
    );
  }

  if (unresolvedLocalAutoFallbackIconKey) {
    return <QuickAppPresetIcon iconKey={unresolvedLocalAutoFallbackIconKey} variant={variant} />;
  }

  if (faviconUrl && !faviconBroken) {
    return (
      <img
        src={faviconUrl}
        alt=""
        className={`${classes.shell} ${classes.radius} object-contain ${
          dockVariant ? "bg-[rgba(255,255,255,0.06)] shadow-[0_8px_18px_rgba(0,0,0,0.18)]" : ""
        }`}
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => setFaviconBroken(true)}
      />
    );
  }

  return <QuickAppPresetIcon iconKey={preferredIconKey} variant={variant} />;
}
