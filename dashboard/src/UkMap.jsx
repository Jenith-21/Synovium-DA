import { useEffect, useMemo, useState } from "react";
import { gbp, gbpCompact, integer, pct } from "./format";
import geoText from "../public/maps/uk-postcode-areas.geojson?raw";

const geo = JSON.parse(geoText);

const METRICS = [
  ["revenue", "Revenue"],
  ["aov", "Order value"],
  ["customers", "Customers"],
  ["revenuePerCustomer", "Revenue per customer"],
];

function mercatorY(lat) {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function walkCoords(coords, visit) {
  if (typeof coords[0] === "number") visit(coords[0], coords[1]);
  else coords.forEach((part) => walkCoords(part, visit));
}

function ringPath(ring, project) {
  return ring.map((coord, index) => {
    const [x, y] = project(coord[0], coord[1]);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("") + "Z";
}

function geometryPath(geometry, project) {
  if (geometry.type === "Polygon") return geometry.coordinates.map((ring) => ringPath(ring, project)).join("");
  return geometry.coordinates.map((polygon) => polygon.map((ring) => ringPath(ring, project)).join("")).join("");
}

function mix(t) {
  const amount = Math.max(0, Math.min(1, t));
  const from = [232, 240, 242];
  const to = [62, 107, 122];
  const channel = (index) => Math.round(from[index] + (to[index] - from[index]) * amount);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export default function UkMap({ areas, selected, onSelect }) {
  const [shapes, setShapes] = useState([]);
  const [metric, setMetric] = useState("revenue");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    try {
        const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        geo.features.forEach((feature) => walkCoords(feature.geometry.coordinates, (lon, lat) => {
          box.minX = Math.min(box.minX, (lon * Math.PI) / 180);
          box.maxX = Math.max(box.maxX, (lon * Math.PI) / 180);
          box.minY = Math.min(box.minY, mercatorY(lat));
          box.maxY = Math.max(box.maxY, mercatorY(lat));
        }));
        const pad = 8;
        const dataW = box.maxX - box.minX;
        const dataH = box.maxY - box.minY;
        const scale = 740 / dataH;
        const width = dataW * scale + pad * 2;
        const height = dataH * scale + pad * 2;
        const project = (lon, lat) => {
          const x = pad + (((lon * Math.PI) / 180) - box.minX) * scale;
          const y = pad + (box.maxY - mercatorY(lat)) * scale;
          return [x, y];
        };
        if (!cancel) {
          setShapes(geo.features.map((feature) => ({
            area: feature.properties.name,
            d: geometryPath(feature.geometry, project),
            viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
          })));
        }
    } catch (err) {
      if (!cancel) setError(err.message || "Could not load the UK map");
    }
    return () => {
      cancel = true;
    };
  }, []);

  const byArea = useMemo(() => new Map(areas.map((row) => [row.area, row])), [areas]);
  const max = useMemo(() => {
    const values = areas.map((row) => row[metric] || 0);
    return Math.max(...values, 0);
  }, [areas, metric]);

  const shown = byArea.get(selected);

  function formatValue(row, key) {
    if (!row) return "—";
    if (key === "customers") return integer(row.customers);
    if (key === "revenue" || key === "revenuePerCustomer" || key === "aov") return key === "aov" ? gbp(row.aov, 0) : gbpCompact(row[key]);
    return row[key];
  }

  return (
    <div className="uk-map-block">
      <div className="map-switch" role="tablist" aria-label="Map measure">
        {METRICS.map(([key, label]) => (
          <button key={key} type="button" className={metric === key ? "active" : undefined} onClick={() => setMetric(key)}>
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="source">{error}</p> : null}
      <div className="uk-layout">
      <div>
        <svg className="uk-map" viewBox={shapes[0]?.viewBox || "0 0 420 760"} role="img" aria-label="UK postcode areas">
          {shapes.map((shape) => {
            const row = byArea.get(shape.area);
            const value = row?.[metric] || 0;
            const hot = shape.area === selected;
            return (
              <path
                key={shape.area}
                d={shape.d}
                fill={value ? mix(Math.sqrt(value / max)) : "#e8f0f2"}
                stroke={hot ? "#3e6b7a" : "#fff"}
                strokeWidth={hot ? 1.6 : 0.45}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(shape.area)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(shape.area);
                  }
                }}
                tabIndex={0}
              >
                <title>{shape.area}{row ? ` · ${formatValue(row, metric)}` : " · no orders"}</title>
              </path>
            );
          })}
        </svg>
      </div>
      <aside className="map-readout">
        <p className="kicker">{shown ? shown.area : selected}</p>
        <div className="stat-value">{shown ? formatValue(shown, metric) : "No orders"}</div>
        <p>{METRICS.find(([key]) => key === metric)?.[1]}</p>
        {shown ? (
          <dl>
            <div><dt>Orders</dt><dd>{integer(shown.orders)}</dd></div>
            <div><dt>Customers</dt><dd>{integer(shown.customers)}</dd></div>
            <div><dt>Net revenue</dt><dd>{gbpCompact(shown.revenue)}</dd></div>
            <div><dt>Share of revenue</dt><dd>{pct(shown.share, 1)}</dd></div>
            <div><dt>Average order value</dt><dd>{gbp(shown.aov, 0)}</dd></div>
            <div><dt>Revenue per customer</dt><dd>{gbpCompact(shown.revenuePerCustomer)}</dd></div>
          </dl>
        ) : <p>This postcode area has no completed orders.</p>}
      </aside>
      </div>
      <div className="map-scale" aria-hidden="true">
        <span>Lower</span>
        <i />
        <span>Higher</span>
        <span className="map-empty">No orders</span>
      </div>
    </div>
  );
}
