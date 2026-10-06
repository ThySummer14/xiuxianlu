# Xiuxianlu art direction

## Sanctuary at dawn, v1

- Asset: `assets/art/sanctuary-dawn-v1.webp`
- Intended use: a portrait environment layer behind the existing Canvas sanctuary scene. Draw interactive elements, characters, effects, text, buttons, and numbers natively above the artwork.
- Dimensions: 1024 × 1536 px (2:3 portrait).
- Delivery: opaque RGB WebP, quality 88, 263,506 bytes (about 257.3 KiB).
- Visual direction: original Chinese ink-and-mineral-color landscape with warm parchment mist, muted jade and indigo cliffs, an ancient pine, a tiny distant tiled shrine, and soft dawn-gold light. Fine brushwork and layered atmospheric depth replace a flat or generic cartoon look.
- Composition: scenic detail concentrated high and along the outer edges; the broad central and lower mist clearing is intentionally low contrast for native game content. Keep that open zone readable and avoid stretching the artwork. A light ivory scrim behind overlaid copy may be used if required by the final scene crop.
- Generation date: 2026-10-06 (UTC).
- Provenance: generated specifically for this project using the built-in image generation tool. No external reference image, third-party image download, API fallback, or copied illustration was used.
- Post-processing: RGB WebP encoding with Pillow only; original 1024 × 1536 dimensions retained. No visual compositing or AI-image alterations outside the image tool.
- Inspection: both original generation and optimized WebP inspected. No people, writing, logos, seals, UI, or borders present. Central/lower space remains clear. Detail and dawn palette survive compression.

### Exact generation prompt

Use case: stylized-concept.
Asset type: original portrait 2:3 environmental background painting for a refined Chinese cultivation fantasy Canvas game; one complete landscape asset, approximately 1024 by 1536 pixels.
Primary request: a tranquil mountain sanctuary at first light, exquisitely painted with Chinese ink and restrained mineral pigments. Layered pale distant peaks recede in ivory mist; nearer weathered jade-and-indigo cliffs and a graceful ancient pine frame the outer sides. A very small traditional tiled-roof shrine nestles high on a distant ledge in the upper third, suggesting an inhabited sacred landscape.
Composition: vertical immersive landscape; strongest mountain silhouette and intricate brushwork in the upper third and along the far left and right edges. Preserve a broad luminous open mist clearing across the central 55% and most of the lower half, with gently suggested stone terrace fading into mist at the very bottom. That open area is intentional negative space for separately drawn game objects; do not place any focal object or character there. Landscape should feel spatial, layered, and complete edge to edge, no card framing.
Style/medium: original premium hand-painted Chinese fantasy environment; refined ink outlines, nuanced dry-brush stone textures, translucent mineral-color washes on softly textured ivory xuan paper, sophisticated restrained detail, quiet atmosphere. Muted jade green and smoky indigo, warm parchment ivory fog, tiny soft dawn-gold highlights. Delicate warm dawn light from above, no glaring sun disk. Rich painterly artistry rather than generic cartoon, 3D render, photorealism, or flat vector.
Constraints: ENVIRONMENT ONLY. No people, creatures, silhouettes of people, censer, weapons, interactive objects, typography, writing, Chinese characters, calligraphy, stamps, seals, text, logo, watermark, borders, frames, numbers, buttons, UI or interface. No giant building or hard high-contrast shapes in the central and lower open mist.

### Integration notes

This asset does not contain gameplay affordances. Keep hit targets and numeric status completely native. Load asynchronously with an existing native-background fallback on failure. Preserve the 2:3 aspect ratio; center-align crops to maintain the mist clearing. At a 750 logical-pixel scene width, the source has sufficient resolution while staying below 350 KiB.


## Integrated behavior and checks

- Connected to `assets/draw.js` as the early-realm environment layer (炼气–金丹, including the title scene). Later realms keep their distinct procedural cloud-sea/palace progression. Foreground creatures, censer, interactable art and all UI remain native Canvas drawing.
- Loaded once, asynchronously; no retry loop or gameplay gate. Unavailable Image API, unsupported WebP, network errors or pending loads use the existing procedural village. Cover cropping preserves aspect ratio and fades into parchment near the scene floor.
- Mobile HUD text now has parchment plates over the illustration. Gold button text uses ink rather than ivory (computed contrast improved from1.6–2.1:1 to5.9–7.6:1). Primary button gradient was slightly darkened so both stops pass4.5:1 against its ivory labels.
- Full suite:113 passing tests, including image load/error, no state changes, resize without duplicate image loads, aspect ratio, later-realm preservation, file budget/header and contrast.
- The generated and compressed image itself was inspected. The underlying hotfixed mobile interface passed cloud Chromium narrow-window mouse and screenshot checks. The composed illustration still needs a separate rendered review after this release; no physical-phone testing is claimed.

- Integrated on top of Android hotfix43d8e9be. The pointerdown/move/up/cancel/leave handler block is byte-identical to that hotfix. Image success/failure during an active touch cannot change hitbox geometry, capture input, or clear its queued tap.
