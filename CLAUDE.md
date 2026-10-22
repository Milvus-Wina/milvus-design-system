# CLAUDE.md — 밀버스 디자인 시스템

Salesforce LWC 디자인 시스템 패키지 `@milvus-wina/milvus-design-system`의 저장소다. 소개와 폴더 구조는 `README.md`에 있다.

## 작업 흐름

1. 이슈를 만들고 `main`에서 `<타입>/<이슈번호>-<설명>` 브랜치를 만든다. 예: `feat/12-milvus-tabs`
2. 바꿀 코드를 먼저 읽고 실제 흐름을 따라간 뒤 고친다
3. 아래 검증 명령을 통과해야 커밋한다
4. 커밋은 `[태그] 요약 (#이슈번호)`. 태그: `[Feat]` `[Fix]` `[Docs]` `[Refactor]` `[Test]` `[Chore]`. 커밋·push는 사용자가 요청할 때만 한다
5. PR 제목은 대표 커밋과 같게, 본문에 `Closes #N`과 확인 방법. Squash and merge
6. 발행은 사용자가 요청할 때만: `package.json` version을 올린 PR이 병합된 뒤 `v<버전>` 태그 push

## 판단 순서

코드를 쓰기 전에 위에서부터 묻고, 되는 첫 단계에서 멈춘다.

1. 정말 필요한가
2. 저장소에 이미 있는가(`milvus*` 컴포넌트, `lib/`, `scripts/`)
3. org 테마(색·로고)로 되는가
4. SLDS가 제공하는가(`lightning-*` → SLDS 블루프린트)
5. 브랜드 util.css(hook, `--milvus-*` 변수)로 되는가
6. 설치된 의존성이나 Node·브라우저 기본 기능으로 되는가
7. 그래도 안 되면 동작하는 최소 구현. 새 의존성은 이유를 PR에 적는다

모양만 바꾸려고 밀버스 컴포넌트를 새로 만들지 않는다. 표현 컴포넌트에는 `@wire`, Apex, LDS를 넣지 않는다.

## 절대 줄이지 않는 것

- 입력 검증(`@api` 값), 에러 처리, 데이터 손실 방지
- 접근성: SLDS 블루프린트의 `aria-*`, 키보드 조작, 대비 4.5:1
- `var()` fallback, 컴포넌트마다 스토리

## 스타일 규칙

- 컴포넌트 CSS: `var(--slds-g-*, fallback)`, `var(--slds-s-*, fallback)`, `var(--milvus-*, fallback)` 읽기만. hex 색, `--slds-c-*`, hook 재정의, `.slds-*` 덮어쓰기 금지
- `brands/<브랜드>/util.css` 규칙은 `lib/rules.ts`가 구현하고 `pnpm test:brands`가 검사한다
- org 브랜드의 `brands/<브랜드>/theme.json`, `logo.*`는 직접 고치지 않는다(`SF_ORG=<별칭> pnpm sync:theme`이 만든다). 샘플 브랜드(`"source": "sample"`, `brands/Sample_Forest`)는 손으로 관리한다
- 커스텀 변수 접두사는 `--milvus-`만 쓴다

## 검증 명령

| 명령                   | 확인하는 것                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `pnpm lint`            | ESLint (`force-app/**/lwc/**/*.js`)                               |
| `pnpm test`            | 타입 검사 → LWC Jest → node 테스트 → 브랜드 규칙 → 정적 반영 검사 |
| `pnpm build-storybook` | LWC 빌드 뒤 Storybook 정적 빌드                                   |
| `pnpm audit:brand`     | 정적 반영 검사. 기준 파일과 달라지면 실패                         |
| `pnpm bridge:generate` | SLDS 2 CSS에서 `milvusBridge.css`를 다시 만든다(생성)             |

CI(`.github/workflows/storybook.yml`)는 `pnpm lint`, `pnpm test`, `pnpm build-storybook`을 실행한다. UI 변경은 Storybook에서 직접 확인한다.

## 도구와 안전

- **pnpm만 쓴다.** `npm`, `npx`, `yarn`은 쓰지 않는다. `npx` 예제는 `pnpm exec`(설치됨)나 `pnpm dlx`(미설치)로 바꾼다
- **sf CLI:** 조회는 자유롭게 한다. 배포, 삭제, 데이터 변경, `apex run`은 대상 org와 명령을 보여 주고 승인을 받는다
- 개인정보 필드(`Phone`, `Email`, 주소)나 `FIELDS(ALL)`는 조회하지 않는다
- 액세스 토큰을 출력하는 명령(`sf org display`, `sf org list --json`, `sf auth list --json`, `sf org open --url-only`·`-r`·`--json`)은 실행하지 않는다
- 공개 저장소다. org ID, 인증 정보, 고객사 이름·데이터를 코드·문서·이슈·커밋에 쓰지 않는다
- `.sfdx/`, `.sf/`, `.env`, `package-lock.json`은 커밋하지 않는다

## 사실 확인

필드명, hook 이름, 패키지 옵션은 추측하지 않는다. describe, 공식 문서, 패키지 소스로 확인하고, 확인하지 못한 것은 **미확인**으로 적는다.
