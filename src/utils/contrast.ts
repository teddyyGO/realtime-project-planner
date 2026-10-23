function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function autoTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#1f2937';
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  return lum > 0.55 ? '#1f2937' : '#ffffff';
}

export function isValidHex(value: string): boolean {
  return /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeHex(value: string): string {
  let v = value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (v.length === 4) {
    v =
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('');
  }
  return v.toLowerCase();
}
