# Wrap Atelier / 车衣画廊

Static GitHub Pages gallery for Model Y Juniper Premium digital wrap designs.

- Chinese topic filters, character/title search, local favorites and per-design sharing URLs.
- Download the original verified 1024² PNG directly.
- Drag/zoom 3D Juniper preview, turntable mode, moving road/wheels and three lighting conditions.
- AI concept renders and actual atlas inspection sheets have separate view tabs.
- All runtime scripts and model assets are served locally; no CDN or API key required.

Open `/itasha/` on a web server. Opening `index.html` as a `file://` URL will not work because the viewer loads ES modules and a GLB.

The site's 3D vehicle is an artist-authored 2025 Juniper, not Tesla's proprietary dashboard mesh. The viewer reads the downloadable atlas directly and applies an adapted spatial projection. It shows real interactive 3D and actual downloaded artwork, but small seams and curvature can differ from the in-car visualization. It is not physical vinyl production geometry.

`catalog.json` indexes ready designs. Each record points to its original PNG, a compressed concept image, an inspection image and a thumbnail. Add designs only after checking their source manifest. Original generation prompts and source images are retained in the separate full design collection.

## Credits

- Model: **2025 Tesla Model Y** by [BloxBloger](https://sketchfab.com/BloxBloger), [original listing](https://sketchfab.com/3d-models/2025-tesla-model-y-619601e7800d418da5922c4fa7833f74), [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Noncommercial use; preserve attribution. GLB conversion and material naming by [Tesla Studio](https://github.com/aditano/tesla-studio/tree/main/public/models/juniper). Website-specific projection, lighting and wheel animation are additional adaptations. See `assets/model/CREDITS.md`.
- Three.js r180, MIT. Vendored license at `vendor/three/LICENSE`.
- Official wrap template: [Tesla custom-wraps](https://github.com/teslamotors/custom-wraps/tree/master/modely-2025-premium).
- Wrap art and concept images: built-in ImageGen, individually art-directed and reviewed. Fan art characters belong to their respective owners. This is a personal noncommercial gallery, not an official collaboration.

Only `itasha/` is part of this change; the personal homepage and other projects are not replaced.
