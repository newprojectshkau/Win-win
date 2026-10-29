#!/usr/bin/env python3
"""Build a private schema-v1 dry-run file from a verified Massive archive.
This is a fixed research subset, not an unbiased historical IB stock universe.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
import urllib.parse
from zoneinfo import ZoneInfo

NY=ZoneInfo('America/New_York')

def load_archive(root):
    root=Path(root).resolve();latest={}
    for line in (root/'manifest.jsonl').read_text().splitlines():
        entry=json.loads(line)
        if entry.get('status')=='saved':latest[entry['url']]=entry
    minutes={};references={};checks={'checkedFiles':0,'duplicateIdenticalBars':0,'conflictingBars':[]}
    for url,entry in latest.items():
        file=(root/entry['file']).resolve()
        if root not in file.parents:raise ValueError('Archive manifest path escapes private archive')
        payload=file.read_bytes()
        if hashlib.sha256(payload).hexdigest()!=entry['sha256']:raise ValueError('Archive checksum mismatch')
        checks['checkedFiles']+=1;data=json.loads(gzip.decompress(payload));path=urllib.parse.urlsplit(url).path
        query=dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))
        if path.startswith('/v2/aggs/ticker/') and '/minute/' in path:
            if query.get('limit')=='5':continue  # entitlement probe is not the retained complete series
            symbol=data.get('ticker')
            if not symbol:continue
            bucket=minutes.setdefault(symbol,{})
            for row in data.get('results',[]):
                stamp=row.get('t')
                if stamp in bucket:
                    if bucket[stamp]==row:checks['duplicateIdenticalBars']+=1
                    else:checks['conflictingBars'].append({'symbol':symbol,'timestamp':stamp})
                else:bucket[stamp]=row
        elif path.startswith('/v3/reference/tickers/') and query.get('date'):
            result=data.get('results',{})
            references[(path.rsplit('/',1)[-1],query['date'])]=result if isinstance(result,dict) else {}
    if checks['conflictingBars']:raise ValueError('Conflicting minute bars exist; review the archive before replay')
    return minutes,references,checks

def build(root,date,symbols,lookback=20):
    minutes,references,checks=load_archive(root);date=dt.date.fromisoformat(date)
    by_symbol={};quality={'scope':'Fixed user/research symbol subset, not historical IB universe','requestedTradeDate':str(date),'lookback':lookback,'source':'Massive REST archive','checks':checks,'issues':[],'sourceAvailabilityAssumption':'Historical reference ?date is a provider as-of claim; publication timestamps are not independently verified. marketCapAvailableAt is assumed at that historical session close, not asserted as original publication evidence.','priceBasis':'Split-adjusted OHLCV as retrieved; no independent corporate-action audit; not a guaranteed executable historical quote.'}
    for symbol in symbols:
        dates={}
        for row in minutes.get(symbol,{}).values():
            instant=dt.datetime.fromtimestamp(row['t']/1000,dt.timezone.utc);local=instant.astimezone(NY)
            if local.date()>date or local.time()<dt.time(9,30) or local.time()>=dt.time(16):continue
            if instant.second or instant.microsecond:raise ValueError('Non-minute source timestamp')
            dates.setdefault(str(local.date()),[]).append(row)
        by_symbol[symbol]={d:sorted(rows,key=lambda r:r['t']) for d,rows in dates.items()}
    all_dates=sorted(set.union(*(set(days) for days in by_symbol.values()))) if by_symbol else []
    if str(date) not in all_dates:raise ValueError('Requested trade date is absent from the minute archive')
    # One extra source day is retained privately for the first screening day's previous close.
    selected=all_dates[-(lookback+2):]
    if len(selected)<lookback+2:raise ValueError('Need lookback + trade day + one prior close day; archive a longer range')
    instruments=[]
    for symbol in symbols:
        sessions=[]
        for i,day in enumerate(selected):
            rows=by_symbol[symbol].get(day,[])
            expected_start=int(dt.datetime.combine(dt.date.fromisoformat(day),dt.time(9,30),NY).timestamp()*1000)
            expected=[expected_start+n*60000 for n in range(390)]
            if [r['t'] for r in rows]!=expected:
                quality['issues'].append({'symbol':symbol,'date':day,'type':'incomplete_regular_session','rows':len(rows),'expected':390});continue
            if i==0:continue
            previous=by_symbol[symbol].get(selected[i-1],[])
            if len(previous)!=390:
                quality['issues'].append({'symbol':symbol,'date':day,'type':'missing_previous_close'});continue
            reference=references.get((symbol,day),{})
            cap=reference.get('market_cap')
            if not isinstance(cap,(int,float)) or cap<=0:
                quality['issues'].append({'symbol':symbol,'date':day,'type':'missing_historical_market_cap'});continue
            bars=[]
            for r in rows:
                prices=[r.get(k) for k in ['o','h','l','c']]
                if not all(isinstance(p,(int,float)) and p>0 for p in prices) or not isinstance(r.get('v'),(int,float)) or r['v']<0 or r['h']<max(r['o'],r['c']) or r['l']>min(r['o'],r['c']):raise ValueError('Invalid source OHLCV')
                t=dt.datetime.fromtimestamp(r['t']/1000,dt.timezone.utc)
                bars.append({'time':t.isoformat(),'availableAt':(t+dt.timedelta(minutes=1)).isoformat(),'open':r['o'],'high':r['h'],'low':r['l'],'close':r['c'],'volume':r['v']})
            close=dt.datetime.combine(dt.date.fromisoformat(day),dt.time(16),NY).astimezone(dt.timezone.utc)
            sessions.append({'date':day,'marketCap':cap,'marketCapAvailableAt':close.isoformat(),'previousClose':previous[-1]['c'],'bars':bars})
        instruments.append({'symbol':symbol,'name':references.get((symbol,str(date)),{}).get('name',symbol),'sessions':sessions})
    quality['instruments']=len(instruments);quality['expectedSessionsPerInstrument']=lookback+1
    quality['readyForAssumedSubsetReplay']=not quality['issues'] and all(len(i['sessions'])==lookback+1 for i in instruments)
    dataset={'schemaVersion':1,'id':'massive-private-subset-'+str(date),'kind':'imported','description':f'Massive 真實 OHLCV；{len(symbols)} 隻固定研究子集，交易日 {date}。不是完整歷史 IB 股票池或盈利驗證。','providerStatement':'Private subscribed Massive archive. Adjusted OHLCV. Fixed research subset. Historical market-cap availability uses the explicit provider-date/close assumption, not independently verified publication time. No licensed data may be published to GitHub Pages by this tool.','provenance':{'quality':quality,'sourceArchiveManifestSha256':hashlib.sha256((Path(root)/'manifest.jsonl').read_bytes()).hexdigest()},'instruments':instruments}
    return dataset,quality

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive',default='/workspace/private/market-data/massive')
    p.add_argument('--date',required=True)
    p.add_argument('--symbols',default='AAPL,MSFT,NVDA,TSLA,AMZN,GOOGL,META,AMD,MU,AVGO,GOOG,PLTR')
    p.add_argument('--lookback',type=int,default=20)
    p.add_argument('--output',required=True)
    args=p.parse_args();output=Path(args.output).resolve();repo=Path(__file__).resolve().parents[2]
    if output==repo or repo in output.parents:p.error('Licensed output must stay outside the public repository')
    symbols=list(dict.fromkeys(s.strip().upper() for s in args.symbols.split(',') if s.strip()))
    if not symbols or len(symbols)>100 or not 1<=args.lookback<=250:p.error('Invalid symbols/lookback')
    try:dataset,quality=build(args.archive,args.date,symbols,args.lookback)
    except (ValueError,OSError,KeyError) as e:p.exit(2,'Cannot build dry run: '+str(e)+'\n')
    output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    report=output.with_suffix('.quality.json');report.write_text(json.dumps(quality,indent=2));report.chmod(0o600)
    if not quality['readyForAssumedSubsetReplay']:p.exit(3,'Dry run blocked by source completeness/reference issues; inspect the private quality report. No values were fabricated.\n')
    raw=json.dumps(dataset,separators=(',',':')).encode()
    if len(raw)>40*1024**2:p.exit(4,'Bundle exceeds platform 40 MB import limit; use a smaller explicitly disclosed research subset.\n')
    output.write_bytes(raw);output.chmod(0o600)
    print(json.dumps({'dataset':str(output),'quality':str(report),'symbols':len(symbols),'bytes':len(raw),'date':args.date,'scope':'provisional research subset, not full G3 acceptance'}))
if __name__=='__main__':main()
