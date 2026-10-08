import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  BarChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
  useXAxisScale,
} from "recharts";
import { monthLabel } from "./analyze";
import { gbp, pct } from "./format";

export const NAVY = "#3E6B7A";
export const ACCENT = "#3E6B7A";
export const BAD = "#C17B62";
export const GOOD = "#5F8F78";
export const STEEL = "#E4E2EA";
export const NEW = "#8FB4C0";
export const YEAR_ONE = "#8FB4C0";
export const YEAR_TWO = "#C17B62";

export const TICK = {
  fill: "#A5A3AE",
  fontSize: 11,
  fontFamily: "Public Sans, Segoe UI, sans-serif",
};

export function AxisFrame({ y, x, height, children }) {
  return (
    <div className="axis-frame">
      <div className="y-label" style={{ height }}>{y}</div>
      <div className="plot" style={{ height }}>{children}</div>
      {x ? <div className="x-label">{x}</div> : <div />}
    </div>
  );
}

export function Tip({ active, payload, label, labelFormat, valueFormat }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => item && item.value != null && item.name);
  if (!rows.length) return null;
  return (
    <div className="tip">
      <div className="tip-title">{labelFormat ? labelFormat(label) : label}</div>
      {rows.map((item) => (
        <div className="tip-row" key={item.name}>
          <span>
            <i className="swatch" style={{ background: item.color || item.stroke || NAVY }} />
            {item.name}
          </span>
          <strong>{valueFormat ? valueFormat(item) : item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function YearShade() {
  const scale = useXAxisScale();
  const plot = usePlotArea();
  if (!scale || !plot) return null;
  const origin = scale("2024-09");
  const next = scale("2024-10");
  if (typeof origin !== "number" || typeof next !== "number") return null;
  const step = Math.abs(next - origin) || 24;
  const bands = [
    ["2024-09", "2024-09", "rgba(28,28,28,0.04)"],
    ["2024-10", "2025-09", "rgba(62, 107, 122, 0.08)"],
    ["2025-10", "2026-09", "rgba(62, 107, 122, 0.16)"],
  ];
  return (
    <g>
      {bands.map(([from, to, fill]) => {
        const start = scale(from);
        const end = scale(to);
        if (typeof start !== "number" || typeof end !== "number") return null;
        const x = Math.min(start, end) - step / 2;
        const width = Math.abs(end - start) + step;
        return <rect key={from} x={x} y={plot.y} width={width} height={plot.height} fill={fill} pointerEvents="none" />;
      })}
    </g>
  );
}

export function moneyTick(value) {
  const abs = Math.abs(value);
  if (abs === 0) return "£0";
  if (abs >= 1000) {
    const thousands = Math.round((value / 1000) * 10) / 10;
    return Number.isInteger(thousands) ? `£${thousands}k` : `£${thousands.toFixed(1)}k`;
  }
  return `£${Math.round(value)}`;
}

function monthAxis(interval = 0) {
  return {
    dataKey: "month",
    tickFormatter: monthLabel,
    tick: { ...TICK, fontSize: 11 },
    interval,
    angle: -45,
    textAnchor: "end",
    height: 64,
    tickMargin: 4,
  };
}

export function RevenueChart({ monthly }) {
  return (
    <>
      <AxisFrame y="Net revenue (£)" x="Month" height={340}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthly} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <YearShade />
            <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
            <XAxis {...monthAxis(1)} />
            <YAxis tick={TICK} width={52} tickFormatter={moneyTick} />
            <Tooltip content={<Tip labelFormat={monthLabel} valueFormat={(item) => gbp(item.value, 0)} />} />
            <Line type="monotone" dataKey="revenue" name="Net revenue" stroke={NAVY} strokeWidth={1.25} dot={false} activeDot={{ r: 4, fill: NAVY }} />
          </ComposedChart>
        </ResponsiveContainer>
      </AxisFrame>
      <ul className="legend">
        <li><i className="swatch lead" /> Sep 2024 lead-in</li>
        <li><i className="swatch y1" /> Year 1</li>
        <li><i className="swatch y2" /> Year 2</li>
        <li><i className="swatch line" /> Net revenue</li>
      </ul>
    </>
  );
}

export function AcquisitionChart({ monthly }) {
  return (
    <>
      <AxisFrame y="Net revenue (£)" x="Month" height={340}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
            <XAxis {...monthAxis(0)} />
            <YAxis tick={TICK} width={52} tickFormatter={moneyTick} />
            <Tooltip content={<Tip labelFormat={monthLabel} valueFormat={(item) => gbp(item.value, 0)} />} />
            <Bar dataKey="returningRevenue" name="Returning customers" stackId="rev" fill={GOOD} maxBarSize={9} radius={[0, 0, 0, 0]} />
            <Bar dataKey="newRevenue" name="New customers" stackId="rev" fill={ACCENT} maxBarSize={9} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </AxisFrame>
      <ul className="legend">
        <li><i className="swatch good" /> Returning customers</li>
        <li><i className="swatch new" /> New customers</li>
      </ul>
    </>
  );
}

export function DiscountChart({ monthly }) {
  return (
    <>
      <AxisFrame y="Discount (£)" x="Month" height={340}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthly} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
            <XAxis {...monthAxis(0)} />
            <YAxis yAxisId="gbp" tick={TICK} width={48} tickFormatter={moneyTick} />
            <YAxis yAxisId="share" orientation="right" tick={TICK} width={44} domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
            <Tooltip
              content={(
                <Tip
                  labelFormat={monthLabel}
                  valueFormat={(item) => (item.dataKey === "discountedShare" ? pct(item.value, 0) : gbp(item.value, 0))}
                />
              )}
            />
            <Bar yAxisId="gbp" dataKey="discount" name="Discount spend" maxBarSize={8}>
              {monthly.map((row) => (
                <Cell
                  key={row.month}
                  fill={row.year === "Y2" ? ACCENT : row.year === "Y1" ? "#C5D8DE" : STEEL}
                />
              ))}
            </Bar>
            <Line yAxisId="share" type="monotone" dataKey="discountedShare" name="Orders discounted" stroke={NAVY} strokeWidth={1.25} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </AxisFrame>
      <ul className="legend">
        <li><i className="swatch y1bar" /> Year 1 discount £</li>
        <li><i className="swatch y2bar" /> Year 2 discount £</li>
        <li><i className="swatch steel" /> Lead-in</li>
        <li><i className="swatch line" /> % of orders discounted</li>
      </ul>
    </>
  );
}

export function FamilyChart({ rows, selected, onSelect }) {
  return (
    <div className="family-pick">
      <AxisFrame y="" x="Share of line revenue" height={380}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} horizontal={false} />
            <XAxis type="number" tick={TICK} tickFormatter={(value) => `${Math.round(value * 100)}%`} domain={[0, 0.75]} />
            <YAxis type="category" dataKey="family" tick={TICK} width={124} />
            <Tooltip content={<Tip valueFormat={(item) => pct(item.value, 1)} />} />
            <Bar
              dataKey="share"
              name="Share of line revenue"
              maxBarSize={7}
              cursor="pointer"
              onClick={(bar) => {
                const family = bar?.payload?.family || bar?.family;
                if (family && family !== "Other") onSelect?.(family);
              }}
            >
              {rows.map((row) => (
                <Cell key={row.family} fill={row.family === selected ? ACCENT : STEEL} />
              ))}
              <LabelList
                dataKey="share"
                position="right"
                formatter={(value) => `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`}
                style={{ fill: "#4B465C", fontSize: 12, fontFamily: "Public Sans, sans-serif" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </AxisFrame>
    </div>
  );
}

export function SeasonChart({ months, family }) {
  return (
    <>
      <AxisFrame y={`${family} line revenue (£)`} x="Calendar month" height={340}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
            <XAxis dataKey="month" tick={TICK} />
            <YAxis tick={TICK} width={52} tickFormatter={moneyTick} />
            <Tooltip content={<Tip valueFormat={(item) => gbp(item.value, 0)} />} />
            <Bar dataKey="revenue" name={`${family} line revenue`} maxBarSize={12}>
              {months.map((row) => (
                <Cell key={row.month} fill={row.weak ? BAD : STEEL} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </AxisFrame>
      <ul className="legend">
        <li><i className="swatch steel" /> Other months</li>
        <li><i className="swatch bad" /> {family === "Airplus" ? "Oct–Dec weak season" : "Oct–Dec"}</li>
      </ul>
    </>
  );
}

export function FrequencyChart({ buckets }) {
  return (
    <AxisFrame y="Customers" x="Completed orders per customer" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="bucket" tick={TICK} tickMargin={8} />
          <YAxis tick={TICK} width={44} />
          <Tooltip content={<Tip valueFormat={(item) => `${Math.round(item.value).toLocaleString("en-GB")} customers`} />} />
          <Bar dataKey="customers" name="Customers" maxBarSize={16}>
            {buckets.map((row) => (
              <Cell key={row.bucket} fill={row.bucket === "1" ? ACCENT : STEEL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function ParetoChart({ pareto, topTenShare }) {
  const top = Math.round(topTenShare * 100);
  return (
    <AxisFrame y="% of net revenue" x="Customers, largest first" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pareto} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="pctCustomers" type="number" domain={[0, 100]} tick={TICK} tickFormatter={(value) => `${value}%`} />
          <YAxis domain={[0, 100]} tick={TICK} width={44} tickFormatter={(value) => `${value}%`} />
          <Tooltip
            content={(
              <Tip
                labelFormat={(label) => `${Math.round(Number(label))}% of customers`}
                valueFormat={(item) => `${Math.round(item.value)}%`}
              />
            )}
          />
          <Line dataKey="equality" name="Equal share" stroke="#d5d5dc" strokeDasharray="4 4" dot={false} />
          <Line dataKey="pctRevenue" name="Cumulative net revenue" stroke={NAVY} strokeWidth={1.25} dot={false} />
          <ReferenceLine
            x={10}
            stroke={ACCENT}
            strokeDasharray="3 3"
            label={{ value: `Top 10% · ${top}% of revenue`, position: "insideTopRight", fill: ACCENT, fontSize: 12 }}
          />
          <ReferenceDot x={10} y={top} r={4} fill={ACCENT} stroke={ACCENT} />
        </LineChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function BasketChart({ singleAov, multiAov, singleShare, multiShare }) {
  const data = [
    { name: "Single product", aov: singleAov, share: singleShare },
    { name: "Multi-product", aov: multiAov, share: multiShare },
  ];
  return (
    <AxisFrame y="Average order value (£)" x="Order type" height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="name" tick={TICK} />
          <YAxis tick={TICK} width={48} tickFormatter={(value) => `£${Math.round(value)}`} />
          <Tooltip content={<Tip valueFormat={(item) => gbp(item.value, 2)} />} />
          <Bar dataKey="aov" name="Average order value" maxBarSize={20}>
            {data.map((row) => (
              <Cell key={row.name} fill={row.name === "Multi-product" ? GOOD : STEEL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function GrowthChart({ rows }) {
  const data = rows.map((row) => ({
    ...row,
    label: `${row.family}`,
    yoyPct: row.yoy * 100,
  }));
  return (
    <AxisFrame y="" x="Year-on-year change in line revenue" height={520}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} horizontal={false} />
          <XAxis type="number" tick={TICK} domain={[-70, 70]} tickFormatter={(value) => `${value}%`} />
          <YAxis type="category" dataKey="label" tick={TICK} width={130} />
          <ReferenceLine x={0} stroke={NAVY} />
          <Tooltip content={<Tip valueFormat={(item) => `${item.value > 0 ? "+" : ""}${item.value.toFixed(0)}%`} />} />
          <Bar dataKey="yoyPct" name="YoY change" maxBarSize={7}>
            {data.map((row) => (
              <Cell key={row.family} fill={row.yoyPct >= 0 ? GOOD : BAD} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}
