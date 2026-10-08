import { buildOverview } from "./overview.js";

/**
 * Synovium order metrics.
 *
 * One CSV row is a product line. Order-level fields repeat on every line.
 * Orders  = sum of Order Count.
 * Order £ = sum of Net Order Revenue × Order Count.
 * Product £ = sum of Line Revenue.
 * Year 1 = Oct 2024–Sep 2025. Year 2 = Oct 2025–Sep 2026.
 * Sep 2024 is a lead-in month: shown on trends, excluded from year-on-year.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value) {
  const [datePart, timePart = "00:00"] = String(value).trim().split(/\s+/);
  const [dd, mm, yyyy] = datePart.split("/").map(Number);
  const [hh, mi] = timePart.split(":").map(Number);
  return new Date(yyyy, mm - 1, dd, hh || 0, mi || 0);
}

export function yearOf(month) {
  if (month === "2024-09") return "lead";
  if (month >= "2024-10" && month <= "2025-09") return "Y1";
  if (month >= "2025-10" && month <= "2026-09") return "Y2";
  return "other";
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

function paymentGroup(method) {
  const low = String(method || "").trim().toLowerCase();
  if (low.includes("apple pay")) return "Apple Pay";
  if (low.includes("google pay")) return "Google Pay";
  if (low === "paypal" || low.startsWith("paypal")) return "PayPal";
  if (low.includes("klarna")) return "Klarna";
  if (low.startsWith("link")) return "Link";
  if (
    low.includes("ending in")
    || low.includes("card")
    || low.includes("visa")
    || low.includes("mastercard")
    || low.includes("amex")
    || low.includes("american express")
    || low === "stripe"
    || low === "cards"
  ) return "Card";
  return "Other";
}

function discountBand(pct) {
  if (pct <= 0) return "0%";
  if (pct <= 0.05) return "0–5%";
  if (pct <= 0.1) return "5–10%";
  if (pct <= 0.15) return "10–15%";
  return ">15%";
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

const BANDS = ["0%", "0–5%", "5–10%", "10–15%", ">15%"];

export function buildModel(cleanRows, skuRows, refundRows, mailRows = []) {
  const skuName = new Map(
    skuRows.map((row) => [String(row.SKU || "").trim(), String(row["Product Name"] || "").trim()]),
  );

  const lines = cleanRows.map((row) => {
    const month = String(row.Month || "").trim();
    const orderId = String(row["Order Number"]).trim();
    const customerId = String(row["Customer ID"]).trim();
    const orderCount = num(row["Order Count"]);
    return {
      orderId,
      customerId,
      firstName: String(row["First Name"] || "").trim(),
      lastName: String(row["Last Name"] || "").trim(),
      month,
      year: yearOf(month),
      date: parseDate(row["Order Date"]),
      orderCount,
      net: num(row["Net Order Revenue"]),
      discount: num(row["Cart Discount Amount"]),
      subtotal: num(row["Order Subtotal Amount"]),
      lineRevenue: row["Line Revenue"] === "" || row["Line Revenue"] == null ? null : num(row["Line Revenue"]),
      family: row["Product Family"] ? String(row["Product Family"]).trim() : "",
      sku: row.SKU ? String(row.SKU).trim() : "",
      productName: row["Product Name"] ? String(row["Product Name"]).trim() : "",
      quantity: num(row.Quantity),
      shipping: num(row["Order Shipping Amount"]),
      payment: paymentGroup(row["Payment Method"]),
      area: String(row["Postcode Area"] || "").trim() || "—",
      country: String(row.Country || "").trim(),
      weekday: String(row.Weekday || "").trim(),
      hour: parseDate(row["Order Date"]).getHours(),
      lineDiscount: num(row["Discount Amount"]),
    };
  });

  const orders = lines.filter((line) => line.orderCount > 0);
  orders.sort((a, b) => a.date - b.date || a.orderId.localeCompare(b.orderId, undefined, { numeric: true }));

  const firstOrderId = new Map();
  for (const order of orders) {
    if (!firstOrderId.has(order.customerId)) firstOrderId.set(order.customerId, order.orderId);
  }
  for (const order of orders) {
    order.isNew = firstOrderId.get(order.customerId) === order.orderId;
    order.discountPct = order.subtotal > 0 ? order.discount / order.subtotal : 0;
    order.band = discountBand(order.discountPct);
    order.discounted = order.discount > 0;
  }

  const skusByOrder = new Map();
  const linesByOrder = new Map();
  for (const line of lines) {
    if (!linesByOrder.has(line.orderId)) linesByOrder.set(line.orderId, []);
    linesByOrder.get(line.orderId).push(line);
    if (!line.sku) continue;
    if (!skusByOrder.has(line.orderId)) skusByOrder.set(line.orderId, new Set());
    skusByOrder.get(line.orderId).add(line.sku);
  }
  for (const order of orders) {
    order.skuCount = skusByOrder.get(order.orderId)?.size || 0;
    order.multi = order.skuCount > 1;
    order.items = (linesByOrder.get(order.orderId) || []).reduce((total, line) => total + line.quantity, 0);
  }

  const net = (rows) => sum(rows, (row) => row.net * row.orderCount);
  const orderCount = (rows) => sum(rows, (row) => row.orderCount);
  const inYear = (year) => orders.filter((order) => order.year === year);
  const y1 = inYear("Y1");
  const y2 = inYear("Y2");

  function periodKpis(rows) {
    const revenue = net(rows);
    const count = orderCount(rows);
    const customers = new Set(rows.map((row) => row.customerId));
    const frequency = new Map();
    for (const row of rows) frequency.set(row.customerId, (frequency.get(row.customerId) || 0) + row.orderCount);
    let repeatCustomers = 0;
    for (const value of frequency.values()) if (value >= 2) repeatCustomers += 1;
    const newCustomers = new Set(rows.filter((row) => row.isNew).map((row) => row.customerId)).size;
    return {
      revenue,
      orders: count,
      aov: count ? revenue / count : 0,
      newCustomers,
      repeatRate: customers.size ? repeatCustomers / customers.size : 0,
      customers: customers.size,
      repeatCustomers,
    };
  }

  const k1 = periodKpis(y1);
  const k2 = periodKpis(y2);

  const months = [...new Set(orders.map((order) => order.month))].sort();
  const monthly = months.map((month) => {
    const rows = orders.filter((order) => order.month === month);
    const newRows = rows.filter((order) => order.isNew);
    const retRows = rows.filter((order) => !order.isNew);
    const discounted = rows.filter((order) => order.discounted);
    return {
      month,
      label: monthLabel(month),
      year: yearOf(month),
      revenue: net(rows),
      orders: orderCount(rows),
      newRevenue: net(newRows),
      returningRevenue: net(retRows),
      discount: sum(rows, (row) => row.discount * row.orderCount),
      discountedShare: rows.length ? discounted.length / rows.length : 0,
    };
  });

  const segment = (rows, predicate) => {
    const picked = rows.filter(predicate);
    return { revenue: net(picked), customers: new Set(picked.map((row) => row.customerId)).size };
  };
  const newY1 = segment(y1, (row) => row.isNew);
  const newY2 = segment(y2, (row) => row.isNew);
  const retY1 = segment(y1, (row) => !row.isNew);
  const retY2 = segment(y2, (row) => !row.isNew);

  function bandsFor(rows) {
    return BANDS.map((band) => {
      const picked = rows.filter((row) => row.band === band);
      const count = orderCount(picked);
      return {
        band,
        orders: count,
        aov: count ? net(picked) / count : 0,
        revenue: net(picked),
      };
    });
  }

  const lifetimeCount = new Map();
  for (const order of orders) {
    lifetimeCount.set(order.customerId, (lifetimeCount.get(order.customerId) || 0) + order.orderCount);
  }
  const firstOrders = orders.filter((order) => order.isNew);
  const discountedFirst = firstOrders.filter((order) => order.discounted);
  const fullPriceFirst = firstOrders.filter((order) => !order.discounted);
  const repeatRateOf = (group) =>
    group.length ? group.filter((order) => lifetimeCount.get(order.customerId) >= 2).length / group.length : 0;

  const familyRevenue = new Map();
  for (const line of lines) {
    if (!line.family || line.lineRevenue == null) continue;
    familyRevenue.set(line.family, (familyRevenue.get(line.family) || 0) + line.lineRevenue);
  }
  const familyYear = new Map();
  for (const line of lines) {
    if (!line.family || line.lineRevenue == null) continue;
    if (line.year !== "Y1" && line.year !== "Y2") continue;
    if (!familyYear.has(line.family)) familyYear.set(line.family, { y1: 0, y2: 0 });
    familyYear.get(line.family)[line.year === "Y1" ? "y1" : "y2"] += line.lineRevenue;
  }
  const comparableFamilyTotal = [...familyYear.values()].reduce((total, row) => total + row.y1 + row.y2, 0);
  const allFamilyTotal = [...familyRevenue.values()].reduce((total, value) => total + value, 0);

  const share = [...familyRevenue.entries()]
    .map(([family, revenue]) => ({
      family,
      revenue,
      share: allFamilyTotal ? revenue / allFamilyTotal : 0,
      comparableShare: familyYear.has(family) && comparableFamilyTotal
        ? (familyYear.get(family).y1 + familyYear.get(family).y2) / comparableFamilyTotal
        : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const airplusComparable = share.find((row) => row.family === "Airplus")?.comparableShare || 0;

  const firstIds = new Set(firstOrders.map((order) => order.orderId));
  const firstWithAirplus = new Set();
  for (const line of lines) {
    if (firstIds.has(line.orderId) && line.family === "Airplus") firstWithAirplus.add(line.orderId);
  }

  const familyByMonth = {};
  for (const row of share) {
    familyByMonth[row.family] = Array.from({ length: 12 }, (_, index) => ({
      month: MONTHS[index],
      monthIndex: index + 1,
      revenue: 0,
      weak: index >= 9,
    }));
  }
  for (const line of lines) {
    if (!line.family || line.lineRevenue == null || !familyByMonth[line.family]) continue;
    if (line.year !== "Y1" && line.year !== "Y2") continue;
    familyByMonth[line.family][line.date.getMonth()].revenue += line.lineRevenue;
  }
  const airplusByMonth = familyByMonth.Airplus;

  const frequencyBuckets = [
    { bucket: "1", customers: 0 },
    { bucket: "2", customers: 0 },
    { bucket: "3", customers: 0 },
    { bucket: "4", customers: 0 },
    { bucket: "5+", customers: 0 },
  ];
  for (const count of lifetimeCount.values()) {
    const bucket = count >= 5 ? "5+" : String(count);
    frequencyBuckets.find((row) => row.bucket === bucket).customers += 1;
  }
  const customerTotal = lifetimeCount.size;
  const onceCustomers = frequencyBuckets[0].customers;
  const repeatCustomerIds = new Set([...lifetimeCount.entries()].filter(([, count]) => count >= 2).map(([id]) => id));
  const repeatRevenue = net(orders.filter((order) => repeatCustomerIds.has(order.customerId)));
  const totalRevenue = net(orders);

  const byCustomer = new Map();
  for (const order of orders) {
    byCustomer.set(order.customerId, (byCustomer.get(order.customerId) || 0) + order.net * order.orderCount);
  }
  const ranked = [...byCustomer.values()].sort((a, b) => b - a);
  const pareto = [{ pctCustomers: 0, pctRevenue: 0, equality: 0 }];
  let running = 0;
  ranked.forEach((value, index) => {
    running += value;
    const pctCustomers = ((index + 1) / ranked.length) * 100;
    const pctRevenue = (running / totalRevenue) * 100;
    const previous = pareto[pareto.length - 1];
    const keep = index === ranked.length - 1 || index % 29 === 28 || Math.abs(pctCustomers - 10) < 0.05;
    if (keep || pctCustomers - previous.pctCustomers >= 2.4) {
      pareto.push({ pctCustomers, pctRevenue, equality: pctCustomers });
    }
  });
  const topTenIndex = Math.ceil(ranked.length * 0.1) - 1;
  const topTenShare = ranked.slice(0, topTenIndex + 1).reduce((total, value) => total + value, 0) / totalRevenue;

  const gaps = [];
  const byCustomerOrders = new Map();
  for (const order of orders) {
    if (!byCustomerOrders.has(order.customerId)) byCustomerOrders.set(order.customerId, []);
    byCustomerOrders.get(order.customerId).push(order);
  }
  for (const group of byCustomerOrders.values()) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i += 1) {
      gaps.push((group[i].date - group[i - 1].date) / 86400000);
    }
  }

  const singleOrders = orders.filter((order) => !order.multi);
  const multiOrders = orders.filter((order) => order.multi);
  const singleAov = singleOrders.length ? net(singleOrders) / orderCount(singleOrders) : 0;
  const multiAov = multiOrders.length ? net(multiOrders) / orderCount(multiOrders) : 0;

  const primaryFamily = new Map();
  for (const order of firstOrders) {
    const productLines = (linesByOrder.get(order.orderId) || []).filter((line) => line.family && line.lineRevenue != null);
    if (!productLines.length) continue;
    productLines.sort((a, b) => b.lineRevenue - a.lineRevenue);
    primaryFamily.set(order.customerId, productLines[0].family);
  }
  const familyRepeat = new Map();
  for (const [customerId, family] of primaryFamily) {
    if (!familyRepeat.has(family)) familyRepeat.set(family, { family, customers: 0, repeats: 0 });
    const row = familyRepeat.get(family);
    row.customers += 1;
    if (lifetimeCount.get(customerId) >= 2) row.repeats += 1;
  }
  const firstFamilyRepeat = [...familyRepeat.values()]
    .map((row) => ({ ...row, repeatRate: row.customers ? row.repeats / row.customers : 0 }))
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 6);

  const growth = [...familyRevenue.entries()]
    .filter(([, revenue]) => revenue > 1000)
    .map(([family, revenue]) => {
      const years = familyYear.get(family) || { y1: 0, y2: 0 };
      return {
        family,
        revenue,
        y1: years.y1,
        y2: years.y2,
        yoy: years.y1 > 0 ? years.y2 / years.y1 - 1 : null,
      };
    })
    .filter((row) => row.yoy != null)
    .sort((a, b) => b.yoy - a.yoy);

  const skuYear = new Map();
  for (const line of lines) {
    if (!line.sku || line.lineRevenue == null) continue;
    if (line.year !== "Y1" && line.year !== "Y2") continue;
    if (!skuYear.has(line.sku)) skuYear.set(line.sku, { y1: 0, y2: 0, family: line.family, name: line.productName });
    skuYear.get(line.sku)[line.year === "Y1" ? "y1" : "y2"] += line.lineRevenue;
  }
  const airplusSkus = ["SAL5000", "SAL940"].map((sku) => {
    const row = skuYear.get(sku) || { y1: 0, y2: 0, name: "" };
    return {
      sku,
      name: skuName.get(sku) || row.name,
      y1: row.y1,
      y2: row.y2,
      yoy: row.y1 > 0 ? row.y2 / row.y1 - 1 : null,
    };
  });

  const refundOrders = new Set(refundRows.map((row) => String(row["Order Number"]).trim()));

  const familiesByCustomer = new Map();
  for (const line of lines) {
    if (!line.family || line.lineRevenue == null) continue;
    if (!familiesByCustomer.has(line.customerId)) familiesByCustomer.set(line.customerId, new Set());
    familiesByCustomer.get(line.customerId).add(line.family);
  }
  let airplusBuyers = 0;
  let airplusOnly = 0;
  for (const families of familiesByCustomer.values()) {
    if (!families.has("Airplus")) continue;
    airplusBuyers += 1;
    if (families.size === 1) airplusOnly += 1;
  }
  const ordersAbove86 = orders.filter((order) => order.net * order.orderCount >= 86).length;

  return {
    totals: {
      revenue: totalRevenue,
      orders: orderCount(orders),
      customers: customerTotal,
      refunds: refundRows.length,
      refundsAlsoCompleted: [...refundOrders].filter((id) => orders.some((order) => order.orderId === id)).length,
    },
    kpis: {
      y1: k1,
      y2: k2,
      revenueChange: k1.revenue ? k2.revenue / k1.revenue - 1 : 0,
      ordersChange: k1.orders ? k2.orders / k1.orders - 1 : 0,
      aovChange: k1.aov ? k2.aov / k1.aov - 1 : 0,
      newChange: k1.newCustomers ? k2.newCustomers / k1.newCustomers - 1 : 0,
      repeatChange: k2.repeatRate - k1.repeatRate,
    },
    monthly,
    acquisition: {
      newCustomersY1: newY1.customers,
      newCustomersY2: newY2.customers,
      newRevenueY1: newY1.revenue,
      newRevenueY2: newY2.revenue,
      returningRevenueY1: retY1.revenue,
      returningRevenueY2: retY2.revenue,
      returningCustomersY1: retY1.customers,
      returningCustomersY2: retY2.customers,
    },
    discount: {
      spendY1: sum(y1, (row) => row.discount * row.orderCount),
      spendY2: sum(y2, (row) => row.discount * row.orderCount),
      shareY1: y1.length ? y1.filter((row) => row.discounted).length / y1.length : 0,
      shareY2: y2.length ? y2.filter((row) => row.discounted).length / y2.length : 0,
      bandsY1: bandsFor(y1),
      bandsY2: bandsFor(y2),
      repeatFullPrice: repeatRateOf(fullPriceFirst),
      repeatDiscounted: repeatRateOf(discountedFirst),
      fullPriceCustomers: fullPriceFirst.length,
      discountedCustomers: discountedFirst.length,
    },
    range: {
      share,
      airplusComparable,
      airplusAll: share.find((row) => row.family === "Airplus")?.share || 0,
      firstPurchaseAirplus: firstIds.size ? firstWithAirplus.size / firstIds.size : 0,
      airplusByMonth,
      familyByMonth,
    },
    retention: {
      buckets: frequencyBuckets.map((row) => ({
        ...row,
        share: customerTotal ? row.customers / customerTotal : 0,
      })),
      onceShare: customerTotal ? onceCustomers / customerTotal : 0,
      repeatRevenueShare: totalRevenue ? repeatRevenue / totalRevenue : 0,
      pareto,
      topTenShare,
      medianDays: median(gaps),
    },
    crossSell: {
      singleAov,
      multiAov,
      multiShare: orders.length ? multiOrders.length / orders.length : 0,
      singleShare: orders.length ? singleOrders.length / orders.length : 0,
      ratio: singleAov ? multiAov / singleAov : 0,
      firstFamilyRepeat,
    },
    growth,
    airplusSkus,
    gap: {
      airplusBuyers,
      airplusOnly,
      airplusOnlyShare: airplusBuyers ? airplusOnly / airplusBuyers : 0,
      ordersAbove86,
      ordersAbove86Share: orders.length ? ordersAbove86 / orders.length : 0,
    },
    overview: buildOverview({ orders, lines, refundRows, mailRows, totalRevenue }),
  };
}
