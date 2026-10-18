// Design results shared by the design tabs, the handover pack and pricing.

import { correctionFactor, emitterDt50, emitterOutput, meanDeltaT } from './emitters';
import type { ProjectLoss } from './heatloss';
import type { PipeRun, Project, Room } from './model';
import { analysePipe, autoSize, flowFromHeat, pipeSize } from './pipes';
import { designUfhRoom } from './ufh';

export function ufhOutput(p: Project, r: Room) {
  return r.ufh.enabled ? designUfhRoom(ufhInputs(p, r)) : null;
}

/** Output of all emitters in a room at the project's design flow temperature. */
export function roomEmitterOutput(p: Project, r: Room) {
  const s = p.settings;
  const dT = meanDeltaT(s.flowTemp, s.flowTemp - s.deltaT, r.designTemp);
  const rads = r.emitters.filter((e) => e.status !== 'replace').reduce((a, e) => a + emitterOutput(e, dT, s.radiatorExponent), 0);
  const ufh = ufhOutput(p, r)?.outputW ?? 0;
  return { dT, rads, ufh, total: rads + ufh };
}

/** Lowest flow temperature at which this room's emitters meet its heat loss. */
export function requiredFlowTemp(p: Project, r: Room, lossW: number): number | null {
  const s = p.settings;
  const dt50 = r.emitters.filter((e) => e.status !== 'replace').reduce((a, e) => a + emitterDt50(e), 0);
  if (lossW <= 0) return null;
  if (r.ufh.enabled) {
    // Search, as UFH output isn't a simple power law.
    for (let f = 25; f <= 80; f += 0.5) {
      const ufh = designUfhRoom({ ...ufhInputs(p, r), flow: f, ret: f - s.deltaT }).outputW;
      const rad = dt50 * correctionFactor(meanDeltaT(f, f - s.deltaT, r.designTemp), s.radiatorExponent);
      if (ufh + rad >= lossW) return f;
    }
    return Infinity;
  }
  if (dt50 <= 0) return Infinity;
  const dT = 50 * (lossW / dt50) ** (1 / s.radiatorExponent);
  return r.designTemp + dT + s.deltaT / 2;
}

export function ufhInputs(p: Project, r: Room) {
  return {
    areaM2: r.area,
    activeAreaPct: r.ufh.activeAreaPct,
    spacingMm: r.ufh.spacing,
    coveringId: r.ufh.covering,
    screedCoverMm: r.ufh.screedCover,
    pipeSizeId: r.ufh.pipeSizeId,
    leadLengthM: r.ufh.leadLength,
    maxLoopLengthM: r.ufh.maxLoopLength,
    flow: p.settings.flowTemp,
    ret: p.settings.flowTemp - p.settings.deltaT,
    room: r.designTemp,
    requiredW: 0,
    fluid: p.settings.fluid,
    isBathroom: r.typeId === 'bathroom' || r.typeId === 'ensuite',
  };
}

export function runLoad(loss: ProjectLoss, run: PipeRun) {
  if (run.loadW > 0) return run.loadW;
  return run.roomIds.reduce((a, id) => a + Math.max(0, loss.byId.get(id)?.totalW ?? 0), 0);
}

/** Total length of pipes drawn on the plan and linked to this run, m. */
export function drawnLength(p: Project, run: PipeRun): number {
  let total = 0;
  for (const pl of Object.values(p.plans)) {
    for (const pipe of pl.pipes ?? []) {
      if (pipe.runId !== run.id) continue;
      for (let i = 1; i < pipe.pts.length; i++) total += Math.hypot(pipe.pts[i][0] - pipe.pts[i - 1][0], pipe.pts[i][1] - pipe.pts[i - 1][1]);
    }
  }
  return total;
}

/** Length used for the run: the drawn length when pipes are linked (unless switched off), else the typed length. */
export function runLength(p: Project, run: PipeRun): number {
  const drawn = drawnLength(p, run);
  return drawn > 0 && run.useDrawn !== false ? drawn : run.lengthM;
}

export function analyseRun(p: Project, loss: ProjectLoss, run: PipeRun) {
  const s = p.settings;
  const mean = s.flowTemp - s.deltaT / 2;
  const load = runLoad(loss, run);
  const q = flowFromHeat(load, s.deltaT, s.fluid, mean);
  const size = run.sizeId ? pipeSize(run.sizeId) : autoSize(run.material, q, s.fluid, mean);
  const res = size ? analysePipe({ sizeId: size.id, lengthM: runLength(p, run), fittingsAllowancePct: run.fittingsPct, flowM3s: q, fluid: s.fluid, meanTemp: mean }) : null;
  return { load, q, size, res };
}
