from playwright.sync_api import sync_playwright,expect
import json,os
from pathlib import Path
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('G3_SIMULATOR_URL','http://127.0.0.1:8014/simulator.html'));page.locator('#file').set_input_files(os.environ.get('G3_PRIVATE_DATASET','/workspace/private/market-data/recent-review.dataset.json'));expect(page.locator('#run')).to_be_enabled();page.locator('#run').click();expect(page.locator('#progress')).to_contain_text('已完成 10',timeout=60000)
 assert page.locator('.team-review-note').count()==7
 expect(page.locator('#audit-match')).to_contain_text('指紋與核對版本一致')
 with page.expect_download() as d:page.locator('#export-json').click()
 d.value.save_as('/tmp/before-motion.json')
 page.locator('#view-motion').click();assert page.locator('#daily-table').is_hidden();assert page.locator('#motion-daily').is_visible();assert page.locator('#motion-daily .signed-row').count()==10
 page.locator('#motion-daily [data-day="2026-10-20"]').click();assert page.locator('#detail-date').input_value()=='2026-10-20'
 assert page.locator('#motion-details .check-tile').count()==12
 page.locator('#motion-pause').click();assert page.locator('html').get_attribute('data-motion')=='paused'
 page.locator('#fill-step').fill('1');page.locator('#fill-step').dispatch_event('input')
 expect(page.locator('#fill-card')).to_contain_text('2 /')
 page.locator('#motion-pause').click();page.locator('#fill-play').click();page.wait_for_timeout(1000);page.locator('#motion-pause').click();value=page.locator('#fill-step').input_value();page.wait_for_timeout(300);assert page.locator('#fill-step').input_value()==value
 page.locator('#view-numbers').click();assert page.locator('#daily-table').is_visible()
 with page.expect_download() as d:page.locator('#export-json').click()
 d.value.save_as('/tmp/after-motion.json')
 assert Path('/tmp/before-motion.json').read_bytes()==Path('/tmp/after-motion.json').read_bytes()
 page.locator('#view-motion').click();page.evaluate('window.scrollTo(0,0)');page.screenshot(path='/tmp/motion-desktop.png',full_page=True)
 for width in [390,320]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.screenshot(path='/tmp/motion-mobile.png',full_page=True)
 page.emulate_media(reduced_motion='reduce');assert page.locator('.value-bar').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
 page.emulate_media(media='print');assert page.locator('#daily-table').is_visible();assert page.locator('#motion-daily').is_hidden()
 assert not errors,errors
 print('PASS: numeric/motion toggle; seven review notes; audited fingerprint; 10 daily bars; daily drilldown; screening tiles; pause/step/play; exported results unchanged; 390/320 widths; reduced motion; print tables; no JS errors.')
 b.close()
