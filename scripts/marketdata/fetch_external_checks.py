import urllib.request,datetime as dt,json,hashlib,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path('/workspace/private/market-data/independent-audit')
def epoch(s):return int(dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc).timestamp())
def job(symbol):
 result=[]
 for interval,a,b in [('1d','2026-09-16','2026-10-29'),('1m','2026-10-15','2026-10-21'),('1m','2026-10-21','2026-10-27'),('1m','2026-10-27','2026-10-29')]:
  url=f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={epoch(a)}&period2={epoch(b)}&interval={interval}&includePrePost=false&events=div%2Csplits'
  info={'source':'Yahoo Finance chart','symbol':symbol,'interval':interval,'start':a,'endExclusive':b,'url':url,'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat()}
  try:
   r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30);raw=r.read();name=f'{symbol}-{interval}-{a}.json';(root/name).write_bytes(raw);parsed=json.loads(raw)
   info.update(status=r.status,file=name,sha256=hashlib.sha256(raw).hexdigest(),error=parsed.get('chart',{}).get('error'))
  except Exception as e:info['error']=str(e)
  result.append(info)
 return result
rows=[row for group in ThreadPoolExecutor(3).map(job,['NVDA','TSLA','AMD']) for row in group]
(root/'sources.json').write_text(json.dumps(rows,indent=2));print(json.dumps([{k:r.get(k) for k in ['symbol','interval','start','status','error']} for r in rows]))

# Nasdaq supplies a second daily reference, with its own retained source receipt.
nasdaq=[]
for symbol in ['NVDA','TSLA','AMD']:
 url=f'https://api.nasdaq.com/api/quote/{symbol}/historical?assetclass=stocks&fromdate=2026-10-15&todate=2026-10-28&limit=30'
 info={'source':'Nasdaq historical','symbol':symbol,'url':url,'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat()}
 try:
  raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept':'application/json','Origin':'https://www.nasdaq.com'}),timeout=30).read()
  name=f'nasdaq-{symbol}.json';(root/name).write_bytes(raw);info.update(file=name,sha256=hashlib.sha256(raw).hexdigest())
 except Exception as error:info['error']=str(error)
 nasdaq.append(info)
(root/'nasdaq-sources.json').write_text(json.dumps(nasdaq,indent=2))
