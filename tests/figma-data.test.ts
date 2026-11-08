import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTokens, hookToFigma, mapCaptureValues, parseStoryOptions, parseVars, resolveVar, toFigmaComponent, toHex, toPx, type CaptureNode } from "../lib/figma-data.ts";

test("hook 이름 → Figma 역할 변수 이름(docs/milvus/figma.md 2장)", () => {
  assert.equal(hookToFigma("--slds-g-color-on-surface-1"), "color/on-surface/1");
  assert.equal(hookToFigma("--slds-g-color-success-container-1"), "color/success-container/1");
  assert.equal(hookToFigma("--slds-g-spacing-4"), "spacing/4");
  assert.equal(hookToFigma("--slds-g-radius-border-pill"), "radius/pill");
  assert.equal(hookToFigma("--slds-g-font-scale-neg-1"), "font/scale/neg-1");
  assert.equal(hookToFigma("--slds-g-sizing-border-1"), "sizing/border/1");
  assert.equal(hookToFigma("--slds-g-shadow-1"), undefined);
});

test("var 사슬과 light-dark, 값 변환", () => {
  const vars = parseVars(":root{--a: var(--b); --b: light-dark(var(--c), #000); --c:#fff; --d: var(--none, 0.5rem)}");
  assert.deepEqual(resolveVar("--a", vars), { value: "#fff", refs: ["--a", "--b", "--c"] });
  assert.equal(resolveVar("--d", vars).value, "0.5rem");
  assert.equal(toHex("#fff"), "#FFFFFF");
  assert.equal(toHex("rgb(1, 118, 211)"), "#0176D3");
  assert.equal(toHex("rgba(0,0,0,0.5)"), undefined);
  assert.equal(toPx("0.5rem"), 8);
  assert.equal(toPx("calc(1rem + 2px)"), undefined);
});

test("브랜드 색 계열은 테마 팔레트 값, 원시 이름은 palette/<색>/<단계>", () => {
  const sldsCss = ":root{--slds-r-color-brand-50:#066afe; --slds-g-color-accent-1: var(--slds-r-color-brand-50); --slds-g-color-brand-base-50: var(--slds-r-color-brand-50); --slds-g-color-on-surface-1:#757575; --slds-g-spacing-4: 1rem; --slds-g-spacing-var-4: var(--slds-g-spacing-4)}";
  const t = buildTokens({
    sldsCss,
    hooks: ["--slds-g-color-accent-1", "--slds-g-color-brand-base-50", "--slds-g-color-on-surface-1", "--slds-g-spacing-4", "--slds-g-spacing-var-4"],
    brandColor: "#0176D3",
    brandPalette: { 50: "#2976ca" },
  });
  assert.deepEqual(t.color.map((c) => [c.name, c.palette, c.scopes[0]]), [
    ["color/accent/1", "palette/brand/50", "FRAME_FILL"],
    ["color/on-surface/1", "palette/value/757575", "TEXT_FILL"],
  ]);
  assert.equal(t.palette["palette/brand/50"], "#2976CA");
  assert.deepEqual(t.number, [{ name: "spacing/4", hook: "--slds-g-spacing-4", value: 16, web: "var(--slds-g-spacing-4)", scopes: ["GAP"] }]);
});

test("스토리 argTypes 선택지는 상수도 따라가고, @api와 합쳐 Figma 속성이 된다", () => {
  const storySrc = `const VARIANTS = ["brand", "destructive"];
export default { args: { options: OPTIONS }, argTypes: {
  variant: { control: "select", options: VARIANTS },
  size: { control: "inline-radio", options: ["small", "large"] },
  label: { control: "text" }
} };
export const 기본 = {};
export const 소스_코드 = x;`;
  assert.deepEqual(parseStoryOptions(storySrc), { variant: ["brand", "destructive"], size: ["small", "large"] });
  const c = toFigmaComponent(
    {
      folder: "milvusFoo", exportName: "MilvusFoo", tag: "c-milvus-foo", storyName: "Foo", description: "설명",
      props: [
        { name: "variant", control: "text", value: "destructive" },
        { name: "busy", control: "boolean", value: false },
        { name: "disabled", control: "boolean", value: false },
        { name: "label", control: "text", value: "확인" },
      ],
    },
    { storySrc, html: "<template><div></div></template>", source: "x" },
  );
  assert.deepEqual(c.props, [
    { name: "Variant", type: "VARIANT", values: ["Brand", "Destructive"], default: "Destructive" },
    { name: "Size", type: "VARIANT", values: ["Small", "Large"], default: "Small" },
    { name: "Busy", type: "BOOLEAN", default: false },
    { name: "State", type: "VARIANT", values: ["Default", "Disabled"], default: "Default" },
    { name: "Label", type: "TEXT", default: "확인" },
  ]);
  assert.deepEqual(c.stories, ["기본"]);
  assert.equal(c.visual, true);
  const loader = { folder: "milvusLoader", exportName: "MilvusLoader", tag: "c-milvus-loader", storyName: "Loader", description: "", props: [] };
  assert.equal(toFigmaComponent(loader, { html: "<template></template>", source: "" }).visual, false);
});

test("milvus figma: 프로젝트 BrandingSet 색으로 .milvus/figma에 플러그인과 figma-data.json을 둔다", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { runFigma } = await import("../cli/figma.ts");
  const { writeBrandingSet } = await import("../lib/branding.ts");
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const root = mkdtempSync(join(tmpdir(), "milvus-figma-"));
  try {
    writeFileSync(join(root, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
    const version = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version;
    writeFileSync(join(root, "milvus.config.json"), JSON.stringify({ version, targetOrg: "x", brand: "Acme", vf: false, managed: {} }));
    mkdirSync(join(root, "force-app/main/default/brandingSets"), { recursive: true });
    writeFileSync(join(root, "force-app/main/default/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml"), writeBrandingSet({ name: "Acme", brandColor: "#2E7D32" }));
    const write = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    const code = await runFigma([], { cwd: root, pkgRoot }).finally(() => (process.stdout.write = write));
    assert.equal(code, 0);
    for (const f of ["manifest.json", "code.js", "ui.html", "figma-data.json"]) assert.ok(existsSync(join(root, ".milvus/figma", f)), f);
    const data = JSON.parse(readFileSync(join(root, ".milvus/figma/figma-data.json"), "utf8"));
    assert.deepEqual({ name: data.brand.name, brandColor: data.brand.brandColor }, { name: "Acme", brandColor: "#2E7D32" });
    assert.ok(data.brand.cover.milvusLogo, "표지용 밀버스 흰 로고가 들어간다");
    assert.ok(data.components.some((c: { name: string }) => c.name === "Badge"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Storybook에서 읽은 값은 같은 값의 역할 변수로, 쓰임새에 맞는 이름을 고른다", () => {
  const tokens = {
    palette: { "palette/brand/50": "#2976CA", "palette/value/ffffff": "#FFFFFF" },
    color: [
      { name: "color/accent/1", hook: "", palette: "palette/brand/50", web: "", scopes: [] },
      { name: "color/accent-container/1", hook: "", palette: "palette/brand/50", web: "", scopes: [] },
      { name: "color/border-accent/1", hook: "", palette: "palette/brand/50", web: "", scopes: [] },
      { name: "color/on-accent/1", hook: "", palette: "palette/value/ffffff", web: "", scopes: [] },
    ],
    number: [
      { name: "spacing/4", hook: "", value: 16, web: "", scopes: [] },
      { name: "radius/pill", hook: "", value: 240, web: "", scopes: [] },
      { name: "sizing/border/1", hook: "", value: 1, web: "", scopes: [] },
    ],
  };
  const btn: CaptureNode = {
    type: "frame", bg: "rgb(41, 118, 202)", border: { width: 1, color: "rgb(41, 118, 202)" }, radius: 240, gap: 0, pad: [0, 16, 0, 16],
    children: [{ type: "text", chars: "Brand", color: "rgb(255, 255, 255)", fontSize: 13 }, { type: "frame", bg: "rgba(0, 0, 0, 0)", pad: [0, 0, 0, 0] }],
  };
  mapCaptureValues(btn, tokens);
  assert.deepEqual(btn.vars, { bg: "color/accent-container/1", border: "color/border-accent/1", borderWidth: "sizing/border/1", radius: "radius/pill", pad1: "spacing/4", pad3: "spacing/4" });
  assert.equal(btn.literal, undefined);
  assert.deepEqual(btn.children![0].vars, { color: "color/on-accent/1" });
  assert.deepEqual(btn.children![0].literal, ["fontSize=13"]); // font/scale 변수가 없으면 직접 값으로 센다
  assert.equal(btn.children![1].vars, undefined); // 투명은 칠하지 않는다
});
