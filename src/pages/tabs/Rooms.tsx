import { useState } from 'react';
import { FABRICS, KIND_NAMES, type FabricKind } from '../../data/fabrics';
import { defaultRoomTemp, ROOM_TYPES, roomType } from '../../data/rooms';
import { newRoom, newWall, removeRoom, uid } from '../../engine/factory';
import { openingArea, settingsOf, wallGrossArea } from '../../engine/heatloss';
import type { Boundary, Project, Room, Surface } from '../../engine/model';
import { Card, fmt, NumField, Select, TextField } from '../../ui/fields';
import { ask } from '../../ui/dialog';
import { useProject } from '../ProjectView';

const BOUNDARIES: { value: Boundary; label: string }[] = [
  { value: 'external', label: 'Outside air' },
  { value: 'ground', label: 'Ground' },
  { value: 'unheated', label: 'Unheated space' },
  { value: 'neighbour', label: 'Heated neighbour' },
  { value: 'room', label: 'Another room' },
];

export function fabricOptions(p: Project, kinds: FabricKind[]) {
  return [...FABRICS, ...p.customFabrics]
    .filter((f) => kinds.includes(f.kind))
    .map((f) => ({ value: f.id, label: `${f.name} (U ${f.u})`, group: KIND_NAMES[f.kind] }));
}

export const LEVELS = ['Basement', 'Ground', 'First', 'Second', 'Third', 'Outbuilding'];

export function RoomsTab() {
  const { project: p, update, loss } = useProject();
  const [selId, setSelId] = useState<string | undefined>(p.rooms[0]?.id);
  const sel = p.rooms.find((r) => r.id === selId) ?? p.rooms[0];
  const idx = sel ? p.rooms.findIndex((r) => r.id === sel.id) : -1;

  const addRoom = () => {
    const r = newRoom(`Room ${p.rooms.length + 1}`, 'living', sel?.level ?? 'Ground', settingsOf(p).ageBand);
    update((d) => void d.rooms.push(r));
    setSelId(r.id);
  };

  const levels = [...new Set(p.rooms.map((r) => r.level))];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Rooms & fabric</p>
          <h1>Room-by-room survey</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={addRoom}>
            + Add room
          </button>
        </div>
      </div>
      {p.rooms.length === 0 ? (
        <div className="empty-state">
          <p>No rooms yet. Add them by hand, or import a Polycam floor plan on the Floor plan tab.</p>
        </div>
      ) : (
        <div className="split">
          <div className="room-list">
            {levels.map((lv) => (
              <div key={lv}>
                <h4>{lv}</h4>
                {p.rooms
                  .filter((r) => r.level === lv)
                  .map((r) => (
                    <button key={r.id} className={`room-item ${r.id === sel?.id ? 'on' : ''}`} onClick={() => setSelId(r.id)}>
                      <span>{r.name}</span>
                      <small>{fmt(loss.byId.get(r.id)?.totalW ?? 0)} W</small>
                    </button>
                  ))}
              </div>
            ))}
          </div>
          {sel && <RoomEditor room={sel} idx={idx} onDeleted={() => setSelId(undefined)} />}
        </div>
      )}
    </div>
  );
}

function RoomEditor({ room: r, idx, onDeleted }: { room: Room; idx: number; onDeleted: () => void }) {
  const { project: p, update, loss } = useProject();
  const set = (fn: (r: Room) => void) => update((d) => fn(d.rooms[idx]));
  const rl = loss.byId.get(r.id);
  const otherRooms = p.rooms.filter((x) => x.id !== r.id).map((x) => ({ value: x.id, label: `${x.name} (${x.level}, ${x.designTemp} °C)` }));

  return (
    <div className="room-editor">
      <Card
        title={r.name}
        actions={
          <>
            <button
              className="btn ghost sm"
              onClick={() =>
                update((d) => {
                  const c = structuredClone(r);
                  c.id = uid();
                  c.name = `${r.name} (copy)`;
                  c.polygon = undefined;
                  d.rooms.splice(idx + 1, 0, c);
                })
              }
            >
              Duplicate
            </button>
            <button
              className="btn ghost sm danger"
              onClick={async () => {
                if (!(await ask.confirm(`Delete ${r.name}?`, { danger: true }))) return;
                update((d) => removeRoom(d, r.id));
                onDeleted();
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <div className="grid4">
          <TextField label="Name" value={r.name} onChange={(v) => set((x) => void (x.name = v))} />
          <Select
            label="Room type"
            value={r.typeId}
            onChange={(v) =>
              set((x) => {
                x.typeId = v;
                const t = roomType(v);
                x.designTemp = defaultRoomTemp(v, settingsOf(p).ageBand);
                x.ach = t.ach;
              })
            }
            options={ROOM_TYPES.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Select label="Level" value={r.level} onChange={(v) => set((x) => void (x.level = v))} options={LEVELS.map((l) => ({ value: l, label: l }))} />
          <NumField label="Design temperature" unit="°C" value={r.designTemp} onChange={(v) => set((x) => void (x.designTemp = v))} />
          <NumField label="Floor area" unit="m²" value={r.area} onChange={(v) => set((x) => void (x.area = v))} />
          <NumField label="Ceiling height" unit="m" value={r.height} step={0.05} onChange={(v) => set((x) => void (x.height = v))} />
          <NumField label="Air changes" unit="/h" value={r.ach} step={0.1} onChange={(v) => set((x) => void (x.ach = v))} />
          <div className="field">
            <span>Room heat loss</span>
            <strong className="big">{fmt(rl?.totalW ?? 0)} W</strong>
            <small className="muted">
              {fmt(rl?.wPerM2 ?? 0)} W/m² · fabric {fmt(rl?.fabricW ?? 0)} · air {fmt(rl?.ventilationW ?? 0)}
            </small>
          </div>
        </div>
      </Card>

      <Card
        title="Walls, windows & doors"
        actions={
          <button className="btn ghost sm" onClick={() => set((x) => void x.walls.push(newWall(x.walls.length + 1)))}>
            + Add wall
          </button>
        }
      >
        <div className="walls">
          {r.walls.map((w, wi) => (
            <div key={w.id} className="wall">
              <div className="wall-row">
                <TextField label="Wall" value={w.name} onChange={(v) => set((x) => void (x.walls[wi].name = v))} />
                <NumField label="Length" unit="m" value={w.length} step={0.05} onChange={(v) => set((x) => void (x.walls[wi].length = v))} />
                <NumField
                  label="Height"
                  unit="m"
                  value={w.height ?? r.height}
                  step={0.05}
                  onChange={(v) => set((x) => void (x.walls[wi].height = v === r.height ? undefined : v))}
                />
                <Select<Boundary>
                  label="Other side"
                  value={w.boundary}
                  onChange={(v) =>
                    set((x) => {
                      const wall = x.walls[wi];
                      wall.boundary = v;
                      if (v === 'room' || v === 'neighbour') wall.fabricId = v === 'room' ? 'w-int-stud' : 'w-party-solid';
                      else if (FABRICS.find((f) => f.id === wall.fabricId)?.name.startsWith('Internal')) wall.fabricId = 'w-cavity-filled';
                    })
                  }
                  options={BOUNDARIES}
                />
                {w.boundary === 'room' && (
                  <Select
                    label="Adjacent room"
                    value={w.adjacentRoomId ?? ''}
                    onChange={(v) => set((x) => void (x.walls[wi].adjacentRoomId = v || undefined))}
                    options={[{ value: '', label: 'Same temperature' }, ...otherRooms]}
                  />
                )}
                <Select label="Construction" value={w.fabricId} onChange={(v) => set((x) => void (x.walls[wi].fabricId = v))} options={fabricOptions(p, ['wall'])} />
                <div className="field">
                  <span>Net area</span>
                  <strong>{fmt(Math.max(0, wallGrossArea(w, r) - openingArea(w)), 2)} m²</strong>
                </div>
                <button className="link danger" onClick={() => set((x) => void x.walls.splice(wi, 1))} title="Remove wall">
                  ✕
                </button>
              </div>
              {w.openings.map((o, oi) => (
                <div key={o.id} className="opening-row">
                  <Select
                    value={o.kind}
                    onChange={(v) =>
                      set((x) => {
                        const op = x.walls[wi].openings[oi];
                        op.kind = v;
                        op.fabricId = v === 'door' ? 'd-composite' : v === 'rooflight' ? 'g-velux' : 'g-double';
                      })
                    }
                    options={[
                      { value: 'window', label: 'Window' },
                      { value: 'door', label: 'Door' },
                      { value: 'rooflight', label: 'Roof window' },
                    ]}
                  />
                  <TextField value={o.name} onChange={(v) => set((x) => void (x.walls[wi].openings[oi].name = v))} />
                  <NumField value={o.width} unit="m W" step={0.05} width={70} onChange={(v) => set((x) => void (x.walls[wi].openings[oi].width = v))} />
                  <NumField value={o.height} unit="m H" step={0.05} width={70} onChange={(v) => set((x) => void (x.walls[wi].openings[oi].height = v))} />
                  <NumField value={o.count} unit="×" step={1} min={1} width={50} onChange={(v) => set((x) => void (x.walls[wi].openings[oi].count = v))} />
                  <Select
                    value={o.fabricId}
                    onChange={(v) => set((x) => void (x.walls[wi].openings[oi].fabricId = v))}
                    options={fabricOptions(p, o.kind === 'door' ? ['door'] : ['window', 'rooflight'])}
                  />
                  <button className="link danger" onClick={() => set((x) => void x.walls[wi].openings.splice(oi, 1))}>
                    ✕
                  </button>
                </div>
              ))}
              <div className="opening-add">
                <button
                  className="link"
                  onClick={() =>
                    set((x) => void x.walls[wi].openings.push({ id: uid(), kind: 'window', name: 'Window', width: 1.2, height: 1.2, count: 1, fabricId: 'g-double' }))
                  }
                >
                  + Window
                </button>
                <button
                  className="link"
                  onClick={() =>
                    set((x) => void x.walls[wi].openings.push({ id: uid(), kind: 'door', name: 'Door', width: 0.9, height: 2.0, count: 1, fabricId: 'd-composite' }))
                  }
                >
                  + Door
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid2 top">
        <SurfaceEditor title="Floor" s={r.floor} room={r} kinds={['floor']} onChange={(fn) => set((x) => fn(x.floor))} otherRooms={otherRooms} />
        <SurfaceEditor title="Ceiling / roof" s={r.ceiling} room={r} kinds={['ceiling', 'roof']} onChange={(fn) => set((x) => fn(x.ceiling))} otherRooms={otherRooms} />
      </div>

      {rl && (
        <Card title="Breakdown">
          <table className="tbl">
            <thead>
              <tr>
                <th>Element</th>
                <th className="r">Area m²</th>
                <th className="r">U</th>
                <th className="r">ΔT K</th>
                <th className="r">W</th>
              </tr>
            </thead>
            <tbody>
              {rl.elements.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td className="r">{fmt(e.area, 2)}</td>
                  <td className="r">{fmt(e.u, 2)}</td>
                  <td className="r">{fmt(e.dT, 1)}</td>
                  <td className="r">{fmt(e.watts)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  Ventilation {fmt(rl.airflowM3h)} m³/h ({rl.airflowSource === 'infiltration' ? 'infiltration share' : `${r.ach}/h minimum × ${fmt(rl.volume, 1)} m³`})
                </td>
                <td />
                <td />
                <td className="r">{fmt(r.designTemp - p.settings.externalTemp, 1)}</td>
                <td className="r">{fmt(rl.ventilationW)}</td>
              </tr>
              <tr className="total">
                <td>Total{p.settings.marginPct ? ` (incl. ${p.settings.marginPct}% margin)` : ''}</td>
                <td />
                <td />
                <td />
                <td className="r">{fmt(rl.totalW)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
      <Card title="Room notes">
        <TextField multiline value={r.notes} onChange={(v) => set((x) => void (x.notes = v))} placeholder="Survey notes, photos reference, access…" />
      </Card>
    </div>
  );
}

function SurfaceEditor({
  title,
  s,
  room,
  kinds,
  onChange,
  otherRooms,
}: {
  title: string;
  s: Surface;
  room: Room;
  kinds: FabricKind[];
  onChange: (fn: (s: Surface) => void) => void;
  otherRooms: { value: string; label: string }[];
}) {
  const { project: p } = useProject();
  return (
    <Card title={title}>
      <Select label="Construction" value={s.fabricId} onChange={(v) => onChange((x) => void (x.fabricId = v))} options={fabricOptions(p, kinds)} />
      <div className="grid2">
        <Select<Boundary> label="Other side" value={s.boundary} onChange={(v) => onChange((x) => void (x.boundary = v))} options={BOUNDARIES} />
        <NumField label="Area" unit="m²" value={s.area ?? room.area} onChange={(v) => onChange((x) => void (x.area = v === room.area ? undefined : v))} />
      </div>
      {s.boundary === 'room' && (
        <Select
          label="Room on other side"
          value={s.adjacentRoomId ?? ''}
          onChange={(v) => onChange((x) => void (x.adjacentRoomId = v || undefined))}
          options={[{ value: '', label: 'Same temperature' }, ...otherRooms]}
        />
      )}
    </Card>
  );
}
