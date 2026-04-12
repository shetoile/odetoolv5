interface HtmlNodeTabPanelProps {
  title: string;
  src: string | null;
  onActivateSurface: () => void;
}

export function HtmlNodeTabPanel({ title, src, onActivateSurface }: HtmlNodeTabPanelProps) {
  return (
    <div
      className="flex-1 min-h-0 overflow-hidden px-5 py-6"
      data-ode-surface="grid"
      onMouseDownCapture={onActivateSurface}
    >
      {src ? (
        <div className="h-full overflow-hidden rounded-[24px] border border-[rgba(88,197,255,0.16)] bg-[rgba(2,10,18,0.88)] shadow-[0_24px_56px_rgba(0,0,0,0.28)]">
          <iframe title={title} src={src} className="h-full min-h-[72vh] w-full border-0 bg-white" />
        </div>
      ) : (
        <div className="flex h-full min-h-[60vh] items-center justify-center rounded-[24px] border border-dashed border-[rgba(88,197,255,0.18)] bg-[rgba(4,22,36,0.42)] px-6 text-center text-[0.98rem] text-[var(--ode-text-dim)]">
          HTML file unavailable.
        </div>
      )}
    </div>
  );
}
