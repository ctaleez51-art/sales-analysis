# Part 4 AI Server

## Production flow
3번 CSV/rows → `part4/result-engine.js` → calculated KPI/diagnostics → AI server → 5번 dashboard JSON.

## Current implementation
The working demo uses a Supabase Edge Function named `analyze-shop`.

The server:
1. receives the deterministic `buildResult(rows)` output,
2. reads `OPENAI_API_KEY` from a server-side Secret,
3. calls OpenAI Responses API,
4. returns the analysis to the client.

## Security
Do not commit `OPENAI_API_KEY`.
Do not call OpenAI directly from browser JavaScript with a secret key.

## AI analysis contract
The model receives already-calculated:
- monthly_kpis
- channel_kpis
- changes
- diagnostics

It must separate:
- confirmed facts
- hypotheses
- next actions
- limitations

The diagnostics include current-month Coupang products where `competitor_min_price < unit_price`. This is evidence of price disadvantage, not proof of causality.

## Validation
Part 3 CSV files: 1,200 rows.
Compared against Part 3 `data/answer_key.json`: **190/190 PASS, 0 FAIL**.
