"""Two isolated browsers, real local API/SQLite; no production credentials/data."""
import importlib.util, json, secrets, sqlite3, tempfile, threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('review_api',ROOT/'services/review-api/server.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class QuietStatic(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
with tempfile.TemporaryDirectory() as tmp:
 static=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietStatic,directory=str(ROOT/'sites/g3-platform')))
 origin=f'http://127.0.0.1:{static.server_port}'
 code=secrets.token_urlsafe(24);database=str(Path(tmp)/'review.sqlite3')
 backend=ThreadingHTTPServer(('127.0.0.1',0),api.handler(database,code,{origin},secure=False))
 for srv in [static,backend]:threading.Thread(target=srv.serve_forever,daemon=True).start()
 api_url=f'http://127.0.0.1:{backend.server_port}'
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  a=browser.new_context(accept_downloads=True);b=browser.new_context(accept_downloads=True);errors=[]
  for context in [a,b]:
   context.route('**/review-sync-config.js*',lambda route:route.fulfill(content_type='text/javascript',body=f'export const REVIEW_API_URL={json.dumps(api_url)};'))
  A=a.new_page();B=b.new_page()
  for page in [A,B]:page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+'/review.html#assumptions')
  def login(page,secret):
   page.locator('[data-sync-login] [name=name]').fill('同名測試')
   page.locator('[data-sync-login] [name=code]').fill(secret)
   page.locator('[data-sync-login] button').click()
  login(A,'invalid');expect(A.locator('[data-sync-error]')).to_contain_text('Invalid demo access code')
  login(A,code);expect(A.locator('[data-sync="migrate"]')).to_be_visible()
  A.locator('#comment-A01').fill('A 留言 <script>not executable</script>')
  A.locator('#status-A01').select_option('accepted')
  A.once('dialog',lambda d:d.accept());A.locator('[data-sync="migrate"]').click()
  expect(A.locator('[data-sync-status]')).to_have_text('已儲存')
  rid=A.locator('[data-sync-record] option').nth(1).get_attribute('value')
  login(B,code);expect(B.locator('[data-sync-record] option')).to_have_count(2)
  B.once('dialog',lambda d:d.accept());B.locator('[data-sync-record]').select_option(rid)
  expect(B.locator('#comment-A01')).to_have_value('A 留言 <script>not executable</script>')
  A.locator('#comment-A01').fill('A 新版本');A.locator('[data-sync="save"]').click();expect(A.locator('[data-sync-status]')).to_have_text('已儲存')
  B.locator('#comment-A01').fill('B 未儲存版本');B.locator('[data-sync="save"]').click();expect(B.locator('[data-sync-status]')).to_contain_text('版本衝突')
  expect(B.locator('#comment-A01')).to_have_value('B 未儲存版本')
  B.reload();expect(B.locator('#comment-A01')).to_have_value('B 未儲存版本')
  # JSON backup includes comments only, supports the existing import format.
  with B.expect_download() as dl:B.locator('[data-sync="export"]').click()
  data=json.loads(Path(dl.value.path()).read_text());assert data['assumptions'][0]['review']['comment']=='B 未儲存版本';assert 'runs' not in data
  B.locator('#review-input').set_input_files({'name':'review.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
  expect(B.locator('#comment-A01')).to_have_value('B 未儲存版本')
  # Network failure preserves both textarea and recoverable local draft.
  a.route('**/api/records/**',lambda route:route.abort())
  A.locator('#comment-A01').fill('A offline draft');A.locator('[data-sync="save"]').click();expect(A.locator('[data-sync-status]')).to_contain_text('儲存失敗')
  expect(A.locator('#comment-A01')).to_have_value('A offline draft');a.unroute('**/api/records/**')
  # Server restart retains team records and session, then explicit expiry rejects access.
  backend.shutdown();backend.server_close()
  backend=ThreadingHTTPServer(('127.0.0.1',int(api_url.rsplit(':',1)[1])),api.handler(database,code,{origin},secure=False))
  threading.Thread(target=backend.serve_forever,daemon=True).start()
  A.locator('[data-sync="save"]').click();expect(A.locator('[data-sync-status]')).to_have_text('已儲存')
  with sqlite3.connect(database) as db:db.execute('UPDATE sessions SET expires=0')
  A.locator('#comment-A01').fill('expired draft');A.locator('[data-sync="save"]').click();expect(A.locator('[data-sync-status]')).to_contain_text('登入已過期')
  # Locale and mobile layout; no identity/comment translation.
  B.locator('[data-language=en]').click();expect(B.locator('.sync-panel h2')).to_have_text('Demo review sync')
  B.locator('[data-language="zh-HK"]').click();B.set_viewport_size({'width':390,'height':844})
  assert B.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile horizontal overflow'
  B.screenshot(path='/workspace/work/g3-demo-mobile.png',full_page=True)
  assert not errors,errors
  browser.close()
 static.shutdown();static.server_close();backend.shutdown();backend.server_close()
print('PASS: wrong/right code, two browsers, safe comments, migration, revision conflict, offline draft, JSON import/export, refresh, restart, expiry, bilingual UI and mobile layout')
