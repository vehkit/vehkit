# Edge Functions

Deno-based functions that run on Supabase's edge runtime.

Reserved for v1:

- `ocr-receipt` — receives an uploaded image, calls Mindee/Google Vision, writes back to `service_files.ocr_extracted`
- `whatsapp-inbound` — receives forwarded invoice messages from 360dialog, runs OCR pipeline
- `reminder-dispatcher` — runs on a schedule, finds reminders due in the next 24h / due-by-km, sends WhatsApp/SMS/push
- `wallet-pass-issue` — generates Apple/Google Wallet passes signed server-side

To create one:

```bash
supabase functions new ocr-receipt
supabase functions deploy ocr-receipt
```
