// 디자인 시스템 → figma-data.json(Figma 플러그인 figma-plugin/의 입력, #111).
// 변수 이름은 docs/milvus/figma.md 2장: 컬렉션 milvus(역할, hook 이름 그대로)와 palette(원시 값).
// 파일을 쓰지 않는다. 쓰기는 저장소의 scripts/build-figma-data.ts와 고객 프로젝트의 milvus figma(cli/figma.ts)가 한다
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { COMMENT } from "./hooks-index.ts";
import { findMilvusComponents, loadComponent, type MilvusComponent } from "./milvus-stories.ts";
import { brandPalette } from "./palette.ts";
import { SLDS_DOCS_KO } from "./slds-docs-ko.ts";

export type FigmaColor = { name: string; hook: string; palette: string; web: string; scopes: string[] };
export type FigmaNumber = { name: string; hook: string; value: number; web: string; scopes: string[] };
export type FigmaProp = { name: string; type: "VARIANT" | "BOOLEAN" | "TEXT"; values?: string[]; default: string | boolean };
export type FigmaComponent = { name: string; recipe: string; tag: string; description: string; props: FigmaProp[]; stories: string[]; source: string; visual: boolean };

// 역할 변수로 옮기는 hook 종류. hook 조각 → Figma 종류(lib/tokens.ts KIND_TO_HOOK의 역방향)
const KINDS: [string, string][] = [
  ["color-", "color"],
  ["spacing-", "spacing"],
  ["radius-border-", "radius"],
  ["font-scale-", "font/scale"],
  ["sizing-border-", "sizing/border"],
];
const NUMBER_SCOPES: Record<string, string[]> = {
  spacing: ["GAP"],
  radius: ["CORNER_RADIUS"],
  "font/scale": ["FONT_SIZE"],
  "sizing/border": ["STROKE_FLOAT"],
};

/** --slds-g-color-on-surface-1 → color/on-surface/1, --slds-g-radius-border-pill → radius/pill. 대상 종류가 아니면 undefined */
export function hookToFigma(hook: string): string | undefined {
  const rest = hook.replace(/^--slds-g-/, "");
  const kind = KINDS.find(([piece]) => rest.startsWith(piece));
  if (!kind || rest === hook) return undefined;
  const tail = rest.slice(kind[0].length);
  if (kind[1] !== "color") return `${kind[1]}/${tail}`;
  const m = /^(.+)-([a-z0-9]+)$/.exec(tail); // 색은 마지막 조각이 단계다
  return m ? `color/${m[1]}/${m[2]}` : undefined;
}

/** CSS의 custom property 정의. 같은 이름은 처음 것(:root 기본 테마)만. light-dark()는 밝은 쪽 */
export function parseVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of css.replace(COMMENT, "").matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    if (!vars.has(m[1])) vars.set(m[1], lightOf(m[2].trim()));
  }
  return vars;
}
function lightOf(v: string): string {
  const m = /^light-dark\(\s*(.+)\)$/.exec(v);
  if (!m) return v;
  let depth = 0; // 첫 번째 인자 끝(괄호 밖 쉼표)까지
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return m[1].slice(0, i).trim();
  }
  return v;
}

/** var() 사슬을 끝까지 따라간다. refs는 지나온 이름(첫 --slds-r-*가 palette 이름이 된다) */
export function resolveVar(name: string, vars: Map<string, string>, refs: string[] = []): { value?: string; refs: string[] } {
  const raw = vars.get(name);
  if (raw === undefined || refs.includes(name)) return { refs };
  refs.push(name);
  const m = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*(.+))?\)$/.exec(raw);
  if (!m) return { value: raw, refs };
  const inner = resolveVar(m[1], vars, refs);
  if (inner.value !== undefined || m[2] === undefined) return inner;
  return /^var\(/.test(m[2].trim()) ? resolveVar(m[2].trim().slice(4, -1).split(",")[0].trim(), vars, refs) : { value: m[2].trim(), refs };
}

/** #fff, #ffffff, rgb() → #RRGGBB. 투명도가 있는 색과 해석 못 하는 값은 undefined */
export function toHex(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (v === "white") return "#FFFFFF";
  if (v === "black") return "#000000";
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return ("#" + [...m[1]].map((c) => c + c).join("")).toUpperCase();
  m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) return `#${m[1].toUpperCase()}`;
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (rgb && (rgb[4] === undefined || rgb[4] === "1" || rgb[4] === "100%")) {
    return "#" + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return undefined;
}

/** 0.5rem → 8, 4px → 4, 0 → 0. 그 밖(calc, %)은 undefined */
export function toPx(value: string): number | undefined {
  const m = /^(-?[\d.]+)(rem|px)?$/.exec(value.trim());
  if (!m) return undefined;
  return m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
}

/** 원시 값의 palette 이름. 지나온 이름 중 첫 원시 색(--slds-r-color-<색>-<단계>, neutral-base)을 쓰고 없으면 값으로 */
function paletteName(refs: string[], hex: string): string {
  for (const r of refs) {
    let m = /^--slds-r-color-([a-z]+)-(\d+)$/.exec(r);
    if (m) return `palette/${m[1]}/${m[2]}`;
    m = /^--slds-g-color-neutral-base-(\d+)$/.exec(r);
    if (m) return `palette/neutral/${m[1]}`;
    if (r === "--lwc-brandPrimary") return "palette/brand/primary";
  }
  return `palette/value/${hex.slice(1).toLowerCase()}`;
}

const colorScopes = (name: string) =>
  /^color\/(on-|.*text)/.test(name) ? ["TEXT_FILL"] : /^color\/border/.test(name) ? ["STROKE_COLOR"] : ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"];

/**
 * SLDS 2 CSS + 브랜드(org 테마 BRAND_COLOR, util.css)로 변수 목록을 만든다.
 * hooks는 읽는 곳이 있는 g hook(hooks-index의 readGHooks). 브랜드 색 계열(--slds-r-color-brand-*)은 테마 팔레트로 바꾼다
 */
export function buildTokens(o: { sldsCss: string; hooks: string[]; brandColor: string; brandPalette: Record<number, string>; utilCss?: string }) {
  const vars = parseVars(o.sldsCss);
  for (const [step, hex] of Object.entries(o.brandPalette)) vars.set(`--slds-r-color-brand-${step}`, hex);
  vars.set("--lwc-brandPrimary", o.brandColor); // org가 테마에서 넣는 값. SLDS CSS에는 정의가 없다
  if (o.utilCss) for (const [k, v] of parseVars(o.utilCss)) vars.set(k, v);

  const palette: Record<string, string> = {};
  const color: FigmaColor[] = [];
  const number: FigmaNumber[] = [];
  const skipped: string[] = [];
  for (const hook of [...new Set(o.hooks)].sort()) {
    const name = hookToFigma(hook);
    // *-base·palette-* 색은 원시 눈금이라 palette에만 둔다(figma.md 2장 3). var-*는 밀도(density)에 따라 바뀌는 별칭이라 기본 눈금과 겹친다
    if (!name || /^color\/([a-z]+-base|palette-[a-z-]+)\//.test(name) || /\/var-/.test(name)) continue;
    const { value, refs } = resolveVar(hook, vars);
    if (value === undefined) {
      skipped.push(`${hook}: 정의 없음`);
      continue;
    }
    const web = `var(${hook})`;
    if (name.startsWith("color/")) {
      const hex = toHex(value);
      if (!hex) {
        skipped.push(`${hook}: ${value}`);
        continue;
      }
      const p = paletteName(refs, hex);
      palette[p] = hex;
      color.push({ name, hook, palette: p, web, scopes: colorScopes(name) });
    } else {
      const px = toPx(value);
      if (px === undefined) {
        skipped.push(`${hook}: ${value}`);
        continue;
      }
      const kind = Object.keys(NUMBER_SCOPES).find((k) => name.startsWith(`${k}/`));
      number.push({ name, hook, value: px, web, scopes: kind ? NUMBER_SCOPES[kind] : [] });
    }
  }
  return { palette, color, number, skipped };
}

const pascal = (s: string) => s.replace(/(^|[-_\s])([a-z])/g, (_, __, c: string) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());

/** 손으로 쓴 스토리의 argTypes 중 options가 문자열 배열인 것. 상수(const X = ["a"])도 따라간다 */
export function parseStoryOptions(src: string): Record<string, string[]> {
  const consts = new Map<string, string[]>();
  for (const m of src.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*\[([^\]]*)\]/g)) {
    const items = [...m[2].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
    if (items.length && !/[{(]/.test(m[2])) consts.set(m[1], items);
  }
  const start = src.search(/argTypes\s*:\s*\{/);
  if (start < 0) return {};
  let i = src.indexOf("{", start);
  let depth = 0;
  let end = i;
  for (; end < src.length; end++) {
    if (src[end] === "{") depth++;
    else if (src[end] === "}" && --depth === 0) break;
  }
  const block = src.slice(i + 1, end);
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) {
    const opt = /options\s*:\s*(\[[^\]]*\]|[A-Z_][A-Z0-9_]*)/.exec(m[2]);
    if (!opt) continue;
    const list = opt[1].startsWith("[") ? [...opt[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]) : consts.get(opt[1]);
    if (list?.length) out[m[1]] = list;
  }
  return out;
}

/** 스토리 이름(export const 이름). 소스 코드 스토리는 뺀다 */
export function parseStoryNames(src: string): string[] {
  return [...src.matchAll(/^export const (\S+)\s*=/gm)].map((m) => m[1]).filter((n) => n !== "소스_코드");
}

/**
 * 컴포넌트 하나를 Figma 세트 정의로. 선택지가 있는 속성은 VARIANT, @api boolean은 BOOLEAN, 기본 문자열이 있는 @api는 TEXT.
 * 배리언트 조합이 30개를 넘으면(figma-generate-library 권장 상한) 큰 속성부터 하나씩 기본값만 남긴다
 */
export function toFigmaComponent(c: MilvusComponent, o: { storySrc?: string; html: string; source: string }): FigmaComponent {
  const options = o.storySrc ? parseStoryOptions(o.storySrc) : {};
  const api = new Map(c.props.map((p) => [p.name, p]));
  const props: FigmaProp[] = [];
  for (const [name, values] of Object.entries(options)) {
    const def = api.get(name)?.value;
    const vals = values.map(pascal);
    props.push({ name: pascal(name), type: "VARIANT", values: vals, default: typeof def === "string" && values.includes(def) ? pascal(def) : vals[0] });
  }
  for (const p of c.props) {
    if (p.name in options) continue;
    // 모양이 바뀌는 상태는 변형이다(docs/milvus/figma.md 1장: State=Default·Disabled)
    if (p.name === "disabled" && p.control === "boolean") props.push({ name: "State", type: "VARIANT", values: ["Default", "Disabled"], default: "Default" });
    else if (p.control === "boolean") props.push({ name: pascal(p.name), type: "BOOLEAN", default: p.value === true });
    else if (p.control === "text" && typeof p.value === "string" && p.value) props.push({ name: pascal(p.name), type: "TEXT", default: p.value });
  }
  const variants = props.filter((p) => p.type === "VARIANT");
  while (variants.reduce((n, p) => n * (p.values?.length ?? 1), 1) > 30) {
    const big = variants.reduce((a, b) => ((a.values?.length ?? 1) >= (b.values?.length ?? 1) ? a : b));
    big.values = [String(big.default)];
  }
  return {
    name: c.storyName,
    recipe: c.storyName.toLowerCase(),
    tag: c.tag,
    description: c.description,
    props,
    stories: o.storySrc ? parseStoryNames(o.storySrc) : [],
    source: o.source,
    visual: /<(?!\/?template\b)[a-z]/i.test(o.html),
  };
}

/**
 * figma-data.json 내용. 컴포넌트·스토리·SLDS 값·hook 색인은 패키지(pkgRoot)에서, 브랜드는 호출하는 쪽이 준다
 * (저장소: brands/<브랜드>/theme.json·util.css, 고객 프로젝트: BrandingSet의 BRAND_COLOR·milvusBrand.css)
 */
const b64 = (p: string) => readFileSync(p).toString("base64");
export function buildFigmaData(o: { pkgRoot: string; name: string; brandColor: string; brandPalette?: Record<number, string>; utilCss?: string; captureBrand?: string; cover?: { image?: string; logo?: string } }) {
  const read = (p: string) => readFileSync(p, "utf8");
  const req = createRequire(join(o.pkgRoot, "package.json"));
  const sldsCss = read(join(dirname(req.resolve("@salesforce-ux/design-system-2/package.json")), "dist/css/bundled/slds2.cosmos.css"));
  const indexFile = join(o.pkgRoot, "dist/hooks-index.json");
  if (!existsSync(indexFile)) throw new Error(`hook 색인이 없습니다(${indexFile}). 저장소에서는 node scripts/build-hooks-index.ts를 먼저 실행하세요`);
  const lwcDir = join(o.pkgRoot, "force-app/main/default/lwc");
  const components = findMilvusComponents(lwcDir).map((n) => loadComponent(lwcDir, n));
  const componentHooks = components.flatMap((c) => {
    const css = join(lwcDir, c.folder, `${c.folder}.css`);
    return existsSync(css) ? [...read(css).matchAll(/--slds-g-[a-z0-9-]+/g)].map((m) => m[0]) : [];
  });
  const tokens = buildTokens({
    sldsCss,
    hooks: [...JSON.parse(read(indexFile)).readGHooks, ...componentHooks],
    brandColor: o.brandColor,
    brandPalette: o.brandPalette ?? brandPalette(o.brandColor),
    utilCss: o.utilCss,
  });
  const storiesDir = join(o.pkgRoot, "stories/components/milvus");
  const catalogDir = join(o.pkgRoot, "stories/slds-catalog");
  // scripts/capture-storybook.ts가 Storybook에서 읽은 실제 컴포넌트(상태별 트리, 값은 변수 이름). 없으면 About의 목록만 남는다.
  // 브랜드마다 파일이 따로다. 값은 변수 이름이라 다른 브랜드 파일을 써도 색은 이 브랜드 변수로 바뀌지만, 모양(모서리·여백)은 읽은 브랜드를 따른다
  const capturedFile = join(o.pkgRoot, `figma-plugin/captures/${o.captureBrand ?? "Milvus_DesignSystem"}.json`);
  const captured: CapturedComponent[] = (existsSync(capturedFile) ? (JSON.parse(read(capturedFile)).components as CapturedComponent[]) : []).map((c) => ({
    ...c,
    doc: c.group === "milvus" ? milvusDoc(storiesDir, c.name) : sldsDoc(req, c.tag),
  }));
  return {
    data: {
      version: JSON.parse(read(join(o.pkgRoot, "package.json"))).version,
      generatedAt: new Date().toISOString(),
      // 표지(외부제안용1 스타일): 밀버스 흰 로고는 늘, 배경 사진·고객사 흰 로고는 있을 때만(base64)
      brand: {
        name: o.name,
        brandColor: o.brandColor,
        cover: {
          milvusLogo: b64(join(o.pkgRoot, "figma-plugin/milvus-logo-white.png")),
          image: o.cover?.image && b64(o.cover.image),
          logo: o.cover?.logo && b64(o.cover.logo),
        },
      },
      about: {
        rules: [
          "SLDS 에 있으면 만들지 않는다",
          "브랜드 색은 org 테마(BrandingSet) 한 곳, 컴포넌트는 변수만 읽는다",
          "모양만 바꾸는 컴포넌트는 만들지 않는다",
          "화면은 인스턴스로만 조립하고 detach 하지 않는다",
        ],
        sldsCatalog: existsSync(catalogDir) ? readdirSync(catalogDir).filter((f) => f.endsWith(".stories.js")).map((f) => f.replace(".stories.js", "")).sort() : [],
      },
      tokens: {
        palette: tokens.palette,
        color: tokens.color,
        number: tokens.number,
        text: {
          body: { family: "Inter", style: "Regular", size: 13, lineHeight: 20 },
          heading: { family: "Inter", style: "Semi Bold", size: 20, lineHeight: 28 },
        },
      },
      components: components.map((c) => {
        const story = join(storiesDir, `${c.storyName}.stories.js`);
        return toFigmaComponent(c, {
          storySrc: existsSync(story) ? read(story) : undefined,
          html: read(join(lwcDir, c.folder, `${c.folder}.html`)),
          source: `force-app/main/default/lwc/${c.folder}`,
        });
      }),
      captured,
    },
    skipped: tokens.skipped,
  };
}

// ---- Storybook에서 읽은 컴포넌트(scripts/capture-storybook.ts) ----

/** 화면 요소 하나. 값 옆의 *Var는 같은 값의 역할 변수 이름(없으면 직접 값으로 남는다) */
export type CaptureNode = {
  type: "frame" | "text" | "svg" | "image";
  tag?: string;
  w?: number;
  h?: number;
  opacity?: number;
  children?: CaptureNode[];
  display?: string;
  dir?: string;
  wrap?: string;
  align?: string;
  justify?: string;
  gap?: number;
  pad?: number[];
  bg?: string;
  border?: { width: number; color: string };
  radius?: number;
  shadow?: string;
  chars?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  svg?: string;
  png?: string;
  clip?: boolean;
  x?: number;
  y?: number;
  abs?: boolean;
  vars?: Record<string, string>;
  literal?: string[];
};
export type CapturedComponent = {
  group: "slds" | "milvus";
  name: string;
  tag: string;
  story: string;
  brand: string;
  interactive: boolean;
  variants: { name: string; attrs?: Record<string, string>; states: Record<string, CaptureNode> }[];
  doc?: ComponentDoc;
};

/** rgb(a)(...) → { hex, alpha }. 해석하지 못하면 undefined */
export function parseRgb(v: string | undefined): { hex: string; alpha: number } | undefined {
  const m = v && /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/.exec(v.trim());
  if (!m) return undefined;
  return { hex: "#" + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase(), alpha: m[4] === undefined ? 1 : Number(m[4]) };
}

// 같은 값인 역할 변수가 여럿이면 쓰임새에 맞는 이름을 고른다(앞에 있을수록 우선)
const COLOR_PREFER: Record<"bg" | "text" | "border", RegExp[]> = {
  bg: [/container|surface/, /^color\/(accent|brand|error|success|warning|info|disabled)\//, /./],
  text: [/^color\/on-/, /^color\/(accent|error|success|warning|info)\/\d/, /./],
  border: [/^color\/border/, /./],
};
const NUMBER_KIND: Record<"spacing" | "radius" | "font" | "stroke", RegExp> = {
  spacing: /^spacing\//,
  radius: /^radius\//,
  font: /^font\/scale\//,
  stroke: /^sizing\/border\//,
};

/**
 * 읽은 트리의 값을 역할 변수 이름으로 바꿔 node.vars에 적는다. 변수가 없는 값은 node.literal에 남긴다(문서·보고서가 센다).
 * 투명(알파 0)은 칠하지 않으므로 대응하지 않고, 반투명은 같은 색 변수에 불투명도만 따로 둔다
 */
export function mapCaptureValues(node: CaptureNode, tokens: { palette: Record<string, string>; color: FigmaColor[]; number: FigmaNumber[] }): void {
  const byHex = new Map<string, string[]>();
  for (const c of tokens.color) {
    const hex = tokens.palette[c.palette];
    byHex.set(hex, [...(byHex.get(hex) ?? []), c.name]);
  }
  const color = (value: string | undefined, use: keyof typeof COLOR_PREFER): string | undefined | null => {
    const rgb = parseRgb(value);
    if (!rgb || rgb.alpha === 0) return null; // 칠하지 않음
    const names = byHex.get(rgb.hex) ?? [];
    for (const re of COLOR_PREFER[use]) {
      const hit = names.filter((n) => re.test(n)).sort((a, b) => a.length - b.length)[0];
      if (hit) return hit;
    }
    return undefined;
  };
  const num = (value: number | undefined, kind: keyof typeof NUMBER_KIND): string | undefined => {
    if (!value) return undefined;
    return tokens.number.filter((n) => NUMBER_KIND[kind].test(n.name) && n.value === value).sort((a, b) => a.name.length - b.name.length)[0]?.name;
  };
  const walk = (n: CaptureNode) => {
    const vars: Record<string, string> = {};
    const literal: string[] = [];
    const put = (key: string, name: string | undefined | null, raw: unknown) => {
      if (name) vars[key] = name;
      else if (name === undefined && raw) literal.push(`${key}=${raw}`);
    };
    if (n.type === "text") {
      put("color", color(n.color, "text"), n.color);
      put("fontSize", num(n.fontSize, "font"), n.fontSize);
    } else if (n.type === "svg") {
      put("color", color(n.color, "text"), n.color);
    } else if (n.type === "image") {
      put("radius", num(n.radius, "radius"), n.radius);
    } else {
      put("bg", color(n.bg, "bg"), n.bg);
      if (n.border?.width) {
        put("border", color(n.border.color, "border"), n.border.color);
        put("borderWidth", num(n.border.width, "stroke"), n.border.width);
      }
      put("radius", num(n.radius, "radius") ?? (n.radius && n.radius >= 100 ? "radius/pill" : undefined), n.radius);
      put("gap", num(n.gap, "spacing"), n.gap);
      (n.pad ?? []).forEach((p, i) => put(`pad${i}`, num(p, "spacing"), p));
      for (const c of n.children ?? []) walk(c);
    }
    if (Object.keys(vars).length) n.vars = vars;
    if (literal.length) n.literal = literal;
  };
  walk(node);
}

/** 한 줄 요약(스크립트와 CLI가 같은 문구를 쓴다) */
export function figmaDataSummary(d: ReturnType<typeof buildFigmaData>["data"]): string {
  return `palette ${Object.keys(d.tokens.palette).length}, 색 ${d.tokens.color.length}, 수치 ${d.tokens.number.length}, 컴포넌트 ${d.components.length}(화면 ${d.components.filter((c) => c.visual).length}), Storybook에서 읽은 컴포넌트 ${d.captured.length}`;
}

// ---- 문서 프레임의 HOW TO USE·PROPERTIES ----

export type ComponentDoc = { category: string; summary: string[]; url?: string; props: { name: string; type: string }[] };

/** 마크다운 몇 줄을 문서용 문단으로: 표·코드·링크 표기를 걷어 낸다 */
export function plainParagraphs(md: string): string[] {
  return md
    .replace(/\$\{[^}]*\}/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("|") && !/소스 코드/.test(p))
    .map((p) => p.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\\/g, "").replace(/\s+/g, " ").trim());
}

/** 밀버스 컴포넌트: 손으로 쓴 스토리의 docs.description.component */
function milvusDoc(storiesDir: string, name: string): ComponentDoc {
  const file = join(storiesDir, `${name}.stories.js`);
  const src = existsSync(file) ? readFileSync(file, "utf8") : "";
  const m = /component:\s*`([\s\S]*?)`/.exec(src);
  return { category: "MILVUS", summary: m ? plainParagraphs(m[1]) : [], props: [] };
}

/** SLDS 기본 컴포넌트: 공식 문서 주소와 패키지 타입 정의(.d.ts)의 공개 속성 */
function sldsDoc(req: NodeRequire, tag: string): ComponentDoc {
  const folder = tag.replace(/^lightning-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  let props: { name: string; type: string }[] = [];
  try {
    const dts = readFileSync(join(dirname(req.resolve("lightning-base-components/package.json")), `src/lightning/${folder}/${folder}.d.ts`), "utf8");
    const seen = new Set<string>();
    for (const m of dts.matchAll(/^\s{4}(?:get |set )?([a-z][A-Za-z0-9]*)(?:\([^)]*\))?:\s*([^;]+);/gm)) {
      // 메서드·콜백(void)과 내부 상태는 뺀다
      if (seen.has(m[1]) || m[2].trim() === "void" || /Callback$|^handle|^render$|^computed|^original|^show[A-Z]/.test(m[1]) || /ReturnType|=>|\{/.test(m[2])) continue;
      seen.add(m[1]);
      props.push({ name: m[1], type: m[2].trim() });
    }
  } catch {
    props = [];
  }
  return {
    category: "SALESFORCE BASE",
    summary: [
      ...(SLDS_DOCS_KO[tag] ? [SLDS_DOCS_KO[tag]] : []),
      "Salesforce 공식 기본 컴포넌트다. 밀버스에서 새로 만들지 않고 그대로 쓰며, 모양은 브랜드 hook 으로만 바뀐다.",
    ],
    url: `https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/${tag}.html`,
    props: props.slice(0, 14),
  };
}
