import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthLabel } from "./analyze";
import { AxisFrame, BAD, GOOD, STEEL, TICK, Tip, YEAR_ONE, YEAR_TWO, moneyTick } from "./charts";
import { gbp, integer } from "./format";

const BLUE = "#3E6B7A";
const BLUE_SOFT = "#8FB4C0";
export const FAMILY_COLORS = {
  Airplus: "#3E6B7A",
  Gastrosafe: "#6E93A0",
  Agility: "#5F8F78",
  "Motion-JMT": "#C4A574",
  Calmingard: "#8C7E72",
  Other: "#E4E2DC",
};

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="tip">
      <div className="tip-title">{point.area}</div>
      <div className="tip-row"><span>Customers</span><strong>{integer(point.customers)}</strong></div>
      <div className="tip-row"><span>Revenue per customer</span><strong>{gbp(point.revenuePerCustomer, 0)}</strong></div>
    </div>
  );
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

export function RevenueOrdersChart({ monthly }) {
  return (
    <AxisFrame y="Net revenue (£)" x="Month" height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={monthly} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis {...monthAxis(1)} />
          <YAxis yAxisId="revenue" tick={TICK} width={52} tickFormatter={moneyTick} />
          <YAxis yAxisId="orders" orientation="right" tick={TICK} width={40} />
          <Tooltip content={<Tip valueFormat={(item) => (item.dataKey === "orders" ? integer(item.value) : gbp(item.value, 0))} />} />
          <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Net revenue" stroke={BLUE} strokeWidth={1.25} dot={false} />
          <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke={BLUE_SOFT} strokeWidth={1.15} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function YearOverlayChart({ rows }) {
  return (
    <AxisFrame y="Net revenue (£)" x="Calendar month" height={300}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="month" tick={TICK} />
          <YAxis tick={TICK} width={52} tickFormatter={moneyTick} />
          <Tooltip content={<Tip valueFormat={(item) => gbp(item.value, 0)} />} />
          <Line type="monotone" dataKey="y1" name="Year 1" stroke={YEAR_ONE} strokeWidth={1.25} dot={false} />
          <Line type="monotone" dataKey="y2" name="Year 2" stroke={YEAR_TWO} strokeWidth={1.25} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function HourChart({ rows }) {
  return (
    <AxisFrame y="Orders" x="Hour" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="hour" tick={TICK} interval={1} />
          <YAxis tick={TICK} width={36} />
          <Tooltip content={<Tip valueFormat={(item) => integer(item.value)} />} />
          <Bar dataKey="orders" name="Orders" fill={BLUE} maxBarSize={7} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function WeekdayChart({ rows }) {
  return (
    <AxisFrame y="Orders" x="Weekday" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="day" tick={TICK} />
          <YAxis tick={TICK} width={40} />
          <Tooltip content={<Tip valueFormat={(item) => integer(item.value)} />} />
          <Bar dataKey="orders" name="Orders" maxBarSize={14} radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.day} fill={row.day === "Mon" ? BLUE : row.day === "Sat" ? STEEL : BLUE_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function HorizontalBars({ rows, nameKey, valueKey, name, height, format, domain, labelWidth = 88 }) {
  return (
    <AxisFrame y="" x={name} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} horizontal={false} />
          <XAxis type="number" tick={TICK} domain={domain} tickFormatter={format} />
          <YAxis type="category" dataKey={nameKey} tick={TICK} width={labelWidth} />
          <Tooltip content={<Tip valueFormat={(item) => (format ? format(item.value) : item.value)} />} />
          <Bar dataKey={valueKey} name={name} fill={BLUE} maxBarSize={6} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function AreaScatter({ rows }) {
  const data = rows.map((row) => ({ ...row, label: row.area === "OX" ? "OX" : "" }));
  return (
    <AxisFrame y="Revenue per customer (£)" x="Customers in the area" height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} />
          <XAxis dataKey="customers" name="Customers" tick={TICK} />
          <YAxis dataKey="revenuePerCustomer" name="Revenue per customer" tick={TICK} width={52} tickFormatter={moneyTick} />
          <Tooltip content={<ScatterTip />} />
          <Scatter data={data} name="Postcode area" fill={BLUE}>
            {data.map((row) => (
              <Cell key={row.area} fill={row.area === "OX" ? BLUE : BLUE_SOFT} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function FamilyAreaChart({ rows, keys }) {
  return (
    <AxisFrame y="Line revenue (£)" x="Month" height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis {...monthAxis(1)} />
          <YAxis tick={TICK} width={52} tickFormatter={moneyTick} />
          <Tooltip content={<Tip labelFormat={monthLabel} valueFormat={(item) => gbp(item.value, 0)} />} />
          {keys.map((key) => (
            <Line key={key} type="monotone" dataKey={key} name={key} stroke={FAMILY_COLORS[key]} strokeWidth={1.25} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function ItemsChart({ rows }) {
  return (
    <AxisFrame y="Orders" x="Items in the order" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="bucket" tick={TICK} />
          <YAxis tick={TICK} width={44} />
          <Tooltip content={<Tip valueFormat={(item) => integer(item.value)} />} />
          <Bar dataKey="orders" name="Orders" maxBarSize={16} radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.bucket} fill={row.bucket === "1" ? BLUE : STEEL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function ShippingChart({ rows }) {
  return (
    <AxisFrame y="Orders" x="Shipping fee" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="fee" tick={{ ...TICK, fontSize: 11 }} interval={0} angle={-40} textAnchor="end" height={64} />
          <YAxis tick={TICK} width={44} />
          <Tooltip content={<Tip valueFormat={(item) => integer(item.value)} />} />
          <Bar dataKey="orders" name="Orders" fill={BLUE} maxBarSize={12} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

export function CompareBars({ rows, label }) {
  return (
    <AxisFrame y={label} x="" height={220}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis dataKey="name" tick={TICK} />
          <YAxis tick={TICK} width={48} tickFormatter={(value) => `£${Math.round(value)}`} />
          <Tooltip content={<Tip valueFormat={(item) => gbp(item.value, 2)} />} />
          <Bar dataKey="value" name={label} maxBarSize={18} radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.name} fill={row.name === "Free shipping" ? GOOD : BLUE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}

function ProductMonthTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="tip">
      <div className="tip-title">{monthLabel(label)}</div>
      <div className="tip-row"><span>Line revenue</span><strong>{gbp(point.revenue, 0)}</strong></div>
      <div className="tip-row"><span>Units</span><strong>{integer(point.units)}</strong></div>
      <div className="tip-row"><span>Orders</span><strong>{integer(point.orders)}</strong></div>
    </div>
  );
}

export function ProductMonthChart({ rows }) {
  return (
    <>
      <AxisFrame y="Line revenue (£)" x="Month" height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
            <XAxis {...monthAxis(1)} />
            <YAxis tick={TICK} width={52} tickFormatter={moneyTick} />
            <Tooltip content={<ProductMonthTip />} />
            <Bar dataKey="revenue" name="Line revenue" maxBarSize={14} radius={[3, 3, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.month} fill={row.year === "Y2" ? BLUE : row.year === "lead" ? STEEL : BLUE_SOFT} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </AxisFrame>
      <ul className="legend">
        <li><i className="swatch" style={{ background: STEEL }} /> Sep 2024 lead-in</li>
        <li><i className="swatch" style={{ background: BLUE_SOFT }} /> Year 1</li>
        <li><i className="swatch" style={{ background: BLUE }} /> Year 2</li>
      </ul>
    </>
  );
}

export function SignupChart({ rows }) {
  return (
    <AxisFrame y="New subscribers" x="Month" height={260}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(75,70,92,0.06)" strokeWidth={0.6} vertical={false} />
          <XAxis {...monthAxis(2)} />
          <YAxis tick={TICK} width={36} />
          <Tooltip content={<Tip labelFormat={monthLabel} valueFormat={(item) => integer(item.value)} />} />
          <Bar dataKey="count" name="Subscribers" fill={BLUE} maxBarSize={6} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AxisFrame>
  );
}
