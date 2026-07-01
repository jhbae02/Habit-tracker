# 습관 트래커 (Habit Tracker)

매일의 습관을 기록하고 달력으로 확인할 수 있는 습관 트래커입니다. `supabase` 브랜치는 Supabase(Postgres + Auth)를 백엔드로 사용해, 로그인한 사용자별로 데이터를 클라우드에 저장합니다. (`main` 브랜치는 여전히 브라우저 `localStorage`만 사용하는 프론트엔드 전용 버전입니다.)

## 스크린샷

|라이트 모드|다크 모드|
|---|---|
|![라이트 모드](screenshots/light-mode.png)|![다크 모드](screenshots/dark-mode.png)|

## 주요 기능

- **습관 관리**: 습관 추가/삭제(실수 방지를 위한 삭제 확인), 이름·색상 수정
- **체크 & 달력**: 월별 캘린더에서 오늘은 물론 지난 날짜도 클릭해서 완료 체크 가능 (미래 날짜는 비활성화)
- **연속일수 & 총일수**: "연속 N일"과 "총 M일"을 함께 표시해 스트릭이 끊겨도 누적 기록이 보이도록 함
- **마일스톤 뱃지**: 역대 최장 연속기록이 7 / 21 / 66 / 100일을 넘으면 뱃지 획득
- **통계 대시보드**: 습관별 누적 완료일수를 막대그래프로 비교, 막대에 마우스를 올리면 연속·총일수 툴팁 표시, 클릭하면 해당 습관 달력으로 스크롤 이동
- **카드 접기/펼치기**: 습관이 많아져도 필요한 것만 펼쳐서 스크롤 부담을 줄임
- **순서 변경**: 위/아래 버튼으로 습관 카드 순서를 원하는 대로 정렬 (통계 랭킹과는 별개로 동작)
- **다크 모드**: 시스템 설정을 기본값으로 사용하고, 토글로 직접 전환 가능 (선택값은 저장됨)
- **데이터 내보내기/가져오기**: JSON 파일로 백업하고 다시 불러올 수 있음
- **PWA 지원**: HTTPS로 배포된 주소에서 "홈 화면에 추가"로 설치해 오프라인에서도 앱처럼 사용 가능

## 사용 방법 (supabase 브랜치)

별도 빌드 과정은 없지만, 사용 전에 Supabase 프로젝트 연동 설정이 필요합니다.

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. Supabase 대시보드 → SQL Editor에서 [supabase/schema.sql](supabase/schema.sql) 내용을 실행해 `habits` 테이블과 RLS 정책을 생성합니다.
3. Authentication → Providers에서 Email(매직 링크) 로그인이 켜져 있는지 확인합니다. Authentication → URL Configuration의 Redirect URLs에 앱을 열 주소(예: `http://localhost:5500`, 배포 도메인 등)를 추가합니다.
4. 프로젝트 루트의 [config.example.js](config.example.js)를 `config.js`로 복사하고, Settings → API에서 확인한 `Project URL`과 `anon public` 키를 채워 넣습니다. `config.js`는 `.gitignore`에 포함되어 커밋되지 않습니다.
5. `index.html`을 정적 서버(또는 브라우저)로 엽니다. 이메일을 입력해 매직 링크를 받고, 메일의 링크를 클릭하면 로그인되어 습관 데이터가 Supabase에 저장됩니다.

> anon key는 공개되어도 되는 값이며, 실제 데이터 접근 제어는 Supabase의 Row Level Security(RLS) 정책이 담당합니다 (본인 소유의 행만 조회/수정 가능).

## 기술 스택

- HTML / CSS / JavaScript (바닐라, 프레임워크·라이브러리 없음)
- 인증 및 데이터 저장: [Supabase](https://supabase.com) (Postgres + Auth, `@supabase/supabase-js` CDN 사용)
- UI 환경설정(테마, 통계 패널 열림 상태)만 브라우저 `localStorage`에 저장

## 향후 계획

Vercel 등에 배포해 실제 서비스 형태로 운영하는 것을 검토 중입니다. PWA 오프라인 캐시는 정적 자산(HTML/CSS/JS)만 대상이며, 습관 데이터 조회/수정에는 네트워크 연결이 필요합니다.
