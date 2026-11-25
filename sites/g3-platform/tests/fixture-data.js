// Offline test fixture only. This file is excluded from the published site.
export function createDemoDataset() {
  const dates = [];
  let day = new Date("2026-10-13T00:00:00Z");
  while (dates.length < 22) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6)
      dates.unshift(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() - 1);
  }
  const instruments = [];
  for (let n = 0; n < 12; n++) {
    const base = 45 + n * 23;
    let previousClose = base;
    const sessions = [];
    for (let d = 0; d < dates.length; d++) {
      const date = dates[d],
        start = Date.parse(date + "T09:30:00-04:00"),
        bars = [];
      let previous = base * (1 + d * 0.0005);
      for (let m = 0; m < 390; m++) {
        let variation =
          0.012 * Math.sin((m + n * 2) / 6) + 0.018 * Math.sin((m + n) / 34);
        if (d === 21 && m < 30)
          variation = m < 20 ? m * 0.003 : (40 - m) * 0.003;
        if (d === 21 && m >= 180 && m < 210)
          variation = 0.01 * Math.sin((m - 180) / 2);
        const close =
          Math.round(base * (1 + d * 0.0005 + variation) * 10000) / 10000;
        bars.push({
          time: new Date(start + m * 60000).toISOString(),
          availableAt: new Date(start + (m + 1) * 60000).toISOString(),
          open: previous,
          high: Math.max(previous, close) + 0.01,
          low: Math.min(previous, close) - 0.01,
          close,
          volume: n === 10 ? 15000 : 35000 + n * 1000,
        });
        previous = close;
      }
      sessions.push({
        date,
        marketCap: n === 11 ? 1500000000 : 5000000000 + n * 1000000000,
        marketCapAvailableAt: new Date(start - 60000).toISOString(),
        previousClose,
        bars,
      });
      previousClose = bars.at(-1).close;
    }
    instruments.push({
      symbol: `DEMO${String(n + 1).padStart(2, "0")}`,
      name: `合成股票 ${n + 1}`,
      sessions,
    });
  }
  return {
    schemaVersion: 1,
    id: "synthetic-22sessions-v1",
    kind: "synthetic",
    description:
      "12 隻虛構股票、22 個合成正常交易日；僅供驗證操作及暫定規則。不是市場回測。",
    providerStatement:
      "程式按固定公式生成；市值、價量及交易日均為示例，並非 IB 或任何行情供應商資料。",
    instruments,
  };
}
