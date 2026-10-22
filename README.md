# 밀버스 디자인 시스템

Salesforce 프로젝트에서 함께 쓰는 LWC 디자인 시스템입니다. 패키지 하나를 설치하면 컴포넌트, 브랜드 파일, Storybook 카탈로그, Claude Code 규칙이 프로젝트에 들어옵니다.

- **문서 사이트(Storybook):** https://milvus-wina.github.io/milvus-design-system/
- **패키지:** `@milvus-wina/milvus-design-system` (GitHub Packages)
- **따라 하기:** 문서 사이트의 **런북** 메뉴

## 무엇이 들어 있나요

| 들어 있는 것      | 하는 일                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm milvus` CLI | `init`(세팅), `storybook`(미리보기), `check`(규칙 검사), `deploy`(org 배포), `update`(새 버전 반영) |
| 밀버스 LWC        | Salesforce에 없는 기능만: Badge, MultiSelect, Notification, Calendar, 앱 전체 브랜드 로더           |
| Storybook         | Salesforce 기본 컴포넌트(`lightning-*`) 73개를 내 브랜드로 그려 보는 카탈로그, 브랜드 명세 페이지   |
| Claude Code 규칙  | `.claude/rules/milvus/design.md`, 브랜드 반영 skill, 권한 규칙, 스타일 검사 hook                    |

## 원칙

1. **Salesforce 기본 컴포넌트를 먼저 씁니다.** 밀버스 컴포넌트는 기능이 없을 때만 만듭니다.
2. **브랜드 색과 로고는 org 테마에서 바꿉니다.** 모양(모서리, 간격, 그림자 등)은 요청이 있을 때만 바꿉니다.
3. **배포하기 전에 Storybook에서 확인합니다.**

## 빨리 시작하기

준비(토큰, `~/.npmrc`, org 로그인)는 [런북](https://milvus-wina.github.io/milvus-design-system/?path=/docs/런북--docs) 1단계를 보세요. SFDX 프로젝트 폴더에서:

```bash
printf '@milvus-wina:registry=https://npm.pkg.github.com\n' >> .npmrc
pnpm add -D @milvus-wina/milvus-design-system
pnpm milvus init --target-org <org 별칭> --brand <브랜드 이름>
pnpm milvus storybook
```

브랜드 명세 페이지에 요청을 저장한 뒤 Claude Code에 "브랜드 요청 반영해줘"라고 하세요. 확인했으면 `pnpm milvus deploy`로 배포 계획을 보고 배포하세요.

## 이 저장소에서 개발하기

pnpm만 씁니다(`npm`·`npx`·`yarn` 쓰지 않음).

```bash
pnpm install
pnpm storybook        # 개발 서버 (localhost:6006)
pnpm lint
pnpm test             # 타입 검사, LWC Jest, node 테스트, 브랜드 규칙, 정적 반영 검사
pnpm build-storybook
```

| 폴더                                 | 내용                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| `cli/`                               | `pnpm milvus` 명령                                      |
| `lib/`                               | 규칙 검사, 브랜드 계산, Storybook 플러그인              |
| `force-app/main/default/lwc/milvus*` | 밀버스 LWC                                              |
| `templates/`                         | `init`이 고객 프로젝트에 놓는 파일                      |
| `stories/`                           | Storybook 페이지(시작하기, 런북, Foundations, 컴포넌트) |
| `brands/`                            | 저장소 Storybook의 예시 브랜드                          |
| `audit/`                             | 정적 반영 검사의 기준 파일                              |

- main에 반영하면 문서 사이트가 다시 배포됩니다(`.github/workflows/storybook.yml`)
- `package.json`의 `version`을 올리고 `v<버전>` 태그를 push하면 패키지가 발행됩니다(`.github/workflows/publish.yml`)

## 처음 만든 곳

개인 저장소 [a40418a/learndoshare](https://github.com/a40418a/learndoshare)에서 학습 자료·설계 기록과 함께 만들었고, 2026-10-22 이 저장소로 옮겼습니다. 코드 주석의 "설계 5.6" 같은 번호는 그 저장소의 [설계 문서](https://github.com/a40418a/learndoshare/blob/main/learndoshare_1/docs/specs/2026-10-08-milvus-package-design.md)를 가리킵니다. 이전 패키지 이름은 `@a40418a/milvus-design-system`(0.3.0까지)입니다.
