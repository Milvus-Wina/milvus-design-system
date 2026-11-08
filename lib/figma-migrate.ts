// 코드 → Figma 이관(#112). 프로젝트 LWC(.html·.css)와 FlexiPage XML을 렌더링하지 않고 정적으로 읽어,
// 플러그인이 컴포넌트 인스턴스·자동 레이아웃 프레임으로 조립할 트리(MNode)로 만든다.
// lightning-*·c-milvus-*는 초기 세팅에서 만든 Figma 컴포넌트 세트의 인스턴스, SLDS 클래스와 var(--slds-g-*)는 같은 이름 변수다.
import { hookToFigma, type CapturedComponent } from "./figma-data.ts";

// ---- 마크업(LWC html·FlexiPage XML) 읽기. LWC 템플릿은 컴파일러가 닫는 태그를 강제하므로 작은 토크나이저로 충분하다 ----
export type El = { tag: string; attrs: Record<string, string>; children: (El | string)[] };
const VOID = new Set(["input", "br", "img", "hr", "meta", "link", "area", "col", "source", "wbr"]);
const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

export function parseMarkup(src: string): El {
  const root: El = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  for (const m of src.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      const t = decode(m[5]).replace(/\s+/g, " ").trim();
      if (t) top.children.push(t);
    } else if (m[2] && m[1]) {
      const i = stack.map((e) => e.tag).lastIndexOf(m[2]);
      if (i > 0) stack.length = i; // 닫는 태그: 같은 이름이 열린 곳까지 닫는다
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of (m[3] ?? "").matchAll(ATTR)) attrs[a[1]] = decode(a[2] ?? a[3] ?? a[4] ?? "");
      const el: El = { tag: m[2], attrs, children: [] };
      top.children.push(el);
      if (!m[4] && !VOID.has(m[2].toLowerCase())) stack.push(el);
    }
  }
  return root;
}
const kids = (e: El) => e.children.filter((c): c is El => typeof c !== "string");
const find = (e: El, tag: string) => kids(e).find((c) => c.tag === tag);
const textOf = (e: El | undefined): string => (e ? e.children.map((c) => (typeof c === "string" ? c : textOf(c))).join("") : "");

// ---- 플러그인이 그릴 트리 ----
// 값은 Figma 변수 이름("spacing/4") 또는 숫자. 숫자는 변수가 없는 직접 값이고 literals로 센다
export type Val = string | number;
export type MNode =
  // texts: 캡처 예시 글자(from)를 코드 값(to)으로. fill: 캡처에서 폭을 꽉 채우던 컴포넌트(입력·알림 등)는 부모 폭에 맞춘다
  | { type: "instance"; section: string; set: string; variant: string; text?: string; texts?: { from: string; to: string }[]; fill?: boolean; name: string }
  | { type: "divider" }
  | { type: "project"; name: string; fill?: boolean }
  | { type: "placeholder"; label: string; width?: number }
  | { type: "text"; chars: string; size?: Val; bold?: boolean; color?: string }
  | {
      type: "frame";
      name: string;
      dir: "VERTICAL" | "HORIZONTAL";
      wrap?: boolean;
      width?: number;
      gap?: Val;
      pad?: [Val, Val, Val, Val];
      fill?: string;
      border?: string;
      radius?: Val;
      justify?: "MIN" | "CENTER" | "MAX";
      hidden?: boolean; // 조건부(lwc:if 등): 그리되 숨김 레이어로. 처음 화면에서 보일지는 코드만으로 모른다
      children: MNode[];
    };

// ---- CSS: SLDS 유틸리티 클래스와 컴포넌트 .css 의 단순 규칙(.클래스 하나, :host) ----
export type Rules = Map<string, Record<string, string>>;
export function parseRules(css: string): Rules {
  const rules: Rules = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decls: Record<string, string> = {};
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).replace(/!important/, "").trim();
    }
    for (const sel of m[1].split(",").map((s) => s.trim())) {
      const key = sel === ":host" ? ":host" : /^\.([\w-]+)$/.exec(sel)?.[1];
      if (key) rules.set(key, { ...rules.get(key), ...decls });
    }
  }
  return rules;
}

type Ctx = { captures: CapturedComponent[]; project: Set<string>; slds: Rules; own: Rules; literals: number; unknown: Set<string>; hidden: number };

/** CSS 값 → 변수 이름(var(--slds-g-*)·var(--token-*)) 또는 px 숫자. 못 읽으면 undefined */
function val(v: string | undefined, c: Ctx): Val | undefined {
  if (!v) return undefined;
  const hook = /^var\((--slds-g-[\w-]+)/.exec(v)?.[1];
  if (hook) return hookToFigma(hook) ?? (c.literals++, undefined);
  const token = /^var\(--token-([\w-]+)/.exec(v)?.[1]; // 토큰은 브랜드 util.css 값. Figma 에는 같은 역할 hook 변수만 있다
  if (token) return (c.unknown.add(`--token-${token}`), undefined);
  const px = /^(-?[\d.]+)(px|rem)$/.exec(v);
  if (px) return c.literals++, +px[1] * (px[2] === "rem" ? 16 : 1);
  if (v === "0") return 0;
  return undefined;
}
function styleOf(e: El, c: Ctx, host: boolean) {
  const classes = (e.attrs.class ?? "").split(/\s+/).filter(Boolean);
  const d: Record<string, string> = {};
  for (const cls of classes) Object.assign(d, c.slds.get(cls));
  if (host) Object.assign(d, c.own.get(":host"));
  for (const cls of classes) Object.assign(d, c.own.get(cls));
  const pad = (side: string) => d[`padding-${side}`] ?? d[`padding-${side === "top" || side === "bottom" ? "block" : "inline"}-${side === "top" || side === "left" ? "start" : "end"}`];
  const all = d.padding?.split(/\s+(?![^(]*\))/);
  const p4 = all ? [all[0], all[1] ?? all[0], all[2] ?? all[0], all[3] ?? all[1] ?? all[0]] : [];
  const padV = (["top", "right", "bottom", "left"] as const).map((s, i) => val(pad(s) ?? p4[i] ?? d[`padding-${s === "top" || s === "bottom" ? "block" : "inline"}`], c) ?? 0) as [Val, Val, Val, Val];
  const grid = classes.includes("slds-grid") || /flex/.test(d.display ?? "");
  return {
    classes,
    dir: (grid && !classes.includes("slds-grid_vertical") && !/column/.test(d["flex-direction"] ?? "") ? "HORIZONTAL" : "VERTICAL") as "VERTICAL" | "HORIZONTAL",
    wrap: classes.includes("slds-wrap") || d["flex-wrap"] === "wrap",
    pad: padV.some((x) => x !== 0) ? padV : undefined,
    gap: val(d.gap ?? d["column-gap"], c),
    fill: (val(d["background-color"] ?? d.background, c) as string) || undefined,
    radius: val(d["border-radius"], c),
    size: val(d["font-size"], c),
    bold: /^(bold|[6-9]00)$/.test(d["font-weight"] ?? "") || /var\(--slds-g-font-weight-(6|7|bold)/.test(d["font-weight"] ?? ""),
    color: (val(d.color, c) as string) || undefined,
    span: /^slds-size_(\d+)-of-(\d+)$/.exec(classes.find((x) => /^slds-size_\d+-of-\d+$/.test(x)) ?? "")?.slice(1).map(Number),
  };
}

// ---- 변형 맞추기: 코드의 속성(kebab) ↔ 캡처의 property(camel). 같은 값이 가장 많은 변형, 없으면 첫 변형 ----
export const pascalName = (s: string) => String(s).replace(/(^|[-_\s])([a-z0-9])/gi, (_, __, ch: string) => ch.toUpperCase());
const camel = (s: string) => s.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
/** 플러그인과 같은 규칙으로 변형 이름을 만든다(pascal, 겹치면 뒤에 2) */
export function variantNames(cap: CapturedComponent): string[] {
  const seen = new Set<string>();
  return cap.variants.map((v) => {
    let n = pascalName(v.name);
    while (seen.has(n)) n += "2";
    seen.add(n);
    return n;
  });
}
function matchVariant(cap: CapturedComponent, attrs: Record<string, string>): number {
  const want = Object.fromEntries(Object.entries(attrs).filter(([, v]) => !v.startsWith("{")).map(([k, v]) => [camel(k), v]));
  // 코드에 variant 가 없으면 컴포넌트 기본값 쪽 변형(figma-generate-design: 소스의 기본값을 읽는다)
  const DEFAULTS = ["neutral", "default", "standard", "base"];
  const rank = (v: CapturedComponent["variants"][number]) => DEFAULTS.indexOf(v.attrs?.variant ?? v.name);
  const ranked = cap.variants.map((v, i) => [rank(v), i]).filter(([r]) => r >= 0).sort((a, b) => a[0] - b[0]);
  const fallback = want.variant || !ranked.length ? -1 : ranked[0][1];
  let best = Math.max(fallback, 0), score = fallback >= 0 ? 0 : -1;
  cap.variants.forEach((v, i) => {
    const a = v.attrs ?? {};
    const s = Object.keys(want).filter((k) => k !== "label" && a[k] === want[k]).length + (want.variant && pascalName(v.name) === pascalName(want.variant) ? 1 : 0);
    if (s > score) [best, score] = [i, s];
  });
  return best;
}

// ---- LWC html → MNode ----
const TEXT_PROPS = ["label", "placeholder", "message", "title", "alternative-text"];
const DIRECTIVE = /^(lwc:if|lwc:elseif|lwc:else|if:true|if:false|for:each|iterator:\w+)$/;
function convert(e: El | string, c: Ctx, width: number): MNode[] {
  if (typeof e === "string") return [{ type: "text", chars: e }];
  const tag = e.tag;
  // lwc:if·for:each (template 이나 요소에 붙는다): 조건은 숨김 레이어, 반복은 한 번 그리고 레이어 이름에 남긴다
  const d = Object.keys(e.attrs).find((k) => DIRECTIVE.test(k));
  if (d) {
    const { [d]: cond, ...rest } = e.attrs;
    const inner = tag === "template" ? e.children.flatMap((x) => convert(x, c, width)) : convert({ ...e, attrs: rest }, c, width);
    const conditional = !/^(for:each|iterator:)/.test(d);
    if (conditional) c.hidden++;
    return [{ type: "frame", name: `${d}${cond ? " " + cond : ""}`, dir: "VERTICAL", hidden: conditional || undefined, children: inner }];
  }
  if (tag === "template") return e.children.flatMap((x) => convert(x, c, width));
  // LightningModal 의 머리·본문·바닥: SLDS 모달(slds-modal__header·content·footer) 값 그대로
  if (tag === "lightning-modal-header") {
    const label = e.attrs.label;
    return [
      { type: "frame", name: tag, dir: "HORIZONTAL", justify: "CENTER", pad: ["spacing/4", "spacing/4", "spacing/4", "spacing/4"], fill: "color/surface-container/1", children: label ? [{ type: "text", chars: label, bold: true, size: "font/scale/3" }] : e.children.flatMap((x) => convert(x, c, width)) },
      { type: "divider" },
    ];
  }
  if (tag === "lightning-modal-body") return [{ type: "frame", name: tag, dir: "VERTICAL", gap: "spacing/2", pad: ["spacing/4", "spacing/4", "spacing/4", "spacing/4"], fill: "color/surface-container/1", children: e.children.flatMap((x) => convert(x, c, width - 32)) }];
  if (tag === "lightning-modal-footer")
    return [{ type: "divider" }, { type: "frame", name: tag, dir: "HORIZONTAL", justify: "MAX", gap: "spacing/2", pad: ["spacing/3", "spacing/4", "spacing/3", "spacing/4"], fill: "color/surface-container/2", children: e.children.flatMap((x) => convert(x, c, width)) }];
  if (tag === "lightning-layout") {
    const s = styleOf(e, c, false);
    return [{ type: "frame", name: "lightning-layout", dir: "HORIZONTAL", wrap: "multiple-rows" in e.attrs, width, pad: s.pad, children: kids(e).flatMap((x) => convert(x, c, width)) }];
  }
  if (tag === "lightning-layout-item") {
    const size = Number(e.attrs.size);
    const w = size ? Math.round((width * size) / 12) : undefined;
    const padCls = e.attrs.padding ? `slds-p-${e.attrs.padding.replace(/^around-/, "around_").replace(/^horizontal-/, "horizontal_")}` : "";
    const s = styleOf({ ...e, attrs: { ...e.attrs, class: `${e.attrs.class ?? ""} ${padCls}` } }, c, false);
    return [{ type: "frame", name: `layout-item${size ? ` ${size}/12` : ""}`, dir: "VERTICAL", width: w, pad: s.pad, children: e.children.flatMap((x) => convert(x, c, w ?? width)) }];
  }
  const cap = c.captures.find((x) => x.tag === tag);
  // 안에 요소를 담는 컴포넌트(lightning-card 등): Figma 인스턴스에는 slot 이 없으므로 틀 프레임에 제목과 안의 내용을 넣는다
  if (cap && kids(e).length) {
    const title = e.attrs.title ?? e.attrs.label;
    const head: MNode[] = title ? [{ type: "text", chars: title, bold: true, size: "font/scale/3" }] : [];
    return [{ type: "frame", name: tag, dir: "VERTICAL", gap: "spacing/3", pad: ["spacing/4", "spacing/4", "spacing/4", "spacing/4"], fill: "color/surface/1", border: "color/border/1", radius: "radius/4", width, children: [...head, ...e.children.flatMap((x) => convert(x, c, width - 32))] }];
  }
  if (cap) {
    const i = matchVariant(cap, e.attrs);
    const v = cap.variants[i];
    // 캡처 때 그 변형이 가진 글자 속성(label·placeholder·message 등) 값을 코드의 값으로 바꾼다
    const texts = TEXT_PROPS.flatMap((k) => {
      const to = e.attrs[k];
      const from = v.attrs?.[camel(k)];
      return to !== undefined && from && from !== to ? [{ from, to }] : [];
    });
    const label = e.attrs.label ?? (textOf(e).trim() || undefined);
    const root = v.states.Default;
    // 섹션 이름은 플러그인의 buildCaptured 와 같다(밀버스 Badge 와 SLDS Badge 처럼 세트 이름이 겹친다)
    return [{ type: "instance", section: cap.group === "milvus" ? cap.name : "SLDS · " + cap.name, set: cap.name, variant: variantNames(cap)[i], text: v.attrs ? undefined : label, texts: texts.length ? texts : undefined, fill: (root?.w ?? 0) >= 400 ? true : undefined, name: tag }];
  }
  if (tag.startsWith("c-")) {
    const name = camel(tag.slice(2));
    if (c.project.has(name)) return [{ type: "project", name }];
  }
  if (tag.includes("-")) {
    c.unknown.add(tag);
    // Figma 에 없는 컴포넌트가 안에 요소를 담으면(c-milvus-modal 등) 이름 붙인 틀에 내용을 살린다
    if (kids(e).length) return [{ type: "frame", name: `<${tag}>`, dir: "VERTICAL", gap: "spacing/3", pad: ["spacing/4", "spacing/4", "spacing/4", "spacing/4"], border: "color/border/1", radius: "radius/4", width, children: e.children.flatMap((x) => convert(x, c, width - 32)) }];
    return [{ type: "placeholder", label: `<${tag}>` }];
  }
  // 코드 안의 <svg><use href="#이름"> 아이콘은 모양을 읽지 않고 이름 붙인 작은 자리 표시로 둔다
  if (tag === "svg") {
    const use = kids(e).find((x) => x.tag === "use");
    const ref = use && (use.attrs.href ?? use.attrs["xlink:href"] ?? "");
    return [{ type: "placeholder", label: `아이콘${ref && !ref.startsWith("{") ? " " + ref.replace(/^.*#/, "") : ""}` }];
  }
  const s = styleOf(e, c, false);
  const onlyText = e.children.every((x) => typeof x === "string" || ["b", "strong", "em", "i", "span", "br"].includes(x.tag));
  if (onlyText && e.children.length) {
    const chars = textOf(e).trim();
    if (!chars) return [];
    const heading = /^h[1-6]$/.test(tag);
    return [{ type: "text", chars, size: s.size, bold: s.bold || heading || tag === "strong" || tag === "b", color: s.color }];
  }
  const w = s.span ? Math.round((width * s.span[0]) / s.span[1]) : undefined;
  return [
    {
      type: "frame",
      name: (e.attrs.class ?? "").split(/\s+/)[0] || tag,
      dir: s.dir,
      wrap: s.wrap || undefined,
      width: w,
      gap: s.gap,
      pad: s.pad,
      fill: s.fill,
      radius: s.radius,
      children: e.children.flatMap((x) => convert(x, c, w ?? width)),
    },
  ];
}

export type MigrateReport = { literals: number; unknown: string[]; hidden: number };

/** 프로젝트 LWC 하나 → 컴포넌트 루트 프레임 */
export function lwcToTree(o: { name: string; html: string; css?: string; captures: CapturedComponent[]; project: Set<string>; slds: Rules; width?: number }): { tree: MNode; report: MigrateReport } {
  const c: Ctx = { captures: o.captures, project: o.project, slds: o.slds, own: parseRules(o.css ?? ""), literals: 0, unknown: new Set(), hidden: 0 };
  const width = o.width ?? 960;
  const root = find(parseMarkup(o.html), "template");
  if (!root) throw new Error(`${o.name}.html에 <template>이 없습니다`);
  const host = styleOf({ tag: "host", attrs: {}, children: [] }, c, true);
  const children = root.children.flatMap((x) => convert(x, c, width));
  // LightningModal(머리·본문·바닥)이면 모달 상자: 모서리 radius/2, 폭 고정
  const modal = kids(root).some((x) => x.tag.startsWith("lightning-modal-"));
  const tree: MNode = modal
    ? { type: "frame", name: o.name, dir: "VERTICAL", width, fill: "color/surface-container/1", radius: "radius/2", children }
    : { type: "frame", name: o.name, dir: "VERTICAL", width, gap: host.gap, pad: host.pad, fill: host.fill, radius: host.radius, children }; // 폭 고정: 안의 FILL 이 기댈 곳
  return { tree, report: { literals: c.literals, unknown: [...c.unknown], hidden: c.hidden } };
}

// ---- FlexiPage → 페이지 ----
// 영역 폭(px, 화면 1440 기준). FlexiPage 메타데이터와 공식 문서(Lightning Page Templates)에는 폭 숫자가 없어
// 개발 org(2026-11-08)에서 화면 폭 1440으로 잰 값이다. 레코드 템플릿의 열 클래스는 slds-large-size_8-of-12 / 4-of-12.
// 공통: 페이지 여백 16(spacing/4), 영역 사이 가로·세로 12(spacing/3). 표에 없는 템플릿은 Region 을 순서대로 한 열로 쌓고 알린다
export const TEMPLATES: Record<string, { region: string; width: number }[][]> = {
  "flexipage:recordHomeTemplateDesktop": [[{ region: "header", width: 1408 }], [{ region: "main", width: 943 }, { region: "sidebar", width: 453 }]],
  "flexipage:defaultAppHomeTemplate": [[{ region: "main", width: 1408 }]],
  "industries_common:homeTemplateOneRegion": [[{ region: "main", width: 1408 }]],
};
export type PageItem = { component?: string; props: Record<string, string>; field?: string };
export type FlexiPage = { name: string; label: string; template: string; type: string; regions: Map<string, { type: string; items: PageItem[] }> };

export function parseFlexiPage(name: string, xml: string): FlexiPage {
  const fp = find(parseMarkup(xml), "FlexiPage");
  if (!fp) throw new Error(`${name}: FlexiPage XML이 아닙니다`);
  const regions = new Map<string, { type: string; items: PageItem[] }>();
  for (const r of kids(fp).filter((x) => x.tag === "flexiPageRegions")) {
    const items = kids(r)
      .filter((x) => x.tag === "itemInstances")
      .map((it): PageItem => {
        const ci = find(it, "componentInstance");
        const fi = find(it, "fieldInstance");
        const props = Object.fromEntries(
          kids(ci ?? it)
            .filter((x) => x.tag === "componentInstanceProperties")
            .map((p) => [textOf(find(p, "name")), textOf(find(p, "value"))]),
        );
        return { component: ci ? textOf(find(ci, "componentName")) : undefined, props, field: fi ? textOf(find(fi, "fieldItem")) : undefined };
      });
    regions.set(textOf(find(r, "name")), { type: textOf(find(r, "type")), items });
  }
  return { name, label: textOf(find(fp, "masterLabel")) || name, template: textOf(find(find(fp, "template") ?? fp, "name")), type: textOf(find(fp, "type")), regions };
}

export const PAGE_WIDTH = 1440;
const CONTENT = 1408; // 1440 - 여백 16 × 2

export function pageToTree(page: FlexiPage, o: { project: Set<string> }): { tree: MNode; notes: string[] } {
  const notes: string[] = [];
  const seen = new Set<string>();
  const items = (region: string, width: number): MNode[] => {
    const r = page.regions.get(region);
    if (!r || seen.has(region)) return [];
    seen.add(region); // 같은 facet 을 두 번 그리지 않는다
    return r.items.flatMap((it): MNode[] => {
      if (it.field) return [{ type: "text", chars: it.field }];
      const comp = it.component ?? "";
      const lwc = /^(?:c:)?(\w+)$/.exec(comp)?.[1]; // LWC 는 "이름" 그대로 또는 "c:이름"(org 에서 받은 파일은 이름만)
      if (lwc && o.project.has(lwc)) return [{ type: "project", name: lwc, fill: true }]; // 영역 폭에 맞춘다
      // 탭 묶음: 탭 이름 줄과 활성 탭(active=true, 없으면 첫 탭)의 내용만
      const tabs = it.props.tabs && page.regions.get(it.props.tabs);
      if (comp === "flexipage:tabset" && tabs) {
        seen.add(it.props.tabs);
        const active = tabs.items.find((x) => x.props.active === "true") ?? tabs.items[0];
        const title = (x: PageItem) => (x.props.title ?? "탭").replace(/^Standard\.Tab\./, "");
        return [{ type: "frame", name: comp, dir: "VERTICAL", gap: "spacing/3", pad: ["spacing/4", "spacing/4", "spacing/4", "spacing/4"], fill: "color/surface/1", radius: "radius/4", width, children: [
          { type: "frame", name: "Tabs", dir: "HORIZONTAL", gap: "spacing/5", children: tabs.items.map((x): MNode => ({ type: "text", chars: title(x), bold: x === active })) },
          ...(active?.props.body ? items(active.props.body, width - 32) : []),
        ] }];
      }
      // 열·필드 묶음은 안의 facet 을 펼친다
      const facets = ["tabs", "body", "columns"].map((k) => it.props[k]).filter((f): f is string => !!f && page.regions.has(f));
      if (facets.length) {
        const label = it.props.title ? it.props.title.replace(/^Standard\.Tab\./, "") : it.props.label;
        const inner = facets.flatMap((f) => items(f, width));
        const horiz = comp === "flexipage:column" ? false : facets.length > 1 || page.regions.get(facets[0])?.items.every((x) => x.component === "flexipage:column");
        return [{ type: "frame", name: label ? `${comp} · ${label}` : comp, dir: horiz ? "HORIZONTAL" : "VERTICAL", gap: "spacing/3", children: inner }];
      }
      return [{ type: "placeholder", label: lwc ? `${comp} (코드 없음)` : comp, width }];
    });
  };
  let rows = TEMPLATES[page.template];
  if (!rows) {
    notes.push(`모르는 템플릿 ${page.template}: 영역을 한 열로 쌓았다(org에서 폭을 재서 TEMPLATES에 더한다)`);
    rows = [...page.regions].filter(([, r]) => r.type === "Region").map(([region]) => [{ region, width: CONTENT }]);
  }
  const frames: MNode[] = rows.map((row) => ({
    type: "frame",
    name: row.map((x) => x.region).join(" + "),
    dir: "HORIZONTAL",
    gap: "spacing/3",
    children: row.map((x): MNode => ({ type: "frame", name: `Region/${x.region}`, dir: "VERTICAL", width: x.width, gap: "spacing/3", children: items(x.region, x.width) })),
  }));
  return { tree: { type: "frame", name: `Page/${page.name}`, dir: "VERTICAL", width: PAGE_WIDTH, gap: "spacing/3", pad: ["spacing/4", "spacing/4", "spacing/4", "spacing/4"], fill: "color/surface/2", children: frames }, notes };
}
