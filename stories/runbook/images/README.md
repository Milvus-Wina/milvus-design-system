# 런북 캡처

이 폴더에 아래 이름의 PNG를 넣으면 런북(`stories/runbook/runbook.mdx`)의 해당 자리에 나타납니다. 없는 파일은 화면에 나오지 않습니다.

| 파일                     | 런북 위치       | 찍을 화면                                                                                 | 가릴 곳                           |
| ------------------------ | --------------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| `01-github-token.png`    | 1-2 토큰 만들기 | GitHub 토큰 생성 화면에서 `read:packages`만 체크된 부분                                   | 토큰 값                           |
| `02-windows-env.png`     | 1-3 Windows     | "계정의 환경 변수 편집" 창의 `NODE_AUTH_TOKEN` 행                                         | 토큰 값                           |
| `03-install.png`         | 2 설치          | `pnpm milvus --version` 결과                                                              | 프롬프트의 사용자 이름            |
| `04-init.png`            | 3 init          | init 결과: 만든 파일 목록과 "다음 단계"                                                   | 사용자 이름, org 별칭             |
| `05-spec-page.png`       | 4 브랜드 요청   | 브랜드 명세 페이지: 할 일 세 줄과 입력 네 칸                                              | 북마크 바, 브라우저 프로필        |
| `06-spec-saved.png`      | 4 브랜드 요청   | 저장한 뒤 "마지막 저장 …" 표시                                                            | 같음                              |
| `07-claude-table.png`    | 5 Claude 반영   | Claude가 보여 주는 브랜드 명세 표                                                         | 세션 목록(고객사 이름), 계정 이름 |
| `08-check.png`           | 6 확인          | `pnpm milvus check` 통과 출력                                                             | 사용자 이름                       |
| `09-storybook-brand.png` | 6 확인          | 툴바 🖌 메뉴에서 브랜드를 바꾼 화면                                                        | 북마크 바                         |
| `10-deploy-plan.png`     | 7 배포          | `pnpm milvus deploy` 계획 출력                                                            | org 별칭, 사용자 이름             |
| `11-deploy-done.png`     | 7 배포          | `--yes` 뒤 "배포를 마쳤습니다"                                                            | 같음                              |
| `12-app-manager.png`     | 8 org 마무리    | App Manager 유틸리티 항목의 `Milvus Brand Loader`와 "앱이 열릴 때 백그라운드로 로드" 체크 | org 도메인                        |
| `13-vf-settings.png`     | 8 org 마무리    | Visualforce Settings의 SLDS 2 체크박스                                                    | org 도메인                        |
| `14-lex-after.png`       | 8 org 마무리    | 배포 뒤 Lightning Experience 레코드 화면                                                  | org 도메인, 레코드의 전화·이메일  |
| `15-show-code.png`       | 9 컴포넌트 쓰기 | 예제 아래 **Show code**를 펼친 화면                                                       | 북마크 바                         |
| `16-update.png`          | 10 새 버전      | `pnpm milvus update` 결과                                                                 | 사용자 이름                       |

가릴 때는 흐림 대신 단색으로 칠하세요. 공개 저장소라 org 도메인, org ID, 사용자 이름, 고객사 이름, 레코드의 개인정보가 보이면 안 됩니다.
