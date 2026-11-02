// 프로젝트 컴포넌트 CSS 규칙(토큰 층 설계 2026-11-02 4.6, #94). 값 자리의 직접 값을 막고, hook·토큰은 var(…, fallback)로 읽게 한다.
// - 직접 값: hex·rgb()·hsl() 색, px·rem·em 길이. 0과 1px(테두리)은 허용. var( … ) 안(fallback)의 리터럴은 허용(SLDS Linter의 fallback 규칙과 같은 방향)
// - 컴포넌트 CSS에서 --slds-*·--token-*·--milvus-*를 정의하지 않는다(값의 원본은 util.css)
// - @import로 토큰 모듈을 들이지 않는다(토큰은 :root에만 있다)
// 밀버스 관리 컴포넌트(lwc/milvus*)는 check가 넘기지 않는다. SLDS Linter는 hook 변수에 넣은 직접 색을 잡지 못해 이 검사가 필요하다(실습 2026-10-30 발견 2)
// ponytail: 이름 색(red, white)은 보지 않는다. 실제로 나오면 키워드 목록을 더한다
import postcss, { CssSyntaxError } from "postcss";
import type { Issue } from "./rules.ts";

const ALLOWED = new Set(["0", "1px", "0px", "0rem", "0em"]);
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi;
const LENGTH = /(?<![\w.-])-?\d*\.?\d+(?:px|rem|em)\b/g;

/** var( … )를 괄호 균형으로 지운다. fallback 안의 리터럴은 허용이라 보지 않는다 */
export function stripVar(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; ) {
    const at = value.indexOf("var(", i);
    if (at < 0) return out + value.slice(i);
    out += value.slice(i, at);
    let depth = 0;
    let j = at + 3;
    for (; j < value.length; j++) {
      if (value[j] === "(") depth++;
      else if (value[j] === ")" && --depth === 0) break;
    }
    i = j + 1;
  }
  return out;
}

/** 값 자리의 직접 값 목록. 없으면 빈 배열 */
export function directValues(value: string): string[] {
  const v = stripVar(value.replace(/\/\*[\s\S]*?\*\//g, " "));
  const found = [...(v.match(COLOR) ?? []), ...(v.match(LENGTH) ?? [])].map((s) => s.replace(/\($/, "()"));
  return [...new Set(found.filter((s) => !ALLOWED.has(s.toLowerCase())))];
}

/** 컴포넌트 CSS 하나를 본다. file은 루트 기준 경로. 문제가 없으면 빈 배열 */
export function checkComponentCss(css: string, file: string): Issue[] {
  const issues: Issue[] = [];
  let root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    if (!(e instanceof CssSyntaxError)) throw e;
    return [{ file, rule: "syntax", message: `CSS 문법 오류(${e.line}줄): ${e.reason}` }];
  }
  root.walkAtRules((at) => {
    if (at.name === "import") issues.push({ file, rule: "import", message: `@import ${at.params}: 토큰·hook은 :root(util.css)에만 있다. 컴포넌트 CSS는 var(--token-*, fallback)로 읽는다` });
  });
  root.walkDecls((d) => {
    if (/^--(?:slds|token|milvus)-/.test(d.prop)) {
      issues.push({ file, rule: "define-hook", message: `${d.prop}: 컴포넌트 CSS에서 hook·토큰·밀버스 변수를 정의하지 않는다. 값의 원본은 milvusBrand.css(util.css)다` });
      return;
    }
    const direct = directValues(d.value);
    if (direct.length) {
      issues.push({
        file,
        rule: "direct-value",
        message: `${d.prop}: ${d.value} — 직접 값 ${direct.join(", ")}. 토큰이나 hook을 var(--token-*, fallback)·var(--slds-g-*, fallback)로 읽는다. fallback 안의 값과 0·1px은 허용`,
      });
    }
  });
  return issues;
}
