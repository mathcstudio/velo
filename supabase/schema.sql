-- VELO 데이터베이스 구조
-- Supabase 대시보드 > SQL Editor 에 이 파일 내용을 통째로 붙여넣고 [Run]을 누르세요.
-- 여러 번 실행해도 안전합니다.
--
-- 보안 방식: 모든 테이블에 RLS(행 수준 보안)를 켜고 정책을 하나도 만들지 않습니다.
-- → 브라우저(공개 키)로는 어떤 데이터도 읽거나 쓸 수 없고,
--   Vercel 서버만 service_role 키로 접근합니다.

create extension if not exists pgcrypto;

-- 반(학급)
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- 학생이 입력하는 학급 코드
  name text not null,
  require_approval boolean not null default true,  -- 배포 전 교사 승인 필요 여부
  daily_limit int not null default 30,       -- 학생 1인당 하루 AI 호출 수
  created_at timestamptz not null default now()
);

-- 학생
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  pin_hash text,                              -- null 이면 다음 로그인 때 새 PIN 설정
  failed_attempts int not null default 0,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

-- 프로젝트(학생이 만드는 앱 하나)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  title text not null default '새 앱',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_student_idx on projects(student_id);

-- 버전(프롬프트 한 번 = 버전 하나)
create table if not exists versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  number int not null,
  kind text not null,                         -- create | edit | debug | free | restore
  prompt jsonb not null default '{}'::jsonb,  -- 카드별 입력값
  prompt_text text not null default '',       -- AI에 보낸 프롬프트(사람이 읽는 형태)
  html text not null,
  summary text not null default '',           -- AI가 쓴 변경 요약
  created_at timestamptz not null default now(),
  unique (project_id, number)
);

-- 배포
create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  slug text not null unique,                  -- /p/<slug>
  name text not null,
  emoji text not null default '✨',
  description text not null default '',
  version_id uuid references versions(id) on delete set null,          -- 지금 공개 중인 버전
  pending_version_id uuid references versions(id) on delete set null,  -- 승인 대기 중인 버전
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists likes (
  deployment_id uuid not null references deployments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deployment_id, student_id)
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

-- AI 호출 기록(호출 한도·비용 확인용)
create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  status text not null default 'running',     -- running | ok | error | blocked
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  error text,
  created_at timestamptz not null default now()
);
-- (GPT/Claude 선택 기능 추가 이후) 어떤 AI·모델을 썼는지 기록. 이미 만든 DB에도 안전하게 추가됨
alter table usage_logs add column if not exists provider text;
alter table usage_logs add column if not exists model text;
create index if not exists usage_logs_student_time_idx on usage_logs(student_id, created_at desc);

-- 전체 설정(키-값)
create table if not exists settings (
  key text primary key,
  value jsonb not null
);

alter table classes     enable row level security;
alter table students    enable row level security;
alter table projects    enable row level security;
alter table versions    enable row level security;
alter table deployments enable row level security;
alter table likes       enable row level security;
alter table feedback    enable row level security;
alter table usage_logs  enable row level security;
alter table settings    enable row level security;
