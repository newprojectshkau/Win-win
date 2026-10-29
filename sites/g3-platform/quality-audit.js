export const DATA_AUDIT = Object.freeze({
  "dataHash": "f1481b29a2420cc173168c051d9f30a54cf739c657632f5c02d11a957dd76808",
  "minutePairs": 11700,
  "minuteCloseWithin1Cent": 10578,
  "minuteMaxCloseDiffPct": 0.08092611168334289,
  "dailyVolumeMedianDiffPct": 18.597886304530796,
  "yahooDailyPairs": 90,
  "nasdaqDailyPairs": 30,
  "intradayWarning": "分鐘開市價差異最大 0.84277%（141 筆超過 0.1%）；最高價最大 0.54907%、最低價最大 0.39935%。不能只憑 close 相近就確認全部 OHLC 可靠；這些異常仍需逐筆釐清。",
  "scope": "2026-10-30 核對：NVDA、TSLA、AMD；日線 9/17–10/28，分鐘線 10/15–10/28",
  "limitations": "Massive 官方日線與 Nasdaq 30 組收市價完全一致，成交量最大差 0.00003614%；Yahoo 90 組官方日線收市價最大差 US$0.0000293、成交量最大差 0.613%。本次未獨立驗證歷史市值公布時點、全年資料及實際成交。",
  "sensitivity": "價格敏感度：只把測試期分鐘 OHLC 改用 Yahoo（市值、成交量及早段回看資料仍用 Massive），20 個時段中 3 個開關改變；成交由 134 至 146 筆，淨額由 −US$151.85 至 −US$190.27。這不是另一個完整獨立回測，而是訊號穩定性警示。"
});
