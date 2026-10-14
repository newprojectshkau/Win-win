from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4, landscape
from pathlib import Path
pdfmetrics.registerFont(TTFont('HK','/System/Library/Fonts/STHeiti Light.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('HKB','/System/Library/Fonts/STHeiti Medium.ttc',subfontIndex=0))
OUT=Path('output/pdf/美股投資及交易模型_v2_圖解審閱版.pdf')
W,H=landscape(A4)
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('美股投資及交易模型 v2｜圖解審閱版'); c.setAuthor('Win-win')
NAVY='#132D3A'; TEAL='#007F79'; GREEN='#087B5A'; RED='#BD4E44'; GOLD='#BE8424'; INK='#203E4C'; MUTED='#637A84'; BG='#F4F7F7'; WHITE='#FFFFFF'; LINE='#DCE5E7'
def rect(x,y,w,h,fill=WHITE,r=10,stroke=None):
 c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(stroke or fill)); c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=bool(stroke))
def txt(x,y,s,size=12,color=INK,bold=False):
 c.setFillColor(HexColor(color)); c.setFont('HKB' if bold else 'HK',size); c.drawString(x,H-y-size,s)
def wrap(s,width,size):
 out=[]
 for p in s.split('\n'):
  line=''
  for ch in p:
   if pdfmetrics.stringWidth(line+ch,'HK',size)>width:
    out.append(line); line=ch
   else: line+=ch
  out.append(line)
 return out
def para(x,y,s,width,size=11,color=MUTED,leading=None):
 leading=leading or size*1.55
 for i,line in enumerate(wrap(s,width,size)):txt(x,y+i*leading,line,size,color)
def line(x1,y1,x2,y2,color=LINE,width=1):
 c.setStrokeColor(HexColor(color)); c.setLineWidth(width);c.line(x1,H-y1,x2,H-y2)
def arrow(x1,y1,x2,y2,color=TEAL):
 line(x1,y1,x2,y2,color,1.6)
 import math
 a=math.atan2(y2-y1,x2-x1)
 p=c.beginPath();p.moveTo(x2,H-y2)
 for d in (-.45,.45):p.lineTo(x2-7*math.cos(a+d),H-(y2-7*math.sin(a+d)))
 p.close();c.setFillColor(HexColor(color));c.drawPath(p,fill=1,stroke=0)
def page(n,title,sub,source):
 rect(0,0,W,H,BG,0);rect(0,0,W,9,TEAL,0)
 txt(38,26,'WIN-WIN / 模型 v2 / 2.0 / 2026.10.14',10,TEAL,True)
 txt(38,53,title,27,NAVY,True);txt(38,94,sub,11,MUTED)
 line(38,H-41,W-38,H-41)
 txt(38,H-31,'來源：投資模型規格_v2.md · '+source,8.5,MUTED)
 txt(W-162,H-31,'審閱草案  /  %02d'%n,9,MUTED)
def end():c.showPage()
def label(x,y,s,color=TEAL):txt(x,y,s,11,color,True)
def card(x,y,w,h,title,body,color=TEAL):
 rect(x,y,w,h);rect(x,y,4,h,color,0);txt(x+16,y+13,title,14,color,True);para(x+16,y+40,body,w-32,11)
# 1
page(1,'五階段流程：前日準備，當日決策及交易','美股 Renko 日內交易 · 香港繁體中文審閱版 · 金額以美元計','§1–6')
rect(38,126,766,58,NAVY);txt(54,137,'v2 狀態：策略理解已校正，部分算法仍待定',16,WHITE,True)
txt(54,162,'依更新規格重整；尚未有程式、行情回測、盈利證明或可修改參數的介面。',10,'#C9DEE3')
steps=[('01','篩選股票池','過去20日平均\n四項條件'),('02','分時段揀股','前日 AM／PM\n各取 RR 最高10隻'),('03','配注及組合值','最接近 US$1,000\n分別計 AM／PM RR'),('04','整段交易開關','當日30分鐘觀察\n對比前日完整時段'),('05','逐股事件交易','首事件才入市\n同向持有、反向反手')]
for i,(num,title,body) in enumerate(steps):
 x=38+i*156;rect(x,203,142,131);txt(x+13,212,num,23,TEAL,True);txt(x+13,248,title,14,NAVY,True);para(x+13,277,body,118,10.5)
 if i<4:arrow(x+144,266,x+154,266)
label(38,351,'階段一：四項門檻均採過去20日平均')
items=[('> US$20億','平均每日市值'),('> 1,000萬股','平均每日成交股數'),('> 1.5%','平均每日波幅'),('US$20-1,000','平均股價範圍')]
for i,(big,small) in enumerate(items):
 x=38+i*195;rect(x,378,181,76,'#E6F0F0');txt(x+13,389,big,17,TEAL,True);txt(x+13,423,small,10,MUTED)
para(38,471,'股票池以會議所述 IB 平台為起點，按上下文理解為 Interactive Brokers；實際證券範圍待核實。20日的曆法、平均股價取樣及 high－low 波幅百分比的分母仍未定義。',758,11)
end()
# 2
page(2,'兩種 RR：揀股用個股值，開關用組合值','RR 表示事件數與反向次數的比值；並非勝率或盈利預測。','§3–4')
card(38,132,365,122,'個股 RR＝B ÷（R＋k）','現行理解 k＝10；會議要求另比較 k＝1。\nB：達到價格變動門檻的上／下行事件數。\nR：升轉跌或跌轉升次數。')
card(421,132,383,122,'組合 OverallRR＝ΣB ÷ ΣR','先加總候選股的 B、R，再相除。\n不平均個股 RR，不加10、1或候選數 n。\nΣR＝0：記錄 null／zero_denominator；處理待定。')
label(38,274,'人工計數例子：k 改變可能令排名倒轉（非行情結果）')
xs=[38,241,421,614];ww=[191,168,181,190]
for x,w,t in zip(xs,ww,['假設股票／事件數','k＝1 的個股 RR','k＝10 的個股 RR','排名結果']):
 rect(x,303,w,35,NAVY,5);txt(x+11,313,t,11,WHITE,True)
for j,row in enumerate([['A：B＝20，R＝0','20 ÷ 1＝20','20 ÷ 10＝2','k＝1：A 排先'],['B：B＝40，R＝2','40 ÷ 3≈13.33','40 ÷ 12≈3.33','k＝10：B 排先']]):
 for i,t in enumerate(row):
  rect(xs[i],348+j*52,ww[i],42,WHITE,5);txt(xs[i]+11,360+j*52,t,11,TEAL if i==3 else INK,i==3)
rect(38,462,766,70,'#E6F0F0');txt(54,472,'Renko 起始門檻 0.5%；一分鐘取樣一次',15,TEAL,True)
para(54,499,'例：開市參考價 US$100 → 固定美元門檻 US$0.50。美元／百分比模式均須提供；參考時段、價格取樣、後續錨點、多門檻計數及百分比累積方式待定。',730,10.5)
end()
# 3
page(3,'時間與開關：30分鐘觀察，對比前日完整時段','所有鐘數均為紐約時間；前日 AM、PM 各有獨立候選名單及組合基準。','§3–5')
xs=[38,135,328,516,655];ww=[85,181,176,127,149]
for x,w,t in zip(xs,ww,['名單','前日評分／RR基準','當日觀察','記錄初始價','終點清倉']):
 rect(x,135,w,35,NAVY,5);txt(x+9,145,t,10.5,WHITE,True)
for j,row in enumerate([['AM','09:30-12:30','09:30-10:00','10:00','12:30'],['PM','12:30-16:00','12:30-13:00','13:00','16:00']]):
 for i,t in enumerate(row):
  rect(xs[i],180+j*55,ww[i],44,WHITE,5);txt(xs[i]+10,193+j*55,t,11,TEAL if i==0 else INK,i==0)
label(38,300,'每份名單取前日 RR 最高10隻；數量 N 及時段可修改')
for i,(sym,title,body,col) in enumerate([('>','啟用整個時段','當日 OverallRR 高於前日\n整份名單進入逐股監察',TEAL),('<','跳過整個時段','當日 OverallRR 低於前日\n整份名單不交易',RED),('＝','規則待定','相等、零分母或缺資料\n無法形成完整決策',GOLD)]):
 x=38+i*260;rect(x,330,246,117,WHITE);txt(x+14,340,sym,26,col,True);txt(x+57,348,title,16,col,True);para(x+14,388,body,216,11)
rect(38,465,766,67,NAVY);txt(54,475,'通過開關 ≠ 立即買齊10隻；沒有首事件的股票繼續空倉',15,WHITE,True)
para(54,503,'Stage 4 可保留／刪除作比較；刪除開關仍須等待 Stage 5 首事件。觀察門檻的參考價待定，不可用觀察結束後才知道的初始價回算觀察窗口。',730,10.5,'#D4E5E8')
end()
# 4
page(4,'配注：整股總金額盡量接近目標','T＝每股目標金額，起點 US$1,000；P＝準備階段參考價，取價及更新時點待定。','§4、§6–8')
rect(38,132,766,64,NAVY);txt(54,143,'q＝使 | q × P－T | 最小的正整數股數',19,WHITE,True)
txt(54,173,'通常比較 floor（T/P）及 ceil（T/P）的正整數；容許略高於目標，等距處理待定。',10.5,'#D4E5E8')
for i,(p,calc,body) in enumerate([('P＝US$335','3股＝US$1,005','差 US$5；比2股 US$670更接近'),('P＝US$900','1股＝US$900','差 US$100；比2股更接近'),('P＝US$100','10股＝US$1,000','剛好達到目標金額')]):
 x=38+i*260;rect(x,218,246,109,WHITE);txt(x+14,230,p,14,TEAL,True);txt(x+14,260,calc,18,NAVY,True);para(x+14,295,body,219,10)
label(38,348,'三個不同參數，必須分開設定')
for i,(big,title,body) in enumerate([('T','配注金額','US$1,000 起點\n決定目標名義金額'),('k','個股 RR 分母常數','現行10；比較1\n影響揀股排名'),('h','反向事件確認次數','預設1；比較2及3\n影響持倉後反手確認')]):
 x=38+i*260;rect(x,374,246,98,'#E6F0F0');txt(x+14,383,big,25,TEAL,True);txt(x+52,390,title,13,NAVY,True);para(x+14,427,body,216,10)
para(38,489,'Stage 1-3 在前日準備；股數是否在當日或反手時重算，未有定義。券商購買力、可借股及費用仍須核對；舊版數值風控只屬可選建議，v2 核心沒有啟用。',758,10.5)
end()
# 5
page(5,'交易狀態：先等首事件，再順勢持有及反手','通過開關後，AM 10:00／PM 13:00 記錄 initial price；記價時不立即建倉。','§6')
label(38,130,'h＝1 預設動作示意｜上行買入，下行沽空')
rect(38,155,766,148,WHITE)
seq=[('記初始價','空倉監察',NAVY),('首事件升','買入長倉',GREEN),('同向事件','持有，不加注',GREEN),('反向事件','先平，再開淡倉',RED),('同向事件','持有淡倉',RED),('時段尾','全部平倉',NAVY)]
for i,(s,b,col) in enumerate(seq):
 x=51+i*125;rect(x,175,111,43,col,6);txt(x+9,188,s,12,WHITE,True);para(x+5,235,b,106,10,INK)
 if i<5:arrow(x+113,195,x+123,195)
para(54,269,'未達首事件門檻 → 整個時段不下單；首事件跌 → 開淡倉。淡倉遇升向反向事件 → 先買回平倉，再買入長倉。',730,10)
card(38,323,365,149,'反向確認 h：預設1，另比較2／3','h＝1：一次反向事件便平倉後反手。\nh > 1：較有支持的讀法是連續相反事件，\n等待時保持原倉；重設計數及錨點規則待定。\nh 不是最多反手次數，也不是兩磚生成門檻。')
card(421,323,383,149,'終點清倉：無須等待新事件','AM 12:30／PM 16:00 時段尾全部平倉。\n長倉賣出；淡倉買回。\n按當時可成交價執行；核對舊倉平倉、\n可借股及購買力後，才執行反手。')
rect(38,486,766,46,NAVY);para(54,497,'圖中只說明已確認的交易動作；後續 Renko 事件生成、分鐘價格取樣、下單延遲及成交模擬仍待定。區間門檻或「即刻」均不是保證成交價。',730,10.5,'#D4E5E8')
end()
# 6
page(6,'v2 審閱清單：先補定義，再驗證效果','已確認規則、上下文讀法與未定項目分開；不沿用舊版假設填補空白。','§7–9')
card(38,132,365,180,'本次圖解已更新的核心差異','市值：改為過去20日平均，非前日快照。\n個股 RR：改用 R＋10；另比較 R＋1。\n組合 RR：ΣB÷ΣR，不加平滑常數。\n配注：取最接近目標的整股數，非只向下取整。\n開關：當日30分鐘 vs 前日完整對應時段。\nh：反向確認次數；移除舊版3次反手上限。')
card(421,132,383,180,'實作前優先定義','後續 B／R 計數、價格採樣及事件錨點。\n觀察門檻基準、美元／百分比模式細則。\n20日曆法、波幅分母及平均股價取樣。\n組合零分母及開關相等時的處理。\n配注參考價、等距處理及更新時點。\nh > 1 的連續確認及重設計數規則。',GOLD)
label(38,332,'驗證次序：按 v2 核心逐項核對')
phases=[('01','定義事件答案','逐分鐘價格例子\n零分母／等號規則'),('02','核對揀股及配注','比較 k＝1／10名單\n核對最近目標股數'),('03','回放開關及交易','整段開關、首事件\n持倉、反手及清倉'),('04','評估淨結果','成交、成本、回撤\n現階段尚未測試')]
for i,(n,t,b) in enumerate(phases):
 x=38+i*195;rect(x,359,181,115,WHITE);txt(x+13,368,n,21,TEAL,True);txt(x+13,399,t,13,NAVY,True);para(x+13,430,b,155,10)
 if i<3:arrow(x+183,417,x+193,417)
para(38,492,'若另加止蝕、日損上限、持倉上限或提前清倉，須作獨立版本，與忠實核心版分開報告。所有可改輸入均須保存參數版本；目前核心邏輯尚未完整，未有收益證明。',758,10.5)
end()
c.save();print(OUT.resolve())
