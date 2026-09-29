# Part 4 실행 방법

## 1. CSV
`csv-loader.js`는 팀 저장소의 `data/sales_2026_06.csv` ~ `sales_2026_09.csv`를 읽어 rows 배열을 만듭니다.

```js
import { loadPart3CSV } from "./csv-loader.js";
import { buildResult } from "./result-engine.js";

const rows = await loadPart3CSV("../data");
const result = buildResult(rows);
```

## 2. OpenAI 서버
Supabase Edge Function 소스:
`part4/supabase/functions/analyze-shop/index.ts`

Supabase Secret에 다음 이름으로 키를 등록합니다.

```
OPENAI_API_KEY
```

API 키 값은 GitHub에 커밋하지 않습니다.

Edge Function은 계산 완료된 `result`를 POST로 받아 OpenAI Responses API에 전달하고 `{ "analysis": "..." }`를 반환합니다.

## 3. 5번에 전달
대시보드는 `buildResult(rows)` 결과의 다음 필드를 사용합니다.

- `monthly_kpis`
- `channel_kpis`
- `changes`
- `diagnostics`

AI 응답은 `analysis` 필드로 표시합니다.

## 검증
3번 실제 CSV 총 1,200행을 `answer_key.json`과 비교:
**190 PASS / 0 FAIL**
