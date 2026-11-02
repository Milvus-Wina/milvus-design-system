// Figma 변수 이름(<종류>/<역할>/<단계>, docs/milvus/figma.md 2장) → 토큰 이름(--token-*) → SLDS hook 대응 판정(설계 2026-11-02 4.3).
// milvus-brand skill이 명세 표를 만들 때와 check가 같은 함수를 쓴다. Node 모듈을 쓰지 않는다(브라우저에서도 import할 수 있게)
import { BRAND_COLOR_PATTERNS, FEEDBACK_HOOKS, LBC_ONLY_G, NEUTRAL_COLOR_PATTERNS } from "./rules.ts";

/** 설계 4.3의 판정 번호. 2 토큰만(읽는 hook 없음), 3 토큰+BrandingSet, 4 토큰+hook, 5 토큰만(util.css 금지 hook), 6 이름 형식 밖 */
export type TokenVerdict = {
  figma: string;
  token?: string;
  hook?: string;
  verdict: 2 | 3 | 4 | 5 | 6;
  note: string;
};

export const TOKEN_NAME = /^--token-[a-z0-9]+(-[a-z0-9]+)+$/;
const FIGMA_NAME = /^[a-z0-9]+(\/[a-z0-9]+(-[a-z0-9]+)*)+$/;

// Figma 종류 → hook 이름 조각. 없는 종류(font/weight, palette)는 토큰만 만든다
const KIND_TO_HOOK: Record<string, string | null> = {
  color: "color-",
  spacing: "spacing-",
  radius: "radius-border-",
  shadow: "shadow-",
  sizing: "sizing-",
  "font/scale": "font-scale-",
  "font/weight": null,
  palette: null,
};

const FEEDBACK_NAMES = new Set(
  Object.values(FEEDBACK_HOOKS).flatMap((k) => [k.text, k.onContainer, k.container, k.border, ...k.hover].filter((n) => n !== null)),
);

/** util.css가 받아 주는 g hook인가(설계 5.2). 색은 중립·피드백·기본 컴포넌트 전용 5개만, 색이 아니면 글꼴을 뺀 전부 */
function allowedInUtilCss(hook: string): boolean {
  if (hook.startsWith("--slds-g-font-family")) return false;
  if (!hook.includes("color")) return true;
  return NEUTRAL_COLOR_PATTERNS.some((p) => p.test(hook)) || FEEDBACK_NAMES.has(hook) || LBC_ONLY_G.includes(hook);
}

/** 토큰 이름. skill 7장 변환 출력의 경로(점 구분)도 받는다: "color.surface.1" → "color/surface/1" */
export function figmaToToken(name: string): string | undefined {
  const path = name.trim().replace(/\./g, "/");
  return FIGMA_NAME.test(path) ? `--token-${path.replace(/\//g, "-")}` : undefined;
}

/** Figma 변수 하나의 판정. readGHooks는 dist/hooks-index.json의 readGHooks다 */
export function mapFigmaVariable(name: string, readGHooks: Set<string>): TokenVerdict {
  const figma = name.trim().replace(/\./g, "/");
  const token = figmaToToken(figma);
  if (!token) return { figma, verdict: 6, note: "이름이 <종류>/<역할>/<단계> 형식이 아니다(docs/milvus/figma.md 2장). 역할 이름으로 바꿔 달라고 돌려준다" };

  const [kind, second, ...rest] = figma.split("/");
  const kindKey = kind === "font" ? `font/${second}` : kind;
  if (!(kindKey in KIND_TO_HOOK)) return { figma, verdict: 6, note: `종류 ${kind}는 대응표에 없다(color, spacing, radius, shadow, sizing, font/scale, font/weight, palette)` };
  const piece = KIND_TO_HOOK[kindKey];
  if (piece === null) return { figma, token, verdict: 2, note: `${kindKey}는 hook이 없다. 토큰만 둔다` };

  const tail = kind === "font" ? rest : [second, ...rest];
  const hook = `--slds-g-${piece}${tail.join("-")}`;
  if (BRAND_COLOR_PATTERNS.some((p) => p.test(hook))) {
    return { figma, token, hook, verdict: 3, note: "브랜드 색 계열. 값은 BrandingSet의 BRAND_COLOR로 제안하고 hook은 쓰지 않는다(org 테마가 원본)" };
  }
  if (!readGHooks.has(hook)) return { figma, token, verdict: 2, note: `${hook}는 읽는 곳이 없는 이름이다. 토큰만 둔다(프로젝트 컴포넌트가 읽는다)` };
  if (!allowedInUtilCss(hook)) return { figma, token, hook, verdict: 5, note: `${hook}는 util.css에 쓰지 않는 hook이다. 토큰만 둔다(SLDS 기본 컴포넌트에는 닿지 않는다)` };
  return { figma, token, hook, verdict: 4, note: `util.css에 ${hook}: var(${token})` };
}

/** 여러 변수를 한 번에. skill이 `경로 값` 출력의 경로 열을 넣는다 */
export function mapFigmaVariables(names: string[], readGHooks: Set<string>): TokenVerdict[] {
  return names.map((n) => mapFigmaVariable(n, readGHooks));
}
