import type { ModuleId, Project } from './engine/model';

export const moduleOf = (p: Project): ModuleId => p.module ?? 'heating';

// Job stages for the project board, in order.
export const STAGES = [
  { id: 'enquiry', name: 'Enquiry' },
  { id: 'quote', name: 'Quote sent' },
  { id: 'survey', name: 'Survey' },
  { id: 'design', name: 'Design' },
  { id: 'proposal', name: 'Proposal out' },
  { id: 'install', name: 'Install' },
  { id: 'handover', name: 'Handover' },
] as const;

export type StageId = (typeof STAGES)[number]['id'] | 'archived';

export const stageOf = (p: Project): StageId => (p.stage as StageId | undefined) ?? 'enquiry';
