#!/usr/bin/env python3
"""Private, resumable Massive REST archive. Auth stays in an HTTPS Bearer header.
No credentials or licensed data are written into the public repository.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

HOST = 'api.massive.com'
NY = ZoneInfo('America/New_York')
PRIMARY = ['AAPL','MSFT','NVDA','TSLA','AMZN','GOOGL','META','AMD','MU','AVGO','GOOG','PLTR']
class StopArchive(Exception): pass
class EntitlementError(Exception): pass
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise StopArchive('API redirect rejected; authentication was not forwarded')

def clean_url(url):
    p=urllib.parse.urlsplit(url)
    if p.scheme!='https' or p.hostname!=HOST or p.username or p.password or p.port not in [None,443]:
        raise StopArchive('Unexpected API pagination destination')
    q=[(k,v) for k,v in urllib.parse.parse_qsl(p.query) if k.lower() not in ['apikey','api_key','token','access_token']]
    return urllib.parse.urlunsplit(('https',HOST,p.path,urllib.parse.urlencode(q),''))

def clean_response(value):
    if isinstance(value,dict):
        return {k:(clean_url(v) if k=='next_url' and isinstance(v,str) else clean_response(v)) for k,v in value.items() if k.lower() not in ['apikey','api_key','authorization','access_token']}
    if isinstance(value,list):return [clean_response(v) for v in value]
    return value

def weekdays(start,end):
    while start<=end:
        if start.weekday()<5:yield start
        start+=dt.timedelta(days=1)

class Archive:
    def __init__(self,root,key,rpm=120,max_requests=2500,max_bytes=1024**3):
        self.root=Path(root).resolve();self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.key=key;self.rpm=rpm;self.max_requests=max_requests;self.max_bytes=max_bytes
        self.requests=0;self.bytes=0;self.last=0;self.index={};self.opener=urllib.request.build_opener(NoRedirect)
        self.manifest=self.root/'manifest.jsonl'
        if self.manifest.exists():
            for line in self.manifest.read_text().splitlines():
                try:
                    item=json.loads(line)
                    if item.get('status')=='saved':self.index[item['url']]=item
                except (ValueError,KeyError):pass
    def record(self,item):
        with self.manifest.open('a') as f:f.write(json.dumps(item,ensure_ascii=False)+'\n')
    def fetch(self,path,params=None):
        url=clean_url(path if path.startswith('https://') else 'https://'+HOST+path+('?' + urllib.parse.urlencode(params) if params else ''))
        old=self.index.get(url)
        if old:
            file=self.root/old['file']
            if file.exists() and hashlib.sha256(file.read_bytes()).hexdigest()==old['sha256']:
                return json.loads(gzip.decompress(file.read_bytes()))
        if self.requests>=self.max_requests or self.bytes>=self.max_bytes:raise StopArchive('Archive request/byte budget reached; rerun resumes verified cached requests')
        for attempt in range(5):
            delay=max(0,60/self.rpm-(time.monotonic()-self.last))
            if delay:time.sleep(delay)
            self.requests+=1;self.last=time.monotonic()
            if self.requests>self.max_requests:raise StopArchive('Request budget reached')
            req=urllib.request.Request(url,headers={'Authorization':'Bearer '+self.key,'User-Agent':'Win-win-private-prototype/0.1','Accept':'application/json'})
            try:
                with self.opener.open(req,timeout=45) as response:
                    raw=response.read(min(50*1024**2,self.max_bytes-self.bytes)+1)
                    if len(raw)>50*1024**2 or self.bytes+len(raw)>self.max_bytes:raise StopArchive('Response exceeds private archive size budget')
                self.bytes+=len(raw);data=clean_response(json.loads(raw))
                if data.get('status') in ['NOT_AUTHORIZED','ERROR']:
                    raise EntitlementError('Provider rejected this endpoint; check plan entitlement')
                encoded=json.dumps(data,separators=(',',':')).encode()
                if self.key.encode() in encoded:raise StopArchive('Provider response appears to contain credential material; refused to save')
                payload=gzip.compress(encoded,mtime=0)
                file='raw/'+hashlib.sha256(url.encode()).hexdigest()+'.json.gz'
                target=self.root/file;target.parent.mkdir(exist_ok=True,mode=0o700)
                temp=target.with_suffix('.tmp');temp.write_bytes(payload);temp.chmod(0o600);temp.replace(target)
                item={'status':'saved','url':url,'file':file,'sha256':hashlib.sha256(payload).hexdigest(),'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'responseBytes':len(raw),'results':data.get('resultsCount',len(data.get('results',[])) if isinstance(data.get('results'),list) else None)}
                self.record(item);self.index[url]=item
                return data
            except urllib.error.HTTPError as error:
                code=error.code
                self.record({'status':'http_error','url':url,'code':code,'at':dt.datetime.now(dt.timezone.utc).isoformat()})
                if code in [401,403]:raise EntitlementError(f'HTTP {code} from provider endpoint (no key or response body logged)') from None
                if code==404:return {'status':'NOT_FOUND','results':[]}
                if code==429 or 500<=code<600:
                    wait=error.headers.get('Retry-After','')
                    wait=float(wait) if wait.isdigit() else 2**(attempt+2)
                    if wait>60:raise StopArchive(f'Provider Retry-After requires {int(wait)} seconds; resume after that cooldown') from None
                    if attempt<4:time.sleep(max(wait,1));continue
                raise StopArchive(f'Provider HTTP {code}; archive is resumable') from None
            except urllib.error.URLError as error:
                reason=str(error.reason)
                if '403' in reason or 'Forbidden' in reason:raise StopArchive('Network proxy blocked api.massive.com; saved secret alone does not apply network settings') from None
                if attempt<4:time.sleep(2**attempt);continue
                raise StopArchive('API transport unavailable; no credential values logged') from None
        raise StopArchive('Retry limit reached')
    def pages(self,path,params=None):
        page=self.fetch(path,params);seen=set()
        while True:
            yield page
            next_url=page.get('next_url')
            if not next_url:break
            next_url=clean_url(next_url)
            if next_url in seen:raise StopArchive('Repeated pagination cursor')
            seen.add(next_url);page=self.fetch(next_url)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default='/workspace/private/market-data/massive')
    parser.add_argument('--start',default=(dt.date.today()-dt.timedelta(days=65)).isoformat())
    parser.add_argument('--end',default=(dt.datetime.now(NY).date()-dt.timedelta(days=1)).isoformat())
    parser.add_argument('--symbols',default=','.join(PRIMARY))
    parser.add_argument('--expand-minute-symbols',type=int,default=50)
    parser.add_argument('--requests-per-minute',type=int,default=120)
    parser.add_argument('--max-requests',type=int,default=2500)
    parser.add_argument('--max-bytes',type=int,default=1024**3)
    parser.add_argument('--probe-only',action='store_true')
    args=parser.parse_args()
    root=Path(args.output).resolve();repo=Path(__file__).resolve().parents[2]
    if root==repo or repo in root.parents:parser.error('Licensed archives must be outside the public repository')
    key=os.environ.get('MASSIVE_API_KEY')
    if not key:parser.exit(2,'MASSIVE_API_KEY is not injected. Add the secret value securely, save/apply the environment settings, then rerun. Never pass keys as command arguments.\n')
    if not 1<=args.requests_per_minute<=600 or args.max_requests<1 or args.max_bytes<1:parser.error('Invalid request/budget settings')
    start,end=dt.date.fromisoformat(args.start),dt.date.fromisoformat(args.end)
    if end<start or (end-start).days>366:parser.error('Date range must be ordered and within 366 days')
    symbols=list(dict.fromkeys(s.strip().upper() for s in args.symbols.split(',') if s.strip()))
    if not symbols or len(symbols)>100 or not all(re.fullmatch(r'[A-Z0-9.\-]{1,20}',s) for s in symbols):parser.error('Invalid symbols (max 100)')
    archive=Archive(root,key,args.requests_per_minute,args.max_requests,args.max_bytes)
    report={'scope':'private licensed research archive; not a point-in-time IB universe or profitability validation','requestedStart':str(start),'requestedEnd':str(end),'primarySymbols':symbols,'completed':[],'limitations':[]}
    def progress(stage):
        print(json.dumps({'stage':stage,'networkRequests':archive.requests,'newRawBytes':archive.bytes}),flush=True)
    def write_report():
        report.update({'newRequests':archive.requests,'newRawBytes':archive.bytes,'lastUpdatedAt':dt.datetime.now(dt.timezone.utc).isoformat()})
        (root/'archive-status.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    try:
        # A tiny request proves authentication/entitlement before any larger acquisition.
        probe=archive.fetch(f'/v2/aggs/ticker/{symbols[0]}/range/1/minute/{end}/{end}',{'adjusted':'true','sort':'asc','limit':5})
        progress('minute_probe_'+str(probe.get('status','unknown')))
        if args.probe_only:report['completed'].append('probe');return
        # Preserve the hard-to-recover minute series first, before subscription expiry.
        for symbol in symbols:
            for _ in archive.pages(f'/v2/aggs/ticker/{symbol}/range/1/minute/{start}/{end}',{'adjusted':'true','sort':'asc','limit':50000}):pass
            progress('minutes_'+symbol)
        report['completed'].append('primary_minutes');write_report()
        grouped={}
        for day in weekdays(start,end):
            try:grouped[str(day)]=archive.fetch(f'/v2/aggs/grouped/locale/us/market/stocks/{day}',{'adjusted':'true','include_otc':'false'})
            except EntitlementError as e:report['limitations'].append('grouped_daily: '+str(e));break
            progress('grouped_'+str(day))
        report['completed'].append('grouped_daily_attempted');write_report()
        # As-of reference snapshots are stored as provider claims, never invented historical caps.
        reference_allowed=True
        for symbol in symbols:
            if not reference_allowed:break
            for day,page in grouped.items():
                if not any(row.get('T')==symbol for row in page.get('results',[])):continue
                try:archive.fetch('/v3/reference/tickers/'+symbol,{'date':day})
                except EntitlementError as e:
                    report['limitations'].append('historical_reference: '+str(e));reference_allowed=False;break
            progress('reference_'+symbol)
        report['completed'].append('primary_reference_attempted');write_report()
        # Broad daily market data is already cached. Use volume only to choose extra archives,
        # not to claim an unbiased historical stock selection or an IB stock universe.
        last=next((grouped[d] for d in sorted(grouped,reverse=True) if grouped[d].get('results')),None)
        if last:
            extra=[row['T'] for row in sorted(last['results'],key=lambda r:r.get('v',0),reverse=True) if re.fullmatch(r'[A-Z0-9.\-]{1,20}',row.get('T','')) and row.get('c',0)>=20 and row['T'] not in symbols]
            extra=extra[:max(0,args.expand_minute_symbols-len(symbols))]
            report['extraArchiveSymbols']=extra
            for symbol in extra:
                try:
                    for _ in archive.pages(f'/v2/aggs/ticker/{symbol}/range/1/minute/{start}/{end}',{'adjusted':'true','sort':'asc','limit':50000}):pass
                except EntitlementError as e:report['limitations'].append('extra_minutes: '+str(e));break
                progress('extra_minutes_'+symbol)
        report['completed'].append('archive_pass')
    except (EntitlementError,StopArchive) as error:
        report['stoppedReason']=str(error);print('Stopped:',str(error),flush=True);return 3
    finally:write_report()
    return 0
if __name__=='__main__':raise SystemExit(main())
