# خطة نشر المشروع على Cloudflare

## الهدف
إعداد مشروع TanStack Start الحالي للنشر المباشر على Cloudflare Workers باستخدام Wrangler، مع الحفاظ على قاعدة البيانات (Lovable Cloud / Supabase) والمصادقة.

## ما هو وضع المشروع حالياً
- القالب يستخدم `@lovable.dev/vite-tanstack-config` الذي يبني الهدف الافتراضي `cloudflare` عبر nitro.
- ملف `src/server.ts` يصدّر `fetch` بتوقيع Cloudflare Worker بالفعل.
- لا يوجد ملف `wrangler.toml` ولا سكربتات نشر مخصصة.

## الخطوات المقترحة

### 1. إضافة إعدادات Wrangler
- إنشاء `wrangler.toml` يحدد:
  - `name`: اسم الـ Worker (مثلاً `gym-attendance-system`).
  - `compatibility_date`: تاريخ متوافق حديث.
  - `main`: مسار ملف الخرج الذي ينتجه nitro (`.output/server/index.mjs`).
  - `routes`: مسارات التطبيق (افتراضية للـ Worker).
- إنشاء `wrangler.toml.example` بدون قيم حساسة.

### 2. إضافة سكربتات النشر
- `build:worker`: بناء المشروع للـ Worker.
- `deploy:worker`: نشر الـ Worker عبر Wrangler.
- `preview:worker`: معاينة محلية عبر `wrangler dev`.

### 3. إضافة أدوات Wrangler
- تثبيت `wrangler` كـ devDependency.

### 4. إعداد المتغيرات والأسرار
- نقل أسرار Supabase إلى Cloudflare:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- إنشاء `.dev.vars.example` يوضّح المتغيرات المحلية.
- تحديث `.gitignore` لاستبعاد `.dev.vars`.

### 5. التحقق من توافق Cloudflare
- مراجعة دوال الخادم (`createServerFn`) للتأكد من عدم وجود مكتبات Node.js فقط (مثل `fs` خارج `/tmp`، `child_process`).
- التأكد من أن `@supabase/supabase-js` تستخدم fetch القياسي.

### 6. توثيق خطوات النشر
- إنشاء قسم "النشر على Cloudflare" في README يوضح:
  - تثبيت Wrangler وتسجيل الدخول.
  - إعداد `wrangler.toml`.
  - نقل الأسرار.
  - تشغيل `bun run deploy:worker`.

## متطلبات من المستخدم
- اسم الـ Worker المطلوب على Cloudflare.
- account ID لحساب Cloudflare (إن وجد) — أو استخدام الإعداد الافتراضي من `wrangler` بعد تسجيل الدخول.
- تأكيد أن قاعدة البيانات ستبقى على Lovable Cloud (Supabase) أو الانتقال إلى قاعدة أخرى.

## الناتج المتوقع
- إمكانية تشغيل `bun run deploy:worker` لرفع التطبيق على Cloudflare Workers.
- بيئة محلية قابلة للمعاينة عبر `wrangler dev`.
- تعليمات واضحة لإعداد الأسرار.