from pathlib import Path
import json,gzip,datetime as dt,collections,hashlib,urllib.parse
from zoneinfo import ZoneInfo
root=Path('/workspace/private/market-data/massive-year');ny=ZoneInfo('America/New_York');index={}
for line in (root/'manifest.jsonl').read_text().splitlines():
 r=json.loads(line)
 if r.get('status')=='saved':index[r['url']]=r
symbols={};daily={};refs=collections.defaultdict(list);size=0
for url,r in index.items():
 raw=(root/r['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==r['sha256'];size+=len(raw);d=json.loads(gzip.decompress(raw));path=urllib.parse.urlsplit(url).path;query=dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))
 if '/range/1/minute/' in path and query.get('limit')!='5':
  s=d.get('ticker');v=symbols.setdefault(s,{'bars':0,'first':None,'last':None,'regularCounts':collections.Counter(),'pages':0,'links':[]})
  v['pages']+=1
  if d.get('next_url'):v['links'].append(d['next_url'])
  for row in d.get('results',[]):
   t=dt.datetime.fromtimestamp(row['t']/1000,ny);date=str(t.date());v['bars']+=1;v['first']=min(v['first'] or date,date);v['last']=max(v['last'] or date,date)
   if dt.time(9,30)<=t.time()<dt.time(16):v['regularCounts'][date]+=1
 elif '/aggs/grouped/' in path:daily[path.rsplit('/',1)[-1]]=len(d.get('results',[]))
 elif '/reference/tickers/' in path and isinstance(d.get('results'),dict) and d['results'].get('market_cap',0)>0:refs[path.rsplit('/',1)[-1]].append(query.get('date'))
for s,v in symbols.items():
 v['fullRegularDays']=sum(n==390 for n in v['regularCounts'].values());v['nonFullDays']={k:n for k,n in sorted(v['regularCounts'].items()) if n!=390};v['regularCounts']=dict(sorted(v['regularCounts'].items()));v['allPaginationLinksCached']=all(link in index for link in v.pop('links'))
report={'range':['2025-10-29','2026-10-28'],'symbols':symbols,'symbolCount':len(symbols),'totalMinuteBars':sum(v['bars'] for v in symbols.values()),'tradingDailyDates':len([n for n in daily.values() if n]),'dailyFirst':min(daily),'dailyLast':max(daily),'dailyRows':sum(daily.values()),'references':{s:{'count':len(d),'first':min(d),'last':max(d)} for s,d in refs.items()},'compressedBytes':size,'files':len(index)}
(root.parent/'annual-inventory.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='symbols'}));print(json.dumps({s:{k:v for k,v in info.items() if k not in ['regularCounts','nonFullDays']} for s,info in symbols.items()}))
