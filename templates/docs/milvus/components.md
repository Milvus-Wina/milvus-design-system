# 프로젝트 부품 목록 (Figma 충실 모드)

`milvus.config.json`의 `fidelity`가 `figma`인 프로젝트에서, Figma 디자인의 부품을 LWC로 만들 때 쓰는 목록이다. 새 LWC를 만들기 전에 여기서 찾고, 만든 뒤 바로 더한다(`.claude/rules/milvus/design.md` 5절 "충실도 모드"). 기본 모드(`slds`)에서는 쓰지 않는다.

- 이 파일(`docs/milvus/components.md`)은 프로젝트 소유다. `pnpm milvus init`(없던 프로젝트는 `update`)이 처음 한 번 놓고, 그 뒤로는 팀이 고친다
- 부품 이름은 `<프로젝트 접두사><Figma 세트 이름 camelCase>`다(예: 접두사 `acme` + `Icon Button` → `acmeIconButton`). `milvus` 접두사는 밀버스 패키지 전용이라 쓰지 않는다
- 값(색·간격·반경·그림자·글자)은 `milvusBrand.css`의 토큰 `--token-*`에 두고 컴포넌트 CSS는 `var(--token-*, fallback)`로 읽는다. 직접 값은 `check`가 막는다
- 동작이 복잡한 부분(rich text, 날짜 선택, 조회)은 Figma 모양을 유지하면서 SLDS 기본 컴포넌트(`lightning-*`)를 안에서 쓴다. 어디에 썼는지 비고에 적는다

## Figma 파일: <파일 이름> — 파일 키 `<키>`, 접두사 `<접두사>`

| Figma 세트 | 세트 id | LWC | 구현한 변형 | 안 한 변형 | 비고 |
| --- | --- | --- | --- | --- | --- |
| (예) Button | `92:11225` | `acmeButton` | Hierarchy=Primary·Secondary × State=Default·Hover·Pressed | Disabled | Disabled는 Figma에 없어 임시 |

## 공통 자원

| 자원 | 내용 |
| --- | --- |
| `milvusBrand.css`의 `--token-*` | Figma 변수 값. 대응은 `milvus-brand` skill이 제안한 명세 표 |
| `<접두사>Icons` (static resource) | Figma 아이콘 SVG 스프라이트. id는 Figma 레이어 이름 |
