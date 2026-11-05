# YouTube description — Mitsinjo Grid demo

Video: https://youtu.be/GSu96kD7HRw

## Title

Mitsinjo Grid — AI Copilot for a Rural Solar Microgrid (Meta AI Hackathon demo)

## Description

When the sun drops, who keeps the light?

Mitsinjo Grid is an AI copilot for a simulated rural solar microgrid in Madagascar. One microgrid powers a clinic, a school, water and every home. Mitsinjo Grid helps the operator decide how to share scarce energy, explains every decision in plain words, and backs each number with evidence from a deterministic simulation engine.

Built solo from scratch during the Meta AI Hackathon (Oct 26 – Nov 4, 2026). No code existed before the event, only open-source libraries.

🔗 Try it live: https://mitsinjo-grid.vercel.app/simulation
💻 Source code: https://github.com/Tokiarivelo/mitsinjo-grid

⏱️ Chapters
0:00 Intro: built from scratch at the hackathon
0:08 The problem: one microgrid, a whole village
0:20 Building a simulated week (sun, clouds, storm, chaos mode)
0:36 3D village, topology, circuit and the Strategy Lab
0:56 Voice copilot: "Who loses power first?"
1:12 Autonomous AI dispatch, with one-tap take back control
1:31 Photo → objects detected and outlined
1:48 2D facade → 3D model, built stage by stage
2:06 Load, placement and insertion in the village
2:21 Four Meta models, one job each + benchmarks
2:41 Outro

🤖 Meta models used
• Muse Voice: speech to text for the voice copilot
• Muse Spark: reasons, calls the engine's tools, explains decisions and builds 3D models
• SAM 3.1: outlines detected appliances and buildings in photos
• Muse Image: draws clean front elevations of buildings

⚙️ How it works
• Every number comes from a deterministic TypeScript engine. The AI never invents energy values.
• Each AI answer points to the simulation run that produced its numbers.
• Actions need human approval, except fire isolation and the autonomous mode, which stay inside the village rules and can always be undone.
• Available in English, French and Malagasy, dark and light themes, mobile-ready.

🛠️ Stack
Next.js 15 · React 19 · TypeScript · Tailwind 4 · React Three Fiber · Zustand · Zod · Recharts · next-intl · Vitest · Playwright · Meta Model API

⚠️ All data in this demo is simulated. Narration voice: Kokoro TTS.

#Meta #MetaAI #Hackathon #MetaAIHackathon #MuseSpark #SAM #AI #GenerativeAI #AIAgent #Copilot #SolarEnergy #Microgrid #RenewableEnergy #CleanEnergy #EnergyAccess #Madagascar #Africa #AIForGood #ClimateTech #DigitalTwin #Simulation #ThreeJS #ReactThreeFiber #NextJS #TypeScript #WebDev #OpenSource

## Tags (YouTube Studio → "Tags" field, comma-separated, under 500 characters)

Meta, Meta AI, hackathon, Meta AI hackathon, Muse Spark, Muse Voice, Muse Image, SAM, Segment Anything, AI copilot, AI agent, generative AI, LLM, tool calling, solar microgrid, microgrid, solar energy, renewable energy, energy access, rural electrification, off-grid solar, battery storage, load shedding, Madagascar, Africa, AI for good, climate tech, digital twin, energy simulation, Three.js, React Three Fiber, Next.js, TypeScript, hackathon demo, Mitsinjo Grid
