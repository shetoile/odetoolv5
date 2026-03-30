import { useEffect, useRef } from "react";
import { getNode, syncExternalMirrorEntries } from "@/lib/nodeService";

type UseDesktopMirrorSyncParams = {
  isDesktopRuntime: boolean;
  activeProjectRootId: string | null;
  currentFolderId: string | null;
  refreshTree: () => Promise<void>;
  navigateTo: (folderId: string | null) => Promise<void>;
  suspendSync?: boolean;
};

export function useDesktopMirrorSync({
  isDesktopRuntime,
  activeProjectRootId,
  currentFolderId,
  refreshTree,
  navigateTo,
  suspendSync = false
}: UseDesktopMirrorSyncParams) {
  const currentFolderIdRef = useRef<string | null>(currentFolderId);

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId;
  }, [currentFolderId]);

  useEffect(() => {
    if (!isDesktopRuntime || suspendSync) return;

    let cancelled = false;
    let inFlight = false;

    const syncFromDesktopMirror = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const imported = await syncExternalMirrorEntries(activeProjectRootId ?? null);
        if (cancelled || imported <= 0) return;
        const restoreFolderId =
          currentFolderIdRef.current && (await getNode(currentFolderIdRef.current))
            ? currentFolderIdRef.current
            : activeProjectRootId ?? null;
        await refreshTree();
        if (cancelled) return;
        await navigateTo(restoreFolderId);
      } catch {
        // Ignore mirror import polling errors to keep UI responsive.
      } finally {
        inFlight = false;
      }
    };

    void syncFromDesktopMirror();

    const onFocus = () => {
      void syncFromDesktopMirror();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncFromDesktopMirror();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isDesktopRuntime, activeProjectRootId, refreshTree, navigateTo, suspendSync]);
}
