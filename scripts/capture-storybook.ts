/**
 * Storybook에 그려진 실제 컴포넌트를 상태별로 읽어 Figma 컴포넌트 정의로 만든다(#111).
 * 이미지가 아니라 구조(요소 트리)·계산된 스타일·아이콘 SVG를 읽고, 값은 같은 값의 역할 변수(milvus 컬렉션)로 대응시킨다.
 *
 *   대상   컴포넌트/기본/*(SLDS 기본 컴포넌트), 컴포넌트/밀버스 추가/*(밀버스 컴포넌트). 컴포넌트마다 대표 스토리 하나
 *   브랜드 스토리 URL의 globals=brand:<브랜드>로 Storybook 브랜드 툴바와 같은 hook(팔레트·util.css)을 적용한 화면을 읽는다
 *   변형   스토리 안의 lightning-*·c-milvus-* 요소 하나하나. 이름은 variant·label 속성
 *   상태   Default, Hover, Pressed, Focus는 Chrome이 의사 클래스를 강제하고, Disabled는 disabled 속성을 켜고 읽는다.
 *          누를 요소(button·input·a 등)가 없는 컴포넌트는 Default만 있고 "상태 없음(의도)"으로 남긴다
 *
 * 출력: figma-plugin/captures/<브랜드>.json. pnpm figma --brand <브랜드>가 figma-data.json에 넣고, 플러그인이 컴포넌트 세트로 만든다.
 * 사용: pnpm build-storybook 뒤 node scripts/capture-storybook.ts [--brand Milvus_DesignSystem] [--only Button,Badge]
 * 필요: Google Chrome(데스크톱 앱). 새 의존성 없이 Node 내장 http·WebSocket으로 Chrome 원격 디버깅 프로토콜을 쓴다
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigmaData, mapCaptureValues, type CaptureNode } from "../lib/figma-data.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC = join(root, "storybook-static");
const OUT = join(root, "figma-plugin/captures");
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const BRAND = arg("brand") ?? "Milvus_DesignSystem";
const ONLY = arg("only")?.split(",");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const STATES = ["Default", "Hover", "Pressed", "Focus", "Disabled"] as const;
const PSEUDO: Record<string, string[]> = { Hover: ["hover"], Pressed: ["hover", "active"], Focus: ["focus", "focus-visible", "focus-within"] };
if (!existsSync(join(STATIC, "index.json"))) throw new Error("storybook-static이 없습니다. pnpm build-storybook을 먼저 실행하세요");
if (!existsSync(CHROME)) throw new Error(`Chrome을 찾지 못했습니다: ${CHROME}. CHROME 환경 변수로 경로를 주세요`);

// 컴포넌트마다 대표 스토리 하나: 변형을 모아 보여 주는 스토리(모음) → basic·기본 → 소스가 아닌 첫 스토리
type Entry = { type: string; id: string; title: string; name: string };
const GROUPS = { "컴포넌트/기본/": "slds", "컴포넌트/밀버스 추가/": "milvus" } as const;
const stories = Object.values(JSON.parse(readFileSync(join(STATIC, "index.json"), "utf8")).entries as Record<string, Entry>).filter(
  (e) => e.type === "story" && Object.keys(GROUPS).some((g) => e.title.startsWith(g)),
);
const byTitle = new Map<string, Entry[]>();
for (const s of stories) byTitle.set(s.title, [...(byTitle.get(s.title) ?? []), s]);
const kebab = (s: string) => s.trim().replace(/\s+/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
const picks = [...byTitle.entries()]
  .map(([title, list]) => {
    const group = Object.entries(GROUPS).find(([g]) => title.startsWith(g))![1];
    const name = title.split("/").pop()!;
    return {
      group,
      name,
      tag: group === "slds" ? `lightning-${kebab(name)}` : `c-milvus-${kebab(name)}`,
      story: list.find((s) => /모음/.test(s.name)) ?? list.find((s) => /^(basic|base|기본)$/i.test(s.name)) ?? list.find((s) => !/(source|소스|원본)/i.test(s.name)) ?? list[0],
    };
  })
  .filter((p) => !ONLY || ONLY.includes(p.name));

// 페이지 안에서 실행하는 읽기 함수. shadow DOM과 slot을 따라가며 화면에 보이는 요소만 트리로 만든다
const PAGE_LIB = String.raw`
window.__mv = window.__mv || (() => {
  const deep = (root, sel) => { const out = []; const visit = (n) => { if (n.matches && n.matches(sel)) out.push(n); if (n.shadowRoot) [...n.shadowRoot.children].forEach(visit); [...n.children].forEach(visit); }; visit(root); return out; };
  const kids = (el) => {
    const list = el.shadowRoot ? [...el.shadowRoot.childNodes] : [...el.childNodes];
    return list.flatMap((n) => n.nodeName === 'SLOT' ? n.assignedNodes({ flatten: true }) : (n.nodeType === 1 && n.nodeName !== 'svg' && getComputedStyle(n).display === 'contents' ? kids(n) : [n]));
  };
  const px = (v) => Math.round(parseFloat(v) || 0);
  let count = 0;
  const node = (el, origin) => {
    if (count++ > 400) return null;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || (r.width <= 1 && r.height <= 1) || /^rect\(0px,? 0px/.test(cs.clip) || cs.clipPath === 'inset(50%)' || /* 화면 낭독기용 숨김 글자(slds-assistive-text) */ el.tagName === 'STYLE' || el.tagName === 'SCRIPT') return null;
    const base = { tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '', x: Math.round(r.left - origin.left), y: Math.round(r.top - origin.top), w: Math.round(r.width), h: Math.round(r.height), opacity: parseFloat(cs.opacity), abs: cs.position === 'absolute' || cs.position === 'fixed' };
    if (el.tagName === 'IMG') { // 화면에 그려진 그대로 PNG 로. 다른 출처 이미지라 못 뜨면 빈 자리만 남긴다
      let png = '';
      try { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(r.width * 2)); c.height = Math.max(1, Math.round(r.height * 2)); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); png = c.toDataURL('image/png').split(',')[1]; } catch (e) {}
      return { ...base, type: 'image', png, radius: px(cs.borderTopLeftRadius) };
    }
    if (el.tagName.toLowerCase() === 'svg') {
      const clone = el.cloneNode(true); clone.setAttribute('width', r.width); clone.setAttribute('height', r.height);
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      return { ...base, type: 'svg', svg: clone.outerHTML, color: cs.fill && cs.fill !== 'none' && !cs.fill.startsWith('url') ? cs.fill : cs.color };
    }
    const text = { color: cs.color, fontSize: px(cs.fontSize), fontWeight: parseInt(cs.fontWeight), lineHeight: cs.lineHeight === 'normal' ? 0 : px(cs.lineHeight) };
    const children = [];
    for (const k of kids(el)) {
      if (k.nodeType === 3) { const t = k.textContent.replace(/\s+/g, ' ').trim(); if (t) children.push({ type: 'text', chars: t, ...text }); }
      else if (k.nodeType === 1) { const c = node(k, origin); if (c) children.push(c); }
    }
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'checkbox' && el.type !== 'radio') {
      const t = el.value || el.placeholder;
      if (t) children.push({ type: 'text', chars: t, ...text, color: el.value ? cs.color : getComputedStyle(el, '::placeholder').color });
    }
    return {
      ...base, type: 'frame', children,
      display: cs.display, dir: cs.flexDirection, wrap: cs.flexWrap, align: cs.alignItems, justify: cs.justifyContent,
      gap: px(cs.columnGap === 'normal' ? 0 : cs.columnGap),
      pad: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
      bg: cs.backgroundColor, border: { width: cs.borderTopStyle === 'none' ? 0 : px(cs.borderTopWidth), color: cs.borderTopColor },
      radius: px(cs.borderTopLeftRadius), shadow: cs.boxShadow === 'none' ? '' : cs.boxShadow, clip: cs.overflow !== 'visible' || cs.overflowX !== 'visible',
    };
  };
  // 같은 태그가 다른 같은 태그 안에 있으면 바깥 것만(예: button-group 안의 button)
  const hosts = (tag) => deep(document.body, tag).filter((h, i, all) => !all.some((o) => o !== h && (o.contains(h) || (o.shadowRoot && o.shadowRoot.contains(h)))));
  const interactive = (h) => deep(h, 'button, input, textarea, select, a[href], [role="button"], [role="option"], [role="tab"], [tabindex="0"]')[0] || null;
  // LWC 는 속성을 attribute 가 아니라 property 로 받는다. 코드(LWC html)의 속성과 변형을 맞추려고 문자열 property 를 남긴다(#112)
  const PROPS = ['variant', 'type', 'size', 'iconName', 'iconPosition', 'label', 'title', 'name', 'state', 'alternativeText', 'placeholder', 'message', 'value'];
  const attrs = (h) => Object.fromEntries(PROPS.map((k) => [k, h[k] ?? h.getAttribute(k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()))]).filter(([, v]) => typeof v === 'string' && v));
  const label = (h, i) => { const a = attrs(h); return a.variant || a.type || a.iconName || a.label || a.name || String(i + 1); };
  const snap = (h) => { count = 0; return node(h, h.getBoundingClientRect()); };
  return { hosts, interactive, label, attrs, snap };
})();
`;

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
  const file = join(STATIC, path === "/" ? "index.html" : path);
  if (!file.startsWith(STATIC) || !existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

// 변수 대응 기준: 이 브랜드의 역할 변수 값(figma-data와 같은 함수)
const theme = JSON.parse(readFileSync(join(root, "brands", BRAND, "theme.json"), "utf8"));
const util = join(root, "brands", BRAND, "util.css");
const { data } = buildFigmaData({ pkgRoot: root, name: BRAND, brandColor: theme.brandColor, brandPalette: theme.palette, utilCss: existsSync(util) ? readFileSync(util, "utf8") : undefined });

const profile = mkdtempSync(join(tmpdir(), "milvus-capture-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
try {
  let page: { webSocketDebuggerUrl: string } | undefined;
  for (let i = 0; i < 50 && !page; i++) {
    await new Promise((r) => setTimeout(r, 200));
    page = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l: { type: string; webSocketDebuggerUrl: string }[]) => l.find((t) => t.type === "page")).catch(() => undefined);
  }
  if (!page) throw new Error("Chrome 원격 디버깅에 연결하지 못했습니다");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const waiting = new Map<number, (v: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id) waiting.get(m.id)?.(m);
  };
  const cdp = <T = Record<string, unknown>>(method: string, params = {}) =>
    new Promise<T>((ok, fail) => {
      const id = ++seq;
      waiting.set(id, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok((m.result ?? {}) as T)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async <T>(expression: string): Promise<T> => {
    const r = await cdp<{ result: { value?: T }; exceptionDetails?: { text: string; exception?: { description?: string } } }>("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value as T;
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("DOM.enable");
  await cdp("CSS.enable");

  mkdirSync(OUT, { recursive: true });
  type Captured = { group: string; name: string; tag: string; story: string; brand: string; interactive: boolean; variants: { name: string; attrs?: Record<string, string>; states: Record<string, CaptureNode> }[] };
  const out: Captured[] = [];
  for (const p of picks) {
    await cdp("Page.navigate", { url: `${base}/iframe.html?id=${encodeURIComponent(p.story.id)}&viewMode=story&globals=brand:${encodeURIComponent(BRAND)}` });
    // LWC가 그려질 때까지: 대상 요소가 생기고 크기가 0.5초 동안 그대로면. 10초가 지나면 있는 대로
    let n = 0;
    for (let i = 0, last = ""; i < 40; i++) {
      await sleep(250);
      const sig = await ev<string>(`(() => { ${PAGE_LIB}; const h = __mv.hosts(${JSON.stringify(p.tag)}); return h.length + ':' + h.map((x) => { const r = x.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }).join(','); })()`).catch(() => "");
      n = parseInt(sig) || 0;
      if (n && sig === last && i > 3) break;
      last = sig;
    }
    if (!n) {
      console.warn(`! ${p.name}: ${p.tag}를 찾지 못해 건너뜀 (${p.story.id})`);
      continue;
    }
    await ev(`(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}'; document.head.appendChild(s); return true; })()`);
    const brand = await ev<string>("document.documentElement.dataset.milvusBrand || ''");
    // DOM 에이전트가 shadow DOM 안의 노드까지 알아야 forcePseudoState가 그 노드를 찾는다
    await cdp("DOM.getDocument", { depth: -1, pierce: true });
    const variants: Captured["variants"] = [];
    let interactive = false;
    for (let i = 0; i < Math.min(n, 12); i++) {
      const pick = `__mv.hosts(${JSON.stringify(p.tag)})[${i}]`;
      const states: Record<string, CaptureNode> = {};
      const def = await ev<CaptureNode | null>(`__mv.snap(${pick})`);
      if (!def) continue;
      states.Default = def;
      const target = await cdp<{ result: { objectId?: string; subtype?: string } }>("Runtime.evaluate", { expression: `__mv.interactive(${pick})` });
      if (target.result.objectId && target.result.subtype !== "null") {
        interactive = true;
        const { nodeId } = await cdp<{ nodeId: number }>("DOM.requestNode", { objectId: target.result.objectId });
        for (const [state, pseudo] of Object.entries(PSEUDO)) {
          await cdp("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: pseudo });
          await sleep(30);
          states[state] = (await ev<CaptureNode | null>(`__mv.snap(${pick})`)) ?? def;
        }
        await cdp("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
        const was = await ev<boolean>(`(() => { const h = ${pick}; const was = !!h.disabled; h.disabled = true; h.setAttribute('disabled', ''); return was; })()`);
        await sleep(150);
        states.Disabled = (await ev<CaptureNode | null>(`__mv.snap(${pick})`)) ?? def;
        if (!was) await ev(`(() => { const h = ${pick}; h.disabled = false; h.removeAttribute('disabled'); return true; })()`);
        await sleep(80);
      }
      variants.push({ name: await ev<string>(`__mv.label(${pick}, ${i})`), attrs: await ev<Record<string, string>>(`__mv.attrs(${pick})`), states });
    }
    if (!variants.length) {
      console.warn(`! ${p.name}: 화면에 보이는 ${p.tag}가 없어 건너뜀 (${p.story.id})`);
      continue;
    }
    for (const v of variants) for (const s of Object.values(v.states)) mapCaptureValues(s, data.tokens);
    out.push({ group: p.group, name: p.name, tag: p.tag, story: p.story.name, brand, interactive, variants });
    console.log(`${p.name}: 변형 ${variants.length} × 상태 ${interactive ? STATES.length : 1}${brand !== BRAND ? ` (! 브랜드 ${brand || "없음"})` : ""}`);
  }
  writeFileSync(join(OUT, `${BRAND}.json`), JSON.stringify({ brand: BRAND, capturedAt: new Date().toISOString(), components: out }) + "\n");
  console.log(`figma-plugin/captures/${BRAND}.json: ${out.length}/${picks.length}개, 브랜드 ${BRAND}`);
  ws.close();
} finally {
  chrome.kill();
  server.close();
  await new Promise((r) => setTimeout(r, 400));
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
