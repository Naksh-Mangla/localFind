---
name: LocalFind Narrative
colors:
  surface: '#fff8f4'
  surface-dim: '#e2d8d1'
  surface-bright: '#fff8f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf2ea'
  surface-container: '#f6ece5'
  surface-container-high: '#f1e6df'
  surface-container-highest: '#ebe1da'
  on-surface: '#1f1b17'
  on-surface-variant: '#56423c'
  inverse-surface: '#352f2b'
  inverse-on-surface: '#f9efe8'
  outline: '#89726b'
  outline-variant: '#ddc0b8'
  surface-tint: '#9f4122'
  primary: '#9c3e20'
  on-primary: '#ffffff'
  primary-container: '#bc5636'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59f'
  secondary: '#745b1a'
  on-secondary: '#ffffff'
  secondary-container: '#ffdc8e'
  on-secondary-container: '#795f1e'
  tertiary: '#5d5c55'
  on-tertiary: '#ffffff'
  tertiary-container: '#76746d'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59f'
  on-primary-fixed: '#3a0a00'
  on-primary-fixed-variant: '#802a0d'
  secondary-fixed: '#ffdf9a'
  secondary-fixed-dim: '#e4c378'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4302'
  tertiary-fixed: '#e6e2d9'
  tertiary-fixed-dim: '#c9c6be'
  on-tertiary-fixed: '#1c1c17'
  on-tertiary-fixed-variant: '#484741'
  background: '#fff8f4'
  on-background: '#1f1b17'
  surface-variant: '#ebe1da'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 20px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is built on the philosophy of "Digital Neighborhoods." It bridges the gap between the efficiency of e-commerce and the warmth of a local farmers' market. The target audience includes urban residents seeking convenience with a conscience and small business owners looking for a modern digital storefront.

The design style is **Warm Minimalism**. It utilizes heavy whitespace to ensure clarity in a product-dense environment, but softens the interface through a palette of sun-drenched neutrals and organic textures. The emotional response should be one of trust, proximity, and ease. Every interaction should feel like a friendly nod from a local merchant.

## Colors

The palette is inspired by natural clay and sunlight to evoke a sense of community and earthiness.

- **Primary (Terracotta):** Used for primary actions, price points, and merchant "Verified" statuses. It provides a confident, grounded energy.
- **Secondary (Soft Amber):** Used for highlighting proximity (the "2km" badge), ratings, and promotional tags. It acts as a warm accent that draws the eye without creating urgency.
- **Surface (Warm White):** The background is not a sterile pure white, but a warm cream (#FFFBF2) that reduces eye strain and feels more approachable.
- **Neutral (Charcoal Coffee):** A deep, warm grey used for typography to ensure high legibility while maintaining the "warm" aesthetic.

## Typography

The design system uses **Plus Jakarta Sans** as the primary typeface for its modern, friendly, and slightly rounded geometric shapes, which perfectly align with the community-focused brand. 

- **Headlines:** Use Bold weights with slight negative letter-spacing to create a "contained" and professional look.
- **Body:** Use Regular weight for high readability in product descriptions and shopkeeper bios.
- **Labels:** **Work Sans** is introduced for utility-heavy text (e.g., "DISTANCE," "OPEN UNTIL," "IN STOCK") to provide a subtle professional distinction from narrative text.

## Layout & Spacing

This design system uses a **Fluid Mobile-First Grid** centered on a 4px baseline.

- **Mobile:** A 4-column grid with 20px outside margins. This generous margin keeps the content from feeling "cramped" against the device edges, reinforcing the airy, minimalist feel.
- **Vertical Rhythm:** Elements are spaced in multiples of 8px. Use 16px (stack-md) for most component spacing and 32px (stack-lg) to separate major content sections like "Shops Near You" and "Trending Products."
- **Shopkeeper View:** For the merchant dashboard, the layout shifts to a structured list-view with tighter vertical padding (8px) to allow for data density when managing inventory.

## Elevation & Depth

To maintain a "clean" feel, depth is created primarily through **Tonal Layers** rather than heavy shadows.

- **Level 0 (Base):** The Warm White background.
- **Level 1 (Cards):** Pure white (#FFFFFF) surfaces with a very soft, diffused shadow (0px 4px 20px, 4% opacity of the Neutral color). This makes products appear to "float" slightly above the neighborhood map.
- **Level 2 (Active Elements):** Buttons and active chips use a more pronounced shadow (0px 8px 16px, 10% opacity of the Primary color) to indicate interactability.
- **Glassmorphism:** Use a light backdrop blur (12px) for the bottom navigation bar and sticky headers to maintain a sense of context and spatial awareness of the map beneath.

## Shapes

The shape language is defined by **Soft Geometricism**. 

- **Default Corners:** 12px for standard cards and input fields.
- **Large Elements:** 24px for top-level containers and merchant profile banners.
- **Interactive Elements:** Buttons utilize a slightly more aggressive rounding (16px) to make them feel "squishy" and touch-friendly, encouraging interaction from shoppers.
- **Icons:** Should always feature rounded terminals and a 2px stroke weight to match the weight of the typography.

## Components

- **Buttons:** Primary buttons are solid Terracotta with white text. Secondary buttons are Soft Amber with the Neutral Charcoal text. Ghost buttons use a 1.5px border of the Primary color.
- **Product Cards:** Feature a 1:1 aspect ratio for images. The bottom 40% of the card is reserved for the product name, price, and a small "distance" tag in the top right corner.
- **Proximity Chips:** Small, rounded-pill labels using the Secondary (Amber) background. They display "0.5km away" or "Ready in 10m."
- **Merchant Switcher:** A distinctive toggle for shopkeepers to flip between "Consumer View" and "Shop Management." This uses a high-contrast background to ensure it's never accidentally triggered.
- **Input Fields:** Use the Warm White background with a subtle 1px border. On focus, the border thickens to 2px Primary Terracotta.
- **Navigation:** A floating bottom bar with semi-transparent blur, using icons that represent "Home," "Map," "Orders," and "Profile."