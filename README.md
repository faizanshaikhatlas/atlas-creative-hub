# Design Studio

A lightweight, Canva-style design editor that runs entirely in the browser.

**Milestone 1** — a working **1280 × 720 YouTube thumbnail editor**: artboard,
image upload, editable text, shapes, selection/movement, zoom, undo/redo, local
save/reopen, and PNG export.

**Milestone 2 — Editing precision & structure:** stable object IDs and names, a
**Layers panel** (select, show/hide, lock/unlock, rename, reorder, delete), a
right-click **context menu**, **group/ungroup**, **alignment & distribution**,
**smart guides with snapping**, and a full keyboard shortcut map. All backward
compatible with projects saved in Milestone 1.

**Milestone 3 — Multi-page documents:** a project is now a **multi-page**
document. Add / duplicate / reorder / delete pages from the bottom filmstrip,
switch between them without losing edits, each page has its **own canvas,
background and thumbnail**, **undo/redo is isolated per page**, and everything
autosaves. The IndexedDB schema was migrated to **v2** — existing single-page
(M1/M2) projects upgrade automatically with no data loss.

**Milestone 4 — Canvas sizes & presets:** a **New design** picker with presets
(YouTube Thumbnail & Banner, Instagram Post & Story, Facebook/X posts,
Presentation) plus **custom dimensions**. Each page can be **resized
independently** (or all at once) from the Properties panel, sizes **persist per
page**, and **PNG export matches the page's exact dimensions**.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), JavaScript only |
| UI | React 19 |
| Styling | Tailwind CSS v4 (single `app/globals.css` entry, no component CSS) |
| Canvas engine | Fabric.js 7 (loaded **client-side only**) |
| Editor state | Zustand 5 |
| Local persistence | IndexedDB via Dexie 4 |
| Icons | Lucide React |

## Architecture

The three concerns are deliberately separated:

- **Fabric.js owns the canvas** — every object and its rendering. All Fabric
  access is funnelled through one reusable module, `lib/fabric/canvasController.js`.
- **Zustand owns UI state** — active tool, zoom, a serializable mirror of the
  selected object's properties, save status, and undo/redo availability
  (`lib/store/editorStore.js`). It never stores canvas objects.
- **Dexie owns persistence** — each project is one row (serialized Fabric JSON +
  a PNG thumbnail) in IndexedDB (`lib/db/projects.js`).

History (undo/redo) is isolated in `lib/history/history.js` as a
framework-agnostic snapshot stack.

```
app/
  layout.js              Root layout + self-hosted Inter font (no external CDN)
  globals.css            The single Tailwind v4 entry
  page.js                Home: project grid + "New YouTube Thumbnail"
  editor/[id]/page.js    Loads the editor client-side only (next/dynamic, ssr:false)
components/editor/
  Editor.js              Shell: toolbar + panels + canvas, shortcuts, autosave
  CanvasStage.js         Mounts Fabric, wires callbacks, fit-to-view, wheel zoom
  Toolbar.js             Undo/redo, zoom, export, save, project name
  ElementsPanel.js       Add text / shapes / upload image
  PropertiesPanel.js     Edit the selected object
  LayersPanel.js         Layer list: select/show/hide/lock/rename/reorder/delete
  AlignBar.js            Contextual align / distribute / group bar
  ContextMenu.js         Right-click menu
  PagesBar.js            Bottom page filmstrip (add/dupe/reorder/delete/rename)
components/
  NewDesignDialog.js     Home "New design" size picker (presets + custom)
lib/
  fabric/canvasController.js   The only module that talks to Fabric
  store/editorStore.js         Zustand UI state
  history/history.js           Undo/redo snapshot stack
  db/projects.js               Dexie schema + CRUD
```

## Run it

Requires Node 20+ (developed on Node 24).

```bash
npm install
npm run dev
```

Open the printed URL (default <http://localhost:3000>).

Production build:

```bash
npm run build
npm start
```

## How to test it manually

1. On the home page, click **New design** → pick a preset (or enter a custom
   size) → you land in the editor on that artboard.
2. **Add text** (double-click it on the canvas to edit the words), add a
   **Rectangle / Circle / Triangle / Line**, and **Upload** an image from your
   device.
3. Click an object to select it; drag to move, use the corner handles to
   resize/rotate. The right **Properties** panel edits color, font, size,
   border, opacity, position, rotation, and layer order.
4. **Zoom** with the toolbar (or `Ctrl`/`Cmd` + mouse wheel) and **Fit** to
   re-center.
5. **Undo/redo** with the toolbar or `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`.
   `Delete`/`Backspace` removes the selected object.
6. Changes **autosave** to your browser after ~1.2s (watch the "Saved"
   indicator). Go **Back**; the project appears in the grid with a live
   thumbnail. Reopen it — your design is restored.
7. **Export PNG** downloads the design at full 1280 × 720 resolution.
8. **Layers** (left panel → *Layers* tab): click to select, toggle the eye to
   show/hide, the padlock to lock, double-click the name to rename, the
   chevrons to reorder, the trash to delete.
9. Select 2+ objects (marquee-drag, or `Ctrl/Cmd+A`) → the floating bar aligns,
   distributes, and **groups** them; a group can be **ungrouped**.
10. Drag an object near another's edge/center or the page center → **pink smart
    guides** appear and the object snaps.
11. **Right-click** any object for a context menu (duplicate, layer order,
    lock, hide, delete).
12. **Pages** (bottom filmstrip): **Add** a page, edit it, switch back — each
    page keeps its own objects, background and undo history. Duplicate, reorder
    (hover a page → arrows), rename (double-click the name) and delete pages.
13. **Page size** (right panel, nothing selected): change the current page's
    size via the preset dropdown or custom W×H, or **Apply to all pages**. Pages
    can have different sizes; **Export PNG** matches the active page exactly.

### Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` | Undo / redo |
| `Delete` / `Backspace` | Delete selection |
| Arrow keys (`+Shift` = 10px) | Nudge selection |
| `Ctrl/Cmd+D` | Duplicate |
| `Ctrl/Cmd+A` | Select all |
| `Ctrl/Cmd+G` / `Ctrl/Cmd+Shift+G` | Group / ungroup |
| `Ctrl/Cmd+]` / `Ctrl/Cmd+[` | Bring forward / send backward |
| `Esc` | Deselect / close menu |

### Automated tests

Two Playwright suites drive the running dev server and assert real canvas state:

- **Milestone 1** (core workflows): **21/21** checks, zero console errors.
- **Milestone 2** (IDs, layers, lock/hide/rename/reorder, group/ungroup,
  align/distribute, snapping math, keyboard shortcuts, right-click menu,
  persistence of lock/hide/name, legacy-JSON backward compatibility): **41/41**
  checks, zero console errors.
- **Milestone 3** (add/switch/reorder/duplicate/delete pages, per-page content
  isolation, per-page background, **per-page undo/redo isolation**, multi-page
  persistence across reload, and **v1→v2 migration** of a single-page record
  with full content preservation): **29/29** checks, zero console errors.
- **Milestone 4** (preset + custom sizes, dimension clamping, per-page resize,
  per-page size isolation, export-matches-size, size persistence across reload,
  apply-to-all): **17/17** checks, zero console errors.

## Known limitations

- **Local to one browser.** Projects live in that browser's IndexedDB. They do
  not sync across browsers, devices, or private windows. Opening a project URL
  in a different browser shows a graceful "Project not found" screen.
- **History is per session, and per page.** Each page has its own undo/redo
  stack while the editor is open; the document is saved, but the stacks are not
  persisted across reloads (reopening starts fresh history for every page).
- **Very large custom sizes** (near the 5000px cap, especially with several
  images) increase canvas memory and export time; dimensions are clamped to
  50–5000px per side.
- **Fonts.** Inter is self-hosted (no external CDN). The other font choices
  (Arial, Georgia, Impact, …) render with whatever the viewer's OS provides, so
  they can look slightly different across systems.
- **Images are embedded.** Uploaded images are stored as data URLs inside the
  project, so many large images increase the stored project size.
- **Scope.** PNG is the only export format so far; templates, text effects,
  image editing (crop/mask/filters) and gradient fills are planned for later
  milestones.
- **Layer reorder** uses up/down one-step controls (full drag-and-drop reorder
  is a later enhancement). Nested group editing is single-level.
- React Strict Mode is intentionally disabled (`next.config.mjs`) because Fabric
  manages its own `<canvas>` DOM wrapper imperatively and Strict Mode's dev-only
  double-mount can leave a detached wrapper; production is unaffected.
