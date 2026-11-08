// 밀버스 디자인 시스템 Figma 플러그인(#111). figma-data.json 으로 Figma 파일의 변수·문서·컴포넌트를 만든다.
// figma-data.json 은 저장소에서 node scripts/build-figma-data.ts, 고객 프로젝트에서 pnpm milvus figma 가 만든다.
// 표준 Plugin API 만 쓴다(Free 플랜 개발 플러그인). 유료 좌석의 use_figma 에도 같은 코드가 들어간다.
// 페이지는 셋(Starter 플랜은 파일당 3페이지): 표지·기초 / 컴포넌트 / 화면. 그 안은 섹션으로 나눈다

const PAGES = {
  foundations: "📔 Foundations",
  components: "🧩 Components",
  pages: "📄 Pages"
};
const OLD_NAMES = { "📄 Pages": "🧪 Playground" }; // 실습 파일의 옛 이름. 새 페이지를 만들지 않고 이름만 바꾼다

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  };
}
function log(obj) {
  console.log(JSON.stringify(obj, null, 2));
}
async function getPage(name) {
  let p =
    figma.root.children.find((x) => x.name === name) ||
    figma.root.children.find((x) => x.name === OLD_NAMES[name]);
  if (p) p.name = name;
  else {
    // 새 파일의 빈 "Page 1"은 새로 만들지 않고 이름만 바꿔 쓴다(무료 플랜 3페이지). children 은 불러온 뒤에만 읽을 수 있다
    const first = figma.root.children.find((x) => x.name === "Page 1");
    if (first) await first.loadAsync();
    if (first && first.children.length === 0) {
      p = first;
      p.name = name;
    } else {
      p = figma.createPage();
      p.name = name;
    }
  }
  await p.loadAsync();
  return p;
}
function getSection(page, name) {
  return page.children.find((n) => n.type === "SECTION" && n.name === name);
}
async function getCollection(name) {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const col =
    cols.find((c) => c.name === name) ||
    figma.variables.createVariableCollection(name);
  if (col.modes[0].name === "Mode 1")
    col.renameMode(col.modes[0].modeId, "Default"); // figma-use: 'Mode 1' 로 두지 않는다
  return col;
}
function bindPaint(variable) {
  return figma.variables.setBoundVariableForPaint(
    { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
    "color",
    variable
  );
}

const INTER = {
  regular: { family: "Inter", style: "Regular" },
  bold: { family: "Inter", style: "Semi Bold" },
  heavy: { family: "Inter", style: "Bold" }
};
let FONTS = INTER; // 문서 글자: Pretendard, 없으면 Noto Sans KR, 둘 다 없으면 Inter (loadDocFont)
// figma-use: 글꼴 스타일 이름은 파일마다 다르다("SemiBold" / "Semi Bold"). 추측하거나 try/catch 로 찔러 보지 말고 목록에서 확인한다
let FONT_LIST = null;
async function pickFamily(families, styles) {
  FONT_LIST = FONT_LIST || (await figma.listAvailableFontsAsync());
  for (const family of families) {
    const have = new Set(
      FONT_LIST.filter((f) => f.fontName.family === family).map(
        (f) => f.fontName.style
      )
    );
    const found = styles.map((alts) => alts.find((x) => have.has(x)));
    if (found.every(Boolean)) {
      await Promise.all(
        found.map((style) => figma.loadFontAsync({ family, style }))
      );
      return { family, styles: found };
    }
  }
  return null;
}
async function loadDocFont() {
  const got = await pickFamily(
    ["Pretendard", "Noto Sans KR"],
    [["Regular"], ["SemiBold", "Semi Bold"], ["Bold"]]
  );
  if (!got) {
    FONTS = INTER;
    ui("Pretendard·Noto Sans KR 이 없어 문서 글자를 Inter 로 씁니다");
    return;
  }
  const [regular, bold, heavy] = got.styles.map((style) => ({
    family: got.family,
    style
  }));
  FONTS = { regular, bold, heavy };
}
const INK = { type: "SOLID", color: { r: 0.09, g: 0.09, b: 0.09 } };
const PAPER = { type: "SOLID", color: { r: 1, g: 1, b: 1 } };
const MISSING = { type: "SOLID", color: { r: 1, g: 0, b: 1 } }; // 마젠타 = 변수 없음(보고서 unbound)
let VARS = {};
let REPORT = { components: [], unbound: new Set(), noCapture: [] };

// Figma 는 4096px 를 넘는 이미지를 받지 않는다(createImage: Image is too large). 넘으면 건너뛰고 알린다
function imageOf(b64, what) {
  try {
    return figma.createImage(figma.base64Decode(b64));
  } catch (e) {
    ui(
      what +
        " 이미지를 넣지 못했습니다(가로·세로 4096px 이하로 줄여 주세요): " +
        e.message
    );
    return null;
  }
}
function ui(msg) {
  figma.ui.postMessage(msg);
  console.log(msg);
}
function V(name) {
  const v = VARS[name];
  if (!v) REPORT.unbound.add(name);
  return v;
}
function paintOf(name) {
  const v = V(name);
  return v ? bindPaint(v) : MISSING;
}
function bindNum(node, field, name, fallback) {
  const v = V(name);
  if (v) node.setBoundVariable(field, v);
  else node[field] = fallback;
}
function bindRadius(node, name, fallback) {
  for (const k of [
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius"
  ])
    bindNum(node, k, name, fallback);
}
function bindPad(node, x, y) {
  bindNum(node, "paddingLeft", x, 8);
  bindNum(node, "paddingRight", x, 8);
  bindNum(node, "paddingTop", y, 8);
  bindNum(node, "paddingBottom", y, 8);
}
function hug(node, dir) {
  node.layoutMode = dir;
  node.primaryAxisSizingMode = "AUTO";
  node.counterAxisSizingMode = "AUTO";
  node.fills = [];
  return node;
}
function box(parent, name, dir, gap) {
  const f = hug(figma.createFrame(), dir);
  f.name = name;
  if (typeof gap === "string") bindNum(f, "itemSpacing", gap, 8);
  else f.itemSpacing = gap || 0;
  parent.appendChild(f);
  return f;
}
// o: { bold, scale(변수 이름), size(직접 값, 문서 프레임용), color(변수 이름), width(줄바꿈 폭) }
function txt(parent, chars, o = {}) {
  const t = figma.createText();
  t.fontName = o.heavy ? FONTS.heavy : o.bold ? FONTS.bold : FONTS.regular;
  if (o.width) {
    t.textAutoResize = "HEIGHT";
    t.resize(o.width, t.height);
  } // 글자보다 먼저(figma-use)
  t.characters = String(chars);
  if (o.scale) bindNum(t, "fontSize", o.scale, 13);
  else t.fontSize = o.size || 12;
  t.fills = [o.fill || (o.color ? paintOf(o.color) : INK)];
  if (o.name) t.name = o.name;
  parent.appendChild(t);
  if (o.width && t.width === 0) throw new Error("글자 폭이 0: " + chars);
  if (o.lineHeight) t.lineHeight = { value: o.lineHeight, unit: "PERCENT" };
  if (o.url) t.hyperlink = { type: "URL", value: o.url };
  return t;
}
async function getSectionIn(page, name) {
  let s = getSection(page, name);
  if (!s) {
    s = figma.createSection();
    s.name = name;
    page.appendChild(s);
    const xs = page.children
      .filter((n) => n.type === "SECTION" && n !== s)
      .map((n) => n.x + n.width);
    s.x = xs.length ? Math.max(...xs) + 100 : 0;
    s.y = 0;
  }
  return s;
}
function clearSection(section, names) {
  for (const n of [...section.children])
    if (n.name.startsWith("Doc/") || names.includes(n.name)) n.remove();
}
function fitSection(section) {
  const kids = section.children;
  const w = Math.max(...kids.map((n) => n.x + n.width), 900) + 100;
  const h = Math.max(...kids.map((n) => n.y + n.height), 700) + 100;
  section.resizeWithoutConstraints(w, h);
}
function layoutSections(page, perRow, order) {
  // 커진 섹션이 겹치지 않게 줄 맞춤(perRow 개씩 한 줄). order 에 있는 이름이 먼저
  const rank = (n) => {
    const i = order ? order.indexOf(n.name) : -1;
    return i < 0 ? 1e6 : i;
  };
  const list = page.children
    .filter((n) => n.type === "SECTION")
    .sort((a, b) => rank(a) - rank(b) || a.y - b.y || a.x - b.x);
  let x = 0,
    y = 0,
    rowH = 0;
  list.forEach((s, i) => {
    if (perRow && i && i % perRow === 0) {
      x = 0;
      y += rowH + 200;
      rowH = 0;
    }
    s.x = x;
    s.y = y;
    x += s.width + 100;
    rowH = Math.max(rowH, s.height);
  });
}
function docFrame(section, name, width) {
  const f = box(section, "Doc/" + name, "VERTICAL", 16);
  f.fills = [PAPER];
  f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = 48;
  f.resize(width || 960, 100);
  f.counterAxisSizingMode = "FIXED";
  f.primaryAxisSizingMode = "AUTO"; // resize 먼저(figma-use)
  f.x = 100;
  f.y = 100;
  return f;
}

// --- 변수와 텍스트 스타일 ---
async function buildVariables(tokens) {
  const all = await figma.variables.getLocalVariablesAsync();
  const find = (name, col, type) =>
    all.find((v) => v.name === name && v.variableCollectionId === col.id) ||
    figma.variables.createVariable(name, col, type);
  const pal = await getCollection("palette");
  const pm = pal.modes[0].modeId;
  const palVars = {};
  for (const [key, hex] of Object.entries(tokens.palette)) {
    const v = find(key.replace(/^palette\//, ""), pal, "COLOR");
    v.scopes = [];
    v.setValueForMode(pm, hexToRgb(hex));
    palVars[key] = v;
  }
  const mil = await getCollection("milvus");
  const mm = mil.modes[0].modeId;
  for (const c of tokens.color) {
    const v = find(c.name, mil, "COLOR");
    v.scopes = c.scopes;
    v.setValueForMode(
      mm,
      figma.variables.createVariableAlias(palVars[c.palette])
    );
    v.setVariableCodeSyntax("WEB", c.web);
    VARS[c.name] = v;
  }
  for (const n of tokens.number) {
    const v = find(n.name, mil, "FLOAT");
    v.scopes = n.scopes;
    v.setValueForMode(mm, n.value);
    v.setVariableCodeSyntax("WEB", n.web);
    VARS[n.name] = v;
  }
  const styles = await figma.getLocalTextStylesAsync();
  for (const [name, t] of Object.entries(tokens.text)) {
    const s =
      styles.find((x) => x.name === "Text/" + name) || figma.createTextStyle();
    s.name = "Text/" + name;
    s.fontName = { family: t.family, style: t.style };
    s.fontSize = t.size;
    s.lineHeight = { value: t.lineHeight, unit: "PIXELS" };
  }
  return (
    Object.keys(palVars).length + tokens.color.length + tokens.number.length
  );
}

// --- Storybook 에서 읽은 컴포넌트(capture-storybook) → Figma 컴포넌트 세트 ---
// 트리의 값은 이미 역할 변수 이름(node.vars)으로 대응돼 있다. 변수가 없는 값(node.literal)만 직접 값으로 넣고 센다.
// 모든 프레임은 자동 레이아웃이다: flex 는 방향·간격·정렬을 그대로, 그 밖은 자식이 글자·인라인뿐이면 가로, 아니면 세로로 쌓는다
const ALIGN = {
  "flex-start": "MIN",
  start: "MIN",
  normal: "MIN",
  stretch: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  baseline: "BASELINE"
};
const JUSTIFY = {
  "flex-start": "MIN",
  start: "MIN",
  normal: "MIN",
  center: "CENTER",
  "flex-end": "MAX",
  end: "MAX",
  "space-between": "SPACE_BETWEEN"
};
const WEIGHTS = ["Regular", "Medium", "Semi Bold", "Bold"];
let LITERALS = 0;

function parseRgb(css) {
  const m =
    css &&
    /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/.exec(
      css.trim()
    );
  return m
    ? {
        r: +m[1] / 255,
        g: +m[2] / 255,
        b: +m[3] / 255,
        a: m[4] === undefined ? 1 : +m[4]
      }
    : null;
}
function colorPaint(varName, css) {
  const c = parseRgb(css);
  if (!c || c.a === 0) return null;
  const v = varName && V(varName);
  const paint = v
    ? bindPaint(v)
    : { type: "SOLID", color: { r: c.r, g: c.g, b: c.b } };
  return c.a < 1 ? Object.assign({}, paint, { opacity: c.a }) : paint;
}
function weightStyle(w) {
  return w >= 700
    ? "Bold"
    : w >= 600
      ? "Semi Bold"
      : w >= 500
        ? "Medium"
        : "Regular";
}
function setNum(node, field, varName, value) {
  const v = varName && V(varName);
  if (v) {
    try {
      node.setBoundVariable(field, v);
      return;
    } catch (e) {
      /* 바인딩할 수 없는 속성은 값으로 */
    }
  }
  if (value) node[field] = value;
}
function parseShadows(css) {
  if (!css) return [];
  return css
    .split(/,(?![^(]*\))/)
    .map((s) => {
      const color = parseRgb((/rgba?\([^)]*\)/.exec(s) || [])[0]);
      const nums = s.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+px/g) || [];
      const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(parseFloat);
      if (!color || color.a === 0 || (!x && !y && !blur && !spread))
        return null;
      return {
        type: /inset/.test(s) ? "INNER_SHADOW" : "DROP_SHADOW",
        color,
        offset: { x, y },
        radius: blur,
        spread,
        visible: true,
        blendMode: "NORMAL"
      };
    })
    .filter(Boolean);
}
function inlineOnly(n) {
  return (n.children || []).every(
    (c) => c.type !== "frame" || /^inline/.test(c.display || "")
  );
}
// flex 가 아닌 배치(grid·block·inline-block)는 화면에서 잰 자식 위치로 정한다: 한 줄이면 가로, 한 열이면 세로, 여러 줄·열이면 가로 줄바꿈
function boxLayout(n) {
  const boxes = (n.children || []).filter(
    (c) => c.type !== "text" && !c.abs && c.x !== undefined && c.w > 0
  );
  if (boxes.length < 2)
    return { mode: inlineOnly(n) ? "HORIZONTAL" : "VERTICAL", gap: 0 };
  const rows = [];
  for (const b of boxes) {
    const row = rows.find((r) => Math.abs(r.y - b.y) <= 2);
    if (row) row.items.push(b);
    else rows.push({ y: b.y, items: [b] });
  }
  rows.sort((a, b) => a.y - b.y);
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  const gapsX = rows
    .flatMap((r) =>
      r.items.slice(1).map((b, i) => b.x - (r.items[i].x + r.items[i].w))
    )
    .filter((g) => g >= 0);
  const gapsY = rows
    .slice(1)
    .map(
      (r, i) => r.y - (rows[i].y + Math.max(...rows[i].items.map((b) => b.h)))
    )
    .filter((g) => g >= 0);
  const min = (a) => (a.length ? Math.round(Math.min(...a)) : 0);
  if (rows.length === 1) return { mode: "HORIZONTAL", gap: min(gapsX) };
  if (rows.every((r) => r.items.length === 1))
    return { mode: "VERTICAL", gap: min(gapsY) };
  return {
    mode: "HORIZONTAL",
    wrap: true,
    gap: min(gapsX),
    rowGap: min(gapsY)
  };
}

function render(n, asComponent) {
  const v = n.vars || {};
  LITERALS += (n.literal || []).length;
  if (n.type === "text") {
    const t = figma.createText();
    t.fontName = { family: "Inter", style: weightStyle(n.fontWeight || 400) };
    t.characters = n.chars;
    setNum(t, "fontSize", v.fontSize, n.fontSize || 13);
    if (n.lineHeight) t.lineHeight = { value: n.lineHeight, unit: "PIXELS" };
    const p = colorPaint(v.color, n.color);
    t.fills = p ? [p] : [];
    t.name = "Text";
    return t;
  }
  if (n.type === "svg") {
    try {
      const s = figma.createNodeFromSvg(n.svg);
      s.name = "Icon";
      const p = colorPaint(v.color, n.color);
      if (p)
        for (const x of s.findAll(
          (x) => "fills" in x && Array.isArray(x.fills) && x.fills.length
        ))
          x.fills = [p];
      s.resize(Math.max(n.w, 1), Math.max(n.h, 1));
      return s;
    } catch (e) {
      /* 그리지 못한 SVG 는 같은 크기의 빈 프레임으로 */
    }
  }
  if (n.type === "image") {
    // 화면에서 뜬 이미지(아바타 사진 등). 뜨지 못했으면 회색 자리
    const r = figma.createRectangle();
    r.name = "Image";
    r.resize(Math.max(n.w, 1), Math.max(n.h, 1));
    const im = n.png && imageOf(n.png, "컴포넌트");
    r.fills = im
      ? [{ type: "IMAGE", imageHash: im.hash, scaleMode: "FILL" }]
      : [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
    if (n.radius)
      for (const k of [
        "topLeftRadius",
        "topRightRadius",
        "bottomLeftRadius",
        "bottomRightRadius"
      ])
        setNum(r, k, v.radius, n.radius);
    return r;
  }
  const f = asComponent ? figma.createComponent() : figma.createFrame();
  f.name = n.tag || "Frame";
  const flex = /flex/.test(n.display || "");
  const box = flex ? null : boxLayout(n);
  f.layoutMode = flex
    ? /^column/.test(n.dir)
      ? "VERTICAL"
      : "HORIZONTAL"
    : box.mode;
  f.primaryAxisSizingMode = "AUTO";
  f.counterAxisSizingMode = "AUTO";
  const wrap = flex
    ? n.wrap === "wrap" && f.layoutMode === "HORIZONTAL"
    : !!box.wrap;
  if (wrap) {
    // 줄바꿈은 폭이 고정이어야 한다. 자식을 넣기 전에 화면 폭으로 고정
    f.resize(Math.max(n.w, 1), Math.max(n.h, 1));
    f.primaryAxisSizingMode = "FIXED";
    f.counterAxisSizingMode = "AUTO";
    f.layoutWrap = "WRAP";
  }
  if (flex) {
    setNum(f, "itemSpacing", v.gap, n.gap || 0);
    f.counterAxisAlignItems = ALIGN[n.align] || "MIN";
    f.primaryAxisAlignItems = JUSTIFY[n.justify] || "MIN";
  } else {
    f.itemSpacing = box.gap;
    if (wrap) f.counterAxisSpacing = box.rowGap;
    if (f.layoutMode === "HORIZONTAL" && !wrap)
      f.counterAxisAlignItems = "CENTER";
  }
  const pad = n.pad || [0, 0, 0, 0];
  ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].forEach(
    (k, i) => setNum(f, k, v["pad" + i], pad[i])
  );
  const bg = colorPaint(v.bg, n.bg);
  f.fills = bg ? [bg] : [];
  if (n.border && n.border.width) {
    const st = colorPaint(v.border, n.border.color);
    if (st) {
      f.strokes = [st];
      setNum(f, "strokeWeight", v.borderWidth, n.border.width);
      f.strokeAlign = "INSIDE";
    }
  }
  if (n.radius) {
    for (const k of [
      "topLeftRadius",
      "topRightRadius",
      "bottomLeftRadius",
      "bottomRightRadius"
    ])
      setNum(f, k, v.radius, Math.min(n.radius, Math.max(n.h, n.w)));
  }
  if (n.opacity !== undefined && n.opacity < 1) f.opacity = n.opacity;
  let fx = parseShadows(n.shadow);
  const ring = fx.find(
    (e) => !e.offset.x && !e.offset.y && !e.radius && e.spread > 0
  );
  if (ring && !(n.border && n.border.width)) {
    // 포커스 링(box-shadow 0 0 0 Npx)은 그림자보다 바깥 선이 화면과 같다
    const { r, g, b, a } = ring.color;
    f.strokes = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
    f.strokeWeight = ring.spread;
    f.strokeAlign = ring.type === "INNER_SHADOW" ? "INSIDE" : "OUTSIDE";
    fx = fx.filter((e) => e !== ring);
  }
  if (fx.length) f.effects = fx;
  const padIn = n.pad || [0, 0, 0, 0];
  const inner = n.w - padIn[1] - padIn[3];
  const flow = (n.children || []).filter(
    (c) => !c.abs && c.type !== "text" && c.w !== undefined
  );
  const stretch = []; // 화면에서 부모 폭을 꽉 채우던 자식: 인스턴스를 늘렸을 때 함께 늘어나게 FILL(부모 크기를 정한 뒤에 건다)
  for (const c of n.children || []) {
    const k = render(c, false);
    f.appendChild(k);
    // position: absolute(입력 안의 검색 아이콘 등)는 흐름에서 빼고 화면에서 잰 자리에 둔다. 오른쪽에 붙어 있었으면 오른쪽 기준
    if (c.abs && c.x !== undefined) {
      k.layoutPositioning = "ABSOLUTE";
      k.x = c.x - (n.x || 0);
      k.y = c.y - (n.y || 0);
      k.constraints = {
        horizontal: n.w - (k.x + c.w) < k.x ? "MAX" : "MIN",
        vertical: "CENTER"
      };
      continue;
    }
    if (c.type === "text" || c.w === undefined || inner < 40) continue;
    if (f.layoutMode === "VERTICAL" && Math.abs(c.w - inner) <= 2)
      stretch.push(k);
    // 가로 줄에서 남는 폭을 다 차지하던 자식(flex: 1 인 입력칸 등): 가장 넓고 줄을 꽉 채웠으면 FILL
    if (
      f.layoutMode === "HORIZONTAL" &&
      f.layoutWrap !== "WRAP" &&
      flow.length > 1 &&
      c === flow.reduce((a, b) => (b.w > a.w ? b : a))
    ) {
      const used =
        flow.reduce((t, x) => t + x.w, 0) + (n.gap || 0) * (flow.length - 1);
      if (Math.abs(used - inner) <= 4) stretch.push(k);
    }
  }
  // 글꼴 차이로 내용 크기가 달라져도 화면에서 잰 크기를 지킨다(자동 레이아웃은 그대로, 크기만 고정)
  const fixW = !(n.children || []).length || Math.abs(f.width - n.w) > 1;
  const fixH = !(n.children || []).length || Math.abs(f.height - n.h) > 1;
  if (fixW || fixH) {
    f.resize(Math.max(n.w, 1), Math.max(n.h, 1));
    const horiz = f.layoutMode === "HORIZONTAL";
    if (!fixW)
      horiz
        ? (f.primaryAxisSizingMode = "AUTO")
        : (f.counterAxisSizingMode = "AUTO");
    if (!fixH)
      horiz
        ? (f.counterAxisSizingMode = "AUTO")
        : (f.primaryAxisSizingMode = "AUTO");
  }
  if (stretch.length) {
    // 부모 폭부터 고정(figma-use: HUG 부모 아래 FILL 은 무너진다). resize 가 두 축을 FIXED 로 돌리므로 높이 모드는 되살린다
    const vert = f.layoutMode === "VERTICAL";
    const heightMode = vert ? f.primaryAxisSizingMode : f.counterAxisSizingMode;
    f.resize(Math.max(n.w, 1), f.height);
    if (vert) {
      f.counterAxisSizingMode = "FIXED";
      f.primaryAxisSizingMode = heightMode;
    } else {
      f.primaryAxisSizingMode = "FIXED";
      f.counterAxisSizingMode = heightMode;
    }
    for (const k of stretch) k.layoutSizingHorizontal = "FILL";
  }
  f.clipsContent = !!n.clip; // overflow: hidden(둥근 아바타 등)이면 틀 밖을 자른다
  return f;
}

const pascalName = (s) =>
  String(s).replace(/(^|[-_\s])([a-z0-9])/gi, (_, __, c) => c.toUpperCase());
// figma-generate-library: 한 세트의 변형 조합이 30개를 넘으면 나눈다. 넘으면 변형마다 「이름 / 변형」 세트(State 축만)로 만든다
const MAX_SET = 30;
function makeSet(section, comps, name, description, width) {
  const set = figma.combineAsVariants(comps, section);
  set.name = name;
  set.description = description;
  set.layoutMode = "HORIZONTAL";
  set.layoutWrap = "WRAP";
  set.resize(width, set.height);
  set.primaryAxisSizingMode = "FIXED";
  set.counterAxisSizingMode = "AUTO"; // resize 뒤에 높이 hug(figma-use)
  set.itemSpacing = 24;
  set.counterAxisSpacing = 24;
  set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 24;
  return set;
}
async function buildCaptured(page, cap, meta) {
  const sectionName = cap.group === "milvus" ? cap.name : "SLDS · " + cap.name;
  const section = await getSectionIn(page, sectionName);
  clearSection(section, [cap.name]);
  for (const n of [...section.children])
    if (n.name.startsWith(cap.name + " / ")) n.remove(); // 이전에 나눠 만든 세트
  LITERALS = 0;
  const states = Object.keys(cap.variants[0].states);
  const split = cap.variants.length * states.length > MAX_SET;
  const groups = [];
  const seen = new Set();
  const names = [];
  for (const v of cap.variants) {
    let vname = pascalName(v.name);
    while (seen.has(vname)) vname += "2";
    seen.add(vname);
    names.push(vname);
    const comps = [];
    for (const [state, tree] of Object.entries(v.states)) {
      const c = render(tree, true);
      c.name = split
        ? "State=" + state
        : "Variant=" + vname + ", State=" + state;
      section.appendChild(c);
      comps.push(c);
    }
    groups.push({ vname, comps });
  }
  const all = groups.flatMap((g) => g.comps);
  if (!all.length) return;
  // figma-generate-library: 컴포넌트 세트 설명은 사람이 읽는 용도·사용법. 출처는 문서 프레임 바닥에 둔다
  const d = cap.doc || { summary: [] };
  const description = [
    ...(d.summary.length
      ? d.summary
      : meta && meta.description
        ? [meta.description]
        : []),
    "<" + cap.tag + ">" + (d.url ? " · " + d.url : ""),
    cap.interactive
      ? ""
      : "상태 없음(의도): 누르거나 입력하는 요소가 없는 표시용 컴포넌트"
  ]
    .filter(Boolean)
    .join("\n");
  const width = Math.max(1200, Math.min(2400, states.length * 260));
  const sets = split
    ? groups.map((g) =>
        makeSet(
          section,
          g.comps,
          cap.name + " / " + g.vname,
          description,
          width
        )
      )
    : [makeSet(section, all, cap.name, description, width)];
  const doc = buildDoc(section, cap, meta, all, names, states);
  let y = doc.y + doc.height + 80;
  for (const set of sets) {
    set.x = 100;
    set.y = y;
    y += set.height + 48;
  }
  fitSection(section);
  REPORT.components.push({
    name: cap.name,
    group: cap.group,
    variants: cap.variants.length,
    states: states.length,
    sets: sets.length,
    literals: LITERALS
  });
}

// --- 컴포넌트 문서 프레임: 머리띠(아이콘·분류·이름) + 1 사용법 / 2 변형 / 3 상태 / 4 속성. 글자는 Pretendard ---
const DOC_W = 1040,
  BODY_W = DOC_W - 96;
const GRAY = (v) => ({ type: "SOLID", color: { r: v, g: v, b: v } });
const ICONS = {
  // 속성 아이콘(16px). 색은 accent 변수로 다시 칠한다
  boolean:
    '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3C4.6 3 1.8 5.2 1 8c.8 2.8 3.6 5 7 5s6.2-2.2 7-5c-.8-2.8-3.6-5-7-5zm0 8.2A3.2 3.2 0 1 1 8 4.8a3.2 3.2 0 0 1 0 6.4zM8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" fill="#000"/></svg>',
  text: '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 2.5h11v3H12V4H8.8v8.5h1.7V14h-5v-1.5h1.7V4H4v1.5H2.5z" fill="#000"/></svg>',
  other:
    '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 .9l2.6 2.6L8 6.1 5.4 3.5zM3.5 5.4l2.6 2.6-2.6 2.6L.9 8zM12.5 5.4L15.1 8l-2.6 2.6L9.9 8zM8 9.9l2.6 2.6L8 15.1l-2.6-2.6z" fill="#000"/></svg>'
};
function icon(parent, kind) {
  const s = figma.createNodeFromSvg(ICONS[kind]);
  s.name = "Icon/" + kind;
  for (const x of s.findAll((x) => "fills" in x))
    x.fills = [paintOf("color/accent/1")];
  parent.appendChild(s);
  return s;
}
function fixed(f, w, h) {
  f.primaryAxisSizingMode = "FIXED";
  f.counterAxisSizingMode = "FIXED";
  f.resize(w, h);
  f.primaryAxisAlignItems = "CENTER";
  f.counterAxisAlignItems = "CENTER";
  return f;
}
function pad(f, y, x) {
  f.paddingTop = f.paddingBottom = y;
  f.paddingLeft = f.paddingRight = x;
  return f;
}
function docSection(body, no, title) {
  const s = box(body, no + " " + title, "VERTICAL", 20);
  const h = box(s, "Heading", "HORIZONTAL", 12);
  h.counterAxisAlignItems = "CENTER";
  const b = fixed(box(h, "No", "HORIZONTAL", 0), 28, 28);
  b.cornerRadius = 14;
  b.fills = [paintOf("color/accent/1")];
  txt(b, no, { heavy: true, size: 13, color: "color/on-accent/1" });
  txt(h, title, { heavy: true, size: 22 });
  const line = figma.createRectangle();
  line.resize(BODY_W, 1);
  line.fills = [GRAY(0.9)];
  s.appendChild(line);
  return s;
}
function chip(parent, label) {
  const c = pad(box(parent, "Chip", "HORIZONTAL", 0), 6, 12);
  c.cornerRadius = 999;
  c.fills = [GRAY(0.95)];
  txt(c, label, { bold: true, size: 13 });
  return c;
}
function propKind(type) {
  const t = String(type).toLowerCase();
  return /bool/.test(t)
    ? "boolean"
    : /^(text|string)$/.test(t)
      ? "text"
      : "other";
}
function buildDoc(section, cap, meta, comps, names, states) {
  const d = cap.doc || {
    category: cap.group === "milvus" ? "MILVUS" : "SALESFORCE BASE",
    summary: [],
    props: []
  };
  const doc = docFrame(section, cap.name, DOC_W);
  doc.itemSpacing = 0;
  pad(doc, 0, 0);
  doc.cornerRadius = 16;
  doc.clipsContent = true;
  doc.strokes = [GRAY(0.9)];
  // 머리띠
  const head = pad(box(doc, "Header", "HORIZONTAL", 24), 40, 48);
  head.counterAxisAlignItems = "CENTER";
  head.resize(DOC_W, head.height);
  head.primaryAxisSizingMode = "FIXED";
  head.counterAxisSizingMode = "AUTO";
  head.fills = [GRAY(0.965)];
  const ic = fixed(box(head, "Icon", "HORIZONTAL", 0), 72, 72);
  ic.cornerRadius = 18;
  ic.fills = [paintOf("color/accent/1")];
  txt(
    ic,
    cap.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2),
    { heavy: true, size: 26, color: "color/on-accent/1" }
  );
  const tt = box(head, "Title", "VERTICAL", 6);
  txt(
    tt,
    d.category === "MILVUS" ? "MILVUS COMPONENT" : "SALESFORCE BASE COMPONENT",
    { heavy: true, size: 12, color: "color/accent/1" }
  );
  txt(tt, cap.name, { heavy: true, size: 40 });
  txt(tt, "<" + cap.tag + ">", { size: 14, fill: GRAY(0.45) });
  const body = pad(box(doc, "Body", "VERTICAL", 48), 48, 48);
  // 1 사용법
  const s1 = docSection(body, "1", "사용법");
  const summary = d.summary.length
    ? d.summary
    : [
        meta && meta.description
          ? meta.description
          : "설명이 없습니다. 스토리의 component 설명을 채우면 여기에 나온다."
      ];
  for (const p of summary)
    txt(s1, p, { size: 15, width: BODY_W, lineHeight: 160 });
  if (d.url)
    txt(s1, "공식 문서 ↗  " + d.url, {
      size: 13,
      color: "color/accent/1",
      url: d.url,
      width: BODY_W
    });
  // 2 변형
  const s2 = docSection(body, "2", "변형 " + names.length + "개");
  const dash = pad(box(s2, "Variants", "HORIZONTAL", 32), 32, 32);
  dash.layoutWrap = "WRAP";
  dash.counterAxisSpacing = 32;
  dash.resize(BODY_W, dash.height);
  dash.primaryAxisSizingMode = "FIXED";
  dash.counterAxisSizingMode = "AUTO";
  dash.cornerRadius = 12;
  dash.strokes = [GRAY(0.75)];
  dash.dashPattern = [6, 4];
  dash.fills = [GRAY(0.985)];
  comps
    .filter((c) => c.name.endsWith("State=Default"))
    .forEach((c, i) => {
      const cell = box(dash, names[i] || "Variant", "VERTICAL", 10);
      cell.appendChild(c.createInstance());
      txt(cell, names[i] || "", { size: 12, fill: GRAY(0.45) });
    });
  // 3 상태
  const s3 = docSection(body, "3", "상태");
  if (cap.interactive) {
    const row = box(s3, "States", "HORIZONTAL", 8);
    for (const st of states) chip(row, st);
  } else
    txt(
      s3,
      "상태 없음(의도) — 누르거나 입력하는 요소가 없는 표시용 컴포넌트다.",
      { size: 15, width: BODY_W }
    );
  txt(
    s3,
    "색·여백·모서리·글자 크기는 milvus 역할 변수에 연결돼 있다. 변수가 없는 직접 값 " +
      LITERALS +
      "건.",
    { size: 13, fill: GRAY(0.45), width: BODY_W }
  );
  // 4 속성
  const s4 = docSection(body, "4", "속성");
  const props =
    cap.group === "milvus" && meta
      ? meta.props.map((p) => ({
          name: p.name,
          type: p.type,
          note: p.values
            ? p.values.join(" · ")
            : String(p.default === undefined ? "" : p.default)
        }))
      : d.props || [];
  if (!props.length) txt(s4, "공개 속성 정보가 없다.", { size: 15 });
  for (const p of props) {
    const row = box(s4, p.name, "HORIZONTAL", 12);
    row.counterAxisAlignItems = "CENTER";
    const ib = fixed(box(row, "Kind", "HORIZONTAL", 0), 28, 28);
    ib.cornerRadius = 6;
    ib.fills = [GRAY(0.95)];
    icon(ib, propKind(p.type));
    txt(row, p.name, { bold: true, size: 14 }).resize(260, 20);
    txt(row, p.type + (p.note ? "   " + p.note : ""), {
      size: 13,
      fill: GRAY(0.45)
    });
  }
  txt(
    body,
    '출처: Storybook "' +
      cap.story +
      '" 화면(브랜드 ' +
      cap.brand +
      " hook 적용)에서 읽어 생성했다. Figma 에서 고치지 말고 코드에서 고친 뒤 다시 생성한다.",
    { size: 12, fill: GRAY(0.55), width: BODY_W }
  );
  return doc;
}

// --- 표지: 외부제안용1(milvus-external-visual) 표지 스펙. 원본은 EMU(12192000×6858000), 여기서는 1920×1080 으로 옮긴다
// 쌓는 순서: 배경 사진 → 브랜드 색 그라데이션(왼쪽 100% → 오른쪽 20%) → 글자 → 로고. 글자는 아래 기준선에 붙는다
const EMU = (v) => Math.round(((v * 1920) / 12192000) * 10) / 10;
async function coverFamily() {
  // 표지: Pretendard, 없으면 Noto Sans KR
  const got = await pickFamily(
    ["Pretendard", "Noto Sans KR"],
    [["Black"], ["Bold"], ["Medium"], ["Regular"]]
  );
  return got && got.family;
}
async function logo(parent, b64, name, h, maxW) {
  const img = b64 && imageOf(b64, name);
  if (!img) return;
  const { width, height } = await img.getSizeAsync();
  let w = (h * width) / height;
  if (w > maxW) {
    w = maxW;
    h = (w * height) / width;
  }
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FIT" }];
  parent.appendChild(r);
}
function coverText(parent, chars, fontName, size, bottom) {
  const t = figma.createText();
  t.fontName = fontName;
  t.characters = chars;
  t.fontSize = size;
  t.lineHeight = { value: 120, unit: "PERCENT" };
  t.fills = [PAPER];
  t.textAutoResize = "WIDTH_AND_HEIGHT";
  parent.appendChild(t);
  t.x = EMU(619223);
  t.y = bottom - t.height;
  return t;
}
async function buildCover(section, data) {
  const c = data.brand.cover || {};
  const f = figma.createFrame();
  f.name = "Doc/Cover";
  section.appendChild(f);
  f.resize(1920, 1080);
  f.x = 100;
  f.y = 100;
  f.clipsContent = true;
  const { r, g, b } = hexToRgb(data.brand.brandColor);
  let cover;
  f.fills = [
    ...((cover = c.image && imageOf(c.image, "표지 배경"))
      ? [{ type: "IMAGE", imageHash: cover.hash, scaleMode: "FILL" }]
      : [PAPER]),
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0]
      ],
      gradientStops: [
        { position: 0, color: { r, g, b, a: 1 } },
        { position: 1, color: { r, g, b, a: 0.2 } }
      ]
    }
  ];
  const fam = await coverFamily();
  const F = (style) =>
    fam
      ? { family: fam, style }
      : style === "Regular"
        ? FONTS.regular
        : FONTS.heavy;
  if (!fam)
    ui("Pretendard·Noto Sans KR 이 없어 표지 글자를 기본 글꼴로 씁니다");
  coverText(
    f,
    data.brand.name + "\nDesign System",
    F("Black"),
    80,
    EMU(4965674)
  ); // 40pt
  coverText(
    f,
    "Salesforce Lightning 디자인 시스템 · v" + data.version,
    F("Medium"),
    46,
    EMU(5476083)
  ); // 23pt
  coverText(
    f,
    data.generatedAt.slice(0, 10).replace(/-/g, "."),
    F("Regular"),
    36,
    EMU(6292625)
  ); // 18pt
  // 로고: 밀버스는 늘 들어간다. 브랜드 흰 로고가 있으면 「Milvus × 브랜드」로 나란히(스킬의 밀버스 로고 자리·높이 기준)
  const lock = box(f, "Logo", "HORIZONTAL", 24);
  lock.counterAxisAlignItems = "CENTER";
  await logo(lock, c.milvusLogo, "Logo/Milvus", EMU(363507), 9999);
  if (c.logo) {
    coverText(lock, "×", F("Regular"), 40, 0);
    await logo(lock, c.logo, "Logo/Brand", EMU(435739), EMU(1900000));
  }
  lock.x = EMU(619223);
  lock.y = EMU(547717 + 363507 / 2) - lock.height / 2;
}

// --- Foundations 페이지: 표지·안내·색·글자·간격 ---
async function buildFoundations(page, data) {
  const t = data.tokens;
  const cover = await getSectionIn(page, "📔 Cover");
  clearSection(cover, []);
  await buildCover(cover, data);
  fitSection(cover);

  const about = await getSectionIn(page, "ℹ️ About");
  clearSection(about, []);
  const af = docFrame(about, "About");
  txt(af, "사용 규칙", { bold: true, size: 24 });
  data.about.rules.forEach((r, i) =>
    txt(af, i + 1 + ". " + r, { size: 14, width: 864 })
  );
  txt(af, "밀버스 컴포넌트", { bold: true, size: 24 });
  for (const c of data.components)
    txt(
      af,
      c.name +
        "  <" +
        c.tag +
        ">" +
        (c.visual ? "" : "  (화면 없음 — 문서만)") +
        "  —  " +
        c.source,
      { size: 13, width: 864 }
    );
  txt(
    af,
    "Salesforce 기본 컴포넌트(만들지 않고 그대로 쓴다) " +
      data.about.sldsCatalog.length +
      "종",
    { bold: true, size: 24 }
  );
  txt(af, data.about.sldsCatalog.join(" · "), { size: 12, width: 864 });
  txt(af, "변수", { bold: true, size: 24 });
  txt(
    af,
    "컬렉션 milvus(역할, 이름 = SLDS hook) " +
      (t.color.length + t.number.length) +
      "개 · palette(원시 값) " +
      Object.keys(t.palette).length +
      "개. 부품은 milvus 변수만 건다(docs/milvus/figma.md 2장)",
    { size: 13, width: 864 }
  );
  fitSection(about);

  const color = await getSectionIn(page, "Foundations · Color");
  clearSection(color, []);
  const colf = docFrame(color, "Color", 1100);
  txt(colf, "Color — milvus 역할 변수 " + t.color.length + "개", {
    bold: true,
    size: 28
  });
  for (const c of t.color) {
    const r = box(colf, c.name, "HORIZONTAL", 16);
    r.counterAxisAlignItems = "CENTER";
    const sw = figma.createRectangle();
    sw.resize(40, 40);
    sw.cornerRadius = 4;
    sw.fills = [paintOf(c.name)];
    sw.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
    r.appendChild(sw);
    txt(r, c.name, { bold: true, size: 13 }).resize(260, 18);
    txt(r, c.web, { size: 12 }).resize(380, 18);
    txt(
      r,
      c.palette.replace(/^palette\//, "→ ") + "  " + t.palette[c.palette],
      { size: 12 }
    );
  }
  fitSection(color);

  const sp = await getSectionIn(page, "Foundations · Spacing & Radius");
  clearSection(sp, []);
  const spf = docFrame(sp, "Spacing", 1100);
  txt(spf, "Spacing · Radius · Border — 수치 변수", { bold: true, size: 28 });
  for (const n of t.number.filter((n) => !n.name.startsWith("font/"))) {
    const r = box(spf, n.name, "HORIZONTAL", 16);
    r.counterAxisAlignItems = "CENTER";
    const bar = figma.createRectangle();
    bar.fills = [paintOf("color/accent/1")];
    if (n.name.startsWith("radius/")) {
      bar.resize(48, 48);
      bindRadius(bar, n.name, n.value);
    } else bar.resize(Math.max(Math.min(n.value, 240), 2), 16);
    r.appendChild(bar);
    txt(r, n.name + "  " + n.value + "px", { bold: true, size: 13 }).resize(
      200,
      18
    );
    txt(r, n.web, { size: 12 });
  }
  fitSection(sp);

  const ty = await getSectionIn(page, "Foundations · Typography");
  clearSection(ty, []);
  const tyf = docFrame(ty, "Typography", 1100);
  txt(tyf, "Typography — font/scale", { bold: true, size: 28 });
  for (const n of t.number.filter((n) => n.name.startsWith("font/"))) {
    const r = box(tyf, n.name, "HORIZONTAL", 16);
    r.counterAxisAlignItems = "CENTER";
    txt(r, n.name + "  " + n.value + "px", { bold: true, size: 13 }).resize(
      200,
      18
    );
    txt(r, "밀버스 디자인 시스템 Milvus 0123", { scale: n.name });
  }
  txt(
    tyf,
    "글꼴은 Salesforce 기본(org)을 따르고 Figma 에서는 Inter 로 보인다(docs/milvus/figma.md 1장)",
    { size: 12, width: 900 }
  );
  fitSection(ty);
}

async function runBuild(data) {
  VARS = {};
  REPORT = { components: [], unbound: new Set(), noCapture: [] };
  await Promise.all(
    WEIGHTS.map((style) => figma.loadFontAsync({ family: "Inter", style }))
  );
  await loadDocFont();
  ui("변수 " + (await buildVariables(data.tokens)) + "개");
  const fp = await getPage(PAGES.foundations);
  await buildFoundations(fp, data);
  ui("Foundations 완료");
  const cp = await getPage(PAGES.components);
  await figma.setCurrentPageAsync(cp);
  const old = getSection(cp, "SLDS 기본 컴포넌트");
  if (old) old.remove(); // 이전 버전의 캡처 이미지 섹션
  const captured = data.captured || [];
  const order = [
    ...captured.filter((c) => c.group === "milvus"),
    ...captured.filter((c) => c.group === "slds")
  ];
  for (const comp of data.components.filter(
    (c) =>
      c.visual &&
      !captured.some((x) => x.group === "milvus" && x.name === c.name)
  ))
    REPORT.noCapture.push(comp.name);
  for (const cap of order) {
    await buildCaptured(
      cp,
      cap,
      cap.group === "milvus"
        ? data.components.find((c) => c.name === cap.name)
        : null
    );
    ui(cap.name + " 완료");
  }
  await getPage(PAGES.pages);
  layoutSections(fp);
  layoutSections(
    cp,
    6,
    order.map((c) => (c.group === "milvus" ? c.name : "SLDS · " + c.name))
  );
  const literals = REPORT.components.reduce((n, c) => n + c.literals, 0);
  const report = {
    components: REPORT.components,
    unbound: [...REPORT.unbound],
    noCapture: REPORT.noCapture,
    literals
  };
  log({ step: "build", report });
  return (
    "컴포넌트 " +
    report.components.length +
    "개, 직접 값 " +
    literals +
    "건, noCapture " +
    report.noCapture.length +
    ", unbound " +
    report.unbound.length
  );
}

// --- 이관(#112): figma-update.json 의 component·page 만 새로 그린다. 나머지는 그대로 둔다 ---
// figma-generate-design: 감싸개 프레임을 먼저 만들고 그 안에 바로 그린다, 디자인 시스템 인스턴스·변수를 쓴다, FILL 은 넣은 뒤에
async function loadVars() {
  const [all, cols] = await Promise.all([
    figma.variables.getLocalVariablesAsync(),
    figma.variables.getLocalVariableCollectionsAsync()
  ]);
  const mil = cols.find((c) => c.name === "milvus");
  VARS = {};
  if (mil)
    for (const v of all)
      if (v.variableCollectionId === mil.id) VARS[v.name] = v;
  return Object.keys(VARS).length;
}
function setVal(node, field, val) {
  // 값: 변수 이름(문자열) 또는 직접 값(숫자)
  if (val === undefined || val === null) return;
  if (typeof val === "number") {
    node[field] = val;
    if (val) LITERALS++;
    return;
  }
  const v = V(val);
  if (v) node.setBoundVariable(field, v);
}
function frameOf(name, dir) {
  const f = hug(figma.createFrame(), dir);
  f.name = name;
  return f;
} // 부모 없이 만든다(넣는 쪽이 appendChild)
function placeholder(label, width) {
  const f = frameOf("Placeholder/" + label, "VERTICAL");
  if (width) {
    f.resize(width, 48);
    f.counterAxisSizingMode = "FIXED";
    f.primaryAxisSizingMode = "AUTO";
  }
  pad(f, 12, 16);
  f.cornerRadius = 4;
  f.fills = [GRAY(0.96)];
  f.strokes = [GRAY(0.7)];
  f.dashPattern = [4, 4];
  const t = figma.createText();
  t.fontName = INTER.regular;
  t.characters = label;
  t.fontSize = 12;
  t.fills = [GRAY(0.4)];
  f.appendChild(t);
  return f;
}
function setInstanceText(inst, chars) {
  // 컴포넌트 속성이 없으므로(캡처) 첫 글자 레이어를 바꾼다. 글꼴은 초기 세팅에서 쓴 Inter 라 이미 불러와 있다
  const t = inst.findOne((n) => n.type === "TEXT");
  if (t) t.characters = chars;
}
function buildM(n, idx, parentFixedVertical) {
  if (n.type === "text") {
    const t = figma.createText();
    t.fontName = { family: "Inter", style: n.bold ? "Semi Bold" : "Regular" };
    t.characters = n.chars;
    if (n.size !== undefined) setVal(t, "fontSize", n.size);
    else t.fontSize = 13;
    t.fills = [n.color ? paintOf(n.color) : paintOf("color/on-surface/3")];
    t.name = "Text";
    return t;
  }
  if (n.type === "divider") {
    // 모달 머리·바닥 경계선(slds-modal 의 border 2px, color/border/1)
    const r = figma.createRectangle();
    r.name = "Divider";
    r.resize(100, 2);
    r.fills = [paintOf("color/border/1")];
    r.setPluginData("fill", "1");
    return r;
  }
  if (n.type === "placeholder") {
    REPORT.unbound.add("자리 표시: " + n.label);
    return placeholder(n.label, n.width);
  }
  if (n.type === "instance") {
    const sec = idx.sections.get(n.section);
    const sets = sec
      ? sec.findAllWithCriteria({ types: ["COMPONENT_SET"] })
      : [];
    const split = sets.find((x) => x.name === n.set + " / " + n.variant);
    const comp = split
      ? split.children.find((c) => c.name === "State=Default") ||
        split.defaultVariant
      : (() => {
          const set = sets.find((x) => x.name === n.set);
          return (
            set &&
            (set.children.find(
              (c) => c.name === "Variant=" + n.variant + ", State=Default"
            ) ||
              set.defaultVariant)
          );
        })();
    if (!comp) {
      REPORT.noCapture.push(n.section + " / " + n.variant);
      return placeholder("<" + n.name + "> " + n.variant + " (Figma 에 없음)");
    }
    const inst = comp.createInstance();
    inst.name = n.name;
    // 캡처 예시 글자를 코드 값으로(컴포넌트 속성이 없어 글자 레이어를 직접 바꾼다. figma-generate-design 의 대안 경로)
    for (const t of n.texts || [])
      for (const node of inst.findAllWithCriteria({ types: ["TEXT"] }))
        if (node.characters === t.from) node.characters = t.to;
    if (n.text) setInstanceText(inst, n.text);
    if (n.fill) inst.setPluginData("fill", "1");
    return inst;
  }
  if (n.type === "project") {
    const comp = idx.project.get(n.name);
    if (!comp)
      return placeholder(
        "<c-" +
          n.name.replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase()) +
          "> (먼저 component 로 옮기세요)"
      );
    const inst = comp.createInstance();
    inst.name = n.name;
    if (n.fill) inst.setPluginData("fill", "1");
    return inst;
  }
  const f = frameOf(n.name, n.dir);
  if (n.width) {
    // resize 먼저, 크기 모드 나중(figma-use)
    f.resize(n.width, 40);
    if (n.dir === "VERTICAL") {
      f.counterAxisSizingMode = "FIXED";
      f.primaryAxisSizingMode = "AUTO";
    } else {
      f.primaryAxisSizingMode = "FIXED";
      f.counterAxisSizingMode = "AUTO";
    }
  }
  if (n.wrap && n.dir === "HORIZONTAL") {
    f.layoutWrap = "WRAP";
    setVal(f, "counterAxisSpacing", n.gap);
  }
  setVal(f, "itemSpacing", n.gap);
  if (n.justify) f.primaryAxisAlignItems = n.justify;
  if (n.dir === "HORIZONTAL") f.counterAxisAlignItems = "CENTER";
  if (n.hidden) f.visible = false;
  if (n.pad)
    ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].forEach(
      (k, i) => setVal(f, k, n.pad[i])
    );
  f.fills = n.fill ? [paintOf(n.fill)] : [];
  if (n.border) {
    f.strokes = [paintOf(n.border)];
    f.strokeWeight = 1;
    f.strokeAlign = "INSIDE";
  }
  if (n.radius !== undefined)
    for (const k of [
      "topLeftRadius",
      "topRightRadius",
      "bottomLeftRadius",
      "bottomRightRadius"
    ])
      setVal(f, k, n.radius);
  const fixedVertical = !!n.width && n.dir === "VERTICAL";
  for (const c of n.children || []) {
    const k = buildM(c, idx, fixedVertical);
    f.appendChild(k);
    // 세로 틀 안의 틀, 폭을 꽉 채우던 인스턴스(입력·알림), 경계선은 부모 폭을 채운다(넣은 뒤에 FILL. figma-use)
    const wide = k.getPluginData && k.getPluginData("fill") === "1";
    if (n.dir === "VERTICAL" && ((k.type === "FRAME" && !c.width) || wide))
      k.setPluginData("fill", "1");
  }
  return f;
}
// FILL 은 다 그린 뒤 위에서 아래로: 부모가 먼저 폭을 가져야 자식 FILL 이 무너지지 않는다(figma-use: HUG 부모는 FILL 자식을 0 으로)
function applyFill(root) {
  const walk = (node) => {
    if (node.type === "INSTANCE") return; // 인스턴스 안은 본 컴포넌트가 정한다
    for (const k of node.children || []) {
      if (k.getPluginData("fill") === "1" && node.layoutMode === "VERTICAL")
        k.layoutSizingHorizontal = "FILL";
      walk(k);
    }
  };
  walk(root);
}
async function runUpdate(data) {
  VARS = {};
  REPORT = { components: [], unbound: new Set(), noCapture: [] };
  await Promise.all(
    WEIGHTS.map((style) => figma.loadFontAsync({ family: "Inter", style }))
  );
  await loadDocFont();
  if (!(await loadVars()))
    throw new Error(
      "milvus 변수가 없습니다. 먼저 「디자인 시스템 생성」으로 초기 세팅을 하세요"
    );
  const cp = await getPage(PAGES.components);
  const idx = {
    sections: new Map(
      cp.children.filter((x) => x.type === "SECTION").map((x) => [x.name, x])
    ),
    project: new Map()
  };
  for (const c of cp.findAllWithCriteria({ types: ["COMPONENT"] }))
    if (c.name.startsWith("Project/")) idx.project.set(c.name.slice(8), c);
  const done = [];
  await figma.setCurrentPageAsync(cp);
  for (const c of data.components || []) {
    LITERALS = 0;
    const section = await getSectionIn(cp, "Project · " + c.name);
    for (const n of [...section.children]) n.remove(); // 같은 이름은 지우고 다시 그린다(중복 0)
    const frame = buildM(c.tree, idx, false);
    section.appendChild(frame);
    applyFill(frame);
    const comp = figma.createComponentFromNode(frame);
    comp.name = "Project/" + c.name;
    comp.description =
      "프로젝트 LWC " +
      c.name +
      " (코드에서 이관). 직접 값 " +
      c.report.literals +
      "건" +
      (c.report.unknown.length
        ? ", 자리 표시: " + c.report.unknown.join(" ")
        : "");
    comp.x = 100;
    comp.y = 100;
    fitSection(section);
    idx.project.set(c.name, comp);
    done.push(
      "component " +
        c.name +
        " (직접 값 " +
        (c.report.literals + LITERALS) +
        ")"
    );
  }
  if ((data.pages || []).length) {
    const pp = await getPage(PAGES.pages);
    await figma.setCurrentPageAsync(pp);
    for (const p of data.pages) {
      LITERALS = 0;
      const section = await getSectionIn(pp, "Page · " + p.name);
      for (const n of [...section.children]) n.remove();
      const frame = buildM(p.tree, idx, false);
      frame.name = p.label + " (" + p.template + ")";
      section.appendChild(frame);
      applyFill(frame);
      frame.x = 100;
      frame.y = 100;
      fitSection(section);
      done.push(
        "page " + p.name + (p.notes.length ? " — " + p.notes.join("; ") : "")
      );
    }
    layoutSections(pp);
  }
  layoutSections(cp, 6);
  log({
    step: "update",
    done,
    placeholders: [...REPORT.unbound],
    missing: REPORT.noCapture
  });
  return (
    done.join(", ") +
    (REPORT.noCapture.length
      ? " / Figma 에 없는 컴포넌트 " + REPORT.noCapture.length + "개(콘솔)"
      : "")
  );
}

// --- 내보내기: 다른 Figma 파일(고객사·커뮤니티 키트)의 변수·스타일·선택한 컴포넌트를 JSON 으로 ---
// 브랜드 util.css 를 쓸 때 원본 값으로 쓴다. 색은 #RRGGBB(반투명은 알파 포함), 별칭은 가리키는 변수 이름까지 남긴다
const hex2 = (x) =>
  Math.round(x * 255)
    .toString(16)
    .padStart(2, "0");
const toHex = (c) =>
  "#" +
  hex2(c.r) +
  hex2(c.g) +
  hex2(c.b) +
  (c.a !== undefined && c.a < 1 ? hex2(c.a) : "");
async function varName(id) {
  const v = id && (await figma.variables.getVariableByIdAsync(id));
  return v ? v.name : null;
}
async function exportValue(v, byId) {
  if (v && v.type === "VARIABLE_ALIAS") {
    const t = byId[v.id] || (await figma.variables.getVariableByIdAsync(v.id));
    return {
      alias: t ? t.name : v.id,
      value: t
        ? await exportValue(
            t.valuesByMode[Object.keys(t.valuesByMode)[0]],
            byId
          )
        : null
    };
  }
  if (v && typeof v === "object" && "r" in v) return toHex(v);
  return v;
}
async function paintsOut(paints, bound) {
  const out = [];
  for (const [i, p] of (paints || []).entries()) {
    if (p.type !== "SOLID" || p.visible === false) {
      out.push({ type: p.type });
      continue;
    }
    const b = (bound || [])[i] || (p.boundVariables && p.boundVariables.color);
    out.push({
      hex: toHex(
        Object.assign({ a: p.opacity === undefined ? 1 : p.opacity }, p.color)
      ),
      variable: await varName(b && (b.id || (b.color && b.color.id)))
    });
  }
  return out;
}
async function nodeOut(n, depth) {
  const o = {
    name: n.name,
    type: n.type,
    w: Math.round(n.width),
    h: Math.round(n.height)
  };
  const bv = n.boundVariables || {};
  if ("fills" in n && Array.isArray(n.fills))
    o.fills = await paintsOut(n.fills);
  if ("strokes" in n && n.strokes.length) {
    o.strokes = await paintsOut(n.strokes);
    o.strokeWeight = n.strokeWeight;
  }
  if ("cornerRadius" in n && n.cornerRadius)
    o.radius =
      n.cornerRadius === figma.mixed ? n.topLeftRadius : n.cornerRadius;
  if ("layoutMode" in n && n.layoutMode !== "NONE")
    Object.assign(o, {
      layout: n.layoutMode,
      gap: n.itemSpacing,
      pad: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft]
    });
  if ("effects" in n && n.effects.length)
    o.effects = n.effects
      .filter((e) => e.visible)
      .map((e) => ({
        type: e.type,
        color: e.color ? toHex(e.color) : null,
        x: e.offset && e.offset.x,
        y: e.offset && e.offset.y,
        blur: e.radius,
        spread: e.spread
      }));
  if (n.type === "TEXT")
    Object.assign(o, {
      chars: n.characters.slice(0, 40),
      font:
        n.fontName === figma.mixed
          ? "mixed"
          : n.fontName.family + " " + n.fontName.style,
      size: n.fontSize,
      lineHeight: n.lineHeight
    });
  if ("opacity" in n && n.opacity < 1) o.opacity = n.opacity;
  const vars = {};
  for (const [k, v] of Object.entries(bv)) {
    const ids = Array.isArray(v) ? v.map((x) => x.id) : [v.id];
    vars[k] = [];
    for (const id of ids) vars[k].push(await varName(id));
  }
  if (Object.keys(vars).length) o.vars = vars;
  if (n.type === "COMPONENT_SET") o.props = n.componentPropertyDefinitions;
  if ("children" in n && depth < 6) {
    o.children = [];
    for (const c of n.children.slice(0, 40))
      o.children.push(await nodeOut(c, depth + 1));
  }
  return o;
}
async function runExport() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const vars = await figma.variables.getLocalVariablesAsync();
  const byId = Object.fromEntries(vars.map((v) => [v.id, v]));
  const variables = [];
  for (const v of vars) {
    const col = cols.find((c) => c.id === v.variableCollectionId);
    const values = {};
    for (const [mode, val] of Object.entries(v.valuesByMode))
      values[(col.modes.find((m) => m.modeId === mode) || {}).name || mode] =
        await exportValue(val, byId);
    variables.push({
      collection: col.name,
      name: v.name,
      type: v.resolvedType,
      values,
      scopes: v.scopes,
      code: v.codeSyntax,
      description: v.description
    });
  }
  const paint = [];
  for (const s of await figma.getLocalPaintStylesAsync())
    paint.push({
      name: s.name,
      paints: await paintsOut(
        s.paints,
        s.boundVariables && s.boundVariables.paints
      )
    });
  const text = (await figma.getLocalTextStylesAsync()).map((s) => ({
    name: s.name,
    font: s.fontName.family + " " + s.fontName.style,
    size: s.fontSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing
  }));
  const effect = (await figma.getLocalEffectStylesAsync()).map((s) => ({
    name: s.name,
    effects: s.effects.map((e) => ({
      type: e.type,
      color: e.color ? toHex(e.color) : null,
      x: e.offset && e.offset.x,
      y: e.offset && e.offset.y,
      blur: e.radius,
      spread: e.spread
    }))
  }));
  const selection = [];
  for (const n of figma.currentPage.selection.slice(0, 20))
    selection.push(await nodeOut(n, 0));
  const out = {
    file: figma.root.name,
    page: figma.currentPage.name,
    exportedAt: new Date().toISOString(),
    variables,
    styles: { paint, text, effect },
    selection
  };
  figma.ui.postMessage({
    type: "export",
    json: JSON.stringify(out, null, 2),
    name: figma.root.name.replace(/[^A-Za-z0-9가-힣]+/g, "-") + "-export.json"
  });
  return (
    "변수 " +
    variables.length +
    "개, 색 스타일 " +
    paint.length +
    ", 글자 스타일 " +
    text.length +
    ", 효과 스타일 " +
    effect.length +
    ", 선택 " +
    selection.length +
    "개"
  );
}

figma.showUI(__html__, { width: 380, height: 260 });
figma.ui.postMessage({ type: "mode", mode: figma.command || "build" });
if (figma.command === "export") {
  runExport()
    .then((m) => ui("완료: " + m))
    .catch((e) => {
      console.error(e);
      ui("오류: " + e.message);
    });
}
figma.ui.onmessage = async (m) => {
  if (m.type !== "build") return;
  // figma-update.json(kind: update)은 고른 것만, figma-data.json 은 초기 세팅 전체
  try {
    ui(
      "완료: " +
        (await (m.data.kind === "update"
          ? runUpdate(m.data)
          : runBuild(m.data))) +
        " (상세는 콘솔)"
    );
  } catch (e) {
    console.error(e);
    ui("오류: " + e.message);
  }
};
