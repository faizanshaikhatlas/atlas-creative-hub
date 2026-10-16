// Curated, open-licensed (OFL) font set. next/font/google self-hosts the font
// files at build time and serves them from our own origin — no runtime request
// to any external CDN. Each font exposes a CSS variable (applied to <html> in
// the root layout so its @font-face is active) and a resolved `style.fontFamily`
// string we hand to Fabric for canvas rendering.

import {
  Inter,
  Montserrat,
  Poppins,
  Oswald,
  Bebas_Neue,
  Anton,
  Playfair_Display,
  Pacifico,
} from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-montserrat", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-poppins", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-oswald", display: "swap" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: ["400"], variable: "--font-bebas", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: ["400"], variable: "--font-anton", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-playfair", display: "swap" });
const pacifico = Pacifico({ subsets: ["latin"], weight: ["400"], variable: "--font-pacifico", display: "swap" });

/**
 * Registry consumed by the font picker. `css` is the full family list for
 * Fabric's `fontFamily`; `singleWeight` marks display fonts that only ship 400
 * so the bold toggle can be disabled for them.
 */
export const FONTS = [
  { label: "Inter", css: inter.style.fontFamily },
  { label: "Montserrat", css: montserrat.style.fontFamily },
  { label: "Poppins", css: poppins.style.fontFamily },
  { label: "Oswald", css: oswald.style.fontFamily },
  { label: "Bebas Neue", css: bebas.style.fontFamily, singleWeight: true },
  { label: "Anton", css: anton.style.fontFamily, singleWeight: true },
  { label: "Playfair Display", css: playfair.style.fontFamily },
  { label: "Pacifico", css: pacifico.style.fontFamily, singleWeight: true },
];

// Space-separated CSS variable class names for the root <html> element.
export const fontVariables = [
  inter.variable,
  montserrat.variable,
  poppins.variable,
  oswald.variable,
  bebas.variable,
  anton.variable,
  playfair.variable,
  pacifico.variable,
].join(" ");

/** Find a registry entry whose `css` matches a stored fontFamily value. */
export function findFontByCss(css) {
  if (!css) return FONTS[0];
  return FONTS.find((f) => f.css === css) || null;
}

/** The primary family token (used to request the font via document.fonts). */
export function primaryFamily(css) {
  if (!css) return "";
  return css.split(",")[0].trim();
}
