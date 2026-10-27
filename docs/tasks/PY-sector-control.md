# PY — Sector control proposals (stretch, only after P8)

**Read first:** `docs/contracts.md` · `docs/engine-spec.md` §1–3 · `docs/copilot.md`
**Goal:** the copilot can _propose_ "limit the market to 1 kW 18–22 h" or "raise water to critical";
the user confirms; the engine computes. Never auto-applied, never real equipment control.

- [x] **PY-T1** Engine (`/engine-change`): optional `sectorCaps: { sector, maxKw, fromHour, toHour }[]` on `SimulationInput`;
      strategies serve `min(allocation, cap)`, freed power goes to other sectors (re-run allocation without the capped sector).
      Invariant `served_s ≤ cap_s + ε`; warning `SECTOR_CAPPED`. Tests: cap respected, energy balance holds, no cap = identical result & id.
- [x] **PY-T2** `InputPatch` gains `priorities?: Partial<Record<SectorId, Priority>>` and `sectorCaps?` (LLM-safe bounds:
      `maxKw ≥ 0`, hours 0–24, `fromHour < toHour`); `applyPatch` + tests. Update `docs/contracts.md` + `docs/engine-spec.md`.
- [x] **PY-T3** Copilot: `propose_change` accepts the new patch fields; prompt rule "priorities and caps are social choices,
      propose them with the computed trade-off (`compare_strategies` / `run_scenario` before vs after)". Eval cases:
      "Cut the market tonight" → simulated cap proposal, not physical control; invalid cap → validation error explained.
- [x] **PY-T4** UI (`/design-check`): ConfirmProposalDialog shows priority/cap diff; SimControls / AssumptionsInspector show
      active caps and priorities (i18n EN/FR/MG). `store.applyProposal` → run.

**Exit criteria:** a cap or priority change proposed by the copilot is visible, confirmable, and changes results only
through the engine; proposals never auto-apply; `make check` green.
