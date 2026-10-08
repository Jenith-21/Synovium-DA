const CAL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FAMILY_KEEP = ["Airplus", "Gastrosafe", "Agility", "Motion-JMT", "Calmingard"];
const BANDS = ["0%", "0–5%", "5–10%", "10–15%", ">15%"];

function num(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value) {
  const [datePart, timePart = "00:00"] = String(value).trim().split(/\s+/);
  const [dd, mm, yyyy] = datePart.split("/").map(Number);
  const [hh, mi] = timePart.split(":").map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1, hh || 0, mi || 0);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calendarDays(from, to) {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86400000);
}

function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function productKey(line) {
  if (line.sku === "SAL940") return "Airplus 960ml";
  if (line.sku === "SAL5000") return "Airplus 5L";
  if (line.sku === "SGSREFILL") return "Gastrosafe Refill";
  if (!line.family && !line.sku) return null;
  return line.family || line.sku;
}

function buyerTiming(person, asOf) {
  const daysSince = (asOf - person.last) / 86400000;
  if (person.orders < 2) return { avgDays: null, daysSince, overdue: null, status: "One order" };
  const avgDays = (person.last - person.first) / 86400000 / (person.orders - 1);
  const overdue = daysSince - avgDays;
  const ratio = avgDays > 0 ? daysSince / avgDays : null;
  if (avgDays <= 0) return { avgDays, daysSince, overdue, ratio, status: daysSince >= 14 ? "Churned" : "On time" };
  let status = "On time";
  if (ratio > 1 && overdue >= 14) {
    if (ratio <= 1.5) status = "Due";
    else if (ratio <= 2.5) status = "At risk";
    else status = "Churned";
  }
  return { avgDays, daysSince, overdue, ratio, status };
}

function yearOfMonth(month) {
  if (month === "2024-09") return "lead";
  if (month >= "2024-10" && month <= "2025-09") return "Y1";
  if (month >= "2025-10" && month <= "2026-09") return "Y2";
  return "other";
}

function locationGroup(value) {
  const place = String(value || "").trim();
  if (!place) return "Unknown";
  if (place === "United Kingdom") return "United Kingdom";
  if (place === "United States") return "United States";
  return "Other";
}

export function buildOverview({ orders, lines, refundRows, mailRows, totalRevenue }) {
  const orderTotal = orders.length;
  const customers = new Set(orders.map((order) => order.customerId)).size;
  const items = orders.reduce((total, order) => total + order.items, 0);
  const discount = orders.reduce((total, order) => total + order.discount, 0);
  const shipping = orders.reduce((total, order) => total + order.shipping, 0);

  const seenRefunds = new Set();
  let refundValue = 0;
  for (const row of refundRows) {
    const id = String(row["Order Number"]).trim();
    if (seenRefunds.has(id)) continue;
    seenRefunds.add(id);
    refundValue += Math.abs(num(row["Order Total Amount"]));
  }

  const yoyMonth = CAL.map((label, index) => {
    const suffix = `-${String(index + 1).padStart(2, "0")}`;
    const sumYear = (year) => orders
      .filter((order) => order.year === year && order.month.endsWith(suffix))
      .reduce((total, order) => total + order.net, 0);
    return { month: label, y1: sumYear("Y1"), y2: sumYear("Y2") };
  });

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour: String(hour),
    orders: orders.filter((order) => order.hour === hour).length,
  }));

  const weekdays = DAYS.map((day) => ({
    day: day.slice(0, 3),
    orders: orders.filter((order) => order.weekday === day).length,
  }));

  const areaMap = new Map();
  const areaProducts = new Map();
  const areaCustomers = new Map();
  const areaCustomerProducts = new Map();
  const people = new Map();
  const personProducts = new Map();
  for (const order of orders) {
    const row = areaMap.get(order.area) || { area: order.area, orders: 0, revenue: 0, customers: new Set() };
    row.orders += 1;
    row.revenue += order.net;
    row.customers.add(order.customerId);
    areaMap.set(order.area, row);
    if (!areaCustomers.has(order.area)) areaCustomers.set(order.area, new Map());
    const buyers = areaCustomers.get(order.area);
    const buyer = buyers.get(order.customerId) || {
      customerId: order.customerId,
      firstName: "",
      lastName: "",
      revenue: 0,
      orders: 0,
      units: 0,
      first: order.date.getTime(),
      last: order.date.getTime(),
    };
    if (order.firstName) buyer.firstName = order.firstName;
    if (order.lastName) buyer.lastName = order.lastName;
    buyer.revenue += order.net;
    buyer.orders += 1;
    buyer.units += order.items;
    if (order.date.getTime() < buyer.first) buyer.first = order.date.getTime();
    if (order.date.getTime() > buyer.last) buyer.last = order.date.getTime();
    buyers.set(order.customerId, buyer);
    const person = people.get(order.customerId) || {
      customerId: order.customerId,
      firstName: "",
      lastName: "",
      revenue: 0,
      orders: 0,
      units: 0,
      first: order.date.getTime(),
      last: order.date.getTime(),
      orderDates: [],
    };
    if (order.firstName) person.firstName = order.firstName;
    if (order.lastName) person.lastName = order.lastName;
    person.revenue += order.net;
    person.orders += 1;
    person.units += order.items;
    if (order.date.getTime() < person.first) person.first = order.date.getTime();
    if (order.date.getTime() > person.last) person.last = order.date.getTime();
    person.orderDates.push(order.date.getTime());
    people.set(order.customerId, person);
  }
  for (const line of lines) {
    const name = productKey(line);
    if (!name || !line.area) continue;
    if (!areaProducts.has(line.area)) areaProducts.set(line.area, new Map());
    const products = areaProducts.get(line.area);
    const product = products.get(name) || { product: name, revenue: 0, units: 0, orders: new Set(), buyers: new Set() };
    product.revenue += line.lineRevenue || 0;
    product.units += line.quantity;
    product.orders.add(line.orderId);
    product.buyers.add(line.customerId);
    products.set(name, product);
    const pair = `${line.area}\0${line.customerId}`;
    if (!areaCustomerProducts.has(pair)) areaCustomerProducts.set(pair, new Map());
    const owned = areaCustomerProducts.get(pair);
    const ownedProduct = owned.get(name) || { product: name, revenue: 0, units: 0, orders: new Set() };
    ownedProduct.revenue += line.lineRevenue || 0;
    ownedProduct.units += line.quantity;
    ownedProduct.orders.add(line.orderId);
    owned.set(name, ownedProduct);
    if (!personProducts.has(line.customerId)) personProducts.set(line.customerId, new Map());
    const personOwned = personProducts.get(line.customerId);
    const personProduct = personOwned.get(name) || { product: name, revenue: 0, units: 0, orders: new Set() };
    personProduct.revenue += line.lineRevenue || 0;
    personProduct.units += line.quantity;
    personProduct.orders.add(line.orderId);
    personOwned.set(name, personProduct);
  }
  const areas = [...areaMap.values()].map((row) => {
    const products = [...(areaProducts.get(row.area)?.values() || [])]
      .map((product) => ({
        product: product.product,
        revenue: product.revenue,
        units: product.units,
        orders: product.orders.size,
        buyers: product.buyers.size,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
    const buyers = [...(areaCustomers.get(row.area)?.values() || [])]
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
      .map((buyer) => {
        const owned = [...(areaCustomerProducts.get(`${row.area}\0${buyer.customerId}`)?.values() || [])]
          .map((product) => ({
            product: product.product,
            revenue: product.revenue,
            units: product.units,
            orders: product.orders.size,
          }))
          .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
        const line = owned.reduce((total, product) => total + product.revenue, 0);
        return {
          customerId: buyer.customerId,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          revenue: buyer.revenue,
          orders: buyer.orders,
          units: buyer.units,
          first: buyer.first,
          last: buyer.last,
          products: owned.map((product) => ({
            ...product,
            share: line ? product.revenue / line : 0,
          })),
        };
      });
    return {
      area: row.area,
      orders: row.orders,
      customers: row.customers.size,
      revenue: row.revenue,
      share: totalRevenue ? row.revenue / totalRevenue : 0,
      aov: row.orders ? row.revenue / row.orders : 0,
      revenuePerCustomer: row.customers.size ? row.revenue / row.customers.size : 0,
      products,
      buyers,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const ukOrders = orders.filter((order) => order.country === "GB").length;

  const skuMap = new Map();
  for (const line of lines) {
    if (!line.sku || line.lineRevenue == null) continue;
    const row = skuMap.get(line.sku) || { sku: line.sku, name: line.productName, family: line.family || "Other", revenue: 0, units: 0 };
    row.revenue += line.lineRevenue;
    row.units += line.quantity;
    if (line.productName) row.name = line.productName;
    if (line.family) row.family = line.family;
    skuMap.set(line.sku, row);
  }
  const skus = [...skuMap.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
  const familyRevenue = new Map();
  for (const row of skus) familyRevenue.set(row.family, (familyRevenue.get(row.family) || 0) + row.revenue);
  const skuGroups = [...familyRevenue.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  const asOf = orders.reduce((latest, order) => (order.date > latest ? order.date : latest), orders[0].date).getTime();
  const customerList = [...people.values()].map((person) => {
    const owned = [...(personProducts.get(person.customerId)?.values() || [])]
      .map((product) => ({
        product: product.product,
        revenue: product.revenue,
        units: product.units,
        orders: product.orders.size,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
    const line = owned.reduce((total, product) => total + product.revenue, 0);
    return {
      ...person,
      orderDates: [...person.orderDates].sort((a, b) => b - a),
      ...buyerTiming(person, asOf),
      products: owned.map((product) => ({
        ...product,
        share: line ? product.revenue / line : 0,
      })),
    };
  }).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);

  const months = [...new Set(lines.map((line) => line.month))].sort();
  const familyMonthly = months.map((month) => {
    const point = { month };
    let other = 0;
    for (const line of lines) {
      if (line.month !== month || line.lineRevenue == null) continue;
      if (FAMILY_KEEP.includes(line.family)) point[line.family] = (point[line.family] || 0) + line.lineRevenue;
      else other += line.lineRevenue;
    }
    for (const family of FAMILY_KEEP) if (!point[family]) point[family] = 0;
    point.Other = other;
    return point;
  });

  const itemCounts = new Map();
  for (const order of orders) {
    const bucket = order.items >= 5 ? "5+" : String(order.items || 0);
    itemCounts.set(bucket, (itemCounts.get(bucket) || 0) + 1);
  }
  const itemsDist = ["1", "2", "3", "4", "5+"].map((bucket) => ({
    bucket,
    orders: itemCounts.get(bucket) || 0,
    share: orderTotal ? (itemCounts.get(bucket) || 0) / orderTotal : 0,
  }));

  const bandRows = BANDS.map((band) => {
    const rows = orders.filter((order) => order.band === band);
    const revenue = rows.reduce((total, order) => total + order.net, 0);
    return { band, orders: rows.length, aov: rows.length ? revenue / rows.length : 0 };
  });

  const familyDiscount = new Map();
  for (const line of lines) {
    if (!line.family || line.lineRevenue == null) continue;
    const row = familyDiscount.get(line.family) || { family: line.family, discount: 0, revenue: 0 };
    row.discount += line.lineDiscount;
    row.revenue += line.lineRevenue;
    familyDiscount.set(line.family, row);
  }
  const discountByFamily = [...familyDiscount.values()]
    .filter((row) => row.revenue >= 1000)
    .map((row) => ({
      ...row,
      rate: row.revenue + row.discount > 0 ? row.discount / (row.revenue + row.discount) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  const payMap = new Map();
  for (const order of orders) {
    const row = payMap.get(order.payment) || { method: order.payment, orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += order.net;
    payMap.set(order.payment, row);
  }
  const payments = [...payMap.values()]
    .map((row) => ({
      ...row,
      share: orderTotal ? row.orders / orderTotal : 0,
      aov: row.orders ? row.revenue / row.orders : 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  const feeMap = new Map();
  for (const order of orders) {
    const key = order.shipping.toFixed(2);
    feeMap.set(key, (feeMap.get(key) || 0) + 1);
  }
  const feeRows = [...feeMap.entries()].sort((a, b) => b[1] - a[1]);
  const shippingFees = [];
  let otherFees = 0;
  for (const [fee, count] of feeRows) {
    if (count >= 40) {
      shippingFees.push({ fee: Number(fee) === 0 ? "Free" : `£${fee}`, orders: count });
    } else otherFees += count;
  }
  if (otherFees) shippingFees.push({ fee: "Other", orders: otherFees });

  const free = orders.filter((order) => order.shipping === 0);
  const paid = orders.filter((order) => order.shipping > 0);
  const meanNet = (rows) => (rows.length ? rows.reduce((total, order) => total + order.net, 0) / rows.length : 0);

  const signupMap = new Map();
  for (const row of mailRows) {
    const key = monthKey(parseDate(row.Subscribed));
    signupMap.set(key, (signupMap.get(key) || 0) + 1);
  }
  const signups = [...signupMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
  const signupTrend = signups.filter((row) => row.month !== "2023-09");
  const signupCount = new Map(signups.map((row) => [row.month, row.count]));
  const stamps = new Map();
  let sent = 0;
  let opens = 0;
  let clicks = 0;
  let neverClicked = 0;
  let neverOpened = 0;
  let neverOpenedSent = 0;
  let usSubscribers = 0;
  for (const row of mailRows) {
    const subscribed = parseDate(row.Subscribed);
    const sentCount = num(row.Sent);
    const openCount = num(row.Opens);
    const clickCount = num(row.Clicks);
    sent += sentCount;
    opens += openCount;
    clicks += clickCount;
    if (clickCount <= 0) neverClicked += 1;
    if (openCount <= 0) {
      neverOpened += 1;
      neverOpenedSent += sentCount;
    }
    if (String(row.Location || "").trim() === "United States") usSubscribers += 1;
    if (monthKey(subscribed) === "2023-09") {
      const stamp = subscribed.getTime();
      stamps.set(stamp, (stamps.get(stamp) || 0) + 1);
    }
  }
  let importBatch = 0;
  for (const count of stamps.values()) if (count > importBatch) importBatch = count;
  const fullMonths = signups.filter((row) => row.month > "2023-09" && row.month < signups[signups.length - 1]?.month);
  const perMonth = fullMonths.length
    ? fullMonths.reduce((total, row) => total + row.count, 0) / fullMonths.length
    : 0;
  const quietMonths = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((month) => ({
    month,
    label: `${CAL[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`,
    count: signupCount.get(month) || 0,
  }));
  const billedAbroad = orders.filter((order) => !["GB", "JE", "GG"].includes(order.country)).length;
  const latest = orders.reduce((max, order) => (order.date > max ? order.date : max), orders[0].date);
  const productOrders = new Map();
  const productGroups = new Map();
  for (const line of lines) {
    const name = productKey(line);
    if (!name) continue;
    if (!productOrders.has(name)) productOrders.set(name, new Map());
    if (line.family) productGroups.set(name, line.family);
    else if (!productGroups.has(name)) productGroups.set(name, name);
    const bucket = productOrders.get(name);
    const slot = bucket.get(line.orderId) || {
      date: line.date,
      qty: 0,
      revenue: 0,
      customerId: line.customerId,
      month: line.month,
      year: line.year,
    };
    slot.qty += line.quantity;
    slot.revenue += line.lineRevenue || 0;
    slot.date = line.date;
    bucket.set(line.orderId, slot);
  }
  const reorderProducts = [...productOrders.entries()].map(([product, orderMap]) => {
    const byCustomer = new Map();
    const monthMap = new Map();
    let revenue = 0;
    let units = 0;
    let y1 = 0;
    let y2 = 0;
    for (const order of orderMap.values()) {
      revenue += order.revenue;
      units += order.qty;
      if (order.year === "Y1") y1 += order.revenue;
      if (order.year === "Y2") y2 += order.revenue;
      const point = monthMap.get(order.month) || { revenue: 0, units: 0, orders: 0 };
      point.revenue += order.revenue;
      point.units += order.qty;
      point.orders += 1;
      monthMap.set(order.month, point);
      if (!byCustomer.has(order.customerId)) byCustomer.set(order.customerId, []);
      byCustomer.get(order.customerId).push(order);
    }
    const gaps = [];
    const daysPerUnit = [];
    let eligible = 0;
    let reordered = 0;
    for (const purchases of byCustomer.values()) {
      purchases.sort((a, b) => a.date - b.date);
      const first = purchases[0].date;
      if (calendarDays(first, latest) >= 120) {
        eligible += 1;
        if (purchases.length >= 2) reordered += 1;
      }
      for (let index = 1; index < purchases.length; index += 1) {
        const elapsed = (purchases[index].date - purchases[index - 1].date) / 86400000;
        if (elapsed < 1) continue;
        gaps.push(elapsed);
        const quantity = purchases[index - 1].qty || 1;
        daysPerUnit.push(elapsed / quantity);
      }
    }
    const buyers = byCustomer.size;
    const orderCount = orderMap.size;
    return {
      product,
      group: productGroups.get(product) || product,
      buyers,
      orders: orderCount,
      revenue,
      units,
      y1,
      y2,
      yoy: y1 > 0 ? y2 / y1 - 1 : null,
      reorderRate: buyers >= 5 && eligible ? reordered / eligible : null,
      ordersPerBuyer: buyers ? orderCount / buyers : 0,
      revenuePerBuyer: buyers ? revenue / buyers : 0,
      unitsPerOrder: orderCount ? units / orderCount : 0,
      medianDays: quantile(gaps, 0.5),
      daysPerUnit: quantile(daysPerUnit, 0.5),
      monthly: months.map((month) => {
        const point = monthMap.get(month) || { revenue: 0, units: 0, orders: 0 };
        return { month, year: yearOfMonth(month), ...point };
      }),
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const ordersById = new Map();
  for (const [product, orderMap] of productOrders) {
    for (const [orderId, slot] of orderMap) {
      if (!ordersById.has(orderId)) ordersById.set(orderId, []);
      ordersById.get(orderId).push({ product, customerId: slot.customerId, qty: slot.qty, revenue: slot.revenue });
    }
  }
  const pairMap = new Map();
  const multiOrders = new Map();
  for (const items of ordersById.values()) {
    if (items.length < 2) continue;
    for (const item of items) {
      multiOrders.set(item.product, (multiOrders.get(item.product) || 0) + 1);
      if (!pairMap.has(item.product)) pairMap.set(item.product, new Map());
      const companions = pairMap.get(item.product);
      for (const other of items) {
        if (other.product === item.product) continue;
        const pair = companions.get(other.product) || { product: other.product, orders: 0, buyers: new Set(), units: 0, revenue: 0 };
        pair.orders += 1;
        pair.buyers.add(other.customerId);
        pair.units += other.qty;
        pair.revenue += other.revenue;
        companions.set(other.product, pair);
      }
    }
  }
  const productRevenue = reorderProducts.reduce((total, row) => total + row.revenue, 0);
  for (const row of reorderProducts) {
    row.share = productRevenue ? row.revenue / productRevenue : 0;
    row.withAnother = multiOrders.get(row.product) || 0;
    const companions = pairMap.get(row.product);
    row.boughtTogether = companions
      ? [...companions.values()]
        .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue || a.product.localeCompare(b.product))
        .slice(0, 3)
        .map((item) => ({
          product: item.product,
          orders: item.orders,
          buyers: item.buyers.size,
          units: item.units,
          revenue: item.revenue,
          share: row.orders ? item.orders / row.orders : 0,
        }))
      : [];
  }
  const locationMap = new Map();
  for (const row of mailRows) {
    const group = locationGroup(row.Location);
    locationMap.set(group, (locationMap.get(group) || 0) + 1);
  }
  const locationOrder = ["United Kingdom", "United States", "Other", "Unknown"];
  const locations = locationOrder
    .filter((name) => locationMap.has(name))
    .map((name) => ({ name, count: locationMap.get(name) }));
  const funnel = [
    { stage: "Sent", count: mailRows.filter((row) => num(row.Sent) > 0).length },
    { stage: "Opened", count: mailRows.filter((row) => num(row.Opens) > 0).length },
    { stage: "Clicked", count: mailRows.filter((row) => num(row.Clicks) > 0).length },
  ];

  return {
    revenue: totalRevenue,
    orders: orderTotal,
    customers,
    aov: orderTotal ? totalRevenue / orderTotal : 0,
    itemsPerOrder: orderTotal ? items / orderTotal : 0,
    discount,
    shipping,
    refundValue,
    refundOrders: seenRefunds.size,
    refundPct: totalRevenue ? refundValue / totalRevenue : 0,
    yoyMonth,
    hours,
    weekdays,
    areas,
    areaCount: areas.length,
    maxAreaShare: areas[0]?.share || 0,
    ukShare: orderTotal ? ukOrders / orderTotal : 0,
    ukOrders,
    skus,
    skuGroups,
    customerList,
    asOf,
    familyMonthly,
    familyKeys: [...FAMILY_KEEP, "Other"],
    itemsDist,
    oneItemShare: itemsDist[0]?.share || 0,
    bands: bandRows,
    discountByFamily,
    payments,
    shippingFees,
    freeShare: orderTotal ? free.length / orderTotal : 0,
    freeAov: meanNet(free),
    paidAov: meanNet(paid),
    signups,
    signupTrend,
    locations,
    funnel,
    subscribers: mailRows.length,
    mail: {
      subscribers: mailRows.length,
      customers,
      september2023: signupCount.get("2023-09") || 0,
      importBatch,
      perMonth,
      sent,
      opens,
      clicks,
      openRate: sent ? opens / sent : 0,
      clickRate: sent ? clicks / sent : 0,
      neverClicked,
      neverClickedShare: mailRows.length ? neverClicked / mailRows.length : 0,
      neverOpened,
      neverOpenedShare: mailRows.length ? neverOpened / mailRows.length : 0,
      neverOpenedSent: neverOpened ? neverOpenedSent / neverOpened : 0,
      usSubscribers,
      usShare: mailRows.length ? usSubscribers / mailRows.length : 0,
      quietMonths,
      billedAbroad,
    },
    reorderProducts,
  };
}
