import type { DhwProject } from '../engine/model';

export const defaultDhw = (): DhwProject => ({
  demand: {
    occupants: 4,
    bedrooms: 3,
    bathrooms: 1,
    showers: [{ type: 'mixer' }],
    baths: [{ litres: 100 }],
    usagePattern: 'normal',
    heatSource: 'heatPump',
    storageTempC: 50,
  },
  badge: {},
  primaryFlowC: 55,
  primaryFlowLpm: 15,
  sourceKw: 8,
  targetReheatMinutes: 60,
  spaceHeatingLoadKw: 6,
  photos: [],
});
