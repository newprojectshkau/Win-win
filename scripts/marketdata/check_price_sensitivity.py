import json,sys,datetime as dt,statistics
from pathlib import Path
sys.path.insert(0,'scripts/marketdata')
from zoneinfo import ZoneInfo
OUT=Path('/workspace/private/market-data/independent-audit');NY=ZoneInfo('America/New_York')
def yahoo(file):
 d=json.loads(file.read_text())['chart']['result'][0];q=d['indicators']['quote'][0]
 return [(dt.datetime.fromtimestamp(t,dt.timezone.utc),{k:q[k][i] for k in ['open','high','low','close','volume']}) for i,t in enumerate(d.get('timestamp',[]))]
from build_massive_dataset import load_archive
root=Path('/workspace/private/market-data');d=json.loads((root/'recent-review.dataset.json').read_text());minute,_,_=load_archive(root/'massive');comparisons=[]
for inst in d['instruments']:
 sym=inst['symbol'];yd={t.astimezone(NY).date().isoformat():r for t,r in yahoo(OUT/f'{sym}-1d-2026-09-16.json')};ym={t.isoformat():r for f in OUT.glob(f'{sym}-1m-*.json') for t,r in yahoo(f)}
 for s in inst['sessions']:
  date=s['date'];v=sum(b['volume'] for b in s['bars']);closebar=sum(r['v'] for r in minute[sym].values() if dt.datetime.fromtimestamp(r['t']/1000,NY).date().isoformat()==date and dt.datetime.fromtimestamp(r['t']/1000,NY).time()==dt.time(16))
  official=yd[date]['volume'];comparisons.append({'symbol':sym,'date':date,'rth':v,'at1600':closebar,'official':official,'plus1600DiffPct':abs(v+closebar-official)/official*100})
  if date<'2026-10-15':continue
  for b in s['bars']:
   y=ym[b['time']]
   for k in ['open','high','low','close']:b[k]=y[k]
 # previousClose must reflect the preceding replaced session where available.
 for i,s in enumerate(inst['sessions']):
  if i and inst['sessions'][i-1]['date']>='2026-10-15':s['previousClose']=inst['sessions'][i-1]['bars'][-1]['close']
d['id']='yahoo-price-sensitivity-massive-caps-and-volume';d['description']='Yahoo 分鐘 OHLC 敏感度；回看期早段、市值及成交量仍為 Massive。不是獨立完整回測。'
(root/'independent-audit/yahoo-price-sensitivity.dataset.json').write_text(json.dumps(d,separators=(',',':')))
(root/'independent-audit/volume-definition-check.json').write_text(json.dumps(comparisons,indent=2))
print(json.dumps({'medianAbsDifferenceAfterIncluding1600Pct':statistics.median(r['plus1600DiffPct'] for r in comparisons),'rows':len(comparisons)}))
