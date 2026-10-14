from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4, landscape
from pathlib import Path
pdfmetrics.registerFont(TTFont('HK','/System/Library/Fonts/STHeiti Light.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('HKB','/System/Library/Fonts/STHeiti Medium.ttc',subfontIndex=0))
OUT=Path('output/pdf/美股投資及交易模型_圖解審閱版.pdf')
W,H=landscape(A4)
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('美股投資及交易模型｜圖解審閱版'); c.setAuthor('Win-win')
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
 txt(38,26,'WIN-WIN / 模型 1.0 / 2026.10.14',10,TEAL,True)
 txt(38,53,title,27,NAVY,True);txt(38,94,sub,11,MUTED)
 line(38,H-41,W-38,H-41)
 txt(38,H-31,'來源：投資模型規格.md · '+source,8.5,MUTED)
 txt(W-162,H-31,'審閱草案  /  %02d'%n,9,MUTED)
def end():c.showPage()
def label(x,y,s,color=TEAL):txt(x,y,s,11,color,True)
def card(x,y,w,h,title,body,color=TEAL):
 rect(x,y,w,h);rect(x,y,4,h,color,0);txt(x+16,y+13,title,14,color,True);para(x+16,y+40,body,w-32,11)
# 1
page(1,'由揀股到清倉：五個決策關口','美股日內趨勢交易 · 每個時段獨立評估 · 金額以美元計', '§1、§3–7、§11')
rect(38,126,766,50,NAVY);txt(54,137,'策略狀態：模型設計已整理，盈利能力仍待驗證',16,WHITE,True)
txt(54,159,'現有文件沒有歷史損益、勝率或回撤實測；本圖解並非已驗證的交易結果。',10,'#C9DEE3')
steps=[('01','篩選股票池','20個已完成交易日\n檢查流動性及波幅'),('02','分時段揀股','前日 AM／PM 評分\n各取最多10隻'),('03','配置資金','目標每倉 US$1,000\n受風險及股數限制'),('04','決定是否入市','觀察30分鐘\n比較兩日組合 RR'),('05','持倉及反手','首磚決定方向\n同向持有、反向先平')]
for i,(num,title,body) in enumerate(steps):
 x=38+i*156
 rect(x,201,142,135);txt(x+13,211,num,23,TEAL,True);txt(x+13,248,title,15,NAVY,True);para(x+13,277,body,118,10.5)
 if i<4:arrow(x+144,266,x+154,266)
label(38,357,'股票池門檻：全部符合才納入')
items=[('> US$20億','前日最新已知市值'),('> 1,000萬股','20日平均每日成交量'),('> 1.5%','20日平均每日高低幅度'),('US$20–1,000','20日平均及前日收市價')]
for i,(big,small) in enumerate(items):
 x=38+i*195;rect(x,383,181,77,'#E6F0F0');txt(x+13,396,big,17,TEAL,True);txt(x+13,429,small,10,MUTED)
para(38,477,'幅度＝（當日最高價－最低價）÷前一日收市價，再取20日平均。另須符合普通股類型、資料完整及事件處理要求；不足10隻不放寬門檻湊數。',758,11)
end()
# 2
page(2,'Renko 與 RR：用磚塊看走勢持續度','RR 代表走勢持續度；不代表風險回報比、勝率或預期盈利。','§4')
card(38,132,365,95,'每日固定磚塊 b','b＝前收市價 × 0.5%，向上取整至最小價格跳動。\n示意：前收 US$50、tick US$0.01 → b＝US$0.25。')
card(421,132,383,95,'主版本：一磚反向','完整分鐘收市價達到 c＋b 或 c－b 才確認。\n每個窗口重設錨點；磚塊大小當日不變。')
label(38,246,'算法示意：相同磚塊數，方向反覆較少 → RR 較高')
def bricks(x,y,dirs):
 level=0
 for i,d in enumerate(dirs):
  nextlevel=level+d; yy=y-max(level,nextlevel)*25
  rect(x+i*30,yy,26,25,GREEN if d>0 else RED,3)
  txt(x+i*30+6,yy+3,'升' if d>0 else '跌',10,WHITE,True);level=nextlevel
rect(38,272,365,194);rect(421,272,383,194)
txt(54,285,'A  持續向上',15,GREEN,True);bricks(65,450,[1]*6)
txt(258,318,'B＝6',13,INK,True);txt(258,341,'R＝0',13,INK,True);txt(258,369,'RR＝6',18,TEAL,True)
txt(437,285,'B  有兩次反向',15,RED,True);bricks(447,421,[1,1,1,-1,-1,1])
txt(681,318,'B＝6',13,INK,True);txt(681,341,'R＝2',13,INK,True);txt(681,369,'RR＝2',18,TEAL,True)
rect(38,480,766,52,NAVY);txt(54,491,'RR＝B ÷（1＋R）',18,WHITE,True);txt(326,496,'B：確認磚塊總數   R：方向轉換次數（第一磚不計）',11,'#D4E5E8')
end()
#3
page(3,'交易時間與入市開關','所有時間均為紐約時間；香港介面按時區及夏令時間自動換算。','§2.1、§4.3、§6')
# timelines fixed columns
xs=[38,143,304,469,635]; widths=[93,149,153,154,169]
heads=['時段','觀察 / 決定開關','接受新訊號','預定開始清倉','絕對終點']
for x,w,h in zip(xs,widths,heads):rect(x,134,w,34,NAVY,5);txt(x+10,143,h,10,WHITE,True)
rows=[['AM','09:30–10:00','10:00 至 12:20 前','12:25','12:30'],['PM','12:30–13:00','13:00 至 15:50 前','15:55','16:00']]
for j,row in enumerate(rows):
 for i,s in enumerate(row):rect(xs[i],178+j*56,widths[i],46,WHITE,5);txt(xs[i]+10,190+j*56,s,11,TEAL if i==0 else INK,i==0)
label(38,303,'開關：同一批候選股、同一30分鐘窗口、同一算法')
rect(38,329,325,107,WHITE);txt(54,342,'BasketRR＝ΣB ÷（n＋ΣR）',16,TEAL,True)
para(54,374,'當日 BasketRR ≥ 前日 BasketRR → 通過。\n不取個股 RR 的簡單平均。',290,11)
arrow(372,382,395,382)
card(407,329,397,107,'先檢查資料及最低樣本','候選數 n > 0；兩日各須 ΣB ≥ 2n；\n當日每隻 B ≥ 1；兩日觀察窗口完整。')
rect(38,449,766,83,'#E6F0F0');txt(54,460,'通過 → 等待首個交易磚塊；不通過 → 跳過該時段',15,TEAL,True)
para(54,488,'AM、PM 開關各決定一次；上午觸發全日損失停機，下午不可重啟。半日市只運行 AM，於實際收市前5分鐘或12:25兩者較早者開始清倉。',730,10.5)
end()
#4
page(4,'注碼與風控：先定風險，再定股數','US$1,000 是每倉目標名義金額；不是本金，也不是可承受損失。','§5、§7.1、§8')
card(38,132,365,176,'股數 q＝各項上限中的最小值','名義金額：floor（1,000 ÷ 預計成交價 P）\n風險股數：floor［0.1% E0 ÷（2b＋每股來回成本）］\n單股上限：floor（10% E0 ÷ P）\n流動性：floor（最新完整分鐘成交量 × 1%）\n再受券商購買力、沽空可借量限制；q < 1 不交易。')
card(421,132,383,176,'計法示意｜只展示名義金額上限','假設 P＝US$50；b＝US$0.25\nUS$1,000 ÷ US$50＝20股\n緊急止蝕距離 2b＝US$0.50\n20股 × US$0.50＝US$10 價格風險，另加成本\n實際股數須再檢查所有上限，可能少於20股。')
label(38,329,'組合風控儀表板｜全部為待驗證的研究起點')
risk=[('5隻','同時持倉上限'),('50% E0','總名義敞口上限'),('20% E0','每個行業敞口上限'),('0.5% E0','總預算止蝕風險'),('-1% E0','全日損失停機'),('3次','每股每時段反手上限')]
for i,(v,s) in enumerate(risk):
 x=38+(i%3)*260;y=355+(i//3)*74
 rect(x,y,246,63,'#E6F0F0' if i!=4 else '#F7E9E6');txt(x+14,y+8,v,20,TEAL if i!=4 else RED,True);txt(x+14,y+38,s,10.5,MUTED)
para(38,510,'E0＝當日開始時賬戶淨值。日損包括淨已實現及按可平倉價計未實現損益；止蝕是觸發規則，跳空、停牌及滑價可令損失超過預算。',760,10.5)
end()
#5
page(5,'買賣動作：首磚入市，同向持有，反向先平','每個交易窗口重新建立價格錨點；分鐘完結確認訊號後，才可提交訂單。','§4.2、§7–8')
# illustrated sequence
label(38,130,'示意交易路徑｜只說明狀態，並非歷史盈利曲線')
rect(38,153,766,153,WHITE)
seq=[('首磚升','買入長倉',GREEN),('繼續升','持有，不加注',GREEN),('轉跌','先賣出平倉',RED),('平倉確認','重檢後沽空',RED),('繼續跌','持有淡倉',RED),('到清倉時間','買回平倉',NAVY)]
for i,(s,b,col) in enumerate(seq):
 x=51+i*125;rect(x,174,111,43,col,6);txt(x+9,187,s,12,WHITE,True);para(x+6,233,b,105,10.5,INK)
 if i<5:arrow(x+113,194,x+123,194)
para(54,270,'首磚跌：通過借貨及風險檢查後開淡倉；不能沽空則留空倉，後續升磚可再檢查買入資格。',730,10)
card(38,324,365,145,'反手必須分兩步','① 先平舊倉，核對券商實際倉位已清零。\n② 重算股數、成本、借貨及風險，再開新方向。\n部分成交、拒單或借貨不足 → 不開新方向。\n反手達3次後，再反向只平倉並鎖定該股。')
card(421,324,383,145,'退出規則優先於新訊號','先處理已生效止蝕／全日停機，再處理時間清倉。\n長倉緊急止蝕：實際成交均價－2b\n淡倉緊急止蝕：實際成交均價＋2b\n緊急止蝕後該股該時段停用，不立即反手。',RED)
rect(38,483,766,49,NAVY);para(54,494,'磚塊價是訊號水平，並非成交價。回測採下一分鐘開市價加不利成本；實盤採訊號後報價及成交紀錄。反向平倉可能鎖定盈利，兩筆反手成交均須計費。',730,10.5,'#E5EFF1')
end()
#6
page(6,'審閱重點：由設計走向可驗證的交易系統','下一步先做歷史回放及模擬交易；啟用實盤前須完成驗收及賬戶設定。','§8–11；本圖解依據模型 v1.0')
label(38,130,'驗證路線｜每一關都需要證據')
phases=[('01','核對算法','人工價格序列\n測試反向、止蝕、缺失'),('02','歷史回測','至少12個月資料起步\n按時間分訓練及驗證'),('03','樣本外驗收','最後封存期間\n扣成本檢驗淨結果'),('04','模擬交易','至少30個交易日起步\n核對訊號及真實成交')]
for i,(n,t,b) in enumerate(phases):
 x=38+i*195;rect(x,157,181,128,WHITE);txt(x+13,168,n,21,TEAL,True);txt(x+13,201,t,15,NAVY,True);para(x+13,235,b,156,10)
 if i<3:arrow(x+183,221,x+193,221)
card(38,306,365,143,'三組核心對照','RR 揀股：高 RR 名單 vs 固定／隨機名單\n交易開關：啟用 vs 關閉\n反手規則：即時反手 vs 只平倉後等待新訊號\n另測成本2倍／3倍、延遲及借貨限制。')
card(421,306,383,143,'審閱時要決定的設定','賬戶本金 E0 及最大可接受回撤\n券商、賬戶類型、購買力及沽空條件\n行情、報價、歷史借貨及實際費用來源\n保留原模型參數，改動須另立版本。')
rect(38,465,766,67,'#E6F0F0');txt(54,476,'驗收看淨損益及回撤，也看每筆淨期望值、成本與成交能力',14,TEAL,True)
para(54,503,'結果須分 AM／PM、長／淡及市況呈報，列出樣本數與不確定性。本圖所有計法例子均為示意；未新增行情數據或收益預測。',730,10.5)
end()
c.save();print(OUT.resolve())
