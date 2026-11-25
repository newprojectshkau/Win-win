#!/usr/bin/env python3
"""Fetch read-only IBKR bars for the dates and symbols in a private G3 template."""

import argparse
import asyncio
import json
import math
import os
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
UTC = timezone.utc
MINUTE = timedelta(minutes=1)
ROOT = Path(__file__).resolve().parents[2]


def market_dates(instruments):
    dates = [date.fromisoformat(session["date"]) for session in instruments[0]["sessions"]]
    if len(dates) < 21 or len(dates) > 252 or dates != sorted(set(dates)):
        raise ValueError("Provide 21–252 unique, sorted G3 dates including the 20 warm-up sessions")
    for instrument in instruments:
        if [session["date"] for session in instrument["sessions"]] != [d.isoformat() for d in dates]:
            raise ValueError("Every symbol needs the same dates")
    return dates


def quote(bar):
    values = {key: float(getattr(bar, key)) for key in ("open", "high", "low", "close", "volume")}
    low, high = values["low"], values["high"]
    if not all(map(math.isfinite, values.values())) or low <= 0 or values["volume"] < 0:
        raise ValueError("IBKR returned an invalid OHLCV bar")
    if not all(low <= values[key] <= high for key in ("open", "close")):
        raise ValueError("IBKR returned inconsistent OHLC")
    return values


def convert_sessions(template, minute_bars, daily_bars):
    daily = {bar.date.isoformat(): quote(bar) for bar in daily_bars}
    minutes = {session["date"]: {} for session in template}
    for bar in minute_bars:
        if not isinstance(bar.date, datetime) or bar.date.utcoffset() is None:
            raise ValueError("IBKR minute bar lacks explicit time zone")
        et = bar.date.astimezone(NY)
        index = minutes.get(et.date().isoformat())
        if index is None or not time(9, 30) <= et.time() < time(16):
            continue
        if et.second or et.microsecond:
            raise ValueError("IBKR bar does not start on a minute boundary")
        stamp = bar.date.astimezone(UTC)
        row = {"time": stamp.isoformat(), "availableAt": (stamp + MINUTE).isoformat(), **quote(bar)}
        if stamp in index and index[stamp] != row:
            raise ValueError("IBKR returned conflicting bars at the same time")
        index[stamp] = row

    sessions = []
    for source in template:
        day = source["date"]
        session_date = date.fromisoformat(day)
        cap = source.get("marketCap")
        available = source.get("marketCapAvailableAt")
        if cap is not None:
            timestamp = datetime.fromisoformat(available or "")
            if not math.isfinite(cap) or cap <= 0 or timestamp.utcoffset() is None:
                raise ValueError(f"Invalid as-of market capitalization for {day}")
            if timestamp > datetime.combine(session_date, time(16), NY):
                raise ValueError(f"Market capitalization was unavailable at the close on {day}")
        prior = max((d for d in daily if d < day), default=None)
        bars = minutes[day]
        sessions.append({
            "date": day, "marketCap": cap, "marketCapAvailableAt": available if cap else None,
            "previousClose": daily[prior]["close"] if prior else None, "daily": daily.get(day),
            "bars": [bars[t] for t in sorted(bars)] if bars else None,
        })
    return sessions


async def history(ib, contract, end, duration, bar_size):
    # A request timeout or entitlement error stops the export instead of looking like a data gap.
    from ib_async import RequestError

    try:
        bars = await asyncio.wait_for(
            ib.reqHistoricalDataAsync(contract, end, duration, bar_size, "TRADES",
                                      useRTH=True, formatDate=2, timeout=0),
            timeout=90,
        )
    except RequestError as exc:
        if exc.code != 162 or "query returned no data" not in exc.message.lower():
            raise
        bars = []
    await asyncio.sleep(1)
    return bars


async def build(input_data, account):
    from ib_async import IB, Stock, StartupFetch

    instruments = input_data["instruments"]
    if not instruments or len(instruments) > 100:
        raise ValueError("Provide between 1 and 100 G3 instruments")
    if not any(s.get("marketCap") is not None for i in instruments for s in i["sessions"]):
        raise ValueError("Provide historical market-cap records before running the G3 screen")
    dates = market_dates(instruments)
    end = datetime.combine(dates[-1] + timedelta(days=1), time(), NY)
    if end > datetime.now(NY):
        raise ValueError("End the sample on an already completed New York trading date")

    ib = IB()
    ib.RaiseRequestErrors = True
    result = []
    try:
        await ib.connectAsync("127.0.0.1", 4002, clientId=92, timeout=10,
                              readonly=True, fetchFields=StartupFetch(0))
        if account not in ib.managedAccounts():
            raise RuntimeError("Gateway did not report the configured paper account")
        for instrument in instruments:
            symbol = instrument["symbol"]
            matches = await asyncio.wait_for(ib.qualifyContractsAsync(Stock(symbol, "SMART", "USD")), 30)
            if len(matches) != 1:
                raise ValueError(f"Unable to uniquely qualify {symbol} as a USD stock")
            contract = matches[0]
            days = (dates[-1] - dates[0]).days + 8
            daily = await history(ib, contract, end, f"{math.ceil(days / 7)} W", "1 day")
            minutes = []
            cursor = end
            while cursor.date() >= dates[0]:
                minutes.extend(await history(ib, contract, cursor, "2 W", "1 min"))
                cursor -= timedelta(weeks=2)
            if not daily or not minutes:
                raise ValueError(f"No usable IBKR daily or minute data returned for {symbol}")
            sessions = convert_sessions(instrument["sessions"], minutes, daily)
            print(f"{symbol}: {sum(s['bars'] is not None for s in sessions)}/{len(sessions)} sessions with IBKR bars",
                  flush=True)
            result.append({"symbol": symbol, "sessions": sessions})
    finally:
        ib.disconnect()

    return {
        "schemaVersion": 2, "kind": "imported", "barSeconds": 60,
        "id": f"ibkr-history-{dates[0]}-{dates[-1]}",
        "description": "IBKR regular-session TRADES OHLCV on the template dates and symbols",
        "providerStatement": (
            "Daily and one-minute OHLCV from IBKR. Historical market cap, symbol universe and session dates "
            "come from the private input template. OHLCV is not executable quote data."
        ),
        "provenance": {"source": "IBKR TWS API historical TRADES", "marketCapTemplate": input_data["id"]},
        "marketCapCoverage": input_data.get("marketCapCoverage", "research_lower_bound"),
        "defaultTradeDays": len(dates) - 20, "instruments": result,
        "recommendedConfig": {"execution": "next_open"},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", type=Path, help="Private G3 JSON with dated market caps and universe")
    parser.add_argument("output", type=Path, help="Private G3 JSON destination outside the repository")
    parser.add_argument("--symbol", help="Probe only this symbol from the template")
    args = parser.parse_args()
    account = os.environ.get("IBKR_PAPER_ACCOUNT", "").strip()
    if not account.startswith("DU"):
        parser.error("Set IBKR_PAPER_ACCOUNT locally to the exact DU paper account")
    output = args.output.resolve()
    if output.is_relative_to(ROOT) or output == args.template.resolve() or output.exists():
        parser.error("Use a new output path outside the repository")
    template = json.loads(args.template.read_text())
    if args.symbol:
        template["instruments"] = [
            i for i in template["instruments"] if i["symbol"] == args.symbol.upper()
        ]
    dataset = asyncio.run(build(template, account))
    with os.fdopen(
        os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w"
    ) as out:
        json.dump(dataset, out, allow_nan=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
