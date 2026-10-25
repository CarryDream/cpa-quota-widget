# Apple 风格 Logo 备选 v2

生成方式：内置 imagegen。两款均为 PNG 视觉设计稿。

- A：`cpa-quota-widget-apple-card-v2.png`，浅色悬浮额度卡片，白色画布。
- B：`cpa-quota-widget-apple-q-v2.png`，蓝色 Q 形额度环，底板外透明。
- 已采用 A 作为桌面工具图标：图形与悬浮卡片、双额度窗口直接对应。`src-tauri/icons/` 和 `public/favicon.ico` 均由 A 原图经 Tauri CLI 导出；托盘复用应用图标。
- 设计参考：[Apple App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)，强调主体清晰和分层。这些 PNG 不包含 Icon Composer 原生分层工程。

## A：原始生成提示词

```text
Use case: logo-brand
Asset type: a single finished desktop app icon concept for a CPA quota floating widget. The product monitors remaining AI account quotas in a small always-on-top desktop panel.
Design direction: original Apple-platform app-icon aesthetic: exceptionally simple silhouette, optically balanced shapes, continuous curved corners, soft dimensionality from a few clear layers, restrained gradients and fine upper-left lighting. The icon must be calm, precise, professionally art-directed and immediately readable at 32 pixels. This is an original app identity, not a copy of any existing Apple icon. No Apple logo.
Composition: a square canvas containing just ONE large, front-facing continuous-corner squircle icon tile. The tile occupies about 90% of canvas width. Real transparent alpha outside the tile silhouette. A centered bold emblem occupies about 64% of the tile width, with balanced generous internal padding. No angled camera view. No scene, no device, no mockup, no pedestal.
Avoid: words, labels, typography, numerals, percentage signs, corner window-control dots, tiny details, watermark, extra badges, sparkles, charts, metallic chrome, deep extrusion, noisy textures, neon glow, dramatic drop shadows. Do not show a checkerboard. Keep the visual idea simple rather than rendering actual UI.
Variant A — "Floating quota card", light appearance.
Background tile: soft porcelain / very pale cool silver with the gentlest cool-gray tonal gradient, a smooth immaculate continuous-corner silhouette. This is a light app icon.
Emblem: exactly two overlapping floating cards with elegant rounded corners, nearly frontal. The rear card is a solid rich indigo-blue, shifted a little upward and right. The foreground card is a slightly translucent frosted off-white slab with a subtly blue-tinted rim, not a hollow outline; its opaque-enough face and subtle edge lighting make the overlapping layers clear. Keep thickness almost flat, with only a very soft small contact shadow between the cards.
Inside the front card: exactly two short, thick, horizontal capsule bars, aligned at the left and spaced generously. Upper bar longer and vivid indigo #6366F1, lower bar shorter and cyan #22D3EE. Both bars sit cleanly on the front face. Bold clean shapes, superb contrast. These bars symbolize remaining quota, not a menu. Optically center the entire overlapping-card emblem. Avoid the heavy white-outline look of older icons. No extra symbols.
```

## A：最终白底修正提示词

输入为 A 的原始图像；此步骤生成最终交付版本。

```text
Use case: precise-object-edit
Input image 1 is an edit target: the finished light porcelain app icon with indigo rear card and two quota bars.
Change ONLY the background beyond the outer large rounded-square porcelain tile. Output a completely OPAQUE square PNG with a pure solid white #FFFFFF canvas outside the tile. All of the external empty/transparent/black-displayed area and every stray edge patch must become a pristine uniform white background. No alpha transparency anywhere, not even at the corners. Do not produce a cutout. The white surrounding canvas should meet the icon tile in a clean, regular continuous-corner silhouette, with no speckles or noise.
Preserve exactly the pale icon tile, overlapping blue and frosted cards, indigo and cyan capsule bars, their shapes and positions, the existing internal soft lighting, the scale and all existing icon content. Do not add any object or text. Do not introduce a drop shadow outside the tile. The only requested change is a clean opaque white background and clean outer silhouette.
```

## B：完整生成提示词

```text
Use case: logo-brand
Asset type: a single finished desktop app icon concept for a CPA quota floating widget. The product monitors remaining AI account quotas in a small always-on-top desktop panel.
Design direction: original Apple-platform app-icon aesthetic: exceptionally simple silhouette, optically balanced shapes, continuous curved corners, soft dimensionality from a few clear layers, restrained gradients and fine upper-left lighting. The icon must be calm, precise, professionally art-directed and immediately readable at 32 pixels. This is an original app identity, not a copy of any existing Apple icon. No Apple logo.
Composition: a square canvas containing just ONE large, front-facing continuous-corner squircle icon tile. The tile occupies about 90% of canvas width. Real transparent alpha outside the tile silhouette. A centered bold emblem occupies about 64% of the tile width, with balanced generous internal padding. No angled camera view. No scene, no device, no mockup, no pedestal.
Avoid: words, labels, typography, numerals, percentage signs, corner window-control dots, tiny details, watermark, extra badges, sparkles, charts, metallic chrome, deep extrusion, noisy textures, neon glow, dramatic drop shadows. Do not show a checkerboard. Keep the visual idea simple rather than rendering actual UI.
Variant B — "Quota Q", dark blue appearance.
Background tile: a sophisticated deep indigo-blue field, smoothly transitioning from restrained royal blue in the upper-left to midnight indigo in the lower-right, with no noisy texture and no shiny outer rim. This is a blue app icon.
Emblem: ONE large, thick, geometrically precise circular quota ring made from slightly frosted luminous ice-white material with subtle soft edge highlights, not chrome. At its lower-right around the 4:30 position, integrate a very short broad diagonal rounded tail, unmistakably forming the letter Q as a custom graphic symbol. The tail is part of the ring, stays compact and does not become a long magnifying-glass handle.
The final roughly quarter of the ring towards the lower-right is a vivid cyan #22D3EE segment with a hairline-thin clean structural seam at each end, subtly communicating remaining quota. Use a single circular band and a completely empty center; no inner disc, no ticks, no meter needle, no text, no extra bars. Ring stroke is bold, about one fifth of its outer diameter. Restrained dimensionality, broad simple highlights, very subtle soft contact shadow. Preserve a distinctive and elegant Q silhouette at 32px.
```

