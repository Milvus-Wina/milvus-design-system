# 제3자 구성 요소 고지 (Third-Party Notices)

밀버스 디자인 시스템은 아래 제3자 구성 요소를 포함하거나 함께 씁니다. 각 구성 요소는 아래 원문 라이선스·이용 약관을 따르며, 밀버스 이용 조건(`LICENSE`)은 이를 바꾸지 않습니다.

| 구성 요소                                                               | 버전          | 쓰는 곳                                                                                                              | 라이선스                         |
| ----------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Salesforce Lightning Design System 2 (`@salesforce-ux/design-system-2`) | 2.264.2       | `templates/force-app/main/default/staticresources/milvusBridge.css`(SLDS 2 CSS에서 만든 파일), Storybook 문서 사이트 | Salesforce Terms of Use (아래 1) |
| Lightning Base Components (`lightning-base-components`)                 | 1.28.19-alpha | Storybook 문서 사이트의 기본 컴포넌트 카탈로그와 "원본과 hook" 보기                                                  | Salesforce Terms of Use (아래 2) |
| Lightning Web Components (`lwc`, `@lwc/*`)                              | 9.4.3         | Storybook에서 LWC를 그리는 엔진과 컴파일러                                                                           | MIT (아래 3)                     |

그 밖에 빌드·문서 도구(Storybook, Vite, Rollup 등)는 각 패키지에 들어 있는 라이선스를 따릅니다.

## 1. Salesforce Lightning Design System 2

```text
Terms of Use

Copyright 2026 Salesforce, Inc. All rights reserved.

These Terms of Use govern the download, installation, and/or use of this
software provided by Salesforce, Inc. ("Salesforce") (the "Software"), were
last updated on April 15, 2022, and constitute a legally binding
agreement between you and Salesforce. If you do not agree to these Terms of
Use, do not install or use the Software.

Salesforce grants you a worldwide, non-exclusive, no-charge, royalty-free
copyright license to reproduce, prepare derivative works of, publicly
display, publicly perform, sublicense, and distribute the Software and
derivative works subject to these Terms. These Terms shall be included in
all copies or substantial portions of the Software.

Subject to the limited rights expressly granted hereunder, Salesforce
reserves all rights, title, and interest in and to all intellectual
property subsisting in the Software. No rights are granted to you hereunder
other than as expressly set forth herein. Users residing in countries on
the United States Office of Foreign Assets Control sanction list, or which
are otherwise subject to a US export embargo, may not use the Software.

Implementation of the Software may require development work, for which you
are responsible. The Software may contain bugs, errors and
incompatibilities and is made available on an AS IS basis without support,
updates, or service level commitments.

Salesforce reserves the right at any time to modify, suspend, or
discontinue, the Software (or any part thereof) with or without notice. You
agree that Salesforce shall not be liable to you or to any third party for
any modification, suspension, or discontinuance.

You agree to defend Salesforce against any claim, demand, suit or
proceeding made or brought against Salesforce by a third party arising out
of or accruing from (a) your use of the Software, and (b) any application
you develop with the Software that infringes any copyright, trademark,
trade secret, trade dress, patent, or other intellectual property right of
any person or defames any person or violates their rights of publicity or
privacy (each a "Claim Against Salesforce"), and will indemnify Salesforce
from any damages, attorney fees, and costs finally awarded against
Salesforce as a result of, or for any amounts paid by Salesforce under a
settlement approved by you in writing of, a Claim Against Salesforce,
provided Salesforce (x) promptly gives you written notice of the Claim
Against Salesforce, (y) gives you sole control of the defense and
settlement of the Claim Against Salesforce (except that you may not settle
any Claim Against Salesforce unless it unconditionally releases Salesforce
of all liability), and (z) gives you all reasonable assistance, at your
expense.

WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, THE SOFTWARE IS NOT
SUPPORTED AND IS PROVIDED "AS IS," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. IN NO EVENT SHALL SALESFORCE HAVE ANY LIABILITY FOR ANY DAMAGES,
INCLUDING, BUT NOT LIMITED TO, DIRECT, INDIRECT, SPECIAL, INCIDENTAL,
PUNITIVE, OR CONSEQUENTIAL DAMAGES, OR DAMAGES BASED ON LOST PROFITS, DATA,
OR USE, IN CONNECTION WITH THE SOFTWARE, HOWEVER CAUSED AND WHETHER IN
CONTRACT, TORT, OR UNDER ANY OTHER THEORY OF LIABILITY, WHETHER OR NOT YOU
HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

These Terms of Use shall be governed exclusively by the internal laws of
the State of California, without regard to its conflicts of laws
rules. Each party hereby consents to the exclusive jurisdiction of the
state and federal courts located in San Francisco County, California to
adjudicate any dispute arising out of or relating to these Terms of Use and
the download, installation, and/or use of the Software. Except as expressly
stated herein, these Terms of Use constitute the entire agreement between
the parties, and supersede all prior and contemporaneous agreements,
proposals, or representations, written or oral, concerning their subject
matter. No modification, amendment, or waiver of any provision of these
Terms of Use shall be effective unless it is by an update to these Terms of
Use that Salesforce makes available, or is in writing and signed by the
party against whom the modification, amendment, or waiver is to be
asserted.

Data Privacy: Salesforce may collect, process, and store device,
system, and other information related to your use of the Software. This
information includes, but is not limited to, IP address, user metrics, and
other data ("Usage Data"). Salesforce may use Usage Data for analytics,
product development, and marketing purposes. You acknowledge that files
generated in conjunction with the Software may contain sensitive or
confidential data, and you are solely responsible for anonymizing and
protecting such data.
```

## 2. Lightning Base Components

```text
Terms of Use

Copyright 2025 Salesforce, Inc. All rights reserved.

These Terms of Use govern the download, installation, and/or use of this
software provided by Salesforce, Inc. ("Salesforce") (the "Software"), were
last updated on April 15, 2025, and constitute a legally binding
agreement between you and Salesforce. If you do not agree to these Terms of
Use, do not install or use the Software.

Salesforce grants you a worldwide, non-exclusive, no-charge, royalty-free
copyright license to reproduce, prepare derivative works of, publicly
display, publicly perform, sublicense, and distribute the Software and
derivative works subject to these Terms. These Terms shall be included in
all copies or substantial portions of the Software.

Subject to the limited rights expressly granted hereunder, Salesforce
reserves all rights, title, and interest in and to all intellectual
property subsisting in the Software. No rights are granted to you hereunder
other than as expressly set forth herein. Users residing in countries on
the United States Office of Foreign Assets Control sanction list, or which
are otherwise subject to a US export embargo, may not use the Software.

Implementation of the Software may require development work, for which you
are responsible. The Software may contain bugs, errors and
incompatibilities and is made available on an AS IS basis without support,
updates, or service level commitments.

Salesforce reserves the right at any time to modify, suspend, or
discontinue, the Software (or any part thereof) with or without notice. You
agree that Salesforce shall not be liable to you or to any third party for
any modification, suspension, or discontinuance.

You agree to defend Salesforce against any claim, demand, suit or
proceeding made or brought against Salesforce by a third party arising out
of or accruing from (a) your use of the Software, and (b) any application
you develop with the Software that infringes any copyright, trademark,
trade secret, trade dress, patent, or other intellectual property right of
any person or defames any person or violates their rights of publicity or
privacy (each a "Claim Against Salesforce"), and will indemnify Salesforce
from any damages, attorney fees, and costs finally awarded against
Salesforce as a result of, or for any amounts paid by Salesforce under a
settlement approved by you in writing of, a Claim Against Salesforce,
provided Salesforce (x) promptly gives you written notice of the Claim
Against Salesforce, (y) gives you sole control of the defense and
settlement of the Claim Against Salesforce (except that you may not settle
any Claim Against Salesforce unless it unconditionally releases Salesforce
of all liability), and (z) gives you all reasonable assistance, at your
expense.

WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, THE SOFTWARE IS NOT
SUPPORTED AND IS PROVIDED "AS IS," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. IN NO EVENT SHALL SALESFORCE HAVE ANY LIABILITY FOR ANY DAMAGES,
INCLUDING, BUT NOT LIMITED TO, DIRECT, INDIRECT, SPECIAL, INCIDENTAL,
PUNITIVE, OR CONSEQUENTIAL DAMAGES, OR DAMAGES BASED ON LOST PROFITS, DATA,
OR USE, IN CONNECTION WITH THE SOFTWARE, HOWEVER CAUSED AND WHETHER IN
CONTRACT, TORT, OR UNDER ANY OTHER THEORY OF LIABILITY, WHETHER OR NOT YOU
HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

These Terms of Use shall be governed exclusively by the internal laws of
the State of California, without regard to its conflicts of laws
rules. Each party hereby consents to the exclusive jurisdiction of the
state and federal courts located in San Francisco County, California to
adjudicate any dispute arising out of or relating to these Terms of Use and
the download, installation, and/or use of the Software. Except as expressly
stated herein, these Terms of Use constitute the entire agreement between
the parties, and supersede all prior and contemporaneous agreements,
proposals, or representations, written or oral, concerning their subject
matter. No modification, amendment, or waiver of any provision of these
Terms of Use shall be effective unless it is by an update to these Terms of
Use that Salesforce makes available, or is in writing and signed by the
party against whom the modification, amendment, or waiver is to be
asserted.

Data Privacy: Salesforce may collect, process, and store device,
system, and other information related to your use of the Software. This
information includes, but is not limited to, IP address, user metrics, and
other data ("Usage Data"). Salesforce may use Usage Data for analytics,
product development, and marketing purposes. You acknowledge that files
generated in conjunction with the Software may contain sensitive or
confidential data, and you are solely responsible for anonymizing and
protecting such data.
```

## 3. Lightning Web Components

```text
# LWC core license

MIT LICENSE

Copyright (c) 2026, Salesforce, Inc.
All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# Licenses of bundled dependencies

## @parse5/tools

The MIT License (MIT)

Copyright © 2024 James Garbutt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## entities

Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## estree-walker

Copyright (c) 2015-20 [these people](https://github.com/Rich-Harris/estree-walker/graphs/contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## observable-membrane

MIT License

Copyright (c) 2017 Salesforce

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## parse5

Copyright (c) 2013-2019 Ivan Nikulin (ifaaan@gmail.com, https://github.com/inikulin)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
