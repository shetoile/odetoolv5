export function getNodeTooltipLabel(input: {
  title: string;
  description?: string | null;
  numberLabel?: string | null;
}): string | null {
  const description = input.description?.trim();
  return description && description.length > 0 ? description : null;
}
