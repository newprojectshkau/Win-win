import datetime as dt
import gzip
import io
import json
from pathlib import Path
import tempfile
import unittest
from zoneinfo import ZoneInfo
from archive_massive import Archive, StopArchive, clean_url
from build_massive_dataset import build, load_archive

class FakeOpener:
    def __init__(self,payload):self.payload=payload;self.calls=0;self.requests=[]
    def open(self,request,timeout):
        self.calls+=1;self.requests.append(request)
        return io.BytesIO(json.dumps(self.payload).encode())

class ArchiveTests(unittest.TestCase):
    def test_pagination_rejects_other_hosts_and_strips_query_credentials(self):
        self.assertNotIn('apiKey',clean_url('https://api.massive.com/path?apiKey=not-real&cursor=abc'))
        self.assertIn('cursor=abc',clean_url('https://api.massive.com/path?apiKey=not-real&cursor=abc'))
        for url in ['http://api.massive.com/path','https://evil.invalid/path','https://user@api.massive.com/path']:
            with self.assertRaises(StopArchive):clean_url(url)
    def test_bearer_only_scrubbed_cache_checksum_and_request_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            api=Archive(directory,'fixture-secret',max_requests=1)
            opener=FakeOpener({'status':'OK','apiKey':'fixture-secret','results':[{'t':1,'c':100}]});api.opener=opener
            api.fetch('/example',{'limit':1})
            self.assertEqual(opener.requests[0].get_header('Authorization'),'Bearer fixture-secret')
            self.assertNotIn('fixture-secret',opener.requests[0].full_url)
            api.fetch('/example',{'limit':1});self.assertEqual(opener.calls,1)
            self.assertNotIn('fixture-secret',api.manifest.read_text())
            saved=next(Path(directory).glob('raw/*'))
            self.assertNotIn('fixture-secret',gzip.decompress(saved.read_bytes()).decode())
            with self.assertRaises(StopArchive):api.fetch('/different')
    def test_response_echoing_credential_is_not_saved(self):
        with tempfile.TemporaryDirectory() as directory:
            api=Archive(directory,'fixture-secret');api.opener=FakeOpener({'message':'fixture-secret'})
            with self.assertRaises(StopArchive):api.fetch('/example')
            self.assertFalse((Path(directory)/'raw').exists())
    def test_dataset_preserves_actual_bar_count_and_blocks_missing_reference(self):
        with tempfile.TemporaryDirectory() as directory:
            api=Archive(directory,'fixture-secret',rpm=1e9);ny=ZoneInfo('America/New_York')
            dates=[];day=dt.date(2026,9,1)
            while len(dates)<22:
                if day.weekday()<5:dates.append(day)
                day+=dt.timedelta(days=1)
            rows=[]
            for date in dates:
                start=dt.datetime.combine(date,dt.time(9,30),ny)
                for m in range(390):
                    rows.append({'t':int((start+dt.timedelta(minutes=m)).timestamp()*1000),'o':100,'h':101,'l':99,'c':100,'v':50000})
            api.opener=FakeOpener({'ticker':'TEST','status':'OK','results':rows})
            api.fetch('/v2/aggs/ticker/TEST/range/1/minute/2026-09-01/2026-10-01',{'limit':50000})
            for date in dates[1:]:
                api.opener=FakeOpener({'results':{'ticker':'TEST','market_cap':5000000000}})
                api.fetch('/v3/reference/tickers/TEST',{'date':str(date)})
            dataset,quality=build(directory,str(dates[-1]),['TEST'])
            self.assertTrue(quality['readyForAssumedSubsetReplay'])
            self.assertEqual(len(dataset['instruments'][0]['sessions']),21)
            self.assertEqual(sum(len(d['bars']) for d in dataset['instruments'][0]['sessions']),8190)
            self.assertEqual(dataset['instruments'][0]['sessions'][0]['bars'][0]['availableAt'],'2026-09-02T13:31:00+00:00')
            # A supplied date without any historical cap must never be silently filled.
            manifest=Path(directory)/'manifest.jsonl'
            kept=[line for line in manifest.read_text().splitlines() if '/v3/reference/tickers/TEST?date='+str(dates[-1]) not in json.loads(line)['url']]
            manifest.write_text('\n'.join(kept)+'\n')
            _,missing=build(directory,str(dates[-1]),['TEST'])
            self.assertFalse(missing['readyForAssumedSubsetReplay'])
            self.assertTrue(any(x['type']=='missing_historical_market_cap' or x['type']=='incomplete_regular_session' for x in missing['issues']))
    def test_corrupt_cache_fails_integrity_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            api=Archive(directory,'fixture-secret');api.opener=FakeOpener({'results':[]});api.fetch('/example')
            next(Path(directory).glob('raw/*')).write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'checksum'):load_archive(directory)
if __name__=='__main__':unittest.main()
