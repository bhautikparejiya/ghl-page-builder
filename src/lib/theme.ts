export interface Theme {
  primary: string;
  secondary: string;
  text: string;
  background: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
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
  "Playfair Display",
  "Merriweather",
  "Oswald",
];

export function fontUrl(theme: Theme): string {
  const fams = Array.from(new Set([theme.headingFont, theme.bodyFont]))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${fams}&display=swap`;
}

/** CSS custom properties consumed by runtime.css and the widget blocks. */
export function themeCss(theme: Theme, selector: string): string {
  return `${selector}{--gpb-primary:${theme.primary};--gpb-secondary:${theme.secondary};--gpb-text:${theme.text};--gpb-bg:${theme.background};--gpb-radius:${theme.radius}px;--gpb-font-heading:'${theme.headingFont}',sans-serif;--gpb-font-body:'${theme.bodyFont}',sans-serif;}`;
}
