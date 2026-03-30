import type { ReactNode } from "react";

interface TimelineViewProps {
  children: ReactNode;
}

export function TimelineView({ children }: TimelineViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
