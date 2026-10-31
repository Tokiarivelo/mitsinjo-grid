# /village — Village editor (PV)

Purpose: turn a photo into appliances the operator can add to the simulated village. AI finds and outlines;
the engine catalog gives power (never the AI). Sidebar + MobileNav entry « Village editor ».

- Intro card: scan icon, « Add appliances from a photo » + one-line purpose, `SIMULATED DATA` badge.
- No photo: dashed drop zone (drag & drop), primary « Choose a photo » (JPEG/PNG/WebP), secondary « Use the sample room »
  (`/samples/vision-room.jpg`). Wrong type → inline red alert, no call.
- Photo: `DetectionCanvas` (components.md) left; aside « Selected appliance » right (320 px, stacks under on < lg):
  selected line, « 3D model » block (appliances only, PV-T10), AI note (« power from the engine catalog »), « Change photo ».
  « 3D model »: title + badge (violet « AI shape » = Spark recipe; grey « Outline shape » = fallback + one-line why), viewer
  `h-60 sm:h-72` on `bg-canvas-sunken` (orbit + zoom, no pan), « Drag to turn · pinch or scroll to zoom ». Loading: spinner line +
  skeleton. No WebGL: note, photo stays the reference. One Spark call per object per photo (kept on reselect). V5 adds « Insert ».
- Right column (lg 380 px, under on mobile): the aside, then the live village preview (`GridSchematicPreview stacked`,
  3D / 2D toggle, store input + active result + hour), so the current village state stays visible while editing.
- Scenery objects (house, car, tree…) are outlined grey (`text-secondary`) with a « No load » chip; appliances cyan; selected amber.
- Missing objects (PV-T8): « Draw missing objects » under the photo → rectangle, free hand or magnetic lasso, several shapes,
  each movable / resizable until sent, optional « What is it? » text → « Send the objects (n) »: listed at once after the AI
  objects (« Added by you », « Identifying… »), then named and sorted by the vision model, outline refined by SAM. Removable.
- Photo zoom (− / 100 % / +, pan by scrolling or the hand toggle while drawing) and « Adjust the box » on the selected object
  (AI box moved / resized, then saved) — `components.md` § DetectionCanvas.
- States: loading / refining / ready / empty / error + retry (states-copy.md « vision »). Mobile: one column, `pb-20`.
