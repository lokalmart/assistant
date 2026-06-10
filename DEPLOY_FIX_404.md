# Perbaikan 404 Vercel - Lokalmart Odoo AI Bridge

Error seperti ini:

```txt
404: NOT_FOUND
Code: NOT_FOUND
ID: sin1::...
```

biasanya berarti Vercel tidak menemukan file app di root project, bukan berarti koneksi Odoo gagal.

## Penyebab paling sering

1. File app masuk ke subfolder, misalnya:

```txt
repo/
└─ lokalmart-odoo-ai-bridge/
   ├─ index.html
   ├─ vercel.json
   └─ api/bridge.js
```

Tapi di Vercel, **Root Directory** masih diarahkan ke `repo/`, bukan ke `lokalmart-odoo-ai-bridge/`.

2. Yang dideploy hanya folder `api/`, sehingga tidak ada `index.html`.

3. URL yang dibuka salah, misalnya project lama atau deployment preview yang gagal.

## Cara deploy yang benar

Struktur root project harus seperti ini:

```txt
index.html
package.json
vercel.json
api/bridge.js
public/openapi.json
```

Jika struktur di repo masih punya folder pembungkus `lokalmart-odoo-ai-bridge/`, maka di Vercel buka:

Project Settings → General → Root Directory

lalu isi:

```txt
lokalmart-odoo-ai-bridge
```

Setelah itu klik redeploy.

## URL test setelah deploy

Buka root app:

```txt
https://NAMA-PROJECT.vercel.app/
```

Tes API health:

```txt
https://NAMA-PROJECT.vercel.app/api?action=health
```

atau:

```txt
https://NAMA-PROJECT.vercel.app/api/bridge?action=health
```

Jika health sudah muncul JSON, berarti route sudah benar.

## Environment variable wajib

Isi di Vercel → Project Settings → Environment Variables:

```env
ODOO_URL=https://edu-lokalmart.odoo.com
ODOO_DB=edu-lokalmart
ODOO_USERNAME=email-admin-odoo
ODOO_API_KEY=api-key-odoo
LM_ADMIN_TOKEN=token-panjang-random
LM_DEFAULT_LIMIT=300
LM_MAX_LIMIT=1500
```

Setelah environment variable diubah, lakukan redeploy.
