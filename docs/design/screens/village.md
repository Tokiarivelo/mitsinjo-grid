# /village — Village editor (PV)

Purpose: turn a photo into appliances the operator can add to the simulated village. AI finds and outlines;
the engine catalog gives power (never the AI). Sidebar + MobileNav entry « Village editor ».

- Intro card: scan icon, « Add appliances from a photo » + one-line purpose, `SIMULATED DATA` badge.
- No photo: dashed drop zone (drag & drop), primary « Choose a photo » (JPEG/PNG/WebP), secondary « Use the sample room »
  (`/samples/vision-room.jpg`). Wrong type → inline red alert, no call.
- Photo: `DetectionCanvas` (components.md) left; aside « Selected appliance » right (320 px, stacks under on < lg):
  selected line, « 3D model » block (every object, scenery included, PV-T10), AI note (« power from the engine catalog »), « Change photo ».
  « 3D model » is built on demand (user, 2026-11-01): selecting shows a kept model or « Not built yet » + hint + violet
  « Generate the 3D model » (`useObjectShape().peek` / `requestShape`), so picking to adjust a box costs no Spark call.
  Viewer on `.viewer-studio` (radial backdrop `--theme-viewer-center/edge`, lighter than dark objects in dark theme), rim
  light from behind + one baked contact shadow.
  « 3D model »: title + badge (violet « AI shape » = Spark recipe; grey « Outline shape » = fallback + one-line why (Meta did not answer / AI shape unusable) + « Try the AI shape again »), viewer
  `h-60 sm:h-72` on `bg-canvas-sunken` (orbit + zoom, no pan), « Drag to turn · pinch or scroll to zoom », display tweaks
  (PV-T11b: size slider 50–200 %, tint picker, reset — visual only, per object). Loading: spinner line +
  live AI steps (violet box: « Extracting the object » → « Muse Spark imagines the parts » with seconds → « Fitting the parts »,
  done = green check, wait hint 15–40 s) + skeleton. Outline note per reason (Meta error + « Cause: HTTP n », timeout, spend cap,
  server unreachable, unusable). No WebGL: note, photo stays the reference. One Spark call per object per photo (kept on reselect).
  « Add to the simulation » (PV-T11/T12, under the 3D block, `ApplianceInsertPanel`): toggle « AI estimate » (violet) / « Manual »
  (cyan), note, fields name · type · position · feeder line · power per unit (catalog range under it, red when out) · quantity (1 column on
  mobile and lg aside, 2 on sm / xl), engine preview line, cyan « Insert into simulation » (« Update » + « Remove » once in),
  green status « In the simulation: strategies re-computed. ». Scenery: note « no load by default ». List row chip « In simulation ».
  Engine preview line + 24 h load-curve bars (PV-T11b, engine values, text summary for screen readers).
  Free placement (PV-P): position = « Ring around the building » by default or « Place on the map » (`PlaceMinimap`,
  components.md); feeder line = the sector select, preset to the nearest building (« Nearest: … », « Auto » to follow again) —
  the load always goes to one of the 6 feeders while the marker draws anywhere on the terrain.
- Inserted markers (live preview, /simulation too): plinth + body by the ring or at the placed spot, thin cable line to
  the feeder building, tag « name · qty × W ». Click = select (ground ring + cyan tag border); press + drag moves the marker
  on the terrain (ghost preview, orbit frozen, commit on release); the feeder follows the nearest building unless overridden.
- Right column (lg 380 px, under on mobile): the aside, then the live village preview (`GridSchematicPreview stacked`,
  3D / 2D toggle, store input + active result + hour), so the current village state stays visible while editing.
- Every object has its own outline colour, repeated as its row border in « Objects found »; scenery (house, car, tree…) has a lighter
  fill and a « No load » chip; selected = thicker outline.
- Missing objects (PV-T8): « Draw missing objects » under the photo → rectangle, free hand or magnetic lasso, several shapes,
  each movable / resizable until sent, optional « What is it? » text → « Send the objects (n) »: listed at once after the AI
  objects (« Added by you », « Identifying… »), then named and sorted by the vision model, outline refined by SAM. Removable.
- Photo zoom (− / 100 % / +, pan by scrolling or the hand toggle while drawing) and « Adjust the box » on the selected object
  (AI box moved / resized, then saved) — `components.md` § DetectionCanvas.
- States: loading / refining / ready / empty / error + retry (states-copy.md « vision »). Mobile: one column, `pb-20`.
