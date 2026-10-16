import { Card, fmt, Stat } from '../../ui/fields';
import { useProject } from '../ProjectView';

export function HeatLossTab() {
  const { project: p, loss } = useProject();
  const max = Math.max(1, ...loss.rooms.map((r) => r.totalW));
  const kw = loss.totalW / 1000;
  const wm2 = loss.area ? loss.totalW / loss.area : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Heat loss</p>
          <h1>Design heat loss at {p.settings.externalTemp} °C</h1>
        </div>
      </div>
      <div className="stats">
        <Stat label="Total design heat loss" value={fmt(kw, 2)} unit="kW" />
        <Stat label="Fabric" value={fmt(loss.fabricW / 1000, 2)} unit="kW" />
        <Stat label="Ventilation" value={fmt(loss.ventilationW / 1000, 2)} unit="kW" />
        <Stat label="Average" value={fmt(wm2)} unit="W/m²" tone={wm2 > 100 ? 'bad' : wm2 > 60 ? 'warn' : 'ok'} />
        <Stat label="Heated floor area" value={fmt(loss.area, 1)} unit="m²" />
      </div>

      <Card title="Heat source sizing">
        <p>
          The heat source needs to deliver at least <b>{fmt(kw, 2)} kW</b> at {p.settings.externalTemp} °C outside and {p.settings.flowTemp} °C flow. Check the
          manufacturer's output at that outdoor temperature and flow temperature, not the nominal (A7/W35) rating. If the same unit also heats hot water, allow for
          the time it spends on hot water.
        </p>
      </Card>

      <Card title="Room by room">
        <table className="tbl">
          <thead>
            <tr>
              <th>Room</th>
              <th>Level</th>
              <th className="r">Temp °C</th>
              <th className="r">Area m²</th>
              <th className="r">Fabric W</th>
              <th className="r">Air W</th>
              <th className="r">Total W</th>
              <th className="r">W/m²</th>
              <th style={{ width: '22%' }} />
            </tr>
          </thead>
          <tbody>
            {p.rooms.map((r) => {
              const l = loss.byId.get(r.id)!;
              return (
                <tr key={r.id}>
                  <td>
                    <a href={`#/p/${p.id}/rooms`}>{r.name}</a>
                  </td>
                  <td>{r.level}</td>
                  <td className="r">{r.designTemp}</td>
                  <td className="r">{fmt(r.area, 1)}</td>
                  <td className="r">{fmt(l.fabricW)}</td>
                  <td className="r">{fmt(l.ventilationW)}</td>
                  <td className="r">
                    <b>{fmt(l.totalW)}</b>
                  </td>
                  <td className="r">{fmt(l.wPerM2)}</td>
                  <td>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(Math.max(0, l.totalW) / max) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="total">
              <td>Total</td>
              <td />
              <td />
              <td className="r">{fmt(loss.area, 1)}</td>
              <td className="r">{fmt(loss.fabricW)}</td>
              <td className="r">{fmt(loss.ventilationW)}</td>
              <td className="r">{fmt(loss.totalW)}</td>
              <td className="r">{fmt(wm2)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <p className="muted small">
          Method follows BS EN 12831-1 (fabric U·A·ΔT, ground floors via the annual mean temperature, ventilation 0.33·n·V·ΔT). Have a competent person check the
          inputs before sign-off.
        </p>
      </Card>
    </div>
  );
}
