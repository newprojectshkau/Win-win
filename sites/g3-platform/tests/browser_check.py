from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json, os
ARTIFACTS=Path(os.environ.get('G3_TEST_ARTIFACTS','/tmp/g3-platform-check'));ARTIFACTS.mkdir(parents=True,exist_ok=True)
BASE_URL=os.environ.get('G3_BASE_URL','http://127.0.0.1:8010/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1512,'height':1100},accept_downloads=True)
 page=c.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE_URL)
 page.wait_for_selector('.stats',timeout=30000)
 assert '10' in page.locator('.stat').first.inner_text()
 assert page.locator('.gate-card').count()==2
 page.screenshot(path=str(ARTIFACTS/'desktop.png'),full_page=True)
 page.get_by_role('link',name='參數設定',exact=True).click()
 page.locator('#field-target').fill('1500')
 page.get_by_role('button',name='儲存設定草稿',exact=True).click()
 assert page.locator('.pending-run').count()==1
 page.get_by_role('button',name='執行重播',exact=False).first.click()
 page.wait_for_selector('button[data-action="run"]:not([disabled])',timeout=30000)
 assert page.locator('.pending-run').count()==0
 page.get_by_role('link',name='版本比較',exact=True).click()
 expect(page.locator('main')).to_contain_text('每股目標名義金額')
 assert page.locator('table').first.locator('tbody').inner_text().find('1500')>=0
 page.get_by_role('link',name='假設與留言',exact=True).click()
 expect(page.locator('.assumption-card')).to_have_count(22)
 page.locator('#status-A05').select_option('change')
 page.locator('#comment-A05').fill('請比較分鐘 close 與另一種取價方法；<script>alert(1)</script>')
 page.locator('#general-comment').fill('請把價格圖及持倉放在同一頁。')
 page.reload();page.wait_for_selector('#comment-A05')
 assert page.locator('#comment-A05').input_value().startswith('請比較')
 assert page.locator('#status-A05').input_value()=='change'
 with page.expect_download() as dl:page.get_by_role('button',name='匯出全部留言',exact=False).click()
 download=dl.value;download.save_as(str(ARTIFACTS/'review.json'))
 data=json.loads(Path(str(ARTIFACTS/'review.json')).read_text())
 assert len(data['assumptions'])==22 and data['assumptions'][4]['review']['status']=='change'
 assert data['runs'][0]['config']['target']==1500
 assert data['runs'][1]['config']['target']==1000
 page.get_by_role('link',name='逐股重播',exact=True).click()
 expect(page.locator('svg.chart')).to_have_count(1)
 assert page.locator('tbody tr').count()>2
 page.screenshot(path=str(ARTIFACTS/'replay.png'),full_page=True)
 page.get_by_role('button',name='午市',exact=True).click()
 expect(page.locator('main')).to_contain_text('整段開關未通過')
 page.get_by_role('link',name='五階段結果',exact=True).click()
 expect(page.locator('table')).to_have_count(3)
 page.screenshot(path=str(ARTIFACTS/'results.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 for nav in ['工作台','參數設定','五階段結果','逐股重播','假設與留言','版本比較']:
  page.locator(f'#nav a').filter(has_text=nav).click()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),nav+' overflow'
 page.locator('#nav a').filter(has_text='工作台').click()
 page.screenshot(path=str(ARTIFACTS/'mobile.png'),full_page=True)
 assert not errors,errors
 print('Browser passed: six views, settings -> changed run, immutable prior config, comparisons, 22 assumptions, comment persistence/XSS text, review JSON download, symbol chart/ledger, skipped slot, six mobile layouts; no JS errors.')
 b.close()
