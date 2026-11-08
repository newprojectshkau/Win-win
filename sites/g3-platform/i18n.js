import {TRANSLATIONS} from './translations.js?v=20261108-upgrade';
let language='zh-HK';
try{language=localStorage.getItem('winwin-language')==='en'?'en':'zh-HK';}catch{}
const memory=new WeakMap(),reverse=new Map(),attrs=new WeakMap();
const entries=Object.entries(TRANSLATIONS).sort((a,b)=>b[0].length-a[0].length);
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp(entries.map(([zh])=>escaped(zh)).join('|'),'g');
export function translate(text){return TRANSLATIONS[text]??text.replace(pattern,s=>TRANSLATIONS[s]);}
function source(current,saved){return saved&&current===saved.output?saved.original:(reverse.get(current)??current);}
function apply(){
 observer.disconnect();
 document.documentElement.lang=language;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 for(let n;n=walker.nextNode();){
  if(n.parentElement?.closest('script,style,textarea,[data-no-translate],code,pre'))continue;
  const original=source(n.data,memory.get(n)),output=language==='en'?translate(original):original;
  memory.set(n,{original,output});if(output!==original)reverse.set(output,original);if(n.data!==output)n.data=output;
 }
 for(const node of document.querySelectorAll('[title],[aria-label],[placeholder]')){
  if(node.closest('[data-no-translate]'))continue;
  const saved=attrs.get(node)||{};
  for(const key of ['title','aria-label','placeholder'])if(node.hasAttribute(key)){
   const original=source(node.getAttribute(key),saved[key]),output=language==='en'?translate(original):original;
   saved[key]={original,output};if(output!==original)reverse.set(output,original);if(node.getAttribute(key)!==output)node.setAttribute(key,output);
  }
  attrs.set(node,saved);
 }
 for(const b of document.querySelectorAll('[data-language]'))b.setAttribute('aria-pressed',String(b.dataset.language===language));
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
}
const observer=new MutationObserver(()=>apply());
export function initLanguage(){
 const host=document.querySelector('.studio-header')||document.querySelector('header')||document.body;
 const bar=document.createElement('div');bar.className='language-switch';bar.dataset.noTranslate='';bar.setAttribute('aria-label','Language / 語言');
 bar.innerHTML='<button type="button" data-language="zh-HK" lang="zh-HK">繁體中文</button><button type="button" data-language="en" lang="en">English</button>';
 if(host===document.body)host.prepend(bar);else host.append(bar);bar.onclick=e=>{const button=e.target.closest('[data-language]');if(!button)return;language=button.dataset.language;try{localStorage.setItem('winwin-language',language);}catch{}apply();};apply();
}
initLanguage();
