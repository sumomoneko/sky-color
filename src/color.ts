import assert = require("assert");

// https://gist.github.com/mryhryki/29804334efd00129447878b67bff9772

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

/** get higher contrast fontcolor.
 *
 * @param bgColor background color
 * @returns BLACK or WHITE.
 */
export const getFontColor = (bgColor: Rgb): Rgb => {
  const BLACK = { r: 0, g: 0, b: 0 };
  const WHITE = { r: 1.0, g: 1.0, b: 1.0 };

  const blackRatio = getContrastRatio(bgColor, BLACK);
  const whiteRatio = getContrastRatio(bgColor, WHITE);

  return whiteRatio > blackRatio ? WHITE : BLACK;
};

/** mix color  c1 * r + s2 * (1 - r)
 *
 * @returns mixed color
 */
export const mixColor = (c1: Rgb, c2: Rgb, ratio: number): Rgb => {
  const r = c1.r * ratio + c2.r * (1.0 - ratio);
  const g = c1.g * ratio + c2.g * (1.0 - ratio);
  const b = c1.b * ratio + c2.b * (1.0 - ratio);
  return { r, g, b };
};

export const hexToRgb = (hex: string): Rgb => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  assert(result);

  const rHex = parseInt(result[1], 16);
  const gHex = parseInt(result[2], 16);
  const bHex = parseInt(result[3], 16);

  const r = rHex / 255;
  const g = gHex / 255;
  const b = bHex / 255;
  return { r, g, b };
};

export const rgbToHex = (c: Rgb) => {
  const fmt = (c: number) => {
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${fmt(c.r)}${fmt(c.g)}${fmt(c.b)}`;
};

// input: h as an angle in [0,360] and s,l in [0,1] - output: r,g,b in [0,1]
export const hslToRgb = (hsl: Hsl): Rgb => {
  const { h, s, l } = hsl;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return { r: f(0), g: f(8), b: f(4) };
};

// in: r,g,b in [0,1], out: h in [0,360) and s,l in [0,1]
export const rgbToHsl = (rgb: Rgb): Hsl => {
  const { r, g, b } = rgb;
  const v = Math.max(r, g, b);
  const c = v - Math.min(r, g, b);
  const f = 1 - Math.abs(v + v - c - 1);
  const h =
    c && (v === r ? (g - b) / c : v === g ? 2 + (b - r) / c : 4 + (r - g) / c);

  return { h: 60 * (h < 0 ? h + 6 : h), s: f ? c / f : 0, l: (v + v - c) / 2 };
};

const getRGBForCalculateLuminance = (color: number): number => {
  if (color <= 0.03928) {
    return color / 12.92;
  } else {
    return Math.pow((color + 0.055) / 1.055, 2.4);
  }
};

const getRelativeLuminance = (color: Rgb): number => {
  const { r, g, b } = color;
  const R = getRGBForCalculateLuminance(r);
  const G = getRGBForCalculateLuminance(g);
  const B = getRGBForCalculateLuminance(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const getContrastRatio = (color1: Rgb, color2: Rgb): number => {
  const luminance1 = getRelativeLuminance(color1);
  const luminance2 = getRelativeLuminance(color2);
  const bright = Math.max(luminance1, luminance2);
  const dark = Math.min(luminance1, luminance2);
  return (bright + 0.05) / (dark + 0.05);
};
