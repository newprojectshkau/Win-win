// Source receipt; not an imported user comment, approval status, or cloud record.
export function pdfReviewStatus(){
 const rows=[
  ['第 5 頁','RR 分母一律加一','已落實：個股 B/(R+1)，組合 ΣB/(ΣR+1)。'],
  ['第 5 頁','Stage Four 組合比較','已保留同一可用股票名單；沿用前日完整 AM/PM 與當日 30 分鐘窗口。'],
  ['第 6 頁','入市／反手重算股數','已落實；同距取較少股數。同向持倉持續再平衡仍未啟用。'],
  ['第 6 頁','個股缺資料，不封鎖整段','已處理整段分鐘缺失；缺單根分鐘及持倉估值仍待定義，不回填或回溯刪交易。'],
  ['第 7 頁','訊號後成交時點','已落實 next-open；10:01 Bar 於 10:02 完成，可用 10:02 open，不再額外等待一分鐘。'],
  ['第 7 頁','測試如何設定滑價率','已新增相同資料／期間的滑價情景比較；報告損益、成本、收市回撤及拒絕入市。測試不等於找到最佳設定。'],
  ['第 7 頁','反手平舊倉，再檢查新入市','已新增可選追價上限；預設停用以保留原基準。價格保護不阻止風險平倉。'],
  ['第 8 頁','百分比固定基準／複利','已加入選項；固定基準於每個窗口重設，不隨每個事件改變磚幅。'],
  ['第 8 頁','Bar、H、自訂時段及排名配注','待定：目前每分鐘一決策、H=1、固定早午市；次分鐘需要真實細粒度資料。'],
  ['第 9 頁','先定稿、修正、再比較研究','已有版本、驗收測試與研究匯出；未進行新的真實市場績效驗證。']
 ];
 return `<section class="panel row-gap" id="pdf-comments"><div class="panel-head"><h2>PDF 批註處理狀態</h2><span class="badge neutral">2026-11-25 核對</span></div><div class="panel-body"><p>已收到 G3_Meeting_Deck_HK_Chinese.pdf（10 頁）。第 5–9 頁紅色批註與較早的五頁回覆一致；此處記錄處理進度，不會改寫你的本機或團隊審閱狀態。</p><div class="table-wrap"><table><thead><tr><th>來源頁</th><th>批註／方向</th><th>系統處理</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div><a href="./discussion.html" target="_blank" rel="noopener">開啟待討論事項 →</a> · <a href="./simulator.html#execution-research">前往滑價及追價研究 →</a><p class="subtitle">Demo 留言同步的正式後端仍未設定；本頁追蹤表不是已同步的團隊留言。</p></div></section>`;
}
