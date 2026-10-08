export function gbp(value, digits = 0) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function gbpCompact(value) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const thousands = abs / 1000;
    return `${sign}£${thousands.toFixed(1)}k`;
  }
  return gbp(value, abs >= 100 ? 0 : 2);
}

export function signedPct(value, digits = 1) {
  const points = value * 100;
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toFixed(digits)}%`;
}

export function signedPp(value, digits = 1) {
  const points = value * 100;
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${Math.abs(points).toFixed(digits)} pp`;
}

export function pct(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function integer(value) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}
