#!/usr/bin/env python3
"""Compare private Massive replay data to cached independently retrieved daily/minute sources."""
import json,datetime as dt,hashlib,statistics,csv
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path('/workspace/private/market-data');OUT=ROOT/'independent-audit';NY=ZoneInfo('America/New_York')
data=json.loads((ROOT/'recent-review.dataset.json').read_text())
def yahoo(file):
 d=json.loads(file.read_text())['chart']['result'][0];q=d['indicators']['quote'][0]
 return [(dt.datetime.fromtimestamp(t,dt.timezone.utc),{k:q[k][i] for k in ['open','high','low','close','volume']}) for i,t in enumerate(d.get('timestamp',[]))]
def stats(rows):
 prices=[r['closeDiffBps'] for r in rows];volume=[r['volumeDiffPct'] for r in rows if r['volumeDiffPct'] is not None]
 return {**{k+'MaxDiffBps':max((r[k+'DiffBps'] for r in rows),default=None) for k in ['open','high','low']},'rows':len(rows),'closeWithin1Cent':sum(r['closeDiffUSD']<=.010001 for r in rows),'closeWithin1bp':sum(x<=1 for x in prices),'closeOver10bp':sum(x>10 for x in prices),'maxCloseDiffBps':max(prices,default=None),'medianCloseDiffBps':statistics.median(prices) if prices else None,'volumeComparableRows':len(volume),'medianAbsVolumeDiffPct':statistics.median(volume) if volume else None,'volumeOver5Pct':sum(x>5 for x in volume)}
def compare(symbol,date,m,y):
 return {**{k+'DiffBps':abs(m[k]-y[k])/y[k]*10000 for k in ['open','high','low']},'symbol':symbol,'date':date,'massiveClose':m['close'],'otherClose':y['close'],'closeDiffUSD':abs(m['close']-y['close']),'closeDiffBps':abs(m['close']-y['close'])/y['close']*10000,'volumeDiffPct':abs(m['volume']-y['volume'])/y['volume']*100 if y['volume'] else None}
daily=[];minute=[];nasdaq=[];missing=[];minuteCounts={};invalidYahoo=0;events={}
for inst in data['instruments']:
 symbol=inst['symbol'];yd={t.astimezone(NY).date().isoformat():v for t,v in yahoo(OUT/f'{symbol}-1d-2026-09-16.json')}
 events[symbol]=json.loads((OUT/f'{symbol}-1d-2026-09-16.json').read_text())['chart']['result'][0].get('events',{})
 ym={}
 for f in OUT.glob(f'{symbol}-1m-*.json'):
  for t,row in yahoo(f):
   if dt.time(9,30)<=t.astimezone(NY).time()<dt.time(16):ym[t.isoformat()]=row
 minuteCounts[symbol]=len(ym)
 nf=OUT/f'nasdaq-{symbol}.json';nd={}
 if nf.exists():
  for row in json.loads(nf.read_text()).get('data',{}).get('tradesTable',{}).get('rows',[]):
   date=dt.datetime.strptime(row['date'],'%m/%d/%Y').date().isoformat();nd[date]={k:float(row[k].replace('$','').replace(',','')) for k in ['open','high','low','close','volume']}
 for session in inst['sessions']:
  bars=session['bars'];day=session['date'];m={'open':bars[0]['open'],'high':max(b['high'] for b in bars),'low':min(b['low'] for b in bars),'close':bars[-1]['close'],'volume':sum(b['volume'] for b in bars)}
  if day in yd and all(yd[day].get(k) is not None for k in m):daily.append(compare(symbol,day,m,yd[day]))
  else:missing.append({'symbol':symbol,'date':day,'type':'Yahoo daily absent/null'})
  if day in nd:nasdaq.append(compare(symbol,day,m,nd[day]))
  if day<'2026-10-15':continue
  for bar in bars:
   y=ym.get(bar['time'])
   if not y or any(y.get(k) is None for k in ['open','high','low','close','volume']):
    missing.append({'symbol':symbol,'time':bar['time'],'type':'Yahoo minute absent/null'});continue
   minute.append(compare(symbol,bar['time'],bar,y))
report={'asOf':'2026-10-30 Australia/Melbourne','datasetSha256':hashlib.sha256((ROOT/'recent-review.dataset.json').read_bytes()).hexdigest(),'massiveBars':sum(len(s['bars']) for i in data['instruments'] for s in i['sessions']),'scope':{'symbols':[i['symbol'] for i in data['instruments']],'minuteCompareStart':'2026-10-15','minuteCompareEnd':'2026-10-28','dailyCompareStart':'2026-09-17','dailyCompareEnd':'2026-10-28'},'yahooDaily':stats(daily),'yahooMinute':stats(minute),'nasdaqDaily':stats(nasdaq),'missingComparisons':len(missing),'missingDetails':missing[:100],'yahooMinuteCounts':minuteCounts,'corporateEventsReported':events,'limitations':['Massive regular-session minute aggregates compared to provider daily bars; auction and trade eligibility differences may affect volume and close.','No independent historical market-cap or publication-time verification.','Matching prices do not validate idealized fills, spread, slippage, short availability or strategy profitability.','Audit applies only to this three-symbol dataset; annual archive not covered.']}
for name,rows in [('yahoo-daily',daily),('yahoo-minute',minute),('nasdaq-daily',nasdaq)]:
 if rows:
  with (OUT/f'{name}-comparison.csv').open('w',newline='') as f:w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
(OUT/'audit-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,ensure_ascii=False))
