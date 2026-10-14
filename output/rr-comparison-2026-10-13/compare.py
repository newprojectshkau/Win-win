"""Reproducible RR comparison; an assumed event model, not a trading backtest."""
import concurrent.futures
import datetime as dt
import json
from decimal import Decimal, ROUND_FLOOR
from pathlib import Path
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
DATE = '2026-10-13'
TZ = ZoneInfo('America/New_York')
SYMBOLS = ['NVDA','AAPL','MSFT','AMZN','GOOGL','AVGO','META','GOOG','MU','TSLA']

def fetch(symbol):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=5d'
    request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    raw = json.load(urllib.request.urlopen(request, timeout=30))
    (ROOT / f'{symbol}-raw.json').write_text(json.dumps(raw, ensure_ascii=False))
    result = raw['chart']['result'][0]
    assert result['meta']['symbol'] == symbol
    quote = result['indicators']['quote'][0]
    bars = []
    for i, timestamp in enumerate(result['timestamp']):
        time = dt.datetime.fromtimestamp(timestamp,TZ)
        if time.date().isoformat() == DATE and dt.time(9,30) <= time.time() < dt.time(16):
            bars.append({'time':time.isoformat(), **{key:quote[key][i] for key in ['open','high','low','close','volume']}})
    expected = [dt.datetime.fromisoformat(f'{DATE}T09:30:00').replace(tzinfo=TZ)+dt.timedelta(minutes=i) for i in range(390)]
    assert [b['time'] for b in bars] == [t.isoformat() for t in expected], f'{symbol}: incomplete minute timestamps'
    assert all(b[k] is not None and b[k]>0 for b in bars for k in ['open','high','low','close']), f'{symbol}: missing price'
    assert all(b['low']<=b['close']<=b['high'] and b['low']<=b['open']<=b['high'] for b in bars)
    (ROOT / f'{symbol}-minutes.json').write_text(json.dumps(bars,indent=2))
    return symbol,bars,url

def count(bars,brick):
    anchor = Decimal(str(bars[0]['open']))
    previous = 0
    events = []
    B = R = 0
    for bar in bars:
        close = Decimal(str(bar['close']))
        delta = close-anchor
        direction = 1 if delta>0 else -1
        steps = int((abs(delta)/brick).to_integral_value(rounding=ROUND_FLOOR))
        if steps:
            if previous and direction != previous:
                R += 1
            B += steps
            anchor += direction*steps*brick
            previous = direction
            events.append({'time':bar['time'],'direction':direction,'bricks':steps,'anchor':float(anchor)})
    assert 0<=R<=max(0,B-1)
    return B,R,events

def main():
    rows=[]
    metadata=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        fetched = list(executor.map(fetch,SYMBOLS))
    for symbol,bars,url in fetched:
        brick=Decimal(str(bars[0]['open']))*Decimal('0.005')
        metadata.append({'symbol':symbol,'url':url,'minutes':len(bars),'open':bars[0]['open'],'brick_usd':float(brick),'first':bars[0]['time'],'last':bars[-1]['time']})
        for slot,subset in [('AM',bars[:180]),('PM',bars[180:])]:
            B,R,events=count(subset,brick)
            (ROOT / f'{symbol}-{slot}-events.json').write_text(json.dumps(events,indent=2))
            rows.append({'symbol':symbol,'slot':slot,'B':B,'R':R,'RR1':B/(R+1),'RR10':B/(R+10),'increase_pct':None if B==0 else 900/(R+1)})
    for slot in ['AM','PM']:
        subset=[r for r in rows if r['slot']==slot]
        for k in [1,10]:
            for row in subset:
                row[f'rank{k}']=1+sum(other[f'RR{k}']>row[f'RR{k}'] for other in subset)
        for row in subset:
            row['rank_gain_plus1']=row['rank10']-row['rank1']
    output={'date':DATE,'universe_source':'https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy','universe_as_of':DATE,'universe_basis':'index top 10 securities by weight, as-of end of test day; descriptive comparison, not point-in-time trading selection','assumptions':{'sampling':'1m close','brick':'fixed USD = 0.5% of 09:30 minute open','anchor':'first minute open in each slot','slots':'AM [09:30,12:30), PM [12:30,16:00), America/New_York','counting':'each full threshold crossing counts B; multiple crossings per minute allowed; direction change counts R; first event has no reversal; one-brick reversal','ranking':'competition ranks; ties receive same rank','scope':'RR and ranking only; no 20-day Stage 1 screening, gate, fills, costs or P&L'},'retrieved_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'metadata':metadata,'rows':rows}
    (ROOT/'comparison.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
    print(json.dumps(output,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
