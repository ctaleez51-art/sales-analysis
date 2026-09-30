# Part 4 실행 방법

## 1. CSV
`csv-loader.js`는 팀 저장소의 `data/sales_2026_06.csv` ~ `sales_2026_09.csv`를 읽어 rows 배열을 만듭니다.

```js
import { loadPart3CSV } from "./csv-loader.js";
import { buildResult } from "./result-engine.js";

const rows = await loadPart3CSV("../data");
const result = buildResult(rows);
```

## 2. 팀 Supabase로 통일
최종 앱은 로그인/결제와 동일한 Supabase 프로젝트를 사용합니다.

`https://joxyzphsqjwuyobkboqe.supabase.co`

테스트용 `hpuwvtekmzujixvzgdeo` 주소는 최종 통합에서 사용하지 않습니다.

## 3. OpenAI 서버
Supabase Edge Function 소스:
`part4/supabase/functions/analyze-shop/index.ts`

Supabase Secret에 다음 이름으로 키를 등록합니다.

```
OPENAI_API_KEY
```

API 키 값은 GitHub에 커밋하지 않습니다.

Edge Function은 계산 완료된 `result`를 POST로 받아 OpenAI Responses API에 전달하고 `{ "analysis": "..." }`를 반환합니다.

## 4. OpenAI 키 교체 방법
OpenAI 크레딧 부족, 키 만료, 키 노출 등이 발생해도 GitHub 코드를 수정하지 않습니다.

팀 Supabase 프로젝트에서 아래 Secret 값만 교체합니다.

```
Project: joxyzphsqjwuyobkboqe
Edge Function: analyze-shop
Secret name: OPENAI_API_KEY
```

절대 커밋하지 말아야 할 것:

```
sk-proj-... 실제 API Key 문자열
```

교체 절차:
1. Supabase Dashboard에서 `joxyzphsqjwuyobkboqe` 프로젝트로 이동
2. Edge Functions → Secrets 메뉴로 이동
3. `OPENAI_API_KEY` 값을 새 키로 교체
4. `analyze-shop` 호출 테스트
5. 문제가 있으면 Edge Function을 재배포

## 5. 5번에 전달
대시보드는 `buildResult(rows)` 결과의 다음 필드를 사용합니다.

- `monthly_kpis`
- `channel_kpis`
- `changes`
- `diagnostics`

AI 응답은 `analysis` 필드로 표시합니다.

## 검증
3번 실제 CSV 총 1,200행을 `answer_key.json`과 비교:
**190 PASS / 0 FAIL**

## 6. 2번 로그인 연동 (필수)

팀 Edge Function은 `verify_jwt=true` 입니다. 따라서 브라우저 호출 시 로그인 사용자의 Supabase access token을 보내야 합니다.

4번 클라이언트는 다음 둘 중 하나를 지원합니다.

1. 2번이 전역 `window.supabaseClient`를 제공
2. 2번이 `window.getAccessToken()` 함수를 제공

권장 계약:

```js
window.getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};
```

4번은 해당 토큰을 다음 헤더로 전송합니다.

```
Authorization: Bearer <access_token>
```

토큰이나 API Key를 GitHub에 하드코딩하지 않습니다.
