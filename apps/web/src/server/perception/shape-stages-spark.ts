import sharp from 'sharp';
import type { ObjectRecipe } from '@/lib/object-shape';
import {
  type ElevationStage,
  type ScoredElevation,
  elevationDiff,
  scoreElevation,
} from './elevation-score';
import type { Elevation } from './facade-house';
import { stageQuestion } from './shape-script-prompt';
import type { Proposer } from './shape-stages';

/**
 * Spark as the stage proposer (PG-T15): builds the stage sheet (drawing | model | diff), asks
 * `proposeShapeOps`, and hands the raw ops to the runner (which compiles and scores them).
 */

type Ring = ReadonlyArray<readonly [number, number]>;

/** Grey levels of the drawing's concepts when no drawing image is at hand (label map). */
const LABEL_GREY = [200, 160, 120, 70, 90, 30];
/** Tiles are drawn at this zoom (nearest), so Spark sees the 128-row grids crisp. */
const SHEET_ZOOM = 3;

/** Plain measured hints for the question (openings drawn vs built, per-concept IoU). */
export function stageNotes(s: ScoredElevation): string[] {
  const o = s.openings;
  const concepts = Object.entries(s.concepts)
    .map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)} %`)
    .join(', ');
  return [
    `openings ${o.target} drawn, ${o.render} built, ${o.matched} matched`,
    ...(concepts ? [`overlap per part: ${concepts}`] : []),
  ];
}

/**
 * Drawing | model | diff (JPEG data URL). The drawing tile is the validated elevation image
 * resized to the score grid, else the label map read on it. Never throws: null on failure.
 */
export async function stageSheet(
  recipe: ObjectRecipe,
  s: ScoredElevation,
  drawing: Buffer | null
): Promise<string | null> {
  try {
    const { cols, rows, label } = s.target;
    const [w, h] = [cols * SHEET_ZOOM, rows * SHEET_ZOOM];
    const raw = (b: Buffer) =>
      sharp(b, { raw: { width: cols, height: rows, channels: 3 } })
        .resize(w, h, { kernel: 'nearest' })
        .png()
        .toBuffer();
    const labels = Buffer.alloc(cols * rows * 3, 255);
    label.forEach((v, i) => {
      if (v >= 0) labels.fill(LABEL_GREY[v]!, i * 3, i * 3 + 3);
    });
    const built = Buffer.from(s.render.rgb);
    s.render.mask.data.forEach((v, i) => {
      if (!v) built.fill(255, i * 3, i * 3 + 3);
    });
    const tiles = await Promise.all([
      drawing
        ? sharp(drawing).resize(w, h).flatten({ background: '#ffffff' }).png().toBuffer()
        : raw(labels),
      raw(built),
      raw(Buffer.from(elevationDiff(recipe, s).rgb)),
    ]);
    const jpg = await sharp({
      create: { width: w * 3, height: h, channels: 3, background: '#ffffff' },
    })
      .composite(tiles.map((input, i) => ({ input, left: i * w, top: 0 })))
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch (err) {
    console.warn('[vision] 3D stage sheet failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface SparkStageInput {
  /** `perception.proposeShapeOps` bound to its backend. */
  proposeShapeOps: (
    imageUrl: string,
    question: string,
    signal?: AbortSignal
  ) => Promise<{ result: { ops: unknown[] | null } }>;
  front: Elevation;
  roofRings?: ReadonlyArray<Ring>;
  /** The validated front drawing (PNG / JPEG bytes), when at hand. */
  drawing: Buffer | null;
  label: string;
}

/** A runner proposer that asks Spark for each stage round; empty patch when unusable. */
export function sparkStageProposer(input: SparkStageInput): Proposer<ElevationStage> {
  return async (ctx) => {
    const scored = scoreElevation(
      ctx.recipe,
      input.front,
      input.roofRings ? { roofRings: input.roofRings } : {}
    );
    const sheet = await stageSheet(ctx.recipe, scored, input.drawing);
    if (!sheet) return [];
    const question = stageQuestion({
      label: input.label,
      stage: ctx.stage.id,
      round: ctx.round,
      score: ctx.score,
      components: ctx.components,
      editable: ctx.editable,
      notes: stageNotes(scored),
    });
    const { result } = await input.proposeShapeOps(sheet, question, ctx.signal);
    return result.ops ?? [];
  };
}
