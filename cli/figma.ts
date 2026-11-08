// milvus figma (#111, #112). 결과는 패키지의 Figma 플러그인과 함께 <root>/.milvus/figma에 둔다. init이 .milvus/를 .gitignore에 넣는다.
//   초기 세팅  프로젝트 브랜드(BrandingSet의 BRAND_COLOR, milvusBrand.css)와 패키지 컴포넌트로 figma-data.json(Foundations + 컴포넌트 전체)
//   component  고른 프로젝트 LWC만 코드(.html·.css)에서 읽어 figma-update.json
//   page       고른 FlexiPage만 XML에서 읽어 figma-update.json
// 옵션 없이 터미널에서 실행하면 무엇을 만들지와 이름(쉼표로 여러 개)을 묻는다
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { readBranding } from "../lib/branding.ts";
import { buildFigmaData, figmaDataSummary, type CapturedComponent } from "../lib/figma-data.ts";
import { lwcToTree, pageToTree, parseFlexiPage, parseRules } from "../lib/figma-migrate.ts";
import { sfdxLwcModules } from "../lib/lwc-build.ts";
import { assertSameVersion, findProject, packageInfo, readConfig } from "./context.ts";

const USAGE = "사용법: pnpm milvus figma [--name <표지에 쓸 이름>] | --component <LWC,…> | --page <FlexiPage,…>";
const OUT = ".milvus/figma";
const PLUGIN_FILES = ["manifest.json", "code.js", "ui.html"];
const BRANDING_SETS = "force-app/main/default/brandingSets";
const BRAND_CSS = "force-app/main/default/staticresources/milvusBrand.css";
const list = (s: string | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

type Deps = { cwd?: string; pkgRoot?: string; ask?: (q: string) => Promise<string> };

async function askTerminal(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(q);
  } finally {
    rl.close();
  }
}

export async function runFigma(argv: string[], deps: Deps = {}): Promise<number> {
  let values: { name?: string; component?: string; page?: string };
  try {
    ({ values } = parseArgs({ args: argv, options: { name: { type: "string" }, component: { type: "string" }, page: { type: "string" } } }));
  } catch {
    process.stderr.write(`milvus figma 실패: 옵션이 올바르지 않습니다: ${argv.join(" ")}\n${USAGE}\n`);
    return 1;
  }
  try {
    const root = findProject(deps.cwd ?? process.cwd()).root;
    const config = readConfig(root);
    const pkgRoot = deps.pkgRoot ?? packageInfo().root;
    if (config) assertSameVersion(config, pkgRoot);
    let components = list(values.component);
    let pages = list(values.page);
    const ask = deps.ask ?? (process.stdin.isTTY ? askTerminal : undefined);
    if (!components.length && !pages.length && !values.name && ask) {
      const pick = (await ask("무엇을 Figma로 옮길까요? 1) 초기 세팅(Foundations·컴포넌트 전체)  2) component  3) page [1]: ")).trim() || "1";
      if (pick === "2" || pick === "component") components = list(await ask("LWC 이름(쉼표로 여러 개): "));
      else if (pick === "3" || pick === "page") pages = list(await ask("FlexiPage 이름(쉼표로 여러 개): "));
      else if (pick !== "1") throw new Error(`1, 2, 3 중에서 고르세요: ${pick}`);
      if ((pick === "2" || pick === "3") && !components.length && !pages.length) throw new Error("이름을 하나 이상 입력하세요");
    }
    const out = join(root, OUT);
    mkdirSync(out, { recursive: true });
    for (const f of PLUGIN_FILES) copyFileSync(join(pkgRoot, "figma-plugin", f), join(out, f));
    // component·page 는 브랜드 설정 없이 코드만 읽는다(디자인 시스템 저장소에서도 된다)
    if (components.length || pages.length) return writeUpdate({ root, pkgRoot, out, components, pages });
    if (!config) throw new Error("milvus.config.json이 없습니다. 프로젝트에 밀버스를 준비하려면 pnpm milvus init을 먼저 실행하세요");

    const brandingSet = join(root, `${BRANDING_SETS}/LEXTHEMING${config.brand}.brandingSet-meta.xml`);
    if (!existsSync(brandingSet)) throw new Error(`BrandingSet이 없습니다: ${relative(root, brandingSet)}. pnpm milvus init으로 만드세요`);
    const brandCss = join(root, BRAND_CSS);
    const { data, skipped } = buildFigmaData({
      pkgRoot,
      name: values.name ?? config.brand,
      brandColor: readBranding(readFileSync(brandingSet, "utf8")).brandColor,
      utilCss: existsSync(brandCss) ? readFileSync(brandCss, "utf8") : undefined,
    });
    writeFileSync(join(out, "figma-data.json"), JSON.stringify(data) + "\n");
    process.stdout.write(
      `${OUT}/figma-data.json: ${figmaDataSummary(data)}\n` +
        (skipped.length ? `건너뛴 hook ${skipped.length}개(SLDS CSS에 값이 없거나 색·수치가 아님)\n` : "") +
        "다음 단계:\n" +
        `  1. Figma 데스크톱 → 플러그인 → 개발 → 매니페스트에서 플러그인 가져오기 → ${OUT}/manifest.json (처음 한 번)\n` +
        "  2. 플러그인 → 개발 → Milvus Design System → 디자인 시스템 생성 → figma-data.json 선택\n" +
        "  3. 문서 프레임은 파일 → 프레임을 PDF로 내보내기로 외부 제출용 PDF가 된다\n",
    );
    return 0;
  } catch (e) {
    process.stderr.write(`milvus figma 실패: ${(e as Error).message}\n`);
    return 1;
  }
}

function packageDirs(root: string): string[] {
  const { packageDirectories } = JSON.parse(readFileSync(join(root, "sfdx-project.json"), "utf8")) as { packageDirectories: { path: string }[] };
  return packageDirectories.map((d) => resolve(root, d.path));
}

function writeUpdate(o: { root: string; pkgRoot: string; out: string; components: string[]; pages: string[] }): number {
  const req = createRequire(join(o.pkgRoot, "package.json"));
  const slds = parseRules(readFileSync(join(dirname(req.resolve("@salesforce-ux/design-system-2/package.json")), "dist/css/bundled/slds2.cosmos.css"), "utf8"));
  const capFile = join(o.pkgRoot, "figma-plugin/captures/Milvus_DesignSystem.json");
  const captures: CapturedComponent[] = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")).components : [];
  // 프로젝트 LWC(밀버스 패키지 것은 빼고)
  const modules = new Map(sfdxLwcModules(o.root).map((m): [string, string] => [m.name.replace(/^c\//, ""), m.path]).filter(([n]) => !n.startsWith("milvus")));
  const project = new Set(modules.keys());
  const missing = o.components.filter((n) => !modules.has(n));
  if (missing.length) throw new Error(`프로젝트 LWC를 찾지 못했습니다: ${missing.join(", ")}. 있는 것: ${[...project].join(", ") || "없음"}`);

  const lines: string[] = [];
  const components = o.components.map((name) => {
    const js = modules.get(name)!;
    const html = js.replace(/\.js$/, ".html");
    const css = js.replace(/\.js$/, ".css");
    if (!existsSync(html)) throw new Error(`${relative(o.root, html)}가 없습니다(템플릿 없는 LWC는 그릴 수 없음)`);
    const { tree, report } = lwcToTree({ name, html: readFileSync(html, "utf8"), css: existsSync(css) ? readFileSync(css, "utf8") : "", captures, project, slds });
    lines.push(`component ${name}: 직접 값 ${report.literals}건${report.hidden ? `, 조건부(lwc:if 등) ${report.hidden}개는 숨김 레이어` : ""}${report.unknown.length ? `, Figma에 없는 것 ${report.unknown.join(" ")}(이름 붙인 틀·자리 표시)` : ""}`);
    return { name, tree, report };
  });

  const flexiFiles = new Map<string, string>();
  for (const dir of packageDirs(o.root))
    for (const f of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
      const m = /(?:^|[\\/])flexipages[\\/]([^\\/]+)\.flexipage-meta\.xml$/.exec(f);
      if (m && !flexiFiles.has(m[1])) flexiFiles.set(m[1], join(dir, f));
    }
  const missingPages = o.pages.filter((n) => !flexiFiles.has(n));
  if (missingPages.length) throw new Error(`FlexiPage를 찾지 못했습니다: ${missingPages.join(", ")}. 있는 것: ${[...flexiFiles.keys()].join(", ") || "없음(sf project retrieve start -m FlexiPage로 받으세요)"}`);
  const pages = o.pages.map((name) => {
    const fp = parseFlexiPage(name, readFileSync(flexiFiles.get(name)!, "utf8"));
    const { tree, notes } = pageToTree(fp, { project });
    const used = [...JSON.stringify(tree).matchAll(/"type":"project","name":"(\w+)"/g)].map((m) => m[1]).filter((n) => !o.components.includes(n));
    lines.push(`page ${name} (${fp.template})${notes.length ? `: ${notes.join("; ")}` : ""}`);
    if (used.length) lines.push(`  페이지에 쓰인 프로젝트 LWC ${[...new Set(used)].join(", ")}: Figma에 없으면 먼저 --component로 옮기세요(없으면 자리 표시로 그림)`);
    return { name, label: fp.label, template: fp.template, tree, notes };
  });

  const file = join(o.out, "figma-update.json");
  writeFileSync(file, JSON.stringify({ kind: "update", generatedAt: new Date().toISOString(), components, pages }) + "\n");
  process.stdout.write(
    `${relative(o.root, file)}: component ${components.length}개, page ${pages.length}개\n` +
      lines.map((l) => `  ${l}\n`).join("") +
      "다음 단계: Figma 플러그인 → 개발 → Milvus Design System → 선택한 것만 반영 → figma-update.json 선택\n" +
      "  (초기 세팅이 된 파일이어야 한다. 같은 이름은 지우고 다시 그린다)\n",
  );
  return 0;
}
