import type { ReactNode } from "react";

interface DesktopViewProps {
  children: ReactNode;
}

export function DesktopView({ children }: DesktopViewProps) {
  return <>{children}</>;
}
