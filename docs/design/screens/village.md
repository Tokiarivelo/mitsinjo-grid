# /village — Village editor (PV)

Purpose: turn a photo into appliances the operator can add to the simulated village. AI finds and outlines;
the engine catalog gives power (never the AI). Sidebar + MobileNav entry « Village editor ».

- Intro card: scan icon, « Add appliances from a photo » + one-line purpose, `SIMULATED DATA` badge.
- No photo: dashed drop zone (drag & drop), primary « Choose a photo » (JPEG/PNG/WebP), secondary « Use the sample room »
  (`/samples/vision-room.jpg`). Wrong type → inline red alert, no call.
- Photo: `DetectionCanvas` (components.md) left; aside « Selected appliance » right (320 px, stacks under on < lg):
  selected line, AI note (« power from the engine catalog »), « Change photo ». V4 adds the 3D editor and « Insert ».
- Right column (lg 380 px, under on mobile): the aside, then the live village preview (`GridSchematicPreview stacked`,
  3D / 2D toggle, store input + active result + hour), so the current village state stays visible while editing.
- Scenery objects (house, car, tree…) are outlined grey (`text-secondary`) with a « No load » chip; appliances cyan; selected amber.
- States: loading / refining / ready / empty / error + retry (states-copy.md « vision »). Mobile: one column, `pb-20`.
