/**
 * 📌 "B.Pick 담기" 즐겨찾기 버튼
 *
 * 쿠팡·네이버는 서버(클라우드플레어)에서 들어오는 접속을 막아서 "링크에서 가져오기"가 실패할 수 있어요.
 * 이 버튼은 관리자가 평소 쓰는 브라우저에서, 이미 열어 둔 상품 페이지의 대표 사진·이름을 읽어
 * 클립보드에 복사해요. 관리자 화면에서 Ctrl+V 하면 그대로 들어가요.
 */
export const IMPORT_PREFIX = 'BPICK1:';

export type Imported = { title: string; image: string; url: string };

const CODE = `(function(){
function m(n){var e=document.querySelector('meta[property="'+n+'"],meta[name="'+n+'"]');return e&&e.getAttribute('content')||''}
var i=m('og:image')||m('twitter:image');
if(i.indexOf('//')===0)i='https:'+i;
var t=m('og:title')||document.title||'';
if(!i&&!t){alert('이 페이지에서 상품 정보를 찾지 못했어요. 상품 페이지에서 눌러 주세요.');return}
var s='${IMPORT_PREFIX}'+JSON.stringify({t:t,i:i,u:location.href});
function done(){alert('📌 B.Partners Pick에 담았어요!\\n\\n'+t+'\\n\\n관리자 화면으로 돌아가서 Ctrl+V 를 누르세요.')}
function old(){var a=document.createElement('textarea');a.value=s;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}a.remove();if(ok)done();else prompt('아래 글자를 Ctrl+C 로 복사한 뒤, 관리자 화면에서 Ctrl+V 하세요.',s)}
if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(s).then(done,old)}else{old()}
})()`;

/** 즐겨찾기 줄에 끌어다 놓을 주소 */
export const BOOKMARKLET = 'javascript:' + encodeURIComponent(CODE.replace(/\n/g, ''));

/** 쇼핑몰 이름 꼬리 떼기: "상품명 - | 쿠팡" → "상품명" */
export function cleanTitle(t: string): string {
  return t
    .replace(/\s*\|\s*(쿠팡|coupang)!?\s*$/i, '')
    .replace(/[\s\-–:|]+$/, '')
    .trim()
    .slice(0, 200);
}

/** Ctrl+V 한 글자가 📌 버튼으로 담은 것인지 확인 */
export function parseImport(text: string): Imported | null {
  const s = text.trim();
  if (!s.startsWith(IMPORT_PREFIX)) return null;
  try {
    const d = JSON.parse(s.slice(IMPORT_PREFIX.length)) as { t?: unknown; i?: unknown; u?: unknown };
    const image = typeof d.i === 'string' && /^https?:\/\//i.test(d.i) ? d.i : '';
    return { title: cleanTitle(typeof d.t === 'string' ? d.t : ''), image, url: typeof d.u === 'string' ? d.u : '' };
  } catch {
    return null;
  }
}
