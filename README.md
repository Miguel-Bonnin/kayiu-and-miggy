# Miggy & Kayiu

A scroll-driven pop-up book: our story from Lammas, Staines to the Palm House at Kew, ending on the save-the-date for **Saturday 15 May 2027**.

Plain static site (three.js from a CDN, no build step), hosted on GitHub Pages.

- `index.html`, `style.css`: the page.
- `js/main.js`: the scene and the story timeline. The whole story is a function of one number, scroll progress `p` from 0 to 1. Add `?p=0.4` to the URL to freeze a frame.
- `js/story.js`: **the words**: comic captions and speech bubbles, with the scroll range each one shows for. Edit this to change what we say.
- `js/book.js`, `js/cutmesh.js`, `js/paper.js`, `js/post.js`, `js/lib.js`: the pop-up book engine from lemo-opuscar (the opening book, curling page turn, paper cut-outs with silhouette shadows, depth of field, bloom).
- `js/hud.js`: the comic overlay.
- `assets/`: web-sized cut-outs (WebP) and the room (`assets/room/`: Poly Haven HDRI, walnut veneer, desk lamp, tea set, all CC0). Source art lives outside the repo.

Run locally: `python3 -m http.server` and open http://localhost:8000.

Pop-up technique (paper borders, card shadows, the book that opens into a stage) adapted from [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) by LemoLab, MIT licence: see `THIRD_PARTY_LICENSE-lemo-opuscar.txt`. Illustrations made with ChatGPT image generation from our own photos.
