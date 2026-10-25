import { newProject, newRoom, removeRoom } from './factory';
import { projectHeatLoss } from './heatloss';

describe('removing a room', () => {
  it('leaves no walls, floors or pipe runs pointing at it', () => {
    const p = newProject();
    const lounge = newRoom('Lounge', 'living');
    const kitchen = newRoom('Kitchen', 'kitchen');
    kitchen.walls.push({ id: 'w', name: 'To Lounge', length: 4, fabricId: kitchen.walls[0].fabricId, boundary: 'room', adjacentRoomId: lounge.id, openings: [] });
    kitchen.ceiling = { ...kitchen.ceiling, boundary: 'room', adjacentRoomId: lounge.id };
    p.rooms = [lounge, kitchen];
    p.pipes = [{ id: 'run', roomIds: [lounge.id, kitchen.id] } as (typeof p.pipes)[number]];
    const before = projectHeatLoss(p).byId.get(kitchen.id)!.totalW;

    removeRoom(p, lounge.id);

    expect(p.rooms.map((r) => r.name)).toEqual(['Kitchen']);
    const wall = p.rooms[0].walls.find((w) => w.id === 'w')!;
    expect(wall.adjacentRoomId).toBeUndefined();
    expect(wall.boundary).toBe('unheated');
    expect(p.rooms[0].ceiling.adjacentRoomId).toBeUndefined();
    expect(p.pipes[0].roomIds).toEqual([kitchen.id]);
    // The wall that faced the lounge now loses heat to an unheated space instead of nothing.
    expect(projectHeatLoss(p).byId.get(kitchen.id)!.totalW).toBeGreaterThan(before);
  });
});
