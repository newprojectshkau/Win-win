"""Real-data review UI smoke check. Supply a private dataset; never publish it."""
from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import os,json
BASE=os.environ.get('G3_BASE_URL','http://127.0.0.1:8020/review.html')
DATA=Path(os.environ.get('G3_PRIVATE_DATASET','/workspace/private/market-data/recent-review.dataset.json'))
if not DATA.exists():raise SystemExit('Set G3_PRIVATE_DATASET to an existing private schema-v1 historical dataset')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1512,'height':1100},accept_downloads=True);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 expect(page.locator('main')).to_contain_text('載入真實股票')
 page.locator('#dataset-input').set_input_files(str(DATA));expect(page.locator('main')).to_contain_text('massive')
 page.locator('[data-action="run"]').first.click();expect(page.locator('.stats')).to_be_visible(timeout=30000)
 assert 'DEMO' not in page.locator('main').inner_text()
 page.get_by_role('link',name='參數設定',exact=True).click();page.locator('#field-target').fill('1500');page.get_by_role('button',name='儲存設定草稿',exact=True).click()
 page.locator('[data-action="run"]').first.click();page.wait_for_selector('button[data-action="run"]:not([disabled])',timeout=30000)
 page.get_by_role('link',name='版本比較',exact=True).click();expect(page.locator('main')).to_contain_text('每股目標名義金額')
 page.get_by_role('link',name='假設與留言',exact=True).click();page.locator('#comment-A05').fill('真實資料審閱 <script>alert(1)</script>');page.reload();expect(page.locator('#comment-A05')).to_have_value('真實資料審閱 <script>alert(1)</script>')
 with page.expect_download() as d:page.get_by_role('button',name='匯出全部留言',exact=False).click()
 d.value.save_as('/tmp/real-review-export.json');r=json.loads(Path('/tmp/real-review-export.json').read_text());assert r['runs'][0]['config']['target']==1500;assert all(x['data']['kind']=='imported' for x in r['runs'])
 page.set_viewport_size({'width':390,'height':844})
 for nav in ['工作台','參數設定','五階段結果','逐股重播','假設與留言','版本比較']:
  page.get_by_role('link',name=nav,exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),nav
 assert not errors,errors
 print('PASS: real-only review UI, empty state, import, settings, frozen comparisons, persistent safe comments, export and six mobile pages.')
 b.close()
