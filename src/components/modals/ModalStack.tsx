import type { ReactNode } from "react";

interface ModalStackProps {
  children: ReactNode;
}

export function ModalStack({ children }: ModalStackProps) {
  return <>{children}</>;
}
