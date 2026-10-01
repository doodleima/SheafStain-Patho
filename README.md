# SheafStain project page

Source of the project page for **SheafStain: Sheaf-Theoretic Schrödinger Bridge for Spatially and Biologically Coherent Virtual Staining** (NeurIPS 2026).

- Page: https://doodleima.github.io/SheafStain-Patho/
- Paper: https://arxiv.org/abs/2606.11846
- Code: https://github.com/deepnoid-ai/SheafStain

The site is static HTML, CSS and JavaScript with no build step. `gallery.html` and the montage on
`index.html` read `assets/gallery/manifest.json`, so preview it over HTTP:

```bash
python3 -m http.server 8000
```

Layout, palette and components are adapted from the STREAM project page
([chokevin8/STREAM-Patho](https://github.com/chokevin8/STREAM-Patho)).
