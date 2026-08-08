/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "inverse-surface": "#352f2b",
        "inverse-primary": "#ffb59f",
        "on-surface": "#1f1b17",
        "surface-bright": "#fff8f4",
        "on-primary": "#ffffff",
        "on-tertiary-fixed": "#1c1c17",
        "on-error": "#ffffff",
        "tertiary": "#5d5c55",
        "outline-variant": "#ddc0b8",
        "surface-tint": "#9f4122",
        "on-tertiary-container": "#fffbff",
        "surface-container": "#f6ece5",
        "surface-dim": "#e2d8d1",
        "primary": "#9c3e20",
        "surface": "#fff8f4",
        "tertiary-fixed-dim": "#c9c6be",
        "on-secondary-fixed": "#251a00",
        "primary-container": "#bc5636",
        "on-primary-container": "#fffbff",
        "primary-fixed-dim": "#ffb59f",
        "secondary-fixed": "#ffdf9a",
        "outline": "#89726b",
        "inverse-on-surface": "#f9efe8",
        "on-error-container": "#93000a",
        "secondary-fixed-dim": "#e4c378",
        "on-tertiary-fixed-variant": "#484741",
        "primary-fixed": "#ffdbd0",
        "tertiary-fixed": "#e6e2d9",
        "tertiary-container": "#76746d",
        "on-secondary-fixed-variant": "#5a4302",
        "surface-variant": "#ebe1da",
        "on-primary-fixed-variant": "#802a0d",
        "on-background": "#1f1b17",
        "secondary-container": "#ffdc8e",
        "error-container": "#ffdad6",
        "on-tertiary": "#ffffff",
        "secondary": "#745b1a",
        "surface-container-high": "#f1e6df",
        "on-secondary": "#ffffff",
        "background": "#fff8f4",
        "error": "#ba1a1a",
        "surface-container-lowest": "#ffffff",
        "on-primary-fixed": "#3a0a00",
        "on-surface-variant": "#56423c",
        "surface-container-highest": "#ebe1da",
        "surface-container-low": "#fcf2ea",
        "on-secondary-container": "#795f1e"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "stack-lg": "32px",
        "container-margin": "20px",
        "stack-sm": "8px",
        "unit": "4px",
        "gutter": "12px",
        "stack-md": "16px"
      },
      fontFamily: {
        "display-lg": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg-mobile": ["Plus Jakarta Sans", "sans-serif"],
        "body-lg": ["Plus Jakarta Sans", "sans-serif"],
        "label-caps": ["Work Sans", "sans-serif"],
        "title-md": ["Plus Jakarta Sans", "sans-serif"],
        "body-sm": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "sans-serif"]
      },
      fontSize: {
        "display-lg": ["40px", { "lineHeight": "48px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "headline-lg-mobile": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
        "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "title-md": ["18px", { "lineHeight": "24px", "fontWeight": "600" }],
        "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
        "headline-lg": ["28px", { "lineHeight": "36px", "fontWeight": "700" }]
      }
    }
  },
  plugins: []
}
