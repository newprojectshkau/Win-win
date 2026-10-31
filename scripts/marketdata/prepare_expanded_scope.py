"""Prepare an archive-backed 30/90-day scope; optionally acquire dated cap samples.
Missing caps remain unknown; samples only prove a nonnegative lower bound.
"""
import sys,json,gzip,hashlib,os,argparse
from pathlib import Path
from urllib.parse import urlsplit,parse_qs

from archive_massive import Archive
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',default='/workspace/private/market-data')
parser.add_argument('--trading-days',type=int,choices=[30,90],default=90)
parser.add_argument('--end',default=None)
parser.add_argument('--fetch-cap-samples',action='store_true')
args=parser.parse_args()
root=Path(args.root).resolve();repo=Path(__file__).resolve().parents[2]
if root==repo or repo in root.parents:parser.error('Licensed data must remain outside repository')
length=args.trading_days+21
annual=root/'massive-year';out=root/f'panel-{args.trading_days}days';out.mkdir(exist_ok=True)
api=Archive(annual,os.environ.get('MASSIVE_API_KEY',''),rpm=5,max_requests=160,max_bytes=64*1024**2)
entries={url:e for url,e in api.index.items() if '/aggs/grouped/' in url}
daily={}
for url,e in sorted(entries.items(),reverse=True):
 day=urlsplit(url).path.split('/')[-1]
 if args.end and day>args.end:continue
 raw=(annual/e['file']).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=e['sha256']:raise ValueError('Checksum mismatch')
 rows=json.loads(gzip.decompress(raw)).get('results',[])
 if rows:daily[day]={r['T']:r for r in rows}
 if len(daily)==length:break
dates=sorted(daily);assert len(dates)==length,'Archive has insufficient trading days and warmup'
symbols=list(json.loads((root/'annual-inventory.json').read_text())['symbols']);trade=dates[21:];coarse={};world=set()
for idx in range(21,len(dates)):
 history=dates[idx-20:idx]
 def qualifies(s):
  if any(s not in daily[d] or s not in daily[dates[dates.index(d)-1]] for d in history):return False
  rows=[daily[d][s] for d in history]
  return sum(r['v'] for r in rows)/20>1e7 and 20<=sum(r['c'] for r in rows)/20<=1000 and sum((daily[d][s]['h']-daily[d][s]['l'])/daily[dates[dates.index(d)-1]][s]['c'] for d in history)/20>.015
 coarse[dates[idx]]=[s for s in symbols if qualifies(s)]
 world.update(s for s in daily[history[-1]] if qualifies(s))
scope={'archiveUniverse':symbols,'dates':dates,'tradeDates':trade,'nonCapPassByDay':coarse,'marketNonCapUnionCount':len(world),'unarchivedNonCapUnion':sorted(world-set(symbols))}
(out/'scope.json').write_text(json.dumps(scope,indent=2));print(json.dumps({'scopeReady':True,'start':trade[0],'end':trade[-1],'days':len(trade),'pool':len(symbols)}),flush=True)
if not args.fetch_cap_samples:sys.exit(0)
if not os.environ.get('MASSIVE_API_KEY'):parser.error('MASSIVE_API_KEY binding is required for acquisition')
for name in ['fetch-complete.json','fetch-error.json']:(out/name).unlink(missing_ok=True)
# Dated cap samples can only prove a nonnegative lower bound, never replace an exact mean.
known={}
for folder in ['massive-year','massive','access-recheck']:
 index={}
 for line in (root/folder/'manifest.jsonl').read_text().splitlines():
  e=json.loads(line)
  if e.get('status')=='saved' and '/v3/reference/tickers/' in e['url']:index[e['url']]=e
 for url,e in index.items():
  q=parse_qs(urlsplit(url).query);day=q.get('date',[''])[0];symbol=urlsplit(url).path.split('/')[-1]
  payload=json.loads(gzip.decompress((root/folder/e['file']).read_bytes())).get('results',{})
  if isinstance(payload,dict) and payload.get('market_cap'):known[symbol,day]=payload['market_cap']
priority={s for (s,d),cap in known.items() if cap>40e9}
queue=[]
for k in range(20,length,20):
 day=dates[k]
 for symbol in symbols:
  if symbol not in priority:continue
  windows=[i for i in range(21,length) if i-20<=k<i and symbol in coarse[dates[i]]]
  if not windows:continue
  # Skip samples when all relevant rolling windows already prove the cap threshold.
  if all(sum(known.get((symbol,d),0) for d in dates[i-20:i])/20>2e9 for i in windows):continue
  queue.append((symbol,day))
print(json.dumps({'scheduledSamples':len(queue),'prioritySymbols':len(priority)}),flush=True)
try:
 for symbol,day in queue:
  p=api.fetch('/v3/reference/tickers/'+symbol,{'date':day})
  cap=p.get('results',{}).get('market_cap')
  if cap:known[symbol,day]=cap
  print(json.dumps({'sample':symbol,'date':day,'requests':api.requests}),flush=True)
 (out/'fetch-complete.json').write_text(json.dumps({'complete':True,'requests':api.requests,'tradingDays':args.trading_days,'start':trade[0],'end':trade[-1]}))
except Exception as e:
 (out/'fetch-error.json').write_text(json.dumps({'error':str(e),'requests':api.requests}));print(type(e).__name__,str(e),flush=True);raise SystemExit(2)
