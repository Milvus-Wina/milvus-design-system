import { test } from "node:test";
import assert from "node:assert/strict";
import { lwcToTree, pageToTree, parseFlexiPage, parseMarkup, parseRules, type MNode } from "../lib/figma-migrate.ts";
import type { CapturedComponent } from "../lib/figma-data.ts";

const cap = (group: "slds" | "milvus", name: string, tag: string, variants: Record<string, string>[]): CapturedComponent => ({
  group,
  name,
  tag,
  story: "basic",
  brand: "Milvus_DesignSystem",
  interactive: true,
  variants: variants.map((attrs) => ({ name: attrs.variant ?? "1", attrs, states: {} })),
});
const captures = [
  cap("slds", "Button", "lightning-button", [{ variant: "base", label: "Base" }, { variant: "neutral", label: "Neutral" }, { variant: "brand", label: "Brand" }]),
  cap("slds", "Card", "lightning-card", [{ variant: "base" }]),
  cap("milvus", "Badge", "c-milvus-badge", [{ variant: "default", label: "default" }, { variant: "success", label: "success" }]),
  cap("milvus", "MultiSelect", "c-milvus-multi-select", [{ label: "지역", placeholder: "지역 검색" }]),
];
const slds = parseRules(".slds-grid{display:flex}.slds-p-around_medium,.slds-p-around--medium{padding:var(--slds-g-spacing-4)}.slds-p-around_small{padding:var(--slds-g-spacing-3)}");
const all = (n: MNode): MNode[] => [n, ...(n.type === "frame" ? n.children.flatMap(all) : [])];

test("마크업 읽기: 속성·닫는 태그·빈 요소·주석", () => {
  const root = parseMarkup('<template><!-- x --><div class="a" hidden><input value="1"><span>안 &amp; 녕</span></div></template>');
  const div = (root.children[0] as { children: unknown[] }).children[0] as { tag: string; attrs: Record<string, string>; children: unknown[] };
  assert.equal(div.tag, "div");
  assert.deepEqual(div.attrs, { class: "a", hidden: "" });
  assert.equal(div.children.length, 2); // input 은 닫지 않아도 형제로
});

test("LWC → 인스턴스·자동 레이아웃: 변형은 속성으로, 없으면 기본값, 폭은 12칸·slds-size", () => {
  const html = `<template>
    <lightning-card title="계정">
      <div class="slds-grid slds-p-around_medium">
        <div class="slds-size_1-of-2"><c-milvus-badge label="활성" variant="success"></c-milvus-badge></div>
        <div class="slds-size_1-of-2"><p class="t">{name}</p></div>
      </div>
      <template lwc:if={ok}><lightning-button label="취소"></lightning-button></template>
      <lightning-layout><lightning-layout-item size="4" padding="around-small"><lightning-button variant="brand" label="저장"></lightning-button></lightning-layout-item></lightning-layout>
      <c-acme-header></c-acme-header><c-unknown-thing></c-unknown-thing>
      <c-wrap-thing><lightning-button label="안"></lightning-button></c-wrap-thing><svg><use href="/x.svg#attach"></use></svg>
    </lightning-card>
  </template>`;
  const { tree, report } = lwcToTree({ name: "acmeSummary", html, css: ":host{padding:var(--slds-g-spacing-2)} .t{font-weight:bold;color:var(--slds-g-color-on-surface-3)}", captures, project: new Set(["acmeHeader"]), slds, width: 960 });
  const nodes = all(tree);
  const inst = nodes.filter((n) => n.type === "instance") as Extract<MNode, { type: "instance" }>[];
  // 글자는 캡처 예시(label 등)를 코드 값으로 바꾼다
  assert.deepEqual(inst.map((n) => [n.section, n.variant, n.texts?.[0]?.to]), [["Badge", "Success", "활성"], ["SLDS · Button", "Neutral", "취소"], ["SLDS · Button", "Brand", "저장"], ["SLDS · Button", "Neutral", "안"]]);
  assert.deepEqual(inst[1].texts, [{ from: "Neutral", to: "취소" }]);
  const card = nodes.find((n) => n.type === "frame" && n.name === "lightning-card") as Extract<MNode, { type: "frame" }>;
  assert.ok(card, "안에 요소가 있는 카드는 틀 프레임");
  const grid = nodes.find((n) => n.type === "frame" && n.name === "slds-grid") as Extract<MNode, { type: "frame" }>;
  assert.equal(grid.dir, "HORIZONTAL");
  assert.deepEqual(grid.pad, ["spacing/4", "spacing/4", "spacing/4", "spacing/4"]);
  assert.deepEqual(grid.children.map((c) => c.type === "frame" && c.width), [464, 464]);
  const item = nodes.find((n) => n.type === "frame" && n.name === "layout-item 4/12") as Extract<MNode, { type: "frame" }>;
  assert.equal(item.width, 309);
  assert.deepEqual(item.pad, ["spacing/3", "spacing/3", "spacing/3", "spacing/3"]);
  assert.ok(nodes.some((n) => n.type === "frame" && n.name === "lwc:if {ok}" && n.hidden), "조건은 숨김 레이어, 이름에 조건");
  assert.equal(report.hidden, 1);
  assert.ok(nodes.some((n) => n.type === "text" && n.chars === "{name}" && n.bold && n.color === "color/on-surface/3"));
  assert.ok(nodes.some((n) => n.type === "project" && n.name === "acmeHeader"));
  assert.deepEqual(report.unknown, ["c-unknown-thing", "c-wrap-thing"]);
  assert.ok(nodes.some((n) => n.type === "frame" && n.name === "<c-wrap-thing>" && n.children.some((k) => k.type === "instance")), "모르는 틀도 안의 내용은 살린다");
  assert.ok(nodes.some((n) => n.type === "placeholder" && n.label === "아이콘 attach"));
  assert.deepEqual(tree.type === "frame" && tree.pad, ["spacing/2", "spacing/2", "spacing/2", "spacing/2"]);
});

test("LightningModal: 머리 제목 가운데·바닥 버튼 오른쪽, 요소의 lwc:if 는 숨김, placeholder 글자 바꾸기, 넓은 컴포넌트는 FILL", () => {
  const html = `<template>
    <lightning-modal-header label="단계 필터"></lightning-modal-header>
    <lightning-modal-body>
      <c-milvus-multi-select label="기회 단계" placeholder="단계 검색"></c-milvus-multi-select>
      <c-milvus-badge lwc:if={confirming} variant="success" label="확인"></c-milvus-badge>
    </lightning-modal-body>
    <lightning-modal-footer><lightning-button label="취소"></lightning-button><lightning-button variant="brand" label="적용"></lightning-button></lightning-modal-footer>
  </template>`;
  const wide = captures.map((x) => (x.name === "MultiSelect" ? { ...x, variants: x.variants.map((v) => ({ ...v, states: { Default: { type: "frame" as const, w: 1168, h: 60 } } })) } : x));
  const { tree, report } = lwcToTree({ name: "acmeFilter", html, captures: wide, project: new Set(), slds });
  assert.equal(tree.type === "frame" && tree.radius, "radius/2");
  const kidsOf = (tree as Extract<MNode, { type: "frame" }>).children;
  assert.deepEqual(kidsOf.map((k) => (k.type === "frame" ? k.name : k.type)), ["lightning-modal-header", "divider", "lightning-modal-body", "divider", "lightning-modal-footer"]);
  const [head, , body, , foot] = kidsOf as Extract<MNode, { type: "frame" }>[];
  assert.equal(head.justify, "CENTER");
  assert.deepEqual(head.children, [{ type: "text", chars: "단계 필터", bold: true, size: "font/scale/3" }]);
  assert.equal(foot.dir, "HORIZONTAL");
  assert.equal(foot.justify, "MAX");
  const ms = body.children[0] as Extract<MNode, { type: "instance" }>;
  assert.deepEqual(ms.texts, [{ from: "지역", to: "기회 단계" }, { from: "지역 검색", to: "단계 검색" }]);
  assert.equal(ms.fill, true);
  assert.equal(body.children[1].type === "frame" && body.children[1].hidden, true);
  assert.deepEqual(report.unknown, []);
});

const FLEXI = `<?xml version="1.0" encoding="UTF-8"?>
<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
  <flexiPageRegions><itemInstances><componentInstance><componentName>record_flexipage:dynamicHighlights</componentName></componentInstance></itemInstances><name>header</name><type>Region</type></flexiPageRegions>
  <flexiPageRegions><itemInstances><componentInstance><componentInstanceProperties><name>title</name><value>Standard.Tab.detail</value></componentInstanceProperties><componentInstanceProperties><name>active</name><value>true</value></componentInstanceProperties><componentInstanceProperties><name>body</name><value>detailTab</value></componentInstanceProperties><componentName>flexipage:tab</componentName></componentInstance></itemInstances><name>maintabs</name><type>Facet</type></flexiPageRegions>
  <flexiPageRegions><itemInstances><componentInstance><componentName>acmeSummary</componentName></componentInstance></itemInstances><name>detailTab</name><type>Facet</type></flexiPageRegions>
  <flexiPageRegions><itemInstances><componentInstance><componentInstanceProperties><name>tabs</name><value>maintabs</value></componentInstanceProperties><componentName>flexipage:tabset</componentName></componentInstance></itemInstances><name>main</name><type>Region</type></flexiPageRegions>
  <flexiPageRegions><itemInstances><fieldInstance><fieldItem>Record.Name</fieldItem></fieldInstance></itemInstances><name>sidebar</name><type>Region</type></flexiPageRegions>
  <masterLabel>계정 레코드</masterLabel>
  <template><name>flexipage:recordHomeTemplateDesktop</name></template>
  <type>RecordPage</type>
</FlexiPage>`;

test("FlexiPage → 1440 데스크톱 프레임, 템플릿 영역 비율, 탭은 활성 탭만, 프로젝트 LWC 는 인스턴스", () => {
  const fp = parseFlexiPage("Acme_Record", FLEXI);
  assert.equal(fp.template, "flexipage:recordHomeTemplateDesktop");
  assert.equal(fp.label, "계정 레코드");
  const { tree, notes } = pageToTree(fp, { project: new Set(["acmeSummary"]) });
  assert.equal(tree.type === "frame" && tree.width, 1440);
  const nodes = all(tree);
  const regions = nodes.filter((n) => n.type === "frame" && n.name.startsWith("Region/")) as Extract<MNode, { type: "frame" }>[];
  assert.deepEqual(regions.map((r) => [r.name, r.width]), [["Region/header", 1408], ["Region/main", 943], ["Region/sidebar", 453]]); // org 실측(1440)
  assert.ok(nodes.some((n) => n.type === "project" && n.name === "acmeSummary"));
  assert.ok(nodes.some((n) => n.type === "placeholder" && n.label === "record_flexipage:dynamicHighlights"));
  assert.ok(nodes.some((n) => n.type === "text" && n.chars === "Record.Name"));
  assert.ok(nodes.some((n) => n.type === "text" && n.chars === "detail" && n.bold));
  assert.deepEqual(notes, []);
  const unknown = pageToTree(parseFlexiPage("X", FLEXI.replace("flexipage:recordHomeTemplateDesktop", "flexipage:someNewTemplate")), { project: new Set() });
  assert.ok(unknown.notes.some((n) => /모르는 템플릿/.test(n)));
});

test("milvus figma --component·--page: 고른 것만 figma-update.json 으로, 없는 이름은 실패", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { runFigma } = await import("../cli/figma.ts");
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const root = mkdtempSync(join(tmpdir(), "milvus-migrate-"));
  const quiet = async (argv: string[], ask?: (q: string) => Promise<string>) => {
    const [w, e] = [process.stdout.write, process.stderr.write];
    process.stdout.write = process.stderr.write = (() => true) as typeof process.stdout.write;
    return runFigma(argv, { cwd: root, pkgRoot, ask }).finally(() => ([process.stdout.write, process.stderr.write] = [w, e]));
  };
  try {
    writeFileSync(join(root, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
    const version = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version;
    writeFileSync(join(root, "milvus.config.json"), JSON.stringify({ version, targetOrg: "x", brand: "Acme", vf: false, managed: {} }));
    const lwc = join(root, "force-app/main/default/lwc/acmeSummary");
    mkdirSync(lwc, { recursive: true });
    writeFileSync(join(lwc, "acmeSummary.js"), "export default class {}");
    writeFileSync(join(lwc, "acmeSummary.html"), '<template><lightning-button variant="brand" label="저장"></lightning-button></template>');
    mkdirSync(join(root, "force-app/main/default/flexipages"), { recursive: true });
    writeFileSync(join(root, "force-app/main/default/flexipages/Acme_Record.flexipage-meta.xml"), FLEXI);

    assert.equal(await quiet(["--component", "acmeSummary", "--page", "Acme_Record"]), 0);
    const out = JSON.parse(readFileSync(join(root, ".milvus/figma/figma-update.json"), "utf8"));
    assert.equal(out.kind, "update");
    assert.deepEqual(out.components.map((c: { name: string }) => c.name), ["acmeSummary"]);
    assert.deepEqual(out.pages.map((p: { name: string }) => p.name), ["Acme_Record"]);
    assert.equal(await quiet(["--component", "acmeSummary,nope"]), 1);
    assert.equal(await quiet(["--page", "Nope"]), 1);
    // 묻기: 3) page → 이름
    const answers = ["3", "Acme_Record"];
    assert.equal(await quiet([], async () => answers.shift()!), 0);
    assert.deepEqual(JSON.parse(readFileSync(join(root, ".milvus/figma/figma-update.json"), "utf8")).components, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
