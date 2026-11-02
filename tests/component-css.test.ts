import { test } from "node:test";
import assert from "node:assert/strict";
import { checkComponentCss, directValues, stripVar } from "../lib/component-css.ts";

const rulesOf = (css: string) => checkComponentCss(css, "force-app/main/default/lwc/acmeCard/acmeCard.css").map((i) => i.rule);

test("var()의 fallback 안 리터럴, 0·1px, 퍼센트·단위 없는 수는 허용한다", () => {
  assert.deepEqual(
    rulesOf(`.card {
  background: var(--slds-g-color-surface-1, #ffffff);
  color: var(--token-color-on-surface-3, #1d1c1d);
  padding: var(--slds-g-spacing-4, 1rem) 0;
  border: 1px solid var(--slds-g-color-border-1, #c9c9c9);
  width: 100%;
  line-height: 1.5;
  opacity: 0.5;
  gap: calc(var(--token-spacing-4, 1rem) - 1px);
  transition: color var(--milvus-motion-duration-fast, 0.1s);
}`),
    [],
  );
});

test("값 자리의 hex·rgb·hsl 색과 px·rem·em 길이는 direct-value다", () => {
  for (const decl of [
    "color: #007a5a;",
    "background: rgba(29, 28, 29, 0.13);",
    "border-color: hsl(120 40% 50%);",
    "padding: 12px;",
    "font-size: 0.9375rem;",
    "margin: 0 2px;",
    "width: calc(100% - 20px);",
    "box-shadow: 0 1px 3px rgba(0,0,0,.08);",
    "--acme-gap: 8px;",
  ]) {
    assert.deepEqual(rulesOf(`.x { ${decl} }`), ["direct-value"], decl);
  }
  assert.deepEqual(directValues("0 2px 5px rgba(0,0,0,0.1) inset"), ["rgba()", "2px", "5px"]);
  assert.equal(stripVar("var(--a, var(--b, #fff)) solid 1px"), " solid 1px");
});

test("hook·토큰·밀버스 변수 정의와 @import는 막는다", () => {
  assert.deepEqual(rulesOf(":host { --slds-g-color-surface-1: #fff; }"), ["define-hook"]);
  assert.deepEqual(rulesOf(":host { --token-color-surface-1: var(--x); }"), ["define-hook"]);
  assert.deepEqual(rulesOf(":host { --milvus-modal-width-base: 40rem; }"), ["define-hook"]);
  assert.deepEqual(rulesOf('@import "c/slackTokens";\n.x { color: var(--token-a, #000); }'), ["import"]);
});

test("문법 오류는 syntax 하나로 알린다", () => {
  assert.deepEqual(rulesOf(".x { color: var(--a"), ["syntax"]);
});
