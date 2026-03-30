import { useMemo } from "react";
import type { AppNode } from "@/lib/types";

interface HyperTreeProps {
  nodes: AppNode[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}

interface TreeRow {
  id: string;
  name: string;
  depth: number;
}

function buildRows(nodes: AppNode[]): TreeRow[] {
  const byParent = new Map<string, AppNode[]>();
  for (const node of nodes) {
    const bucket = byParent.get(node.parentId) ?? [];
    bucket.push(node);
    byParent.set(node.parentId, bucket);
  }
  for (const children of byParent.values()) {
    children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const rows: TreeRow[] = [];
  const visit = (parentId: string, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      rows.push({ id: child.id, name: child.name, depth });
      visit(child.id, depth + 1);
    }
  };

  visit("__ROOT__", 0);
  return rows;
}

export default function HyperTree({ nodes, selectedNodeId, onSelect }: HyperTreeProps) {
  const rows = useMemo(() => buildRows(nodes), [nodes]);

  return (
    <div className="h-full overflow-auto px-2 py-2">
      {rows.map((row) => (
        <button
          key={row.id}
          onClick={() => onSelect(row.id)}
          className={`mb-1 flex w-full items-center rounded-md border px-2 py-1.5 text-left text-sm transition ${
            selectedNodeId === row.id
              ? "border-[var(--aether-accent)] bg-[rgba(36,121,196,0.32)]"
              : "border-transparent bg-[rgba(8,26,50,0.34)] hover:border-[var(--aether-border)] hover:bg-[rgba(28,72,118,0.32)]"
          }`}
          style={{ paddingLeft: `${8 + row.depth * 14}px` }}
        >
          <span className="truncate">{row.name}</span>
        </button>
      ))}
      {rows.length === 0 && (
        <p className="px-2 py-3 text-sm text-[var(--aether-subtle)]">No nodes yet.</p>
      )}
    </div>
  );
}
