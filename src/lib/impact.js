// Turns "how many shares of each kind happened" into the numbers on the impact
// panel. A share counts once a grower has said yes to a neighbor's request.
//
// These are rough averages, not measurements: a listing doesn't record a
// weight or a price, so each share is a typical amount for its category.
// Change the numbers here and every screen follows; nothing in the database
// needs to change.

// Typical weight of produce in one share, and what it would cost in a shop (USD).
// Flowers and seedlings aren't food, so they count toward money but not CO2e.
export const PER_SHARE = {
  vegetables: { kg: 1.5, usd: 5 },
  fruit: { kg: 1.5, usd: 6 },
  greens: { kg: 0.4, usd: 3 },
  herbs: { kg: 0.1, usd: 2.5 },
  flowers: { kg: 0, usd: 6 },
  seedlings: { kg: 0, usd: 4 }
}

// Kilograms of CO2e that growing, shipping and (if it were wasted) rotting one
// kilogram of produce would give off. A cautious everyday figure.
export const CO2E_PER_KG = 1

// counts: { vegetables: 3, fruit: 1, … }  →  { shares, kg, co2e, usd }
export function summarize(counts = {}) {
  let shares = 0
  let kg = 0
  let usd = 0
  for (const [category, n] of Object.entries(counts)) {
    const per = PER_SHARE[category]
    if (!per) continue
    shares += n
    kg += per.kg * n
    usd += per.usd * n
  }
  return { shares, kg, co2e: kg * CO2E_PER_KG, usd }
}

const addCounts = (a = {}, b = {}) => {
  const out = { ...a }
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + n
  return out
}

// What the panel shows for one person: everything they were part of counts
// toward CO2e, and the money saved is the value of what they received.
export function summarizeYou({ given, received }) {
  const both = summarize(addCounts(given, received))
  return {
    given: summarize(given).shares,
    received: summarize(received).shares,
    co2e: both.co2e,
    usd: summarize(received).usd
  }
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const formatKg = (kg) => (kg > 0 && kg < 10 ? `${kg.toFixed(1)} kg` : `${number.format(kg)} kg`)
export const formatUsd = (usd) => `$${number.format(usd)}`
