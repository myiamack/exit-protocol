# Base44 Prompt 0 (REVISED): Avatar Studio — Modern Visual Direction
Game: Performance_Review: Exit_ProtocoL
Paste this INSTEAD of "SCREEN 3: AVATAR STUDIO" from the original Prompt 0. Everything else in Prompt 0 (sign-in, onboarding packet, display-name rules, data) stays the same. Keep the capital L at the end of the title exactly as written.

---

## VISUAL STYLE (this block overrides any default art style)

Render every avatar as a **soft 3D "vinyl toy" character**, built from clean layered vector shapes (SVG) with gradients and soft shadows so it stays razor-sharp on any screen:

- Original character design: oversized rounded-square head (about 60% of total height), smooth bean-shaped body, short stubby arms and legs. Do not copy any existing game's character.
- Materials: matte skin with a subtle vertical gradient (lighter at the top of the head), soft drop shadow under the chin and body, a small white highlight dot in each eye. Clothes have a gentle two-tone shading (main color + 15% darker shade on one side) to suggest volume.
- Lighting: imagine one soft studio light from the upper-left. Every part gets a consistent shadow direction.
- Hair is a smooth sculptural shape sitting on the head with a soft inner shadow where it meets the forehead — not a jagged outline.

**NEGATIVE CONSTRAINTS — strictly avoid:**
- NOT pixel art. NOT 8-bit, 16-bit, or retro-game style. NO visible square pixels, NO dithering, NO jagged step edges.
- NO outlines thinner than 2px, NO muddy gray-on-gray color pairings, NO clipart or stock-photo people.

## CONTRAST & READABILITY (the "easy to see" rules)

- Background of the Avatar Studio: soft neutral stage — a light cool-gray radial gradient (light mode) or deep slate (dark mode) — so the colorful character pops. The avatar itself must never sit on a busy or saturated background.
- Every selectable option appears as a **card with its own mini-preview**: a 64px thumbnail showing the avatar wearing that exact hair / top / accessory, not just a text label.
- Selected state: 3px solid outline in the deep teal accent (#1d5c6b), card scales to 1.05, soft shadow, and a filled checkmark badge in the corner. Unselected cards sit at 70% opacity. There must never be ambiguity about what is selected.
- Active swatch (colors): the color chip gets a white inner ring + dark outer ring so it reads on both light and dark mode.
- All interactive text at least 14px; tab labels 16px semibold; meet WCAG AA contrast (4.5:1) against the panel behind them.
- Phone layout: option cards in a 3-column grid with generous 12px gaps; live preview pinned on top, at least 240px tall, updating instantly with every tap.

## SCREEN 3: AVATAR STUDIO (content)

Live preview panel on the left (top on phones): the full character on a subtle circular "spotlight" floor shadow, name on a nameplate below, a Randomize button, and a slow idle animation (gentle 2px breathing bob) so the character feels alive.

Tabs with the same options as before:
- **Look tab:** skin tone (12), hair (None, Buzz, Short, Puff, Bun, Long, Locs), hair color (12), expression (Happy, Focused, Cool, Surprised).
- **Outfit tab:** top style (Tee, Hoodie, Blazer, Jersey "60"), top color, pants color, shoe color (12 colors each).
- **Accessories tab:** headwear (None, Beanie, Cap, Headphones, Crown, Hard hat, Bucket), eyewear (None, Glasses, Shades, Visor), gear (None, Laptop, Coffee, Backpack, Clipboard, Badge, Drone buddy), accessory color.

## BRAND PALETTE (unchanged, applied to UI chrome)

Cool off-white background, white panels, deep teal accent (#1d5c6b). Magenta (#c4166f) and cyan (#0a8fa6) reserved for glitch/system elements only — never on the avatar's normal clothing options. Fonts: Bricolage Grotesque (headings), Hanken Grotesk (body), JetBrains Mono (system text). Light and dark mode.

---

### Optional upgrade line (add if the builder supports it)
"If you can use Three.js or CSS 3D, give the live preview a slow idle rotation and let the player drag to spin the character 360°. Keep the flat layered-vector fallback for the option thumbnails."
