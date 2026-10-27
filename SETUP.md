# دليل تشغيل NF Store

## الخطوة 1: إعداد Supabase

1. ادخل مشروعك على [supabase.com](https://supabase.com)
2. من القائمة الجانبية: **SQL Editor** → **New query**
3. افتح ملف `sql/schema.sql` وانسخ كل محتواه، الصقه، واضغط **Run**
   - هذا ينشئ كل الجداول (categories, products, orders, order_items, store_settings, admins)
4. اذهب إلى **Storage** → **New bucket**
   - اسم الـ bucket: `payment-proofs`
   - فعّل **Public bucket** (عشان روابط الإيصالات تشتغل من لوحة التحكم)

## الخطوة 2: ربط الكود بـ Supabase

1. من **Project Settings → API** انسخ:
   - **Project URL**
   - **anon public key**
2. افتح `js/supabase-client.js` وحط القيم مكان:
   ```js
   const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
   ```

## الخطوة 3: إنشاء حساب الأدمن (حسابك إنت)

1. من Supabase: **Authentication → Users → Add user**
   - حط بريدك الإلكتروني وكلمة مرور قوية
2. انسخ الـ **User UID** من قائمة المستخدمين
3. ارجع لـ **SQL Editor** ونفّذ:
   ```sql
   insert into admins (user_id) values ('الصق-الـ-UID-هنا');
   ```
4. الآن تقدر تدخل `admin/login.html` بنفس البريد وكلمة المرور

> تقدر تضيف أدمن ثاني (مثلاً لموظف) بنفس الطريقة — إنشاء مستخدم ثم إضافة UID في جدول admins.

## الخطوة 4: تعبئة الإعدادات الأساسية

ادخل لوحة التحكم → تبويب **الإعدادات** واملأ:
- بيانات التحويل البنكي (اسم البنك، اسم الحساب، الآيبان)
- رابط الدفع الإلكتروني (رابط Thawani أو PayPal.me أو أي رابط دفع تستخدمه)
- رقم الواتساب وحساب الانستغرام

ثم أضف **فئة واحدة على الأقل** من تبويب **الفئات**، وبعدها أضف منتجاتك من تبويب **المنتجات**.

## الخطوة 5: رفع المشروع على GitHub

```bash
cd nf-store
git init
git add .
git commit -m "النسخة الأولى من NF Store"
```

سوّي مستودع جديد على GitHub (من الموقع، بدون أي ملفات)، ثم:

```bash
git remote add origin https://github.com/USERNAME/nf-store.git
git branch -M main
git push -u origin main
```

## الخطوة 6: النشر على Vercel

1. ادخل [vercel.com](https://vercel.com) وسجل دخول بحساب GitHub
2. **Add New → Project** → اختر مستودع `nf-store`
3. Framework Preset: اختر **Other** (المشروع HTML ساكن، ما يحتاج بناء)
4. اضغط **Deploy**

بعد النشر بيعطيك رابط مثل `nf-store.vercel.app` — هذا رابط متجرك.
لوحة التحكم بتكون على `nf-store.vercel.app/admin/login.html`

> كل مرة تسوي `git push` على الفرع main، Vercel ينشر النسخة الجديدة تلقائياً.

## ملاحظة أمان مهمة

مفتاح `anon public key` آمن إنه يكون ظاهر بالكود (مصمم لذلك)، لكن الحماية الحقيقية موجودة في قواعد **Row Level Security** اللي بملف `schema.sql` — هي اللي تمنع أي شخص غير مسجل كأدمن من رؤية أو تعديل الطلبات والمنتجات. لا تعدّل أو تعطّل هالقواعد إلا إذا فاهم وش بتسويه بالضبط.

## الخطوة التالية (دفع إلكتروني حقيقي لاحقاً)

حالياً الدفع الإلكتروني رابط خارجي يراجعه الأدمن يدوياً. إذا توفر سجل تجاري مستقبلاً وتبي تدمج بوابة دفع فعلية (Thawani API، Moyasar...) تقدر تضيفها كخطوة تالية بدون ما تغيّر بنية قاعدة البيانات — بس تحتاج سيرفر صغير (Vercel Function) يستقبل تأكيد الدفع من البوابة.
