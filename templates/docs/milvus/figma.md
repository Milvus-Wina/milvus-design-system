# 밀버스 Figma 작성 규칙

Figma 디자인을 LWC로 옮길 때(Claude Code의 Figma to LWC 스킬 경로) 코드가 추측하지 않게 Figma 파일에 있어야 하는 것을 정한 팀 규칙이다. 디자이너는 넘기기 전에 1장 체크리스트로 점검하고, 개발자와 Claude는 받은 파일을 같은 체크리스트로 점검한다.

- 이 파일(`docs/milvus/figma.md`)은 프로젝트 소유다. `pnpm milvus init`(이 파일이 없던 프로젝트는 `update`)이 처음 한 번 놓고, 그 뒤로는 팀이 규칙을 바꾼다. `update`는 있는 파일을 건드리지 않는다
- Claude는 Figma 링크를 받아 LWC를 만들기 전에 이 체크리스트로 입력을 점검하고, 빠진 것은 추측하지 말고 사용자에게 묻는다(`.claude/rules/milvus/design.md` 5절)
- 규칙은 "규칙 / 이유 / 출처"로 적는다. 공식 문서에 근거가 없는 규칙은 **밀버스 규칙(팀 합의)**으로 표시한다
- 변수를 밀버스 토큰(`--milvus-*`)과 SLDS hook으로 잇는 규칙은 토큰 층 설계가 끝난 뒤 이 파일에 더한다. 지금은 Figma 쪽 이름 형식(2장)만 정한다

## 1. 넘기기 전 체크리스트

- [ ] **부품은 컴포넌트, 상태는 변형.** 두 번 이상 쓰는 부품은 컴포넌트 세트로 만들고, 상태는 같은 세트의 변형 속성(`State=Default·Hover·Pressed·Focus·Disabled`)으로 둔다. 내용 상태(`Empty·Loading·Error`)도 변형이다. 일부러 없는 상태는 컴포넌트 설명에 "Disabled 없음(의도)"처럼 적는다
- [ ] **값은 전부 변수.** 색·간격·반경·그림자·글자 크기를 직접 값(hex, px)으로 두지 않고 2장 형식의 역할 이름 변수로 건다. 원시 팔레트(`palette/…`)는 역할 변수의 별칭(alias) 원본으로만 쓰고 부품에 직접 걸지 않는다
- [ ] **모든 프레임에 자동 레이아웃.** 간격(gap)과 안쪽 여백(padding)이 숫자로 남아야 코드가 간격을 읽는다. SVG나 스크린샷에는 간격 규칙이 남지 않는다
- [ ] **이름 규칙(3장).** 컴포넌트 세트·변형 속성·레이어 이름을 역할로 짓는다. `Frame 123`, `Rectangle 4`를 남기지 않는다
- [ ] **아이콘은 컴포넌트.** 아이콘마다 컴포넌트 하나, 레이어 이름이 아이콘 id가 된다. 선(stroke)과 면(fill)을 한 아이콘에 섞지 않는다. 크기는 변수(`sizing/icon/…`)로 건다
- [ ] **동작과 반응형은 글로 적는다.** 클릭 결과, 유효성 검사, 빈 값일 때 동작은 컴포넌트 설명이나 디자인 코멘트에 적는다. 화면 폭에 따라 달라지면 브레이크포인트와 바뀌는 것을 적는다
- [ ] **SLDS 기본 컴포넌트로 만들 부품은 표시한다.** 버튼·입력·선택 상자처럼 Salesforce 기본 컴포넌트(`lightning-*`)로 만들 부품은 컴포넌트 설명에 `SLDS: lightning-button`처럼 적는다. 적지 않은 부품은 Figma 모양대로 직접 만든다 — **밀버스 규칙(팀 합의)**
- [ ] **글꼴은 Salesforce 기본.** 밀버스는 글꼴을 바꾸지 않는다. Figma에서 다른 글꼴을 쓰면 크기·굵기·줄 높이만 옮겨지고 글꼴은 org 기본이 된다
- [ ] **세트 단위로 읽을 수 있게 둔다.** 한 세트의 변형이 한 페이지 안에 모여 있어야 한 번에 읽는다. 아이콘을 하나씩 읽으면 Figma 호출 한도를 빨리 쓴다(4장)

## 2. 변수 이름 형식 (역할 이름)

### 규칙

1. 컬렉션은 둘이다. `milvus`(역할 변수. 부품이 거는 것)와 `palette`(원시 값. 역할 변수가 별칭으로 가리키는 것) — **밀버스 규칙(팀 합의)**
2. 역할 변수 이름은 `<종류>/<역할>/<단계>`다. `/`로 그룹을 만든다. 역할과 단계는 SLDS 2 global styling hook의 이름(`--slds-g-<종류>-<역할>-<단계>`)에서 그대로 가져온다. 그래야 토큰 층 없이도 hook과 1:1로 대응되고, 토큰 층이 생기면 기계적으로 옮길 수 있다 — **밀버스 규칙(팀 합의)**
3. 값 이름(`gray-700`, `1D1C1D-30%`)을 역할 변수 이름에 쓰지 않는다. 값 이름은 `palette/<색>/<단계>`(예: `palette/green/50`)에만 둔다
4. hover·pressed는 같은 역할의 다음 단계로 표현한다(예: `color/accent/1` → `color/accent/2`). 단계로 표현할 수 없는 상태만 마지막 조각에 `…/hover`처럼 붙인다. 이 변수는 hook 대응이 없으므로 개발자와 먼저 합의한다
5. 눈금은 SLDS 2 기본값과 같은 값을 쓴다. 간격·반경·글자 크기가 SLDS 눈금 밖(예: 간격 18px)이면 변환 때 가장 가까운 눈금으로 바뀌거나 직접 값이 남는다. hook 이름과 기본값 목록은 설치한 패키지의 `node_modules/@milvus-wina/milvus-design-system/dist/hooks-index.json`에 있다

| 종류 | 역할 변수 예 | 대응하는 SLDS hook | 비고 |
| --- | --- | --- | --- |
| 색 | `color/surface/1`~`3`, `color/surface-container/1`~`3` | `--slds-g-color-surface-1`, `--slds-g-color-surface-container-1` | 면·바탕. `surface/2`가 앱 바탕 |
| 색 | `color/on-surface/1`~`3` | `--slds-g-color-on-surface-1`~`-3` | 글자. 3이 제목·본문, 2가 입력값·라벨, 1이 보조 |
| 색 | `color/border/1`~`2` | `--slds-g-color-border-1`, `-2` | 1 구분선·카드, 2 입력·버튼 |
| 색 | `color/accent/1`~`3`, `color/on-accent/1` | `--slds-g-color-accent-1`, `--slds-g-color-on-accent-1` | 브랜드 색. 실제 값의 원본은 org 테마(`BrandingSet`)이므로 CSS에는 적지 않는다 |
| 색 | `color/error/1`, `color/success/1`, `color/warning/1`, `color/info/1` | `--slds-g-color-error-1` 등 피드백 색 | 글자·바탕·테두리 짝은 `on-error`, `error-container`, `border-error`처럼 hook 이름을 따른다 |
| 색 | `color/disabled/1`, `color/on-disabled/1` | `--slds-g-color-disabled-1`, `--slds-g-color-on-disabled-1` | 비활성 |
| 간격 | `spacing/1`~`12` | `--slds-g-spacing-1`~`-12` | 자동 레이아웃의 gap·padding에 건다 |
| 반경 | `radius/1`~`4`, `radius/pill` | `--slds-g-radius-border-1`~`-4`, `--slds-g-radius-border-pill` | |
| 그림자 | `shadow/1`~`4` | `--slds-g-shadow-1`~`-4` | |
| 글자 | `font/scale/neg-2`~`7`, `font/weight/regular`·`bold` | `--slds-g-font-scale-neg-2`~`-7`, `--slds-g-font-scale-base` | 크기는 `font/scale/N`. `font/size/N`은 없는 이름이다 |
| 크기 | `sizing/border/1`~`2`, `sizing/icon/<이름>` | `--slds-g-sizing-border-1`, `-2` | 아이콘 크기는 hook이 없어 밀버스 토큰 후보다 |

### 이유

- 역할 이름 변수가 있어야 Figma 값 하나가 코드 토큰 하나와 1:1로 맞는다. 값 이름 변수(`1D1C1D-30%`)는 같은 색이 역할에 따라 다른 hook으로 가야 할 때 갈라지지 않는다(2026-10-30 밀버스 실습에서 Slack UI Kit의 값 이름 변수를 역할로 다시 나눠야 했다)
- SLDS 의미 hook은 값이 Salesforce 색이라 Figma 색과 다르다. 그래서 변환 도구가 Figma 색을 SLDS hook에 "가장 가까운 것"으로 대응시키면 화면 색이 바뀐다. 역할 변수의 값을 밀버스 토큰 층이 받아야 Figma 값이 그대로 간다(토큰 층 설계에서 정한다)
- hook 이름 형식을 따르면 `search-hooks`나 `hooks-index.json`으로 존재를 바로 확인할 수 있다. 색 hook은 반드시 번호가 붙고 글자 크기는 `font-scale`이라는 함정이 Figma 쪽 이름에도 그대로 적용된다

## 3. 이름 규칙 (컴포넌트·레이어)

1. 컴포넌트 세트 이름은 영문이고 부품의 역할을 말한다(`Button`, `Icon Button`, `Message Box`). LWC 이름은 `<프로젝트 접두사><세트 이름 camelCase>`가 된다(예: 접두사 `acme` + `Icon Button` → `acmeIconButton`). 접두사 `milvus`는 밀버스 패키지 전용이라 쓰지 않는다
2. 변형 속성 이름은 `State`, `Variant`(또는 `Hierarchy`), `Size`로 통일하고 값은 영문 PascalCase(`Default`, `Hover`, `Primary`, `Small`)로 쓴다. 코드에서 `@api variant`, `@api size`와 CSS 상태로 바뀐다 — **밀버스 규칙(팀 합의)**
3. 레이어 이름은 역할(`Header`, `Body`, `Footer`, `Label`, `Icon`, `Divider`)로 짓는다. 자동 이름(`Frame 12`, `Group 3`)을 남기지 않는다
4. 아이콘 컴포넌트 이름은 kebab-case(`caret-down`, `add-emoji`)로 짓는다. 그대로 SVG 스프라이트의 id가 된다
5. 다른 디자인 시스템 파일(Slack UI Kit 등)을 그대로 쓸 때는 이름을 고치지 말고, 접두사와 대응표(`docs/milvus/` 아래 `<파일>-components.md`)를 개발자가 만든다

## 4. 넘기기와 읽기

- 링크는 프레임이나 컴포넌트 세트 단위로 준다(`figma.com/design/<파일 키>/…?node-id=<노드>`). 페이지 전체 링크는 구조만 오고 색·글꼴이 오지 않는다
- 읽는 쪽(공식 Figma MCP, Framelink)은 둘 다 Figma 플랜과 좌석의 호출 한도를 받는다. View·Collab 좌석은 플랜과 상관없이 월 20회라 실무 전제는 Dev 또는 Full 좌석이다. 한 번 읽은 데이터는 파일로 저장해 다시 쓴다
- 변환 결과는 `pnpm milvus check`를 통과해야 한다. 변수 대신 직접 값이 남아 있으면 Figma에 변수를 걸고 다시 읽는 것이 코드에서 고치는 것보다 빠르다

### 출처 (2026-10-30 확인)

- LWC 개발자 가이드: [Use the Figma to LWC Conversion Tool (Beta)](https://developer.salesforce.com/docs/platform/lwc/guide/mcp-design.html) — "Prepare Your Figma Design": 이름 규칙 통일, 레이어의 논리적 그룹화, 모든 상태 포함, 브레이크포인트, SLDS 컴포넌트·패턴 사용, 동작은 디자인 코멘트에, 자산 내보내기
- GitHub forcedotcom/sf-skills: [experience-lwc-design-generate/SKILL.md](https://github.com/forcedotcom/sf-skills/blob/main/skills/experience-lwc-design-generate/SKILL.md) — Phase 1 입력(Figma URL, 스크린샷, Dev Mode 메타데이터), PRD 항목(상태·상호작용·반응형·스타일)
- GitHub forcedotcom/sf-skills: [design-systems-slds-apply/SKILL.md](https://github.com/forcedotcom/sf-skills/blob/main/skills/design-systems-slds-apply/SKILL.md) — hook 이름 함정(색 hook은 번호 필수, 글자 크기는 `font-scale`), 결정 계층
- Figma 도움말: [Create and manage variables and collections](https://help.figma.com/hc/en-us/articles/15145852043927) — 컬렉션, 그룹, 별칭(alias)
- Figma 도움말: [Explore component properties](https://help.figma.com/hc/en-us/articles/5579474826519-Explore-component-properties) — 변형 속성(state, size 등)
- Figma 도움말: [Guide to auto layout in Figma](https://help.figma.com/hc/en-us/articles/360040451373) — padding·gap
- Figma 도움말: [Plans, access, and permissions](https://help.figma.com/hc/en-us/articles/39252411778583) — MCP 서버 호출 한도(View·Collab 월 20회, Full·Dev 하루 200·600회)
- 밀버스 실습(2026-10-30, Slack Design System and UI Kit → LWC): 값 이름 변수를 역할로 다시 나눈 것, SLDS 의미 hook과 Figma 색의 차이, 세트 단위 읽기와 호출 한도, Figma에 없던 Disabled·Focus 상태를 임시로 만든 것
