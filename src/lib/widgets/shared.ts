/** Stroke icon (24×24 grid) for widget tiles and panel buttons. */
export const icon = (paths: string, size = 30) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const alignIcon = (lines: [number, number][]) =>
  icon(lines.map(([x1, x2], i) => `<path d="M${x1} ${6 + i * 4}h${x2 - x1}"/>`).join(""), 16);

export const ALIGN = [
  { value: "left", label: "Left", icon: alignIcon([[4, 20], [4, 14], [4, 18], [4, 12]]) },
  { value: "center", label: "Center", icon: alignIcon([[4, 20], [7, 17], [5, 19], [8, 16]]) },
  { value: "right", label: "Right", icon: alignIcon([[4, 20], [10, 20], [6, 20], [12, 20]]) },
  { value: "justify", label: "Justify", icon: alignIcon([[4, 20], [4, 20], [4, 20], [4, 20]]) },
];
