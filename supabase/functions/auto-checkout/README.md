# auto-checkout Edge Function

HTTP endpoint สำหรับปิดสถานะการลงเวลาที่ค้างเป็น `working` จากวันก่อน
ให้กลายเป็น `auto-out` พร้อม `check_out_time = 23:59:59 ของ work_date`

## ใช้งานเมื่อไหร่

- Project อยู่บน **Supabase Free tier** ที่ไม่มี pg_cron, หรือ
- อยากเรียก manually จาก backend / GitHub Action / external scheduler

ถ้ามี pg_cron แล้ว (รัน `sql/auto_checkout.sql`) — function นี้ก็ยังใช้เป็น fallback ได้

## Deploy

```bash
# 1. Login & link project
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# 2. Set secrets (token ป้องกันคนเรียก)
supabase secrets set AUTO_CHECKOUT_TOKEN=$(openssl rand -hex 32)

# 3. Deploy
supabase functions deploy auto-checkout --no-verify-jwt
```

## เรียก endpoint

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/auto-checkout \
  -H "x-auth-token: $AUTO_CHECKOUT_TOKEN"
```

Response:
```json
{ "ok": true, "mode": "rpc", "closed_count": 3 }
```

## ตั้ง schedule

ตัวอย่างกับ **cron-job.org**:

| Field | Value |
|---|---|
| URL | `https://<PROJECT_REF>.supabase.co/functions/v1/auto-checkout` |
| Method | `POST` |
| Header | `x-auth-token: <AUTO_CHECKOUT_TOKEN>` |
| Schedule | `1 17 * * *` (= 00:01 เวลาไทย) |

หรือกับ **GitHub Actions** (`.github/workflows/auto-checkout.yml`):

```yaml
name: auto-checkout
on:
  schedule:
    - cron: '1 17 * * *'   # 00:01 Asia/Bangkok
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsSL -X POST \
            -H "x-auth-token: ${{ secrets.AUTO_CHECKOUT_TOKEN }}" \
            "https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/auto-checkout"
```
