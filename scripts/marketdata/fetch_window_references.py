#!/usr/bin/env python3
"""Fill dated references for a fixed review subset, then build a private rolling-window dataset."""
import argparse,datetime as dt,json,os
from pathlib import Path
from archive_massive import Archive
from build_massive_dataset import load_archive,build,NY
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--archive',required=True);p.add_argument('--output',required=True)
p.add_argument('--date',required=True);p.add_argument('--symbols',default='NVDA,TSLA,AMD')
p.add_argument('--days',type=int,default=10);p.add_argument('--requests-per-minute',type=int,default=8)
a=p.parse_args();root=Path(a.archive).resolve();out=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2]
for dest in [root,out]:
 if dest==repo or repo in dest.parents:p.error('Data must stay outside public repository')
if not 1<=a.days<=100 or not 1<=a.requests_per_minute<=120:p.error('Invalid days/rate')
symbols=list(dict.fromkeys(a.symbols.split(',')))
if not 1<=len(symbols)<=100:p.error('Invalid symbol count')
key=os.environ.get('MASSIVE_API_KEY')
if not key:p.error('MASSIVE_API_KEY is not injected')
minutes,_,_=load_archive(root)
if any(s not in minutes for s in symbols):p.error('Download minute series for every requested symbol first')
dates=sorted({dt.datetime.fromtimestamp(r['t']/1000,NY).date().isoformat() for r in minutes[symbols[0]].values() if dt.time(9,30)<=dt.datetime.fromtimestamp(r['t']/1000,NY).time()<dt.time(16) and dt.datetime.fromtimestamp(r['t']/1000,NY).date().isoformat()<=a.date})[-(a.days+21):]
if len(dates)<a.days+21 or dates[-1]!=a.date:p.error('Insufficient source dates')
api=Archive(root,key,rpm=a.requests_per_minute,max_requests=4000,max_bytes=128*1024**2)
for day in reversed(dates[1:]):
 for symbol in symbols:
  api.fetch('/v3/reference/tickers/'+symbol,{'date':day})
  print(json.dumps({'symbol':symbol,'date':day,'requests':api.requests}),flush=True)
dataset,quality=build(root,a.date,symbols,a.days+19)
out.parent.mkdir(parents=True,exist_ok=True)
q=out.with_suffix('.quality.json');q.write_text(json.dumps(quality,indent=2));q.chmod(0o600)
if not quality['readyForAssumedSubsetReplay']:p.exit(3,'Review blocked by completeness checks; inspect private quality report\n')
encoded=json.dumps(dataset,separators=(',',':')).encode()
if len(encoded)>40*1024**2:p.exit(4,'Dataset exceeds browser import limit\n')
out.write_bytes(encoded);out.chmod(0o600)
print(json.dumps({'ready':str(out),'sessions':a.days+20,'symbols':symbols}))
