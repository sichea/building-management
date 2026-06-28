# 건물관리 앱 - Cloudflare + Supabase 배포 가이드라인

본 가이드는 로컬(내 컴퓨터)에서 작동하던 건물관리 앱을 **GitHub**, **Cloudflare Pages**, **Supabase**를 활용하여 모바일에서 실시간 동기화하여 사용할 수 있게 만드는 전체 과정을 단계별로 상세히 기술합니다.

---

## [1 단계] Supabase 데이터베이스 및 스토리지 설정

Supabase는 방 정보 데이터 저장(PostgreSQL) 및 사진 파일 저장소(Storage) 역할을 무료로 담당합니다.

1. **Supabase 프로젝트 생성**
   * [Supabase 홈페이지](https://supabase.com)에 로그인(또는 GitHub 계정으로 가입)합니다.
   * **[New Project]** 버튼을 클릭하여 새 프로젝트를 생성합니다.
     * Name: `building-management` (자유롭게 입력)
     * Database Password: 안전한 비밀번호 입력 (따로 메모 필수)
     * Region: `Seoul (ap-northeast-2)` (한국 지역 우선 선택)
     * 요금제: **Free Tier** 선택
   * 프로젝트 생성 완료까지 약 1~2분 정도 대기합니다.

2. **데이터 테이블 생성 및 초기 마이그레이션**
   * 프로젝트 대시보드 왼쪽 메뉴에서 **[SQL Editor]**를 클릭합니다.
   * **[New query]**를 누르고, 프로젝트 폴더 내에 생성된 [schema.sql](file:///c:/Users/kks37/OneDrive/바탕%20화면/코딩/건물관리/schema.sql) 파일의 전체 내용을 복사하여 붙여넣습니다.
   * 우측 하단의 **[Run]** 버튼을 누릅니다. `Success` 메시지가 나오면 기존 로컬 데이터 마이그레이션이 끝납니다.

3. **이미지 파일 업로드용 Storage 버킷 생성**
   * 왼쪽 메뉴에서 **[Storage]**를 클릭합니다.
   * **[New Bucket]** 버튼을 누릅니다.
     * Name: **`uploads`** (반드시 소문자 `uploads`로 정확히 적어야 합니다)
     * **[Public bucket]** 옵션을 토글하여 활성화합니다. (누구나 링크를 통해 업로드된 방 사진을 볼 수 있게 하는 설정)
     * **[Save]** 버튼을 누릅니다.

4. **API 접속 정보 복사하기**
   * 왼쪽 맨 아래 톱니바퀴 아이콘인 **[Project Settings]** -> **[API]** 메뉴로 이동합니다.
   * 다음 두 가지 정보를 따로 메모장 등에 복사해 둡니다. (Cloudflare 설정 시 필요)
     1. **`Project URL`** (예: `https://xxxxxx.supabase.co`)
     2. **`API Keys`**의 **`anon (public)`** 키값 (매우 긴 문자열)

---

## [2 단계] GitHub에 소스코드 올리기

Cloudflare Pages에 코드를 전달하고 자동 빌드 환경을 구축하기 위해 깃허브에 코드를 올려야 합니다.

1. **GitHub 리포지토리 생성**
   * [GitHub 홈페이지](https://github.com)에 로그인 후, 우측 상단의 **[+] -> New repository**를 누릅니다.
   * Repository name: `building-management`
   * Public 또는 Private 중 원하는 모드로 선택 (Private 권장 - 내 건물 정보 보호용)
   * **[Create repository]**를 누릅니다.

2. **로컬 터미널에서 코드 푸시하기**
   * 윈도우 터미널(또는 CMD/PowerShell)을 열고 현재 프로젝트 루트 경로(`건물관리` 폴더)로 이동합니다.
   * 아래 명령어를 순서대로 실행합니다:
     ```bash
     # 1. git 초기화 및 브랜치명 변경
     git init
     git branch -M main

     # 2. 업로드 제외 규칙 .gitignore 파일 생성 (없을 경우)
     # OneDrive 관련 빌드 임시 폴더 및 node_modules 제외
     echo "node_modules/" >> .gitignore
     echo ".env" >> .gitignore
     echo "*.log" >> .gitignore

     # 3. 로컬 파일들 스테이징 및 커밋
     git add .
     git commit -m "Initialize building management app with serverless config"

     # 4. GitHub 원격지 연결 (깃허브 생성화면의 주소 대입)
     git remote add origin https://github.com/사용자아이디/building-management.git

     # 5. 최종 코드 푸시
     git push -u origin main
     ```

---

## [3 단계] Cloudflare Pages 배포 및 환경 설정

GitHub에 업로드된 코드를 바탕으로 평생 무료 폰 접속 사이트를 빌드하고 Supabase API 키를 주입합니다.

1. **Pages 애플리케이션 생성**
   * [Cloudflare 대시보드](https://dash.cloudflare.com)에 로그인합니다.
   * 왼쪽 메뉴에서 **[Workers & Pages]** -> **[Create]**를 선택합니다.
   * **[Pages]** 탭을 선택하고 **[Connect to Git]** 버튼을 누릅니다.
   * 방금 생성한 GitHub의 `building-management` 리포지토리를 선택하고 **[Begin setup]**을 누릅니다.

2. **빌드 설정 구성**
   * Project name: 원하는 서브도메인 이름 기입 (예: `my-building-app`)
   * Production branch: `main`
   * **Build settings**:
     * Framework preset: **`None`** 선택
     * Build command: (아무것도 적지 않고 비워둡니다)
     * Build output directory: **`public`** 입력 (매우 중요)
   * 최하단의 **[Save and Deploy]** 버튼을 누릅니다. (첫 배포는 API Key가 설정되지 않아 데이터 로드에 에러가 나는 것이 정상이므로 안심하세요)

3. **Supabase API Key 환경 변수 설정 (핵심)**
   * 첫 배포 성공 페이지 하단의 **[Continue to project]**를 누르거나, 프로젝트 설정 메뉴의 **[Settings] -> [Variables and Secrets]**로 이동합니다.
   * **[Environment variables]** 영역의 **[Add variables]** 버튼을 누릅니다.
   * 다음 두 가지 키-밸류 쌍을 각각 추가합니다.
     * **`SUPABASE_URL`** = `[1단계에서 복사한 Supabase Project URL 주소]`
     * **`SUPABASE_KEY`** = `[1단계에서 복사한 anon public 키]`
   * **[Save]** 버튼을 눌러 저장합니다.

4. **재배치 및 확인**
   * 상단의 **[Deployments]** 탭으로 이동합니다.
   * 가장 최근 배포(가장 위의 내역) 우측의 점 세 개 버튼을 눌러 **[Retry deployment]**를 클릭합니다.
   * 완료 후 표시되는 `https://my-building-app.pages.dev` 등의 고유 주소로 스마트폰이나 다른 컴퓨터에서 접속하시면 됩니다!

---

## [4 단계] 로컬 컴퓨터에서 서버리스 API 시뮬레이션 개발하기

로컬 PC에서 Supabase DB에 실시간으로 붙여서 개발/테스트하고 싶다면:

1. **로컬 환경 변수 파일 생성**
   * 프로젝트 루트 경로에 `.dev.vars` 파일을 새로 생성하고 아래 양식으로 API 키들을 넣어 저장합니다:
     ```env
     SUPABASE_URL="내 Supabase URL"
     SUPABASE_KEY="내 Supabase Anon Key"
     ```
2. **에뮬레이터 실행**
   * 터미널에서 다음 명령어를 실행하여 로컬 Pages Functions 에뮬레이션을 실행합니다:
     ```bash
     npm run dev:pages
     ```
   * 브라우저에서 `http://localhost:3000`으로 접속하면, PC 내부의 정적 리소스(HTML/JS)와 Supabase 클라우드 데이터베이스가 연동되어 안전하게 작동합니다.
