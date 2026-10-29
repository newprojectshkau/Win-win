import json,gzip,datetime as dt,hashlib
from pathlib import Path
root=Path('/workspace/private/market-data');audit=root/'independent-audit';archive=root/'massive-year';d=json.loads((root/'recent-review.dataset.json').read_text());dates={s['date'] for s in d['instruments'][0]['sessions']};symbols=['NVDA','TSLA','AMD'];pages={}
for line in (archive/'manifest.jsonl').read_text().splitlines():
 r=json.loads(line)
 if r.get('status')!='saved' or '/aggs/grouped/' not in r['url']:continue
 date=r['url'].split('?')[0].split('/')[-1]
 if date not in dates:continue
 raw=(archive/r['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==r['sha256'];pages[date]=json.loads(gzip.decompress(raw))
rows=[]
for symbol in symbols:
 y=json.loads((audit/f'{symbol}-1d-2026-09-16.json').read_text())['chart']['result'][0];q=y['indicators']['quote'][0];ym={dt.datetime.fromtimestamp(t,dt.timezone.utc).date().isoformat():{k:q[k][i] for k in ['open','high','low','close','volume']} for i,t in enumerate(y['timestamp'])}
 nm={dt.datetime.strptime(r['date'],'%m/%d/%Y').date().isoformat():{k:float(r[k].replace(',','').replace('$','')) for k in ['open','high','low','close','volume']} for r in json.loads((audit/f'nasdaq-{symbol}.json').read_text())['data']['tradesTable']['rows']}
 for date,p in pages.items():
  m=next(x for x in p['results'] if x['T']==symbol)
  for source,lookup in [('Yahoo',ym),('Nasdaq',nm)]:
   if date not in lookup:continue
   y=lookup[date];rows.append({'symbol':symbol,'date':date,'source':source,'closeDiffUSD':abs(m['c']-y['close']),'volumeDiffPct':abs(m['v']-y['volume'])/y['volume']*100})
report={source:{'pairs':len([r for r in rows if r['source']==source]),'maxCloseDiffUSD':max(r['closeDiffUSD'] for r in rows if r['source']==source),'maxVolumeDiffPct':max(r['volumeDiffPct'] for r in rows if r['source']==source)} for source in ['Yahoo','Nasdaq']}
(audit/'official-daily-check.json').write_text(json.dumps({'summary':report,'rows':rows},indent=2));print(json.dumps(report))
