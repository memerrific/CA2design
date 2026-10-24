import { defaultDhw } from './data/dhwDefaults';
import { newProject } from './engine/factory';
import type { Project } from './engine/model';
import { defaultPlantRoom } from './engine/plant';
import { defaultPoolInputs } from './engine/pool';
import { jobInfo } from './jobs';

/** Switch a project (or draft) to another job type, filling in whatever that type needs. Nothing is removed. */
export function applyJobType(p: Project, jobId: string) {
  const job = jobInfo(jobId);
  if (!job) return;
  p.jobType = job.id;
  p.module = job.module;
  if (job.systemType && (!p.systemType || p.rooms.length === 0)) p.systemType = job.systemType;
  if (job.module === 'pool' && !p.pool) p.pool = defaultPoolInputs();
  if ((job.module === 'dhw' || job.steps.includes('dhw')) && !p.dhw) p.dhw = defaultDhw();
  if (job.module === 'plantroom' && !p.plant) {
    p.plant = defaultPlantRoom();
    p.settings.flowTemp = 80;
    p.settings.deltaT = 20;
  }
}

export function newProjectFor(jobId: string): Project {
  const p = newProject('New job');
  applyJobType(p, jobId);
  return p;
}
