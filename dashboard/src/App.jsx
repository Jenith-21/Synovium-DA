import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { buildModel, monthLabel } from "./analyze";
import {
  BasketChart,
  DiscountChart,
  FamilyChart,
  FrequencyChart,
  GrowthChart,
  ParetoChart,
  RevenueChart,
  SeasonChart,
} from "./charts";
import {
  CompareBars,
  FamilyAreaChart,
  FAMILY_COLORS,
  HorizontalBars,
  HourChart,
  ItemsChart,
  ProductMonthChart,
  ShippingChart,
  SignupChart,
  WeekdayChart,
  YearOverlayChart,
} from "./overview-charts";
import { gbp, gbpCompact, integer, pct, signedPct, signedPp } from "./format";
import { YEAR_ONE, YEAR_TWO } from "./charts";
import UkMap from "./UkMap";
import cleanCsv from "../../Synovium Web Orders - Clean Data.csv?raw";
import skuCsv from "../../Synovium Web Orders - SKU Lookup.csv?raw";
import refundsCsv from "../../Synovium Web Orders - Refunds.csv?raw";
import mailCsv from "../../Synovium Mailerlite Subscriptions.csv?raw";

const TABS = [
  ["overview", "Overview", "grid"],
  ["insights", "Insights", "star"],
  ["gap", "Gap analysis", "gap"],
];

function Icon({ name }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "grid") {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
      </svg>
    );
  }
  if (name === "trend") {
    return (
      <svg {...props}>
        <polyline points="4 16 9 11 13 14 20 7" />
        <polyline points="14 7 20 7 20 13" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.8-2.8 2.8-4.2 5.5-4.2s4.7 1.4 5.5 4.2" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16.2 14.8c1.8.4 3.1 1.5 3.8 4.2" />
      </svg>
    );
  }
  if (name === "tag") {
    return (
      <svg {...props}>
        <path d="M12.5 4.5H5.5v7l8 8 7-7-8-8z" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg {...props}>
        <path d="M4 8l8-4 8 4-8 4-8-4z" />
        <path d="M4 8v8l8 4 8-4V8" />
        <path d="M12 12v8" />
      </svg>
    );
  }
  if (name === "repeat") {
    return (
      <svg {...props}>
        <path d="M7 7h8a4 4 0 0 1 0 8H9" />
        <path d="M17 17H9a4 4 0 0 1 0-8h6" />
        <polyline points="6 4 4 7 7 8" />
        <polyline points="18 20 20 17 17 16" />
      </svg>
    );
  }
  if (name === "layers") {
    return (
      <svg {...props}>
        <path d="M12 4l8 4-8 4-8-4 8-4z" />
        <path d="M4 12l8 4 8-4" />
        <path d="M4 16l8 4 8-4" />
      </svg>
    );
  }
  if (name === "flag") {
    return (
      <svg {...props}>
        <path d="M6 20V4" />
        <path d="M6 5h12l-2.2 3.5L18 12H6" />
      </svg>
    );
  }
  if (name === "gap") {
    return (
      <svg {...props}>
        <path d="M4 7h7" />
        <path d="M13 17h7" />
        <path d="M8 7v4a4 4 0 0 0 4 4h1" />
        <path d="M16 17v-4a4 4 0 0 0-4-4h-1" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M12 3.5l2.2 4.6 5 .7-3.6 3.5.9 5.1L12 15.2 7.5 17.4l.9-5.1L4.8 8.8l5-.7L12 3.5z" />
    </svg>
  );
}

function Sparkline({ values }) {
  if (!values?.length) return null;
  const width = 280;
  const height = 64;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = 8 + (1 - (value - min) / span) * (height - 18);
    return [x, y];
  });
  const line = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} fill="rgba(62,107,122,0.16)" />
      <path d={line} fill="none" stroke="#3E6B7A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function parseCsv(text, name) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
  if (!parsed.data?.length) throw new Error(`No rows in ${name}`);
  return parsed.data;
}

function tone(change, goodWhenUp) {
  return (change > 0) === goodWhenUp ? "good" : "bad";
}

function Kpi({ label, value, change, changeLabel, y1, y2, base, goodWhenUp, icon }) {
  const direction = tone(change, goodWhenUp);
  const max = Math.max(y1, y2) || 1;
  return (
    <article className="kpi">
      <div className="kpi-top">
        <span className={`glyph ${direction}`}><Icon name={icon} /></span>
        <div className={`pill ${direction}`}>{changeLabel}</div>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="track" aria-hidden="true">
        <b className={direction} style={{ width: `${(y2 / max) * 100}%` }} />
      </div>
      <div className="kpi-base">{base}</div>
    </article>
  );
}

function Compare({ label, from, to, changeLabel, change, goodWhenUp, note }) {
  const direction = tone(change, goodWhenUp);
  return (
    <article>
      <div className="label">{label}</div>
      <div className="figures">
        <strong>{from}</strong>
        <span>Year 1</span>
        <span aria-hidden="true">→</span>
        <strong>{to}</strong>
        <span>Year 2</span>
      </div>
      <div className={`delta ${direction}`}>{changeLabel}</div>
      {note ? <div className="kpi-base">{note}</div> : null}
    </article>
  );
}

function Section({ id, index, kicker, headline, soWhat, children }) {
  return (
    <section className="card" id={id}>
      <header className="card-head">
        <p className="kicker">{index} · {kicker}</p>
        <h2>{headline}</h2>
        <p className="so-what">{soWhat}</p>
      </header>
      {children ? <div className="card-body">{children}</div> : null}
    </section>
  );
}

function Tile({ title, note, children, className = "" }) {
  return (
    <div className={`tile ${className}`.trim()}>
      {title ? <h3>{title}</h3> : null}
      {children}
      {note ? <p className="source">{note}</p> : null}
    </div>
  );
}

function oneDecimal(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const REORDER_COLUMNS = [
  ["group", "Group", (row) => row.group],
  ["product", "Product", (row) => row.product],
  ["buyers", "Buyers", (row) => integer(row.buyers)],
  ["orders", "Orders", (row) => integer(row.orders)],
  ["revenue", "Revenue (£)", (row) => oneDecimal(row.revenue)],
  ["yoy", "YoY %", (row) => (row.yoy == null ? "—" : signedPct(row.yoy, 0))],
  ["reorderRate", "Reorder rate %", (row) => (row.reorderRate == null ? "—" : oneDecimal(row.reorderRate * 100))],
  ["ordersPerBuyer", "Orders per buyer", (row) => oneDecimal(row.ordersPerBuyer)],
  ["medianDays", "Median days between reorders", (row) => oneDecimal(row.medianDays)],
  ["daysPerUnit", "Days per unit", (row) => oneDecimal(row.daysPerUnit)],
];

function ProductBreakdown({ row, onClose, onOpen }) {
  const closeRef = useRef(null);
  const peak = row.monthly.reduce((best, point) => (point.revenue > best.revenue ? point : best), row.monthly[0]);
  const reminder = row.daysPerUnit == null ? null : Math.round(row.daysPerUnit - 5);
  const stats = [
    ["Line revenue", gbp(row.revenue, 0)],
    ["Share of product revenue", pct(row.share, 1)],
    ["Units", integer(row.units)],
    ["Buyers", integer(row.buyers)],
    ["Orders", integer(row.orders)],
    ["Revenue per buyer", gbp(row.revenuePerBuyer, 0)],
    ["Units per order", oneDecimal(row.unitsPerOrder)],
    ["Year 1", gbp(row.y1, 0)],
    ["Year 2", gbp(row.y2, 0)],
    ["Year 2 vs Year 1", row.yoy == null ? "—" : signedPct(row.yoy, 0), row.yoy],
    ["Reorder rate", row.reorderRate == null ? "—" : pct(row.reorderRate, 1)],
    ["Reminder day", reminder == null ? "—" : `Day ${reminder}`],
  ];

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, row.product]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="product-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
      <div className="product-detail-head">
        <h3 id="product-dialog-title">{row.product}</h3>
        <button type="button" ref={closeRef} onClick={onClose}>Close</button>
      </div>
      <div className="product-detail-body">
      <div className="product-kpis">
        {stats.map(([label, value, change]) => (
          <article key={label}>
            <div className="label">{label}</div>
            <strong className={change == null ? undefined : change >= 0 ? "good" : "bad"}>{value}</strong>
          </article>
        ))}
      </div>
      <h3>Top products bought with this</h3>
      <p className="source">
        {integer(row.withAnother)} of {integer(row.orders)} orders also include another product.
        {row.boughtTogether.length ? " Counts are for the other product on those same orders. Click a name to open it." : null}
      </p>
      {row.boughtTogether.length ? (
        <div className="table-wrap">
          <table className="together-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Orders together</th>
                <th>Share of orders</th>
                <th>Buyers</th>
                <th>Units</th>
                <th>Line revenue</th>
              </tr>
            </thead>
            <tbody>
              {row.boughtTogether.map((item) => (
                <tr key={item.product}>
                  <td>
                    <button type="button" onClick={() => onOpen(item.product)}>{item.product}</button>
                  </td>
                  <td>{integer(item.orders)}</td>
                  <td>{pct(item.share, 1)}</td>
                  <td>{integer(item.buyers)}</td>
                  <td>{integer(item.units)}</td>
                  <td>{gbp(item.revenue, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h3>Line revenue each month</h3>
      <ProductMonthChart rows={row.monthly} />
      <p className="source">
        {peak?.revenue
          ? `Busiest month was ${monthLabel(peak.month)}, at ${gbp(peak.revenue, 0)} from ${integer(peak.orders)} orders.`
          : "No line revenue in this range."}
        {" "}September 2024 is a lead-in month and is left out of the year-on-year change. Hover a bar for units and orders.
      </p>
      </div>
      </div>
    </div>,
    document.body,
  );
}

function ReorderTable({ rows, selected, onSelect }) {
  const [sort, setSort] = useState({ key: "revenue", dir: "desc" });
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    const leftMissing = left == null || left === "";
    const rightMissing = right == null || right === "";
    if (leftMissing && rightMissing) return a.product.localeCompare(b.product);
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const result = typeof left === "string" ? left.localeCompare(right) : left - right;
    return sort.dir === "asc" ? result : -result;
  });

  function choose(key) {
    setSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "product" || key === "group" ? "asc" : "desc" }
    ));
  }

  return (
    <div className="table-wrap">
      <table className="reorder-table">
        <thead>
          <tr>
            {REORDER_COLUMNS.map(([key, label]) => (
              <th key={key} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" className={sort.key === key ? "active" : undefined} onClick={() => choose(key)}>
                  {label}
                  {sort.key === key ? <span aria-hidden="true">{sort.dir === "asc" ? " ↑" : " ↓"}</span> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.product}
              className={selected === row.product ? "selected" : undefined}
              onClick={() => onSelect(row.product)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row.product);
                }
              }}
              tabIndex={0}
              aria-selected={selected === row.product}
            >
              {REORDER_COLUMNS.map(([key, , format]) => (
                <td key={key} className={key === "yoy" && row.yoy != null ? (row.yoy >= 0 ? "good" : "bad") : undefined}>{format(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Plot({ title, note, wide = false, children }) {
  return (
    <section className={`plot-card${wide ? " wide" : ""}`}>
      <h3>{title}</h3>
      {children}
      {note ? <p className="source">{note}</p> : null}
    </section>
  );
}

function readModel() {
  try {
    return {
      model: buildModel(
        parseCsv(cleanCsv, "completed orders"),
        parseCsv(skuCsv, "SKU lookup"),
        parseCsv(refundsCsv, "refunds"),
        parseCsv(mailCsv, "MailerLite"),
      ),
      error: "",
    };
  } catch (err) {
    return { model: null, error: err.message || "Could not read the order files." };
  }
}

const loaded = readModel();

export default function App() {
  const { model, error } = loaded;
  const [tab, setTab] = useState("overview");
  const stageRef = useRef(null);

  useEffect(() => {
    stageRef.current?.scrollTo(0, 0);
  }, [tab]);

  const familyBars = useMemo(() => {
    if (!model) return [];
    const ranked = [...model.range.share].sort((a, b) => b.comparableShare - a.comparableShare);
    const top = ranked.slice(0, 8).map((row) => ({ family: row.family, share: row.comparableShare }));
    const other = ranked.slice(8).reduce((total, row) => total + row.comparableShare, 0);
    return [...top, { family: "Other", share: other }];
  }, [model]);

  return (
    <div className="frame">
      <aside className="rail">
        <button type="button" className="brand" onClick={() => setTab("overview")}>
          <span className="mark" aria-hidden="true" />
          <strong>Synovium</strong>
        </button>
        <p className="rail-label">Dashboards</p>
        <nav aria-label="Pages">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : undefined}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="stage" ref={stageRef}>
        {!model && !error ? <p className="state">Reading completed orders…</p> : null}
        {error ? <p className="state">{error}</p> : null}
        {model && tab === "overview" ? <Overview model={model} /> : null}
        {model && tab === "insights" ? <Dashboard model={model} familyBars={familyBars} /> : null}
        {model && tab === "gap" ? <GapAnalysis model={model} /> : null}
      </main>
    </div>
  );
}

function Block({ kicker, title, children }) {
  return (
    <section className="block">
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function orderDate(value) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function orderWhen(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status) {
  if (status === "On time" || status === "Loyal") return "good";
  if (status === "Due") return "due";
  if (status === "At risk" || status === "Churned") return "bad";
  return undefined;
}

function statusLabel(status) {
  return status === "On time" ? "Loyal" : status;
}

const RETARGET_RANK = { "On time": 0, Due: 1, "At risk": 2, Churned: 3 };
const RETARGET_STATUSES = ["On time", "Due", "At risk", "Churned"];

function customerName(customer) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
  return name || customer.customerId;
}

function CustomerBreakdown({ customer, area, onClose }) {
  const closeRef = useRef(null);
  const stats = [
    ["Net revenue", gbp(customer.revenue, 0)],
    ["Orders", integer(customer.orders)],
    ["Average order", gbp(customer.orders ? customer.revenue / customer.orders : 0, 0)],
    ["Units", integer(customer.units)],
    ["Products", integer(customer.products.length)],
    ["First order", orderDate(customer.first)],
    ["Latest order", orderDate(customer.last)],
  ];
  if (customer.daysSince != null) {
    stats.push(
      ["Days since last order", oneDecimal(customer.daysSince)],
      ["Average days between orders", oneDecimal(customer.avgDays)],
      ["Days overdue", customer.overdue == null ? "—" : oneDecimal(customer.overdue)],
      ["Status", statusLabel(customer.status)],
    );
  }

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, customer.customerId]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="product-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="product-detail-head">
          <h3 id="customer-dialog-title">{area ? `${customerName(customer)} · ${area}` : customerName(customer)}</h3>
          <button type="button" ref={closeRef} onClick={onClose}>Close</button>
        </div>
        <div className="product-detail-body">
          <div className="product-kpis">
            {stats.map(([label, value]) => (
              <article key={label}>
                <div className="label">{label}</div>
                <strong className={label === "Status" ? statusClass(value) : undefined}>{value}</strong>
              </article>
            ))}
          </div>
          <h3>{area ? `Bought in ${area}` : "Everything they bought"}</h3>
          <p className="source">Net revenue counts each order once. The table is line revenue for products on those orders.</p>
          {customer.products.length ? (
            <div className="table-wrap">
              <table className="together-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Orders</th>
                    <th>Units</th>
                    <th>Line revenue</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.products.map((item) => (
                    <tr key={item.product}>
                      <td>{item.product}</td>
                      <td>{integer(item.orders)}</td>
                      <td>{integer(item.units)}</td>
                      <td>{gbp(item.revenue, 0)}</td>
                      <td>{pct(item.share, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="source">This customer has no named product lines in {area}.</p>}
          {customer.orderDates?.length ? (
            <>
              <h3>Order dates</h3>
              <p className="source">Newest first. The gap is the days since the order before it.</p>
              <div className="table-wrap order-dates">
                <table className="together-table">
                  <thead>
                    <tr>
                      <th>Order date</th>
                      <th>Days since previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orderDates.map((date, index) => {
                      const older = customer.orderDates[index + 1];
                      const gap = older == null ? null : (date - older) / 86400000;
                      return (
                        <tr key={`${date}-${index}`}>
                          <td>{orderWhen(date)}</td>
                          <td>{oneDecimal(gap)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Overview({ model }) {
  const view = model.overview;
  const [areaCode, setAreaCode] = useState("OX");
  const [areaView, setAreaView] = useState("products");
  const [openCustomer, setOpenCustomer] = useState(null);
  const [skuGroup, setSkuGroup] = useState("All");
  const [skuSort, setSkuSort] = useState("revenue");
  const [openBuyer, setOpenBuyer] = useState(null);
  const [customerSort, setCustomerSort] = useState({ key: "revenue", dir: "desc" });
  const [retargetSort, setRetargetSort] = useState({ key: "overdue", dir: "desc" });
  const [retargetStatus, setRetargetStatus] = useState(RETARGET_STATUSES);
  const topAreas = view.areas.slice(0, 15);
  const selectedArea = view.areas.find((row) => row.area === areaCode) || null;
  const skuRows = [...view.skus]
    .filter((row) => skuGroup === "All" || row.family === skuGroup)
    .sort((a, b) => {
      if (skuSort === "group") return a.family.localeCompare(b.family) || b.revenue - a.revenue;
      if (skuSort === "units") return b.units - a.units || b.revenue - a.revenue;
      return b.revenue - a.revenue || b.units - a.units;
    });
  const customers = [...view.customerList].sort((a, b) => {
    const value = (item) => {
      if (customerSort.key === "name") return customerName(item);
      if (customerSort.key === "products") return item.products.length;
      return item[customerSort.key];
    };
    const left = value(a);
    const right = value(b);
    const leftMissing = left == null || left === "";
    const rightMissing = right == null || right === "";
    if (leftMissing && rightMissing) return customerName(a).localeCompare(customerName(b));
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const result = typeof left === "string" ? left.localeCompare(right) : left - right;
    return customerSort.dir === "asc" ? result : -result;
  });
  function sortCustomers(key) {
    setCustomerSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    ));
  }
  const retargetPool = view.customerList.filter((item) => RETARGET_STATUSES.includes(item.status));
  const retargetRows = retargetPool
    .filter((item) => retargetStatus.includes(item.status))
    .sort((a, b) => {
      const value = (item) => {
        if (retargetSort.key === "name") return customerName(item);
        if (retargetSort.key === "status") return RETARGET_RANK[item.status];
        return item[retargetSort.key];
      };
      const left = value(a);
      const right = value(b);
      const leftMissing = left == null || left === "";
      const rightMissing = right == null || right === "";
      if (leftMissing && rightMissing) return customerName(a).localeCompare(customerName(b));
      if (leftMissing) return 1;
      if (rightMissing) return -1;
      const result = typeof left === "string" ? left.localeCompare(right) : left - right;
      if (result === 0) return customerName(a).localeCompare(customerName(b));
      return retargetSort.dir === "asc" ? result : -result;
    });
  function sortRetarget(key) {
    setRetargetSort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    ));
  }
  function toggleRetargetStatus(status) {
    setRetargetStatus((current) => (
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    ));
  }
  const paypal = view.payments.find((row) => row.method === "PayPal");
  const apple = view.payments.find((row) => row.method === "Apple Pay");
  const card = view.payments.find((row) => row.method === "Card");
  const link = view.payments.find((row) => row.method === "Link");

  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <h1>Overview</h1>
          <div className="chip">Sep 2024 – Sep 2026</div>
        </div>
        <div className="top-actions">
          <div className="search">Completed orders · net revenue excludes VAT and shipping</div>
          <div className="dark-pill">{integer(view.orders)} orders</div>
        </div>
      </header>

      <div className="stats">
        <article className="stat lead">
          <div className="kpi-label">Net revenue</div>
          <div className="stat-value">{gbpCompact(view.revenue)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Orders</div>
          <div className="stat-value">{integer(view.orders)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Customers</div>
          <div className="stat-value">{integer(view.customers)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Average order value</div>
          <div className="stat-value">{gbp(view.aov, 2)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Items per order</div>
          <div className="stat-value">{view.itemsPerOrder.toFixed(2)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Total discount</div>
          <div className="stat-value">{gbpCompact(view.discount)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Shipping collected</div>
          <div className="stat-value">{gbpCompact(view.shipping)}</div>
        </article>
        <article className="stat">
          <div className="kpi-label">Refunds</div>
          <div className="stat-value">{pct(view.refundPct, 2)}</div>
          <div className="kpi-base">{gbp(view.refundValue, 0)} across {integer(view.refundOrders)} refunded orders</div>
        </article>
      </div>

      <Block kicker="Time" title="When orders come in">
        <div className="plots">
          <Plot wide title="Year 1 and Year 2 by calendar month" note="The same month in each year, overlaid. September 2024 is left out.">
            <YearOverlayChart rows={view.yoyMonth} />
            <ul className="legend">
              <li><i className="swatch" style={{ background: YEAR_ONE }} /> Year 1 · Oct 2024 – Sep 2025</li>
              <li><i className="swatch" style={{ background: YEAR_TWO }} /> Year 2 · Oct 2025 – Sep 2026</li>
            </ul>
          </Plot>
          <Plot title="Orders by hour" note="Two peaks: late morning, around 11:00, and the evening from 19:00 to 21:00.">
            <HourChart rows={view.hours} />
          </Plot>
          <Plot title="Orders by weekday" note="Monday is the busiest day. Saturday is the quietest.">
            <WeekdayChart rows={view.weekdays} />
          </Plot>
        </div>
      </Block>

      <Block kicker="Location" title="A national customer base">
        <div className="plots location-row">
          <Plot title="UK postcode areas" note={`${integer(view.areaCount)} areas have orders. Click an area, then switch the table between its products and customers. The largest, ${topAreas[0]?.area}, is ${pct(view.maxAreaShare, 1)} of revenue.`}>
            <UkMap areas={view.areas} selected={areaCode} onSelect={(code) => { setAreaCode(code); setOpenCustomer(null); }} />
          </Plot>
          <div className="area-side">
            <article className="callout">
              <p className="kicker">Country</p>
              <div className="stat-value">{(view.ukShare * 100).toFixed(2)}% UK</div>
              <p>{integer(view.ukOrders)} of {integer(view.orders)} completed orders are billed to GB. The other two are Jersey and Guernsey.</p>
            </article>
            <article className="callout">
              <div className="area-head">
                <div className="map-switch" role="tablist" aria-label={`${areaCode} breakdown`}>
                  <button type="button" role="tab" aria-selected={areaView === "products"} className={areaView === "products" ? "active" : ""} onClick={() => setAreaView("products")}>Products</button>
                  <button type="button" role="tab" aria-selected={areaView === "customers"} className={areaView === "customers" ? "active" : ""} onClick={() => setAreaView("customers")}>Customers</button>
                </div>
                <span className="kicker">{areaCode}</span>
              </div>
              {areaView === "products" ? (
                selectedArea?.products?.length ? (
                  <div className="table-wrap area-products">
                    <table className="together-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Orders</th>
                          <th>Units</th>
                          <th>Buyers</th>
                          <th>Line revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedArea.products.map((item) => (
                          <tr key={item.product}>
                            <td>{item.product}</td>
                            <td>{integer(item.orders)}</td>
                            <td>{integer(item.units)}</td>
                            <td>{integer(item.buyers)}</td>
                            <td>{gbp(item.revenue, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p>No product lines are billed to {areaCode}.</p>
              ) : selectedArea?.buyers?.length ? (
                <>
                  <div className="table-wrap area-products">
                    <table className="together-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Orders</th>
                          <th>Units</th>
                          <th>Products</th>
                          <th>Net revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedArea.buyers.map((item) => (
                          <tr
                            key={item.customerId}
                            className="clickable"
                            tabIndex={0}
                            onClick={() => setOpenCustomer(item)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setOpenCustomer(item);
                              }
                            }}
                          >
                            <td>{customerName(item)}</td>
                            <td>{integer(item.orders)}</td>
                            <td>{integer(item.units)}</td>
                            <td>{integer(item.products.length)}</td>
                            <td>{gbp(item.revenue, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>Click a customer for the products on their orders.</p>
                </>
              ) : <p>No completed orders are billed to {areaCode}.</p>}
            </article>
          </div>
          {openCustomer ? (
            <CustomerBreakdown
              customer={openCustomer}
              area={areaCode}
              onClose={() => setOpenCustomer(null)}
            />
          ) : null}
        </div>
      </Block>

      <Block kicker="Catalogue" title="The range and who buys it">
        <div className="plots">
          <Plot title="All SKUs" note={skuGroup === "All" ? `${integer(skuRows.length)} SKUs. Choose a group, or sort the list so each group sits together.` : `${integer(skuRows.length)} SKUs in ${skuGroup}.`}>
            <div className="catalogue-tools">
              <label>
                Group
                <select value={skuGroup} onChange={(event) => setSkuGroup(event.target.value)}>
                  <option value="All">All groups</option>
                  {view.skuGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                </select>
              </label>
              <div className="map-switch" role="group" aria-label="Sort SKUs">
                <button type="button" className={skuSort === "revenue" ? "active" : ""} onClick={() => setSkuSort("revenue")}>Revenue</button>
                <button type="button" className={skuSort === "group" ? "active" : ""} onClick={() => setSkuSort("group")}>Group</button>
                <button type="button" className={skuSort === "units" ? "active" : ""} onClick={() => setSkuSort("units")}>Units</button>
              </div>
            </div>
            <div className="table-wrap catalogue-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Group</th>
                    <th className="num">Revenue</th>
                    <th className="num">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {skuRows.map((row) => (
                    <tr key={row.sku}>
                      <td>{row.sku}</td>
                      <td>{row.name}</td>
                      <td>{row.family}</td>
                      <td className="num">{gbpCompact(row.revenue)}</td>
                      <td className="num">{integer(row.units)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Plot>
          <Plot title="All customers" note={`${integer(view.customerList.length)} customers. Click a heading to sort. Click a name for what they bought.`}>
            <div className="table-wrap catalogue-scroll">
              <table className="together-table">
                <thead>
                  <tr>
                    {[
                      ["name", "Customer"],
                      ["orders", "Orders"],
                      ["units", "Units"],
                      ["products", "Products"],
                      ["avgDays", "Avg days between orders"],
                      ["revenue", "Net revenue"],
                    ].map(([key, label]) => (
                      <th key={key} aria-sort={customerSort.key === key ? (customerSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className={customerSort.key === key ? "active" : undefined} onClick={() => sortCustomers(key)}>
                          {label}
                          {customerSort.key === key ? <span aria-hidden="true">{customerSort.dir === "asc" ? " ↑" : " ↓"}</span> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((item) => (
                    <tr
                      key={item.customerId}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => setOpenBuyer(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenBuyer(item);
                        }
                      }}
                    >
                      <td>{customerName(item)}</td>
                      <td>{integer(item.orders)}</td>
                      <td>{integer(item.units)}</td>
                      <td>{integer(item.products.length)}</td>
                      <td>{oneDecimal(item.avgDays)}</td>
                      <td>{gbp(item.revenue, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Plot>
          <Plot wide title="Customers to retarget" note={`${integer(retargetRows.length)} of ${integer(retargetPool.length)} repeat customers, ordered by days overdue: how far the last order sits past that customer's own average gap. Measured to ${orderDate(view.asOf)}. Loyal means the last order is still inside that gap, or less than 14 days past it. Due is up to 1.5×, At risk up to 2.5×, and Churned is later. Select one or more statuses. Click a name for every order date.`}>
            <div className="catalogue-tools">
              <div className="map-switch" role="group" aria-label="Filter by status">
                {RETARGET_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={retargetStatus.includes(status) ? "active" : undefined}
                    aria-pressed={retargetStatus.includes(status)}
                    onClick={() => toggleRetargetStatus(status)}
                  >
                    {statusLabel(status)}
                    <span> {integer(retargetPool.filter((item) => item.status === status).length)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap catalogue-scroll">
              <table className="together-table">
                <thead>
                  <tr>
                    {[
                      ["name", "Customer", ""],
                      ["status", "Status", "status"],
                      ["orders", "Orders", ""],
                      ["avgDays", "Avg days", ""],
                      ["last", "Last order", ""],
                      ["daysSince", "Days since last", ""],
                      ["overdue", "Days overdue", ""],
                      ["revenue", "Net revenue", ""],
                    ].map(([key, label, extra]) => (
                      <th key={key} className={extra || undefined} aria-sort={retargetSort.key === key ? (retargetSort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" className={retargetSort.key === key ? "active" : undefined} onClick={() => sortRetarget(key)}>
                          {label}
                          {retargetSort.key === key ? <span aria-hidden="true">{retargetSort.dir === "asc" ? " ↑" : " ↓"}</span> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retargetRows.length ? retargetRows.map((item) => (
                    <tr
                      key={item.customerId}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => setOpenBuyer(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenBuyer(item);
                        }
                      }}
                    >
                      <td>{customerName(item)}</td>
                      <td className={`status ${statusClass(item.status)}`}>{statusLabel(item.status)}</td>
                      <td>{integer(item.orders)}</td>
                      <td>{oneDecimal(item.avgDays)}</td>
                      <td>{orderDate(item.last)}</td>
                      <td>{oneDecimal(item.daysSince)}</td>
                      <td>{oneDecimal(item.overdue)}</td>
                      <td>{gbp(item.revenue, 0)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8}>Select a status to see customers.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Plot>
          <Plot wide title="Monthly revenue by product family" note="Each line is that family's own line revenue. Airplus, the four next families, and everything else grouped as Other.">
            <FamilyAreaChart rows={view.familyMonthly} keys={view.familyKeys} />
            <ul className="legend">
              {view.familyKeys.map((key) => (
                <li key={key}><i className="swatch" style={{ background: FAMILY_COLORS[key] }} /> {key}</li>
              ))}
            </ul>
          </Plot>
          <Plot title="Items per order" note={`${pct(view.oneItemShare, 0)} of orders contain a single item.`}>
            <ItemsChart rows={view.itemsDist} />
          </Plot>
        </div>
        {openBuyer ? <CustomerBreakdown customer={openBuyer} onClose={() => setOpenBuyer(null)} /> : null}
      </Block>

      <Block kicker="Discounts" title="How much of the order book is discounted">
        <div className="plots">
          <Plot title="Discount rate by product family" note="Line discount divided by line revenue plus that discount. Families above £1,000.">
            <HorizontalBars
              rows={view.discountByFamily}
              nameKey="family"
              valueKey="rate"
              name="Discount rate"
              height={380}
              labelWidth={120}
              format={(value) => pct(value, 1)}
            />
          </Plot>
        </div>
      </Block>

      <Block kicker="Payment" title="How the order is paid">
        <div className="plots">
          <Plot title="Share of orders by payment method" note={`PayPal is ${pct(paypal?.share || 0, 0)} and Apple Pay is ${pct(apple?.share || 0, 0)}. Card includes Credit / Debit Card and values such as “Visa ending in 8166”.`}>
            <HorizontalBars
              rows={view.payments}
              nameKey="method"
              valueKey="share"
              name="Share of orders"
              height={280}
              format={(value) => pct(value, 0)}
            />
          </Plot>
          <Plot title="Average order value by payment method" note={`Card is ${gbp(card?.aov || 0, 0)} and Link is ${gbp(link?.aov || 0, 0)}, against ${gbp(paypal?.aov || 0, 0)} for PayPal and ${gbp(apple?.aov || 0, 0)} for Apple Pay.`}>
            <HorizontalBars
              rows={[...view.payments].sort((a, b) => b.aov - a.aov)}
              nameKey="method"
              valueKey="aov"
              name="Average order value"
              height={280}
              format={(value) => `£${Math.round(value)}`}
            />
          </Plot>
        </div>
      </Block>

      <Block kicker="Shipping" title="What customers pay to receive the order">
        <div className="plots">
          <Plot title="Shipping fee" note="£4.99, £6.98 and £6.90 are the common fees. Amounts with fewer than 40 orders are grouped as Other.">
            <ShippingChart rows={view.shippingFees} />
          </Plot>
          <Plot title="Free shipping and average order value" note={`Free shipping is ${pct(view.freeShare, 1)} of orders. Those orders average ${gbp(view.freeAov, 0)}.`}>
            <CompareBars
              label="Average order value"
              rows={[
                { name: "Free shipping", value: view.freeAov },
                { name: "Paid shipping", value: view.paidAov },
              ]}
            />
          </Plot>
        </div>
      </Block>

      <Block kicker="Refunds" title="Refunded orders stay out of the completed figures">
        <article className="callout">
          <p className="kicker">Refunds</p>
          <div className="stat-value">{pct(view.refundPct, 2)} of revenue</div>
          <p>
            {integer(view.refundOrders)} refunded orders total {gbp(view.refundValue, 0)}, which is {pct(view.refundPct, 2)} of completed net revenue.
          </p>
        </article>
      </Block>

      <Block kicker="Email" title="MailerLite subscribers">
        <div className="plots">
          <Plot title="Subscriber signups per month" note="September 2023 is left out. That month was a bulk import of the existing list.">
            <SignupChart rows={view.signupTrend} />
          </Plot>
          <Plot title="Engagement funnel" note="Subscribers with at least one send, one open, and one click.">
            <HorizontalBars
              rows={view.funnel}
              nameKey="stage"
              valueKey="count"
              name="Subscribers"
              height={200}
              format={(value) => integer(value)}
            />
          </Plot>
          <Plot title="Subscriber locations">
            <HorizontalBars
              rows={view.locations}
              nameKey="name"
              valueKey="count"
              name="Subscribers"
              height={220}
              labelWidth={130}
              format={(value) => integer(value)}
            />
          </Plot>
          <article className="callout">
            <p className="kicker">Subscribers and orders</p>
            <p>Repeat rate and lifetime value of subscribers versus non-subscribers need an email on the order. The order file only has a customer ID, so those two groups cannot be matched.</p>
          </article>
        </div>
      </Block>
    </>
  );
}

const GAP_ROWS = [
  ["Airplus", "Not a headline product. Summer only.", "The UK is built on it."],
  ["Agility", "Bestseller", "Europe’s lead product is falling here."],
  ["Gastrosafe", "Bestseller", "The one that already matches. It is growing."],
  ["Megabol", "Bestseller, €138", "Almost no UK orders."],
  ["Immunomodulator", "Autumn bestseller", "Small here, and growing."],
  ["MSM Optimal-C", "Autumn bestseller", "Small here, and falling."],
  ["Prefit", "Autumn bestseller", "Small here, and falling."],
  ["Linseed Oil", "Autumn bestseller", "Small here, and falling."],
];

function GapAnalysis({ model }) {
  const reorderProducts = model.overview.reorderProducts;
  const agility = reorderProducts.find((row) => row.product === "Agility");
  const megabol = reorderProducts.find((row) => row.product === "Megabol");
  const megabolYear2 = megabol
    ? megabol.monthly.filter((point) => point.year === "Y2").reduce((total, point) => total + point.orders, 0)
    : 0;
  const rows = GAP_ROWS.map(([family, europe, meaning]) => {
    const share = model.range.share.find((row) => row.family === family);
    const grown = model.growth.find((row) => row.family === family);
    const product = reorderProducts.find((row) => row.product === family);
    return {
      family,
      europe,
      meaning: family === "Megabol" ? `${integer(megabolYear2)} orders in Year 2.` : meaning,
      share: share?.comparableShare ?? 0,
      yoy: grown?.yoy ?? product?.yoy ?? null,
    };
  });
  const agilityChange = rows.find((row) => row.family === "Agility")?.yoy;
  const leaders = ["Airplus 960ml", "Airplus 5L", "Agility", "Gastrosafe", "Gastrosafe Refill"]
    .map((product) => reorderProducts.find((row) => row.product === product))
    .filter((row) => row?.reorderRate != null);
  const agilityLeads = agility?.reorderRate != null && leaders.every((row) => row.reorderRate <= agility.reorderRate);

  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <h1>Gap analysis</h1>
          <div className="chip">synovium.eu · 8 Oct 2026</div>
        </div>
      </header>

      <Section
        index="01"
        kicker="The range"
        headline="Europe sells several heroes. The UK sells Airplus."
        soWhat={`Agility, Gastrosafe and Megabol carry the European shop. Airplus is ${pct(model.range.airplusComparable, 0)} of UK revenue and about ${pct(model.range.firstPurchaseAirplus, 0)} of first orders, and outside summer it is not a headline product on synovium.eu. Europe here is the shop that day: badges, the offer, prices, shipping. The UK is two years of orders.`}
      >
        <div className="table-wrap">
          <table className="together-table gap-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Europe</th>
                <th>UK share</th>
                <th>Year 2</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.family}>
                  <td>{row.family}</td>
                  <td>{row.europe}</td>
                  <td>{pct(row.share, 1)}</td>
                  <td className={row.yoy == null ? undefined : row.yoy >= 0 ? "good" : "bad"}>{row.yoy == null ? "—" : signedPct(row.yoy, 0)}</td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        index="02"
        kicker="Price"
        headline="The UK is not losing these products on price."
        soWhat="Agility is £74 against €78. Megabol is about £123 against €138. Prefit is £36 against €58. Where Europe is pushing a product and the UK is not selling it, the shelf price is the same or lower. The difference is what customers are shown."
      />

      <Section
        index="03"
        kicker="Megabol"
        headline="Megabol is a European bestseller and a UK blank."
        soWhat={`Year 2 is ${integer(megabolYear2)} orders. The whole file is ${gbp(megabol?.revenue || 0, 0)}. Stock, regulation, or no marketing: one of those three is the reason, and the orders cannot tell which.`}
      />

      <Section
        index="04"
        kicker="Agility"
        headline="Agility falls in the UK because people are not shown it."
        soWhat={`It leads the European shop. Here, ${pct(agility?.reorderRate, 0)} of buyers who had time to repurchase came back${agilityLeads ? ", the highest rate of the five products that carry most of UK revenue" : ""}, and a unit lasts about ${Math.round(agility?.daysPerUnit || 0)} days. Revenue still fell ${pct(Math.abs(agilityChange || 0), 0)}. The product holds the customer. The front of the shop does not.`}
      />

      <Section
        index="05"
        kicker="The basket"
        headline="Europe pays the customer to add a product. The UK pays them to use a code."
        soWhat={`The European offer is 5% off two products, 10% off three, 15% off four. Year 2 discount in the UK was ${gbp(model.discount.spendY2, 0)}, roughly double the year before, and ${pct(model.crossSell.multiShare, 1)} of orders contain a second product. The European rule is aimed at the gap. The UK codes are not.`}
      />

      <Section
        index="06"
        kicker="Delivery"
        headline="Europe gives free delivery at a basket the UK already reaches."
        soWhat={`Free from €100, about £86. UK free delivery sits around £150, and the usual paid fee is £6.90 or £6.98. ${integer(model.gap.ordersAbove86)} orders, ${pct(model.gap.ordersAbove86Share, 0)} of them, are already at or above £86.`}
      />

      <Section
        index="07"
        kicker="The season"
        headline="Europe has an autumn range. The UK has an autumn dip."
        soWhat="Prefit, Immunomodulator, MSM Optimal-C and Linseed Oil are the European autumn push. October to December is the quiet quarter in the UK, every year, and those products are the ones with room to fill it. Immunomodulator is already growing. The other three are falling from a small base."
      />

      <Section
        index="08"
        kicker="How the shop is built"
        headline="Europe sells the horse’s need. The UK sells the product the customer already typed."
        soWhat={`The European shop is fifteen needs: joints, digestion, immunity, recovery, and the rest. A second product is the next thing on the page. ${pct(model.gap.airplusOnlyShare, 0)} of Airplus buyers, ${integer(model.gap.airplusOnly)} of ${integer(model.gap.airplusBuyers)}, never buy another family.`}
      />

      <Section
        index="09"
        kicker="What closes it"
        headline="European sales by product would show the size of the gap."
        soWhat="Vetmarx can supply 24 months of units and revenue. Until that arrives, this is the European shop set against UK orders."
      />
    </>
  );
}

function Dashboard({ model, familyBars }) {
  const [rangeFamily, setRangeFamily] = useState("Airplus");
  const { kpis, acquisition, discount, range, retention, crossSell, growth, airplusSkus, totals, monthly } = model;
  const mail = model.overview.mail;
  const reorderProducts = model.overview.reorderProducts;
  const lineRevenue = reorderProducts.reduce((total, row) => total + row.revenue, 0);
  const leaders = reorderProducts.slice(0, 5);
  const leaderRevenue = leaders.reduce((total, row) => total + row.revenue, 0);
  const rest = reorderProducts.slice(5);
  const fewBuyers = rest.filter((row) => row.buyers < 30).length;
  const reminders = ["Airplus 960ml", "Gastrosafe", "Calmingard", "Agility"].map((product) => {
    const row = reorderProducts.find((item) => item.product === product);
    return {
      label: product === "Gastrosafe" ? "Gastrosafe tub" : product,
      day: Math.round(row.daysPerUnit - 5),
    };
  });
  const linseed = reorderProducts.find((row) => row.product === "Linseed Oil");
  const msm = reorderProducts.find((row) => row.product === "MSM Optimal-C");
  const smallWeak = reorderProducts.filter((row) => row.revenue < 1000 && (row.reorderRate == null || row.reorderRate < 0.3));
  const [openProduct, setOpenProduct] = useState(null);
  const selectedProduct = reorderProducts.find((row) => row.product === openProduct) || null;
  const fiveLitre = airplusSkus[0];
  const bottle = airplusSkus[1];
  const bands = discount.bandsY1.map((row, index) => ({
    band: row.band,
    y1orders: row.orders,
    y1aov: row.aov,
    y2orders: discount.bandsY2[index].orders,
    y2aov: discount.bandsY2[index].aov,
  }));

  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <h1>Insights</h1>
          <div className="chip">Year 2 · Oct 2025 – Sep 2026</div>
        </div>
        <div className="top-actions">
          <div className="search">Year 2 against Year 1 · net revenue excludes VAT and shipping</div>
          <div className="dark-pill">{integer(totals.orders)} orders</div>
        </div>
      </header>

      <div className="kpis">
        <article className="kpi hero">
          <div className="kpi-top">
            <div className="kpi-label">Net revenue</div>
            <div className="pill light">{signedPct(kpis.revenueChange)}</div>
          </div>
          <div className="kpi-value">{gbpCompact(kpis.y2.revenue)}</div>
          <Sparkline values={monthly.map((row) => row.revenue)} />
          <div className="hero-meta">
            <div><span>Year 1</span><strong>{gbpCompact(kpis.y1.revenue)}</strong></div>
            <div><span>Year 2</span><strong>{gbpCompact(kpis.y2.revenue)}</strong></div>
            <div><span>Orders</span><strong>{signedPct(kpis.ordersChange)}</strong></div>
          </div>
        </article>
        <Kpi icon="trend" label="Orders" value={integer(kpis.y2.orders)} change={kpis.ordersChange} changeLabel={signedPct(kpis.ordersChange)} y1={kpis.y1.orders} y2={kpis.y2.orders} base={`${integer(kpis.y1.orders)} in Year 1`} goodWhenUp />
        <Kpi icon="box" label="Average order value" value={gbp(kpis.y2.aov, 2)} change={kpis.aovChange} changeLabel={signedPct(kpis.aovChange)} y1={kpis.y1.aov} y2={kpis.y2.aov} base={`${gbp(kpis.y1.aov, 2)} in Year 1`} goodWhenUp />
        <Kpi icon="repeat" label="Repeat customer rate" value={pct(kpis.y2.repeatRate, 1)} change={kpis.repeatChange} changeLabel={signedPp(kpis.repeatChange)} y1={kpis.y1.repeatRate} y2={kpis.y2.repeatRate} base="Customers with 2+ orders in the year" goodWhenUp />
      </div>

      <Section
        id="revenue"
        index="01"
        kicker="Revenue"
        headline={`Net revenue down ${Math.abs(Math.round(kpis.revenueChange * 100))}% YoY; orders down ${Math.abs(Math.round(kpis.ordersChange * 100))}%.`}
        soWhat="The business got smaller because fewer orders came in. The basket itself is slightly larger, so this is a demand problem."
      >
        <Tile
          title="Monthly net revenue"
          note="Each month is the sum of net order revenue × order count. September 2024 is the lead-in and is excluded from the year-on-year figure."
        >
          <RevenueChart monthly={monthly} />
        </Tile>
      </Section>

      <Section
        id="discounting"
        index="02"
        kicker="Discounting"
        headline={`Discount spend doubled to ${gbpCompact(discount.spendY2)}, half of orders now discounted; deep-discount orders have the lowest AOV and don't create more repeat buyers.`}
        soWhat={`A discounted first order comes back ${pct(discount.repeatDiscounted, 1)} of the time, against ${pct(discount.repeatFullPrice, 1)} for full price. Year 2 orders over 15% off average ${gbp(bands[4].y2aov, 2)}.`}
      >
        <Tile
          title="Discount spend and the share of orders discounted"
          note={`Bars are cart discount × order count. The line is the share of orders with a discount. Year 1 spend was ${gbpCompact(discount.spendY1)}; ${pct(discount.shareY1, 0)} of orders were discounted, against ${pct(discount.shareY2, 0)} in Year 2.`}
        >
          <DiscountChart monthly={monthly} />
        </Tile>
        <div className="split even band-split">
        <Tile title="Orders and average order value by discount band" note="Discount % = cart discount ÷ order subtotal.">
          <table>
            <thead>
              <tr>
                <th>Discount band</th>
                <th>Y1 orders</th>
                <th>Y2 orders</th>
                <th>Order change</th>
                <th>Y1 AOV</th>
                <th>Y2 AOV</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((row) => (
                <tr key={row.band} className={row.band === ">15%" ? "deep" : undefined}>
                  <td>{row.band}</td>
                  <td>{integer(row.y1orders)}</td>
                  <td>{integer(row.y2orders)}</td>
                  <td>{signedPct(row.y1orders ? row.y2orders / row.y1orders - 1 : 0, 0)}</td>
                  <td>{gbp(row.y1aov, 2)}</td>
                  <td>{gbp(row.y2aov, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
        <div className="stack">
          <article>
            <div className="name">{pct(discount.repeatFullPrice, 1)} came back</div>
            <div className="meta">Full-price first order · {integer(discount.fullPriceCustomers)} customers</div>
          </article>
          <article>
            <div className="name">{pct(discount.repeatDiscounted, 1)} came back</div>
            <div className="meta">Discounted first order · {integer(discount.discountedCustomers)} customers</div>
          </article>
        </div>
        </div>
      </Section>

      <Section
        id="range"
        index="03"
        kicker="Range"
        headline={`Airplus = ${Math.round(range.airplusComparable * 100)}% of revenue and ~${Math.round(range.firstPurchaseAirplus * 100)}% of first purchases; Oct–Dec is the weak season every year.`}
        soWhat="Four in five relationships start with one respiratory product, and that product is quiet every winter. October to December needs a plan that is not another Airplus code."
      >
        <div className="range-filter">
          <span>Family</span>
          <div className="map-switch" role="tablist" aria-label="Product family">
            {familyBars.filter((row) => row.family !== "Other").slice(0, 5).map((row) => (
              <button
                key={row.family}
                type="button"
                role="tab"
                aria-selected={rangeFamily === row.family}
                className={rangeFamily === row.family ? "active" : ""}
                onClick={() => setRangeFamily(row.family)}
              >
                {row.family}
        </button>
            ))}
          </div>
        </div>
        <div className="split charts">
          <Tile title="Share of line revenue by product family" note={`Year 1 and Year 2. ${rangeFamily} is marked. Click a family, or use the filter. Airplus is ${pct(range.airplusComparable, 1)} of that window and ${pct(range.airplusAll, 1)} of all completed orders. Other is every remaining family.`}>
            <FamilyChart rows={familyBars} selected={rangeFamily} onSelect={setRangeFamily} />
          </Tile>
          <Tile title={`${rangeFamily} line revenue by calendar month`} note={rangeFamily === "Airplus" ? `Two years combined, September 2024 excluded so each month is comparable. ${pct(range.firstPurchaseAirplus, 0)} of first orders include Airplus.` : `Two years combined, September 2024 excluded so each month is comparable. Oct–Dec is marked so it can be compared with Airplus.`}>
            <SeasonChart months={range.familyByMonth[rangeFamily]} family={rangeFamily} />
          </Tile>
        </div>
      </Section>

      <Section
        id="retention"
        index="04"
        kicker="Retention"
        headline={`${Math.round(retention.onceShare * 100)}% buy once, yet repeat customers drive ${Math.round(retention.repeatRevenueShare * 100)}% of revenue.`}
        soWhat={`The median gap between repeat orders is ${Math.round(retention.medianDays)} days. A second-order prompt in that window is aimed at the customers who already produce three-quarters of revenue.`}
      >
        <div className="median">
          <p>Median days between consecutive orders, for customers who ordered more than once.</p>
          <strong>{Math.round(retention.medianDays)} days</strong>
        </div>
        <div className="split even">
          <Tile title="Customers by number of orders" note={`Lifetime completed orders. One-time buyers are ${integer(retention.buckets[0].customers)} of ${integer(totals.customers)}.`}>
            <FrequencyChart buckets={retention.buckets} />
          </Tile>
          <Tile title="Cumulative net revenue by customer" note={`Customers ranked from the largest spender. The top 10% account for ${pct(retention.topTenShare, 0)} of net revenue. The dashed line is an equal share.`}>
            <ParetoChart pareto={retention.pareto} topTenShare={retention.topTenShare} />
          </Tile>
        </div>
      </Section>

      <Section
        id="cross-sell"
        index="05"
        kicker="Cross-sell"
        headline={`Multi-product orders are worth ~${Math.round(crossSell.ratio)}x more but are only ${(crossSell.multiShare * 100).toFixed(1)}% of orders.`}
        soWhat="Almost every checkout is a single SKU. Agility and Gastrosafe, when they are the first purchase, already come back more often than Airplus — they are the attach, not a separate acquisition bet."
      >
        <div className="split charts">
          <Tile title="Average order value, single-product vs multi-product" note="A multi-product order contains more than one SKU. Average order value is net order revenue.">
            <BasketChart
              singleAov={crossSell.singleAov}
              multiAov={crossSell.multiAov}
              singleShare={crossSell.singleShare}
              multiShare={crossSell.multiShare}
            />
            <ul className="legend">
              <li><i className="swatch steel" /> Single product · {pct(crossSell.singleShare, 1)} of orders · {gbp(crossSell.singleAov, 0)}</li>
              <li><i className="swatch good" /> Multi-product · {pct(crossSell.multiShare, 1)} of orders · {gbp(crossSell.multiAov, 0)}</li>
          </ul>
          </Tile>
          <Tile title="Repeat rate by first-purchase product family" note="Top six families by customers whose highest-revenue line on their first order was that family.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>First-purchase family</th>
                    <th>Customers</th>
                    <th>Repeat rate</th>
                  </tr>
                </thead>
                <tbody>
                  {crossSell.firstFamilyRepeat.map((row) => {
                    const meter = row.repeatRate >= 0.4 ? "good" : row.repeatRate < 0.25 ? "bad" : "";
                    return (
                      <tr key={row.family}>
                        <td>{row.family}</td>
                        <td>{integer(row.customers)}</td>
                        <td>
                          <span className={`meter ${meter}`}>
                            <i><b style={{ width: `${Math.round(row.repeatRate * 100)}%` }} /></i>
                            {pct(row.repeatRate, 1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Tile>
        </div>
      </Section>

      <Section
        id="growth"
        index="06"
        kicker="Growth products"
        headline="Gastrosafe (+24%), Hoof Health (+54%), Immunomodulator (+40%) and bulk Airplus 5L are growing."
        soWhat={`Feed the lines that are already growing. Inside Airplus, the 5 litre rose ${signedPct(fiveLitre.yoy, 0)} while the 960ml fell ${pct(Math.abs(bottle.yoy), 0)}.`}
      >
        <Tile title="Year-on-year change in line revenue by product family" note="Families with more than £1,000 of line revenue. The change is Year 2 versus Year 1.">
          <GrowthChart rows={growth} />
        </Tile>
        <div className="sku-row">
          <article>
            <div className="name">Airplus 5L · {fiveLitre.sku}</div>
            <div className="meta">{gbpCompact(fiveLitre.y1)} in Year 1 → {gbpCompact(fiveLitre.y2)} in Year 2</div>
            <div className="delta good">{signedPct(fiveLitre.yoy)} line revenue</div>
          </article>
          <article>
            <div className="name">Airplus 960ml · {bottle.sku}</div>
            <div className="meta">{gbpCompact(bottle.y1)} in Year 1 → {gbpCompact(bottle.y2)} in Year 2</div>
            <div className="delta bad">{signedPct(bottle.yoy)} line revenue</div>
          </article>
        </div>
      </Section>

      <Section
        id="reorder"
        index="07"
        kicker="Reorder"
        headline={`Five products make up ${pct(leaderRevenue / lineRevenue, 0)} of revenue. Send the next reminder before the product runs out.`}
        soWhat={`${leaders.map((row) => row.product).join(", ")} bring in ${gbpCompact(leaderRevenue)} of ${gbpCompact(lineRevenue)}. The other ${rest.length} products share ${gbpCompact(lineRevenue - leaderRevenue)}, and ${fewBuyers} of them have fewer than 30 buyers.`}
      >
        <ReorderTable
          rows={reorderProducts}
          selected={openProduct}
          onSelect={(name) => setOpenProduct((current) => (current === name ? null : name))}
        />
        <p className="source">Calculated from the completed-order CSV. Click a column heading to sort. Click a row to open that product. Airplus is split into the 960ml bottle and the 5L. Gastrosafe refill is separate from the tub.</p>
        {selectedProduct ? (
          <ProductBreakdown
            row={selectedProduct}
            onClose={() => setOpenProduct(null)}
            onOpen={setOpenProduct}
          />
        ) : null}
        <div className="mail-facts reorder-actions">
          <article>
            <div className="name">Remind them before they run out</div>
            <div className="meta">Time the reminder to days per unit, minus 5 days: {reminders.map((row) => `${row.label} on day ${row.day}`).join("; ")}.</div>
          </article>
          <article>
            <div className="name">{leaders.length} products, {pct(leaderRevenue / lineRevenue, 0)} of revenue</div>
            <div className="meta">{leaders.map((row) => row.product).join(", ")} bring in {gbpCompact(leaderRevenue)}. The other {rest.length} products share {gbpCompact(lineRevenue - leaderRevenue)}, and {fewBuyers} of those have fewer than 30 buyers.</div>
          </article>
          <article>
            <div className="name">Loyal lines with little exposure</div>
            <div className="meta">Linseed Oil reorders at {pct(linseed.reorderRate, 0)} and MSM Optimal-C at {pct(msm.reorderRate, 0)}, with {oneDecimal(msm.ordersPerBuyer)} orders per buyer. Together they are {gbpCompact(linseed.revenue + msm.revenue)} of revenue.</div>
          </article>
          <article>
            <div className="name">{smallWeak.length} small products to bundle or promote</div>
            <div className="meta">Under £1,000 of revenue, with a reorder rate under 30% or too few buyers to measure one: {smallWeak.map((row) => row.product).join(", ")}.</div>
          </article>
        </div>
      </Section>

      <Section
        id="email"
        index="08"
        kicker="Email"
        headline={`The list barely grows: ${integer(mail.importBatch)} addresses were loaded in one minute, and about ${Math.round(mail.perMonth)} people a month have joined since.`}
        soWhat={`Opens are ${pct(mail.openRate, 0)} of sends, but Apple Mail can record an open without anyone reading it. Clicks are the clearer signal at ${pct(mail.clickRate, 1)} of sends. ${pct(mail.usShare, 0)} of the list is tagged in the United States, and every completed order is billed to the UK or the Channel Islands.`}
      >
        <div className="mail-facts">
          <article>
            <div className="name">{integer(mail.subscribers)} subscribers</div>
            <div className="meta">{integer(mail.september2023)} joined in Sep 2023. {integer(mail.importBatch)} of them share one timestamp, 13 Sep 2023 at 11:05.</div>
          </article>
          <article>
            <div className="name">{Math.round(mail.perMonth)} signups a month</div>
            <div className="meta">Average from Oct 2023 through Sep 2026, against {integer(mail.customers)} buyers in the order file.</div>
          </article>
          <article>
            <div className="name">{pct(mail.openRate, 0)} of sends opened</div>
            <div className="meta">{integer(mail.opens)} opens from {integer(mail.sent)} sends. {pct(mail.neverOpenedShare, 0)} of subscribers have never opened anything, after about {Math.round(mail.neverOpenedSent)} sends each.</div>
          </article>
          <article>
            <div className="name">{pct(mail.clickRate, 1)} of sends clicked</div>
            <div className="meta">{integer(mail.clicks)} clicks. {pct(mail.neverClickedShare, 0)} of subscribers have never clicked.</div>
          </article>
        </div>
        <div className="mail-facts quiet">
          {mail.quietMonths.map((row) => (
            <article key={row.month} className={row.count < 20 ? "low" : undefined}>
              <div className="name">{integer(row.count)}</div>
              <div className="meta">{row.label} signups</div>
            </article>
          ))}
        </div>
        <p className="source">
          {mail.quietMonths[0].label} dropped to {integer(mail.quietMonths[0].count)}, then {mail.quietMonths[1].label} and {mail.quietMonths[2].label} recovered to {integer(mail.quietMonths[1].count)} and {integer(mail.quietMonths[2].count)}. {mail.quietMonths[3].label} and {mail.quietMonths[4].label} fell again, to {integer(mail.quietMonths[3].count)} and {integer(mail.quietMonths[4].count)}. {integer(mail.usSubscribers)} subscribers are tagged United States. Subscriber value, checkout signups, and a reactivation list need an email on the order, and this order file only has a customer ID.
        </p>
      </Section>

      <section className="takeaways" id="takeaways">
        <h2>Key takeaways</h2>
        <ol>
          <li>
            <strong>Orders fell with revenue.</strong>
            Net revenue is down {Math.abs(Math.round(kpis.revenueChange * 100))}% and orders are down {Math.abs(Math.round(kpis.ordersChange * 100))}%. The file starts in September 2024, so a new-versus-returning split is not reliable.
            </li>
            <li>
            <strong>Cut blanket discounting.</strong>
            Spend doubled to {gbpCompact(discount.spendY2)} and half of orders are now discounted, without creating more repeat buyers.
            </li>
            <li>
            <strong>Drive retention and cross-sell around the 42-day reorder window.</strong>
            {Math.round(retention.onceShare * 100)}% buy once, and only {(crossSell.multiShare * 100).toFixed(1)}% of orders contain a second product.
            </li>
        </ol>
      </section>

      <footer className="foot">
        <p>
          {gbp(totals.revenue, 0)} net revenue · {integer(totals.orders)} orders · {integer(totals.customers)} customers.
          Orders are the sum of order count. Order revenue is the sum of net order revenue × order count. Product revenue is the sum of line revenue.
        </p>
        <p>
          Names come from the SKU lookup. {integer(totals.refunds)} refunded orders in the refunds file are excluded from these completed-order figures.
        </p>
      </footer>
    </>
  );
}
