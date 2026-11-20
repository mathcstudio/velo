# VELO 설치 안내서 (교사용)

처음 한 번만 하면 됩니다. 30분 정도 걸립니다. AI는 **GPT(OpenAI)와 Claude(Anthropic) 중 하나만 있어도** 되고, 둘 다 넣어 두면 교사 화면에서 버튼으로 바꿔 쓸 수 있습니다.

| 서비스 | 하는 일 | 요금 |
|---|---|---|
| GitHub | 코드 보관 | 무료 |
| Vercel | 웹앱 실행 (화면 + 서버) | 무료(Hobby) |
| Supabase | 데이터베이스 (학생, 앱, 기록) | 무료(Free) |
| OpenAI 또는 Anthropic | AI (앱 생성) | **선불 충전 필요** (하나 이상) |

---

## 1단계. AI API 키 만들기 (GPT, Claude 중 하나 또는 둘 다)

### GPT를 쓰려면: OpenAI API 키

1. https://platform.openai.com 에 로그인합니다.
2. **Billing**에서 크레딧을 충전합니다. 처음에는 10달러 정도면 충분합니다.
3. **Limits**에서 월 사용 한도(Budget)를 정해 둡니다. 예상보다 많이 쓰는 일을 막아 줍니다.
4. **API keys**에서 **Create new secret key**를 눌러 `sk-`로 시작하는 키를 복사해 메모장에 잠시 붙여 둡니다.
   - ⚠️ 이 키는 비밀번호와 같습니다. 학생에게 보여 주거나 코드에 직접 쓰지 마세요.

### Claude를 쓰려면: Anthropic API 키

1. https://platform.claude.com (Claude Console)에 로그인합니다.
2. **Billing**에서 크레딧을 충전하고, **Limits**에서 월 사용 한도를 정해 둡니다.
3. **API Keys**에서 **Create Key**를 눌러 `sk-ant-`로 시작하는 키를 복사해 둡니다.
   - ⚠️ 이 키도 비밀번호와 같습니다.

> 💡 **부적절한 입력 검사**는 OpenAI 키가 있으면 OpenAI의 무료 검사 기능을 쓰고, Claude 키만 있으면 저렴한 Claude Haiku 5.5로 검사합니다. Claude로 수업하더라도 OpenAI 키를 함께 넣어 두면 검사 비용이 들지 않습니다.

## 2단계. Supabase 데이터베이스 만들기

1. https://supabase.com 에 가입하고 **New project**를 누릅니다.
   - Region은 **Northeast Asia (Seoul)** 를 고릅니다.
   - Database Password는 아무 값이나 만들어 두세요. VELO에서는 쓰지 않습니다.
2. 왼쪽 메뉴 **SQL Editor**를 열고, 이 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 내용을 **통째로 복사해 붙여넣은 뒤 Run**을 누릅니다.
   - `Success. No rows returned`가 나오면 성공입니다.
   - 이 SQL은 모든 테이블에 보안(RLS)을 켜 두어 브라우저에서는 데이터에 접근할 수 없게 합니다.
3. **Project Settings > API**(또는 API Keys) 화면에서 두 값을 복사해 둡니다.
   - **Project URL** → `SUPABASE_URL`
   - **service_role** 키 (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ `anon`/`publishable` 키가 아니라 **service_role(secret)** 키입니다. 이 키도 절대 공개하면 안 됩니다.

## 3단계. Vercel에 올리기

1. https://vercel.com 에 **GitHub 계정으로** 가입합니다.
2. **Add New… > Project**에서 이 저장소(`velo`)를 고르고 **Import**를 누릅니다.
3. **Environment Variables**에 아래 값을 입력합니다. (Name / Value) AI 키는 쓰는 것만 넣으면 됩니다.

   | Name | Value |
   |---|---|
   | `OPENAI_API_KEY` | (GPT를 쓸 때) 1단계의 `sk-...` |
   | `ANTHROPIC_API_KEY` | (Claude를 쓸 때) 1단계의 `sk-ant-...` |
   | `TEACHER_PASSWORD` | 교사 관리 화면 비밀번호 (직접 정하기) |
   | `SUPABASE_URL` | 2단계의 Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | 2단계의 service_role 키 |

   - ⚠️ 이름 앞에 `NEXT_PUBLIC_`을 붙이면 키가 학생 브라우저로 새어 나갑니다. 위 이름 그대로 쓰세요.
   - 참고: Vercel의 **Storage(Marketplace) > Supabase** 연동으로 데이터베이스를 만들면 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 자동으로 들어갑니다. 이 경우에도 2단계의 SQL은 직접 실행해야 합니다.
4. **Deploy**를 누릅니다. 1~2분 뒤 `https://프로젝트이름.vercel.app` 주소가 생깁니다.
5. 같은 프로젝트의 **Settings > Functions**에서 **Fluid Compute**가 켜져 있는지 확인합니다. 새 프로젝트는 보통 켜져 있습니다. 켜져 있어야 AI가 오래 걸려도 중간에 끊기지 않습니다.

## 4단계. 수업 준비

1. `https://내주소.vercel.app/teacher`에 접속해 `TEACHER_PASSWORD`로 로그인합니다.
2. **반 만들기**로 반을 만들면 6자리 학급 코드가 생깁니다.
3. **칠판에 코드 띄우기**를 눌러 학생들에게 보여 줍니다.
4. 학생은 `https://내주소.vercel.app`에 접속해 **학급 코드, 이름, PIN 4자리**를 입력합니다. 처음 입력한 PIN이 그 학생의 비밀번호가 됩니다.

### 수업 전 체크리스트
- [ ] 교사 화면 **AI 설정**에서 AI 사용이 **켜짐**인지 확인
- [ ] 직접 학생으로 로그인해 앱을 하나 만들어 보기 (교사 테스트용 반을 따로 만들면 편합니다)
- [ ] 방학 등으로 일주일 이상 쓰지 않았다면 Supabase 대시보드에 들어가 프로젝트가 **일시 정지(Paused)** 상태가 아닌지 확인 → 정지되어 있으면 **Restore** 클릭
- [ ] 교사 화면 **AI 설정**에서 쓸 AI(GPT/Claude)가 맞게 골라져 있는지, 키가 "✓ 설정됨"인지 확인
- [ ] 사용하는 AI 회사의 크레딧 잔액 확인

---

## 운영 팁

| 하고 싶은 일 | 방법 |
|---|---|
| 수업 끝나고 AI 사용 막기 | 교사 화면 › AI 설정 › **켜짐/꺼짐** 버튼 |
| 학생 한 명만 잠시 멈추기 | 반·학생 › **사용 중지** |
| PIN을 잊었어요 | 반·학생 › **PIN 초기화** → 학생이 다음에 입력하는 PIN이 새 PIN |
| 배포 전에 내용 확인하기 | 반 카드의 **배포 전에 교사 승인 받기** 체크 (기본값: 켜짐) |
| 하루 사용량 제한 | 반 카드의 **1인당 하루 AI 호출** 숫자 |
| 수업 주제에 맞게 AI 지시 추가 | AI 설정 › **AI에게 추가로 줄 지시** |
| GPT ↔ Claude 바꾸기 | AI 설정 › **사용할 AI** 선택 후 저장. 다음 생성부터 바로 적용 |
| 모델 바꾸기 | GPT: **GPT 모델**에 모델 ID 입력 (기본값 `gpt-6-luna`) / Claude: Opus 5.5·Sonnet 5.5·Haiku 5.5 중 선택 (기본값 `claude-opus-5-5`) |
| 토큰 절약 | GPT는 **추론 강도**, Claude는 **생각 깊이(effort)** 를 `low`(기본값)로. 높일수록 토큰이 크게 늘어요 |
| 두 AI 토큰 비교 | AI 설정·사용량 › **모델별 비교** 표 (1회 평균 입력·출력 토큰) |
| 학생 프롬프트 기록 보기(평가 자료) | 반·학생 › **프롬프트 기록** |

### 동시 접속(90명)에 대해
- 서버(Vercel)는 동시 접속을 자동으로 처리합니다.
- 실제 제한은 **AI 회사 계정 등급(Tier)의 분당 한도**입니다. OpenAI, Anthropic 모두 처음 결제한 계정은 한도가 낮아서, 90명이 한꺼번에 누르면 한도에 걸릴 수 있습니다.
  - 그래도 학생 화면에서 “친구들이 많이 쓰고 있어요. N초 후 다시 시도할게요”라고 안내하며 **자동으로 다시 시도**합니다.
  - 각 회사 대시보드의 **Limits**에서 현재 등급과 한도를 확인할 수 있습니다. 누적 결제액이 늘어나면 등급이 자동으로 올라갑니다.

## 문제가 생겼을 때

| 증상 | 확인할 곳 |
|---|---|
| 학생 화면에 “서버 오류가 났어요” | Vercel 프로젝트 › **Logs**에서 빨간 줄 확인. `SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다`라면 3단계 환경변수 확인 후 **Redeploy** |
| “AI 호출에 실패했어요” | 선택한 AI 회사의 크레딧 잔액, API 키, 교사 화면의 모델 이름 확인. GPT는 모델이 지원하지 않는 추론 강도를 고르지 않았는지 확인 |
| “선택된 AI의 API 키가 설정되지 않았어요” | 교사 화면에서 고른 AI의 키가 Vercel 환경변수에 없음 → 키를 추가하고 Redeploy, 또는 다른 AI 선택 |
| “AI가 이 요청은 도와줄 수 없다고 했어요” | Claude의 안전 분류기가 거절한 경우. 학생에게 표현을 바꿔 보게 하세요 |
| `relation "classes" does not exist` | 2단계 SQL을 실행하지 않음 → SQL Editor에서 `schema.sql` 실행 |
| 아무 화면도 안 열림 | Supabase 프로젝트가 일시 정지 상태인지 확인 |
| 환경변수를 바꿨는데 그대로임 | 환경변수는 **다시 배포(Redeploy)** 해야 적용됩니다 |

> 오류 메시지를 그대로 복사해 Claude 같은 AI 코딩 도우미에게 붙여넣고 물어보면, 대부분 바로 원인을 알려 줍니다.
