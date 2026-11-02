import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { hooksIndexFromSource } from "../lib/hooks-index.ts";
import { figmaToToken, mapFigmaVariable } from "../lib/tokens.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const readG = new Set(hooksIndexFromSource(root).readGHooks);
const map = (name: string) => mapFigmaVariable(name, readG);

test("설계 4.3 표의 실습 값은 같은 판정을 낸다", () => {
  const rows: [string, number, string | undefined, string | undefined][] = [
    ["color/surface/1", 4, "--token-color-surface-1", "--slds-g-color-surface-1"],
    ["color/on-surface/3", 4, "--token-color-on-surface-3", "--slds-g-color-on-surface-3"],
    ["color/border/1", 4, "--token-color-border-1", "--slds-g-color-border-1"],
    ["color/accent/1", 3, "--token-color-accent-1", "--slds-g-color-accent-1"],
    ["color/accent/2", 3, "--token-color-accent-2", "--slds-g-color-accent-2"],
    ["spacing/4", 4, "--token-spacing-4", "--slds-g-spacing-4"],
    ["shadow/button", 2, "--token-shadow-button", undefined],
    ["sizing/icon/20", 2, "--token-sizing-icon-20", undefined],
    ["palette/green/50", 2, "--token-palette-green-50", undefined],
    ["font/scale/neg-2", 4, "--token-font-scale-neg-2", "--slds-g-font-scale-neg-2"],
    ["font/weight/bold", 2, "--token-font-weight-bold", undefined],
    ["radius/pill", 4, "--token-radius-pill", "--slds-g-radius-border-pill"],
  ];
  for (const [figma, verdict, token, hook] of rows) {
    const r = map(figma);
    assert.equal(r.verdict, verdict, `${figma}: ${r.note}`);
    assert.equal(r.token, token, figma);
    assert.equal(r.hook, hook, figma);
  }
});

test("util.css가 받지 않는 색 hook(팔레트 색 등)은 5, 형식 밖 이름(값 이름, 대문자, 모르는 종류)은 6이고 토큰을 만들지 않는다", () => {
  const r = map("color/palette/blue-50");
  assert.equal(r.verdict, readG.has("--slds-g-color-palette-blue-50") ? 5 : 2, r.note);
  for (const bad of ["Slack/UI/1D1C1D-30%", "color", "Color/surface/1", "opacity/50"]) {
    const v = map(bad);
    assert.equal(v.verdict, 6, bad);
    assert.equal(v.token, undefined, bad);
  }
  // skill 7장 변환 출력의 점 경로도 받는다
  assert.equal(figmaToToken("color.surface.1"), "--token-color-surface-1");
  assert.equal(map("spacing.4").hook, "--slds-g-spacing-4");
});
