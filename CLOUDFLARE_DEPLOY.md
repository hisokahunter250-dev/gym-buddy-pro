# النشر على Cloudflare Workers

المشروع مُهيأ ليُبنى مباشرة كـ Cloudflare Worker (عبر nitro + إعداد TanStack Start).

## 1) متطلبات أولية

- حساب على [Cloudflare](https://dash.cloudflare.com).
- تثبيت Wrangler محلياً (مضاف بالفعل كـ devDependency).
- تسجيل الدخول مرة واحدة:

```bash
bunx wrangler login
```

## 2) إعداد الأسرار

المتغيرات غير الحساسة موجودة في `wrangler.toml` تحت `[vars]`.

السرّ الحساس (مفتاح Service Role) يجب رفعه عبر Wrangler — لا تضعه في الملف:

```bash
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# الصق القيمة عند الطلب
```

للتطوير المحلي عبر `wrangler dev`، انسخ `.dev.vars.example` إلى `.dev.vars` واملأ القيم.

## 3) البناء والنشر

```bash
# بناء التطبيق (ينتج في .output/)
bun run build

# نشر على Cloudflare
bunx wrangler deploy
```

## 4) المعاينة المحلية (اختياري)

```bash
bun run build
bunx wrangler dev
```

## 5) ربط نطاق مخصص (اختياري)

من لوحة Cloudflare → Workers & Pages → اختر الـ Worker → **Settings → Domains & Routes → Add Custom Domain**.

## ملاحظات

- بيئة التشغيل هي Cloudflare Workers مع `nodejs_compat` مفعّل.
- جميع دوال الخادم (`createServerFn`) متوافقة مع Workers — لا تستخدم `child_process` أو مكتبات native.
- قاعدة البيانات (Supabase) تعمل عبر HTTPS وتدعم Workers بدون تعديل.
