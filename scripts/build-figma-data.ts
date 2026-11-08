/**
 * 이 저장소의 브랜드로 figma-data.json을 만든다(#111). 고객 프로젝트에서는 pnpm milvus figma가 같은 일을 한다.
 * 결과는 figma-plugin/ 플러그인(Figma 데스크톱 → 플러그인 → 개발 → 매니페스트에서 가져오기)의 입력이다.
 *
 * 사용: node scripts/build-figma-data.ts [--brand Milvus_DesignSystem] [--name Milvus] [--out figma-plugin/figma-data.json]
 *   --brand  brands/ 아래 폴더(theme.json의 BRAND_COLOR·팔레트, 있으면 util.css·cover.jpg·logo-white.png), --name  표지에 쓰는 이름
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigmaData, figmaDataSummary } from "../lib/figma-data.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const brand = arg("brand", "Milvus_DesignSystem");
const out = resolve(arg("out", join(root, "figma-plugin/figma-data.json")));
const theme = JSON.parse(readFileSync(join(root, "brands", brand, "theme.json"), "utf8"));
const util = join(root, "brands", brand, "util.css");

const { data, skipped } = buildFigmaData({
  pkgRoot: root,
  name: arg("name", "Milvus"),
  brandColor: theme.brandColor,
  brandPalette: theme.palette,
  utilCss: existsSync(util) ? readFileSync(util, "utf8") : undefined,
  captureBrand: existsSync(join(root, `figma-plugin/captures/${brand}.json`)) ? brand : undefined,
  // 표지 배경 사진(cover.jpg|png)과 컬러 바탕용 흰 로고(logo-white.png). 브랜드 폴더에 있을 때만 쓴다
  cover: {
    image: ["cover.jpg", "cover.png"].map((f) => join(root, "brands", brand, f)).find(existsSync),
    logo: [join(root, "brands", brand, "logo-white.png")].find(existsSync),
  },
});
writeFileSync(out, JSON.stringify(data) + "\n");
console.log(`${relative(process.cwd(), out)}: ${figmaDataSummary(data)}`);
for (const s of skipped) console.warn(`! 건너뜀 ${s}`);
