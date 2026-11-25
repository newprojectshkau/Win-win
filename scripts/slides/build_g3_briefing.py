"""Build the editable HK Traditional Chinese G3 briefing. Requires python-pptx."""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/slides';OUT.mkdir(parents=True,exist_ok=True)
r=Presentation();r.slide_width= Inches(13.333);r.slide_height= Inches(7.5)
BG='F3F6F8';INK='173443';TEAL='087C83';MUTED='526874';LINE='D7E2E7';WHITE='FFFFFF';GOLD='AE671B';PALE='E4F2F1'
FONT='Noto Sans CJK TC'
def rgb(s):return RGBColor.from_string(s)
def box(s,x,y,w,h,fill=WHITE,line=None,round=True):
 sh=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if round else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
 sh.fill.solid();sh.fill.fore_color.rgb=rgb(fill);sh.line.fill.background() if line is None else None
 if line:sh.line.color.rgb=rgb(line)
 from pptx.oxml.xmlchemy import OxmlElement
 sh._element.spPr.append(OxmlElement('a:effectLst'))
 if round:
  try:sh.adjustments[0]=.12
  except Exception:pass
 return sh
def text(s,x,y,w,h,value,size=18,color=INK,bold=False):
 sh=s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h));tf=sh.text_frame
 tf.clear();tf.word_wrap=True
 tf.margin_left=tf.margin_right=Inches(.01);tf.margin_top=tf.margin_bottom=0
 for i,line in enumerate(value.split('\n')):
  p=tf.paragraphs[0] if i==0 else tf.add_paragraph();p.text=line;p.font.name=FONT;p.font.size=Pt(size);p.font.bold=bold;p.font.color.rgb=rgb(color);p.space_after=Pt(4)
 return sh
def base(n,title,subtitle):
 s=r.slides.add_slide(r.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=rgb(BG)
 text(s,.5,.22,11.8,.28,'WIN-WIN  ／  G3 模擬引擎・開工前審閱',11,TEAL,True)
 text(s,.5,.76,12.3,.55,title,28,INK,True)
 text(s,.5,1.4,12.2,.55,subtitle,14,MUTED)
 box(s,.5,7.03,12.3,.015,LINE,round=False)
 text(s,.5,7.12,11.7,.23,'依據：v3、G3 計劃及原始來源核對｜修訂版・2026 年 10 月 29 日｜引擎尚未建成',9,MUTED)
 text(s,12.3,7.09,.5,.3,f'{n:02d}',11,TEAL,True)
 return s
def arrow(s,x1,y1,x2,y2,color=TEAL):
 line=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2));line.line.color.rgb=rgb(color);line.line.width=Pt(2)
 # Native editable triangle arrowhead, independent of connector support.
 sh=s.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x2-.08), Inches(y2-.07), Inches(.14), Inches(.14));sh.fill.solid();sh.fill.fore_color.rgb=rgb(color);sh.line.fill.background()
 sh.rotation=90 if y2>y1 else (270 if y2<y1 else (180 if x2<x1 else 0))
def labelcard(s,x,y,w,h,title,body,fill=WHITE):
 box(s,x,y,w,h,fill,LINE);text(s,x+.16,y+.13,w-.32,.42,title,18,TEAL,True);text(s,x+.16,y+.58,w-.32,h-.62,body,12 if w<4 else 13,INK)
def banner(s,y,title,body):
 box(s,.5,y,12.3,.75,INK);text(s,.7,y+.12,2.7,.46,title,17,WHITE,True);text(s,3.4,y+.14,9.1,.45,body,14,WHITE)

# 1 Architecture
s=base(1,'引擎架構：同一套策略核心，逐層分開驗證','建議架構｜首版採離線歷史重播；雲端及本機使用相同策略邏輯。')
labelcard(s,.5,2.03,3.85,1.1,'歷史資料及交易日曆','分鐘價、歷史股票池、市值、公司行動')
labelcard(s,4.73,2.03,3.85,1.1,'資料驗證及重播時鐘','只釋出當時已知資料；順序固定')
labelcard(s,8.96,2.03,3.85,1.1,'已批准規則及參數','驗證完整性；每次運行鎖定版本')
arrow(s,4.37,2.59,4.65,2.59);arrow(s,8.88,2.59,8.64,2.59)
arrow(s,6.65,3.15,6.65,3.68)
text(s,.5,3.3,6.0,.3,'五階段策略核心　｜　不直接連接券商、網絡或介面狀態',14,TEAL,True)
xs=[.5,3.0,5.5,8.0,10.5]
for i,(title,body) in enumerate([('① 股票池篩選','過去 20 日四項條件'),('② 分時段揀股','前日早／午市獨立排名'),('③ 配注及組合值','整數股數；組合 RR'),('④ 整段交易開關','當日觀察對前日基準'),('⑤ 逐股持倉狀態','等首訊號、持有、反手')]):
 box(s,xs[i],3.8,2.3,1.0,PALE);text(s,xs[i]+.1,3.95,2.1,.3,title,15,TEAL,True);text(s,xs[i]+.1,4.38,2.1,.3,body,12,INK)
 if i<4:arrow(s,xs[i]+2.32,4.3,xs[i]+2.46,4.3)
# Route strategy output into fills, then audit, then the review interface.
for x1,y1,x2,y2 in [(11.65,4.82,11.65,4.97),(11.65,4.97,2.4,4.97)]:
 line=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2));line.line.color.rgb=rgb(TEAL);line.line.width=Pt(1.5)
arrow(s,2.4,4.97,2.4,5.1)
arrow(s,4.37,5.77,4.65,5.77);arrow(s,8.6,5.77,8.88,5.77)
labelcard(s,.5,5.15,3.85,1.25,'模擬成交層','訊號 → 訂單意圖 → 成交 → 持倉\n建議首版理想化；限制及成本須列明')
labelcard(s,4.73,5.15,3.85,1.25,'核對及追溯層','五階段輸出、逐筆紀錄、現金／持倉\n鎖定資料、規則及程式版本')
labelcard(s,8.96,5.15,3.85,1.25,'建議瀏覽器審閱介面','設定 → 核對 → 重播 → 比較／匯出\n介面另估工期；不含實盤落盤')
# Dependency lines: downward arrows are labelled to avoid implied direct broker flow.
text(s,.58,6.61,12.1,.25,'核心產生決策，由模擬層回報成交；所有層保留追溯紀錄。券商接駁及實盤屬後續階段。',12,MUTED)
s.notes_slide.notes_text_frame.text='建議架構，並非已建成系統。資料與設定經驗證後送入重播時鐘及策略核心；箭嘴為簡化流程。根據 docs/G3-simulator-plan.md 及三份審閱。'
# 2 Roadmap
s=base(2,'完成路線：先定規則及資料，再驗證模擬器','目前已有策略框架；只補齊未決細節及資料。01c 對話未取得，不代表當中沒有答案。')
steps=[('G1','規則定稿','沿用已確認策略\n補齊細節及手算答案'),('G2','資料就緒','前日及完整回看期\n時點、授權及缺漏核對'),('G3・甲','重播及階段①–③','時鐘、Renko 計數\n股票池、排名、配注'),('G3・乙','階段④–⑤','整段開關、逐股狀態\n成交模型及追溯紀錄'),('G3・驗收','正確性通過','手算一致、可重現\n無偷用未來資料')]
for i,(tag,title,body) in enumerate(steps):
 x=.5+i*2.5;box(s,x,2.3,2.3,2.05,WHITE,LINE);text(s,x+.15,2.45,2,.35,tag,17,TEAL,True);text(s,x+.15,2.98,2,.4,title,18,INK,True);text(s,x+.15,3.57,2,.62,body,13,MUTED)
 if i<4:arrow(s,x+2.32,3.25,x+2.46,3.25)
text(s,.55,4.6,12,.35,'其後關卡（不屬今次 G3 建置範圍）',16,TEAL,True)
for i,t in enumerate(['G4　盈利、成本及回撤驗證','G5　真實引擎及券商接駁','G6　模擬賬戶交易','G7–G8　小額實盤及加倉']):
 x=.5+i*3.12;box(s,x,5.12,2.95,.63,PALE);text(s,x+.1,5.3,2.75,.3,t,12,INK,True)
banner(s,6.03,'核心暫估四個開發星期','規則及資料到位後起計；不含資料採購、真實券商限制及完整介面。')
s.notes_slide.notes_text_frame.text='建議分工：策略負責人批准規則；開發者建置及測試；量化審閱者獨立核對手算；資料負責人確認授權及資料時點。可先以人造案例搭骨架，但不代表 G2 或完整歷史驗收已通過。原路線圖日期不作新承諾。'
# 3/4 checklists
known_pending=[
('01 首版範圍','早／午市、h＝1、開關可移除；\n美元門檻及百分比選項已有要求。','只批准首版交付分期；「先做一種模式」是工程建議，\n不是重問策略方向。h＝2／3 仍須完整規則。'),
('02 用價及時間','每分鐘一次；上午 10:00 記初始價；\n首事件以該初始價作基準。','補取價欄位、時間標籤及資料何時可用；\n10:00 記價不等於可用該分鐘尚未完成的收市價。'),
('03 門檻及錨點','起點 0.5%；開市價換算固定美元；\n首事件錨點已有定義。','補開市參考時點、後續錨點、窗口重設、等號；\n百分比計法有討論，但複利公式仍須統一。'),
('04 B／R 計數','B：價格變動門檻事件；\nR：升轉跌／跌轉升。','補一分鐘跨多級計幾次、首事件及統計窗口邊界；\n分開事件數與同分鐘可執行的交易動作數。'),
('05 股票池計算','20 日平均及四項數值已有；\n波幅分子為最高價減最低價。','只補交易日／曆日、平均取價、波幅分母及平均法；\n價格上下限端點與回看不足亦須有規則。'),
('06 資料供應','以 IB 平台股票池作起點；\n歷史資料及一分鐘取樣框架已有。','落實證券範圍、實際歷史供應商、授權及預算；\n提到 IB 不等於已確認全部資料由 IB 提供。'),
('07 異常處理','目前兩份逐字稿及五張原圖，\n未找到完整指定處理政策。','補缺資料、停牌、拆股、改名、上市／退市、遲公布；\n舊稿的工程建議不能當成會議已批准規則。'),
('08 名單及配注','早／午各按 RR 揀 10 隻，可重複；\n整數股數最接近 1,000 美元，可略超。','只補同分、不足候選、參考價、同距及何時重算；\n前日收市後準備，不等於指定用前收市價。')]
s=base(3,'清單（一）：已有設定與尚欠細節','沿用有證據的設定，只處理餘下問題；「未找到」只適用於已檢視的來源。')
for x,w,title in [(.5,1.9,'項目'),(2.4,4.0,'已有設定｜不用重新決定'),(6.4,6.4,'待補細節／交付選擇')]:
 box(s,x,1.99,w,.3,INK,round=False);text(s,x+.08,2.02,w-.16,.25,title,11,WHITE,True)
for i,(head,known,pending) in enumerate(known_pending):
 y=2.32+i*.535
 box(s,.5,y,12.3,.505,WHITE if i%2==0 else PALE,round=False)
 text(s,.59,y+.11,1.76,.3,head,12,INK,True)
 text(s,2.48,y+.025,3.82,.47,known,11.5,TEAL)
 text(s,6.48,y+.025,6.2,.47,pending,11.5,INK)
text(s,.55,6.7,12.1,.24,'已核對兩份逐字稿及五張原圖；01c 連結讀取遭 403 阻擋，內容尚未納入，不能視作沒有答案。',10,GOLD,True)
s.notes_slide.notes_text_frame.text=(
 '核對依據：docs/G3-checklist-01-source-audit-zh-HK.md。逐字稿01與02位於 imports/AL-briefing-01/。'
 '01：01 00:09:31、00:10:51–00:12:21；02 00:00:33、00:07:04–00:08:17。'
 '02：01 00:00:56–00:01:25；02 00:02:42–00:03:20、00:05:01–00:05:10；午市13:00補自圖5。'
 '03：01 00:11:22–00:11:49；02 00:03:13–00:03:20、00:05:10–00:05:30；圖2。'
 '04：01 00:04:13–00:05:56；02 00:06:16–00:07:19。'
 '05：01 00:01:32–00:02:48；圖1。06：01 00:01:25–00:01:32、00:03:55。'
 '07：已檢視來源未有完整政策，不是宣稱用戶從未定義。'
 '08：01 00:09:04–00:10:57、00:13:41–00:16:03、00:18:37；圖3。'
 '不以舊稿建議或 compare.py 假設代替策略批准。briefing digest 01c 的 chatgpt.com/local 連結尚未能讀取。')
checks2=[
('09','定義交易開關例外','當日／前日 RR 相等、組合分母為零或一隻候選缺資料時，整段如何處理？'),
('10','定義時段及事件先後','區間端點歸屬、12:30 先清早市還是計午市；半日市及假期採甚麼規則？'),
('11','批准訊號至成交模型','訊號後何時落單／成交、用甚麼價、手續費及滑價；列明理想化假設。'),
('12','批准時段尾清倉辦法','16:00 後沒有下一根正常市況分鐘線；用哪種可支持的成交或估值規則？'),
('13','決定執行限制的建模範圍','借貨、購買力、拒單、部分成交、延遲及未成交單：首版建模，還是列為不支援？'),
('14','批准介面及交付範圍','命令列核心先行；瀏覽器介面另估期。確認可改欄位、比較、原因解釋及匯出。'),
('15','指定負責人、資源及預算','誰拍板規則、誰核對手算、誰驗收？確認本機／雲端、資料儲存及資源預算。'),
('16','簽核驗收標準及版本','先批准手算案例；分開人造案例、歷史資料及成交真實性驗收；改規則須另存版本。')]
for number,title,subtitle,rows in [(4,'尚待落實清單（二）：執行、介面及驗收','只確認未決執行細節及交付安排；先平倉再反手、時段尾清倉等策略原則沿用現有規格。',checks2)]:
 s=base(number,title,subtitle)
 for i,(idx,head,body) in enumerate(rows):
  y=2.03+i*.57;box(s,.5,y,12.3,.51,WHITE if i%2==0 else PALE,round=False)
  box(s,.64,y+.13,.17,.17,WHITE,TEAL,False);text(s,.93,y+.1,.42,.3,idx,12,TEAL,True)
  text(s,1.42,y+.06,3.4,.39,head,15,INK,True);text(s,4.82,y+.09,7.78,.37,body,12,MUTED)
 text(s,.55,6.73,12,.23,'每項均須形成可執行答案及對應測試；未決項目不可由開發者靜默補上。',11,GOLD,True)
# 5 constraints
s=base(5,'限制與注意事項（一）：策略及市場資料','四項預設：20 日均值；市值 >20 億美元、成交量 >1,000 萬股、波幅 >1.5%、股價 20–1,000 美元。')
cards=[('資料必須是「當時已知」','不能用今天的成分股／修訂市值回算當年股票池。\n須有完整回看期、公布時間、退市及公司行動紀錄。'),('一分鐘資料看不到逐筆先後','開高低收不能判斷先升還是先跌；不可猜測分鐘內路徑。\n不用 10:00 之後才知的價，回算較早觀察窗口。'),('兩種 RR 不可混用','個股 RR＝B／(R＋1)；組合 RR＝ΣB／ΣR。\n組合不加常數、不平均個股 RR；分母零須保留「未定義」。'),('名單及交易開關的粒度','前日早／午市各自揀股，可有重複；預設各 10 隻。\n當日 30 分鐘對前日完整對應時段；開關適用整份名單。'),('持倉規則不可偷偷改','通過開關後仍等首事件；同向持有，不加注。\nh＝1 先平倉再反手；無新事件亦須按規則時段尾清倉。'),('配注及可選風控須分開','整數股數最接近每股目標 1,000 美元，可略高於目標。\n五倉上限、日損上限、止蝕等並非現行核心預設。')]
for i,(h,b) in enumerate(cards):labelcard(s,.5+(i%2)*6.28,2.05+(i//2)*1.54,6.02,1.37,h,b)
s.notes_slide.notes_text_frame.text='策略時間以紐約為準：前日早市 09:30–12:30、午市 12:30–16:00；當日觀察 09:30–10:00 及 12:30–13:00；初始價 10:00 及 13:00；清倉 12:30 及 16:00。端點和半日市仍待決定。B 是門檻事件數，R 是方向轉換數，h 是持倉反向確認數，三者不可混淆。'
# 6 constraints/acceptance
s=base(6,'限制與注意事項（二）：工程、操作及交付','G3 的成功定義是「規則跑得正確、可解釋、可重播」；盈利證據及實盤能力另行驗證。')
cards=[('訊號不等於可成交','若首版採理想化成交，須披露借貨、購買力及流動性限制。\n若支援部分／延遲成交，確認平倉後才可開反向倉。'),('時段尾未必有可用成交價','16:00 不能默認用下一分鐘或翌日成交；無可用價須報告。\n停牌／未平持倉不可假裝已清倉；過期時段不得再開倉。'),('可重現及資料保護','固定同時事件次序、精度及四捨五入；鎖定每次設定。\n記錄資料／程式版本；輸出另存，不覆寫研究檔或存入密鑰。'),('本機、雲端及介面一致','以同一核心及鎖定依賴運行；不可依賴原有 Mac 絕對路徑。\n日期用紐約／香港雙時區及夏令時間；先量度資源再擴股票池。'),('操作結果必須講得清楚','分開閘口不通過、未有首事件、缺資料、設定未定及執行拒絕。\n介面改數須真正傳入引擎；提供差異、持倉／成本及逐筆匯出。'),('驗收與範圍不可混為一談','手算、因果、重跑及持倉現金核對全部通過。\nh＝2／3、其他模式及自訂時段須先定義；G3 不含實盤。')]
for i,(h,b) in enumerate(cards):labelcard(s,.5+(i%2)*6.28,2.05+(i//2)*1.54,6.02,1.37,h,b)
s.notes_slide.notes_text_frame.text='詳列約束依據：docs/G3-simulator-plan.md、docs/reviews/G3-trading-review.md、G3-engineering-review.md、G3-investor-review.md。核心四星期估算不含採購、真實券商限制、所有策略變體及完整介面。審閱屬代理分析，並非專業人士背書。程式測試通過不可代替策略負責人及獨立核對者簽核。'
r.core_properties.title='G3 模擬引擎｜架構、路線及開工決策'
r.core_properties.subject='香港繁體中文・六頁審閱簡報・按原始來源核對修訂'
r.core_properties.author='Win-win'
r.save(OUT/'G3-engine-briefing-zh-HK.pptx')
print(OUT/'G3-engine-briefing-zh-HK.pptx')
