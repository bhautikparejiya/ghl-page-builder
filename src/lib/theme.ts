/**
 * Per-page theme. New pages follow the sub-account's brand kit (useKit: true); pages created before
 * brand kits keep these values as their own theme.
 */
export interface Theme {
  primary: string;
  secondary: string;
  text: string;
  background: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
  useKit?: boolean;
}

export const DEFAULT_THEME: Theme = {
  primary: "#4f46e5",
  secondary: "#f59e0b",
  text: "#1f2937",
  background: "#ffffff",
  headingFont: "Poppins",
  bodyFont: "Inter",
  radius: 10,
};

/** Google fonts offered in the brand kit and typography controls. */
export const FONTS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato",
  "DM Sans",
  "Raleway",
  "Nunito",
  "Manrope",
  "Plus Jakarta Sans",
  "Outfit",
  "Sora",
  "Urbanist",
  "Work Sans",
  "Rubik",
  "Figtree",
  "Space Grotesk",
  "Lexend",
  "Archivo",
  "Barlow",
  "Source Sans 3",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Libre Baskerville",
  "Cormorant Garamond",
  "DM Serif Display",
  "Fraunces",
  "Oswald",
  "Bebas Neue",
  "Anton",
  "Caveat",
  "Pacifico",
];

/** Google Fonts stylesheet URL for a set of families. */
export function fontUrlFor(families: string[]): string {
  const fams = Array.from(new Set(families.filter((f) => /^[\w\s-]{1,60}$/.test(f))))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400`)
    .join("&");
  return fams ? `https://fonts.googleapis.com/css2?${fams}&display=swap` : "";
}

export function fontUrl(theme: Theme): string {
  return fontUrlFor([theme.headingFont, theme.bodyFont]);
}

/** CSS custom properties consumed by runtime.css and the widget blocks. */
export function themeCss(theme: Theme, selector: string): string {
  return `${selector}{--gpb-primary:${theme.primary};--gpb-secondary:${theme.secondary};--gpb-text:${theme.text};--gpb-bg:${theme.background};--gpb-radius:${theme.radius}px;--gpb-font-heading:'${theme.headingFont}',sans-serif;--gpb-font-body:'${theme.bodyFont}',sans-serif;}`;
}
