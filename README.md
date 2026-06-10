# Lokalmart Odoo AI Bridge

App Vercel khusus untuk membantu **Asisten Lokalmart** membaca kondisi Odoo secara aman.

Prinsip utama versi ini:

- **Read-first**: hanya membaca, tidak create/write/unlink.
- **Token-protected**: semua akses Odoo butuh `X-LM-ADMIN-TOKEN`.
- **Satu serverless function**: hanya `api/bridge.js`, supaya tidak kena masalah batas jumlah function Vercel.
- **Context Export**: menghasilkan JSON yang bisa kamu upload ke ChatGPT agar AI bisa membaca kondisi Odoo Lokalmart.
- **Audit awal**: cek barcode duplikat, data kosong, produk tanpa harga, task tanpa PIC/deadline, dan risiko custom Many2one.

## 1. Struktur file

```txt
lokalmart-odoo-ai-bridge/
├─ api/
│  └─ bridge.js
├─ public/
│  └─ openapi.json
├─ index.html
├─ package.json
├─ vercel.json
├─ .env.example
└─ README.md
```

## 2. Environment Variables di Vercel

Tambahkan di Vercel Project → Settings → Environment Variables:

```env
ODOO_URL=https://edu-lokalmart.odoo.com
ODOO_DB=edu-lokalmart
ODOO_USERNAME=admin@example.com
ODOO_API_KEY=xxxxxxxxxxxxxxxxxxxx
LM_ADMIN_TOKEN=ganti-token-panjang-random
LM_DEFAULT_LIMIT=300
LM_MAX_LIMIT=1500
```

Gunakan **API key Odoo**, bukan password utama akun.

## 3. Deploy

### Cara cepat via GitHub

1. Buat repo baru, misalnya `lokalmart-odoo-ai-bridge`.
2. Upload semua file ini.
3. Import repo ke Vercel.
4. Isi Environment Variables.
5. Deploy.
6. Buka URL Vercel-nya.

### Cara lokal

```bash
npm install
npx vercel dev
```

Lalu buka:

```txt
http://localhost:3000
```

## 4. Cara pakai

1. Buka halaman app.
2. Masukkan `LM_ADMIN_TOKEN`.
3. Klik **Ping Odoo**.
4. Klik **Context Export**.
5. Download JSON.
6. Upload JSON itu ke ChatGPT / Asisten Lokalmart.
7. Minta analisis, pembersihan data, atau file XLSX patch.

Prompt yang disarankan:

```txt
Baca file JSON dari Lokalmart Odoo AI Bridge ini sebagai kondisi database Odoo Lokalmart saat ini.

Tolong lakukan:
1. Ringkas kondisi struktur dan data.
2. Temukan masalah prioritas: field custom, kategori produk teknis vs ecommerce, produk, partner, project/task, website/page.
3. Jangan sarankan perubahan langsung yang berisiko.
4. Buat rencana patch XLSX yang aman, migration-safe, dan dipisah per area: fields/ACL, produk, project/task, website/QWeb, role/Lokal ID.
5. Perhatikan aturan importer Lokalmart: __action, _external_id, _model, custom x_, m2o _external_id, m2m _external_ids, Many2one custom required=False saat awal, dan QWeb XML-safe.
```

## 5. API actions

Semua action lewat satu endpoint:

```txt
POST /api/bridge
Header: X-LM-ADMIN-TOKEN: <token>
Content-Type: application/json
```

### Ping

```json
{ "action": "ping" }
```

### Context Export

```json
{
  "action": "context_export",
  "limit": 300
}
```

### Audit

```json
{
  "action": "audit",
  "limit": 300
}
```

### Schema Scan

```json
{
  "action": "schema_scan",
  "include_custom": true
}
```

### Read-only RPC

```json
{
  "action": "rpc",
  "model": "product.template",
  "method": "search_read",
  "args": [[ ["active", "=", true] ]],
  "kwargs": {
    "fields": ["id", "name", "default_code", "barcode", "list_price", "categ_id"],
    "limit": 10
  }
}
```

Method yang diizinkan hanya:

```txt
fields_get, search_read, search_count, read, search, name_search, name_get
```

Method berikut sengaja diblokir:

```txt
create, write, unlink, import_data, load, execute, action_*
```

## 6. Kenapa belum langsung write ke Odoo?

Karena tujuan app ini adalah membantu AI membaca dan menganalisis dulu. Untuk Lokalmart, alur paling aman adalah:

```txt
Read → Analyze → Recommend → Generate XLSX Patch → Validate → User Import
```

Versi berikutnya boleh menambahkan mode write, tetapi sebaiknya tetap dengan:

- allowlist model
- preview perubahan
- dry-run
- approval manual
- log audit
- rollback plan

## 7. Catatan keamanan

- Jangan simpan credential Odoo di frontend.
- Jangan share `LM_ADMIN_TOKEN` di URL publik.
- Gunakan user Odoo khusus integrasi dengan hak akses terbatas.
- Jangan aktifkan write endpoint sebelum audit dan approval flow siap.
- Bila ingin dipakai sebagai Custom GPT Action, ubah `public/openapi.json` server URL ke domain Vercel kamu.


## Jika muncul 404 NOT_FOUND di Vercel

Buka `DEPLOY_FIX_404.md`. Ringkasnya: pastikan file `index.html`, `vercel.json`, `package.json`, dan folder `api/` berada di root project yang dideploy. Jika file berada di subfolder `lokalmart-odoo-ai-bridge/`, atur **Root Directory** Vercel ke folder tersebut lalu redeploy.

URL test:

```txt
https://NAMA-PROJECT.vercel.app/api?action=health
```
