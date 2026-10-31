#!/usr/bin/env python3
"""Build a private, packed 50-symbol replay bundle without imputing missing data.
Historical market-cap samples provide only a nonnegative lower bound on the
20-day mean. Insufficient bounds remain unassessed. Not a historical IB universe.
"""
import datetime as dt
import gzip
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from zoneinfo import ZoneInfo

NY = ZoneInfo('America/New_York')

def build(root, trading_days=30):
    root = Path(root).resolve()
    repo = Path(__file__).resolve().parents[2]
    if root == repo or repo in root.parents:
        raise ValueError('Licensed data must remain outside repository')
    scope = json.loads((root/f'panel-{trading_days}days/scope.json').read_text())
    dates = scope['dates']; selected = dates[1:]; symbols = scope['archiveUniverse']
    daily, caps, minutes = {}, {}, {s:{} for s in symbols}
    checks = 0
    for folder in ['massive-year', 'massive', 'access-recheck']:
        archive = root/folder; index = {}
        for line in (archive/'manifest.jsonl').read_text().splitlines():
            e = json.loads(line)
            if e.get('status') == 'saved': index[e['url']] = e
        for url, e in index.items():
            path = urlsplit(url).path; query = parse_qs(urlsplit(url).query)
            grouped = '/aggs/grouped/' in path and path.split('/')[-1] in dates
            ref = '/v3/reference/tickers/' in path and query.get('date',[''])[0] in selected
            minute = folder == 'massive-year' and '/minute/' in path and query.get('limit') != ['5']
            if not (grouped or ref or minute): continue
            f = (archive/e['file']).resolve()
            if archive not in f.parents: raise ValueError('Manifest path escape')
            raw = f.read_bytes()
            if hashlib.sha256(raw).hexdigest() != e['sha256']: raise ValueError('Archive checksum mismatch')
            checks += 1; payload = json.loads(gzip.decompress(raw))
            if grouped:
                daily[path.split('/')[-1]] = {r['T']:r for r in payload.get('results',[])}
            elif ref:
                r=payload.get('results',{}); cap=r.get('market_cap') if isinstance(r,dict) else None
                if isinstance(cap,(int,float)) and cap>0: caps[(path.split('/')[-1],query['date'][0])] = cap
            elif minute:
                symbol = payload.get('ticker')
                if symbol not in minutes: continue
                for row in payload.get('results',[]):
                    instant=dt.datetime.fromtimestamp(row['t']/1000,dt.timezone.utc).astimezone(NY)
                    day=instant.date().isoformat()
                    if day not in selected or not dt.time(9,30)<=instant.time()<dt.time(16): continue
                    bucket=minutes[symbol].setdefault(day,{})
                    if row['t'] in bucket and bucket[row['t']] != row: raise ValueError('Conflicting minute rows')
                    bucket[row['t']]=row
    instruments=[]; missing=[]; observed_caps=0
    for symbol in symbols:
        sessions=[]
        for day in selected:
            start=dt.datetime.combine(dt.date.fromisoformat(day),dt.time(9,30),NY)
            ms=int(start.timestamp()*1000); bucket=minutes[symbol].get(day,{})
            complete=sorted(bucket)==[ms+i*60000 for i in range(390)]
            cap=caps.get((symbol,day)); observed_caps+=cap is not None
            d=daily.get(day,{}).get(symbol); previous=daily.get(dates[dates.index(day)-1],{}).get(symbol)
            session={'date':day,'marketCap':cap,'marketCapAvailableAt':(start+dt.timedelta(minutes=390)).isoformat() if cap else None,'previousClose':previous['c'] if previous else None,'daily':{'high':d['h'],'low':d['l'],'close':d['c'],'volume':d['v']} if d else None,'startMs':ms}
            if complete: session['packedBars']=[[bucket[t][k] for k in ['o','h','l','c','v']] for t in sorted(bucket)]
            else:
                session['bars']=None;missing.append({'symbol':symbol,'date':day,'rows':len(bucket)})
            sessions.append(session)
        instruments.append({'symbol':symbol,'sessions':sessions})
    quality={'checkedFiles':checks,'missingMinuteSessions':missing,'knownCapSessions':observed_caps,'totalSessions':len(symbols)*len(selected),'archiveUniverse':symbols,'marketNonCapUnionCount':scope['marketNonCapUnionCount'],'unarchivedNonCapUnionCount':len(scope['unarchivedNonCapUnion']),'dataThrough':selected[-1], 'capMethod':'Known historical caps summed / 20 is a nonnegative lower bound; missing values are not imputed. Insufficient bounds are unassessed and excluded; this can alter rankings. Date availability at session close is an unverified assumption.'}
    dataset={'schemaVersion':2,'kind':'imported','id':f'massive-expanded-{trading_days}days-'+selected[-1], 'defaultTradeDays':trading_days, 'description':f'50 個已存檔代號研究池，並非歷史 IB 全市場；每日重選。官方日線篩選；市值不足部分只用可證明的非負下限，無法判定者不參與；缺分鐘不補值。最近可用 {trading_days} 個交易日，截止 {selected[-1]}；各日合資格股票數會受市值及分鐘覆蓋影響。','providerStatement':'Private Massive adjusted historical OHLCV. Not executable quotes. Fixed archive universe has selection/survivorship bias. Market cap date availability is assumed, not verified publication time.', 'provenance':quality,'recommendedConfig':{'execution':'next_open'},'instruments':instruments}
    out=root/f'expanded-{trading_days}days.dataset.json';out.write_text(json.dumps(dataset,separators=(',',':')));out.chmod(0o600)
    (root/f'expanded-{trading_days}days.quality.json').write_text(json.dumps(quality,indent=2))
    print(json.dumps({'output':str(out),'bytes':out.stat().st_size,'start':scope['tradeDates'][0],'end':scope['tradeDates'][-1],'symbols':len(symbols),'knownCaps':observed_caps,'missingMinutes':len(missing)}))
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--root',default='/workspace/private/market-data');p.add_argument('--trading-days',type=int,choices=[30,90],default=30);args=p.parse_args();build(args.root,args.trading_days)
