import { XMLParser } from 'fast-xml-parser';

const BRIDGE_VERSION = '0.1.0';
const READ_METHODS = new Set([
  'fields_get',
  'search_read',
  'search_count',
  'read',
  'search',
  'name_search',
  'name_get'
]);

const DEFAULT_MODELS = [
  'product.template',
  'product.product',
  'product.category',
  'product.public.category',
  'res.partner',
  'project.project',
  'project.task',
  'project.task.type',
  'ir.model',
  'ir.model.fields',
  'ir.model.data',
  'website.page',
  'ir.ui.view'
];

const CONTEXT_SPECS = [
  {
    key: 'product_categories_technical',
    model: 'product.category',
    domain: [],
    order: 'complete_name asc,id asc',
    fields: ['id', 'name', 'complete_name', 'display_name', 'parent_id', 'active', 'write_date']
  },
  {
    key: 'product_categories_ecommerce',
    model: 'product.public.category',
    domain: [],
    order: 'name asc,id asc',
    fields: ['id', 'name', 'display_name', 'parent_id', 'sequence', 'website_id', 'write_date']
  },
  {
    key: 'products',
    model: 'product.template',
    domain: [],
    order: 'write_date desc,id desc',
    fields: [
      'id', 'name', 'display_name', 'default_code', 'barcode', 'active', 'sale_ok', 'purchase_ok',
      'detailed_type', 'type', 'categ_id', 'public_categ_ids', 'list_price', 'standard_price',
      'uom_id', 'uom_po_id', 'website_published', 'description_sale', 'create_date', 'write_date'
    ]
  },
  {
    key: 'partners',
    model: 'res.partner',
    domain: [['active', '=', true]],
    order: 'write_date desc,id desc',
    fields: [
      'id', 'name', 'display_name', 'is_company', 'company_type', 'parent_id', 'phone', 'mobile', 'email',
      'street', 'street2', 'city', 'state_id', 'country_id', 'zip', 'supplier_rank', 'customer_rank',
      'category_id', 'active', 'create_date', 'write_date'
    ]
  },
  {
    key: 'projects',
    model: 'project.project',
    domain: [],
    order: 'write_date desc,id desc',
    fields: [
      'id', 'name', 'display_name', 'active', 'user_id', 'partner_id', 'date_start', 'date',
      'company_id', 'privacy_visibility', 'create_date', 'write_date'
    ]
  },
  {
    key: 'tasks',
    model: 'project.task',
    domain: [],
    order: 'write_date desc,id desc',
    fields: [
      'id', 'name', 'display_name', 'active', 'project_id', 'stage_id', 'user_ids', 'partner_id',
      'priority', 'kanban_state', 'date_deadline', 'tag_ids', 'description', 'create_date', 'write_date'
    ]
  },
  {
    key: 'custom_models',
    model: 'ir.model',
    domain: [['model', 'ilike', 'x_']],
    order: 'model asc',
    fields: ['id', 'name', 'model', 'state', 'transient', 'info', 'modules', 'write_date']
  },
  {
    key: 'custom_fields',
    model: 'ir.model.fields',
    domain: [['name', 'ilike', 'x_']],
    order: 'model asc,name asc',
    fields: [
      'id', 'name', 'complete_name', 'model', 'model_id', 'field_description', 'ttype', 'relation',
      'required', 'readonly', 'store', 'copied', 'index', 'state', 'on_delete', 'ondelete', 'help', 'write_date'
    ]
  },
  {
    key: 'website_pages',
    model: 'website.page',
    domain: [],
    order: 'write_date desc,id desc',
    fields: ['id', 'name', 'url', 'view_id', 'website_id', 'is_published', 'create_date', 'write_date']
  },
  {
    key: 'website_views_lokalmart',
    model: 'ir.ui.view',
    domain: ['|', ['name', 'ilike', 'lokal'], ['key', 'ilike', 'lokal']],
    order: 'write_date desc,id desc',
    fields: ['id', 'name', 'key', 'type', 'mode', 'model', 'inherit_id', 'active', 'priority', 'create_date', 'write_date']
  }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false
});

function env(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function requiredEnv(name) {
  const v = env(name);
  if (!v) throw httpError(500, `Missing environment variable: ${name}`);
  return v;
}

function httpError(status, message, detail = undefined) {
  const err = new Error(message);
  err.status = status;
  err.detail = detail;
  return err;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlValue(value) {
  if (value === null || value === undefined) {
    // XML-RPC has no universal null. Odoo convention: use false.
    return '<value><boolean>0</boolean></value>';
  }
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(xmlValue).join('')}</data></array></value>`;
  }
  if (value instanceof Date) {
    return `<value><dateTime.iso8601>${escapeXml(value.toISOString().replace(/[-:]/g, '').slice(0, 15))}</dateTime.iso8601></value>`;
  }
  switch (typeof value) {
    case 'boolean':
      return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
    case 'number':
      if (Number.isInteger(value)) return `<value><int>${value}</int></value>`;
      return `<value><double>${value}</double></value>`;
    case 'object':
      return `<value><struct>${Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `<member><name>${escapeXml(k)}</name>${xmlValue(v)}</member>`)
        .join('')}</struct></value>`;
    default:
      return `<value><string>${escapeXml(value)}</string></value>`;
  }
}

function xmlRequest(methodName, params) {
  return `<?xml version="1.0"?>\n<methodCall><methodName>${escapeXml(methodName)}</methodName><params>${params
    .map((p) => `<param>${xmlValue(p)}</param>`)
    .join('')}</params></methodCall>`;
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseValue(node) {
  if (node === undefined || node === null) return false;
  if (typeof node !== 'object') return node;

  if (Object.prototype.hasOwnProperty.call(node, 'string')) return node.string ?? '';
  if (Object.prototype.hasOwnProperty.call(node, 'int')) return Number(node.int || 0);
  if (Object.prototype.hasOwnProperty.call(node, 'i4')) return Number(node.i4 || 0);
  if (Object.prototype.hasOwnProperty.call(node, 'double')) return Number(node.double || 0);
  if (Object.prototype.hasOwnProperty.call(node, 'boolean')) {
    return node.boolean === true || node.boolean === '1' || node.boolean === 1;
  }
  if (Object.prototype.hasOwnProperty.call(node, 'dateTime.iso8601')) return node['dateTime.iso8601'];
  if (Object.prototype.hasOwnProperty.call(node, 'base64')) return node.base64;
  if (Object.prototype.hasOwnProperty.call(node, 'array')) {
    const values = node.array?.data?.value;
    return asArray(values).map(parseValue);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'struct')) {
    const out = {};
    for (const member of asArray(node.struct?.member)) {
      const key = member?.name;
      if (key !== undefined) out[String(key)] = parseValue(member.value);
    }
    return out;
  }

  // Some Odoo responses use <value>plain text</value>.
  if (Object.keys(node).length === 0) return '';
  return node;
}

async function xmlRpc(endpoint, methodName, params) {
  const base = requiredEnv('ODOO_URL').replace(/\/$/, '');
  const url = `${base}${endpoint}`;
  const body = xmlRequest(methodName, params);

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body
  });
  const text = await r.text();

  if (!r.ok) {
    throw httpError(r.status, `Odoo HTTP ${r.status}`, text.slice(0, 1200));
  }

  let doc;
  try {
    doc = parser.parse(text);
  } catch (e) {
    throw httpError(502, 'Cannot parse Odoo XML-RPC response', text.slice(0, 1200));
  }

  const response = doc?.methodResponse;
  if (!response) throw httpError(502, 'Invalid Odoo XML-RPC response', text.slice(0, 1200));

  if (response.fault) {
    const fault = parseValue(response.fault.value);
    throw httpError(502, fault?.faultString || 'Odoo XML-RPC fault', fault);
  }

  const param = asArray(response.params?.param)[0];
  return parseValue(param?.value);
}

let cachedUid = null;

async function getUid() {
  if (cachedUid) return cachedUid;
  const uid = await xmlRpc('/xmlrpc/2/common', 'authenticate', [
    requiredEnv('ODOO_DB'),
    requiredEnv('ODOO_USERNAME'),
    requiredEnv('ODOO_API_KEY'),
    {}
  ]);
  if (!uid) throw httpError(401, 'Odoo authentication failed. Check ODOO_DB, ODOO_USERNAME, and ODOO_API_KEY.');
  cachedUid = uid;
  return uid;
}

async function odooVersion() {
  return xmlRpc('/xmlrpc/2/common', 'version', []);
}

async function executeKw(model, method, args = [], kwargs = {}) {
  if (!model || typeof model !== 'string') throw httpError(400, 'Missing or invalid model.');
  if (!method || typeof method !== 'string') throw httpError(400, 'Missing or invalid method.');
  const uid = await getUid();
  return xmlRpc('/xmlrpc/2/object', 'execute_kw', [
    requiredEnv('ODOO_DB'),
    uid,
    requiredEnv('ODOO_API_KEY'),
    model,
    method,
    args,
    kwargs || {}
  ]);
}

async function safeFieldsGet(model, attributes = ['string', 'type', 'relation', 'required', 'readonly', 'store', 'selection', 'help']) {
  return executeKw(model, 'fields_get', [], { attributes });
}

async function exportModel(spec, limit) {
  const fieldsMeta = await safeFieldsGet(spec.model, ['string', 'type']);
  const validFields = spec.fields.filter((f) => Boolean(fieldsMeta[f]));
  const data = await executeKw(spec.model, 'search_read', [spec.domain || []], {
    fields: validFields,
    limit,
    order: spec.order || 'id asc'
  });
  return {
    key: spec.key,
    model: spec.model,
    domain: spec.domain || [],
    fields_requested: spec.fields,
    fields_exported: validFields,
    count: Array.isArray(data) ? data.length : 0,
    data
  };
}

function capLimit(raw) {
  const defaultLimit = Number(env('LM_DEFAULT_LIMIT', '300')) || 300;
  const maxLimit = Number(env('LM_MAX_LIMIT', '1500')) || 1500;
  const n = Number(raw || defaultLimit);
  if (!Number.isFinite(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}

function baseMeta() {
  return {
    bridge: 'lokalmart-odoo-ai-bridge',
    bridge_version: BRIDGE_VERSION,
    generated_at: new Date().toISOString(),
    odoo_url: env('ODOO_URL', '').replace(/\/$/, ''),
    odoo_db: env('ODOO_DB', ''),
    mode: 'read_first_no_write'
  };
}

async function actionHealth() {
  return {
    ok: true,
    ...baseMeta(),
    env_ready: {
      ODOO_URL: Boolean(env('ODOO_URL')),
      ODOO_DB: Boolean(env('ODOO_DB')),
      ODOO_USERNAME: Boolean(env('ODOO_USERNAME')),
      ODOO_API_KEY: Boolean(env('ODOO_API_KEY')),
      LM_ADMIN_TOKEN: Boolean(env('LM_ADMIN_TOKEN'))
    },
    actions: ['health', 'manifest', 'ping', 'rpc', 'schema_scan', 'context_export', 'audit']
  };
}

async function actionPing() {
  const [version, uid] = await Promise.all([odooVersion(), getUid()]);
  return { ok: true, ...baseMeta(), uid, odoo_version: version };
}

async function actionRpc(body) {
  const { model, method, args = [], kwargs = {} } = body;
  if (!READ_METHODS.has(method)) {
    throw httpError(403, `Blocked method: ${method}. This bridge is read-only. Allowed methods: ${Array.from(READ_METHODS).join(', ')}`);
  }

  if (kwargs && typeof kwargs === 'object' && Object.prototype.hasOwnProperty.call(kwargs, 'limit')) {
    kwargs.limit = capLimit(kwargs.limit);
  }

  const data = await executeKw(model, method, Array.isArray(args) ? args : [], kwargs || {});
  return { ok: true, ...baseMeta(), request: { model, method, args, kwargs }, data };
}

async function actionSchemaScan(body) {
  const models = Array.isArray(body.models) && body.models.length ? body.models : DEFAULT_MODELS;
  const includeCustom = body.include_custom !== false;
  const attributes = body.attributes || ['string', 'type', 'relation', 'required', 'readonly', 'store', 'selection', 'help'];
  const out = [];
  const errors = [];

  let scanModels = [...new Set(models)];

  if (includeCustom) {
    try {
      const custom = await executeKw('ir.model', 'search_read', [[['model', 'ilike', 'x_']]], {
        fields: ['model', 'name', 'state'],
        limit: capLimit(body.custom_limit || 500),
        order: 'model asc'
      });
      for (const m of custom || []) scanModels.push(m.model);
      scanModels = [...new Set(scanModels.filter(Boolean))];
    } catch (e) {
      errors.push({ key: 'custom_model_lookup', error: e.message, detail: e.detail });
    }
  }

  for (const model of scanModels) {
    try {
      const fields = await safeFieldsGet(model, attributes);
      out.push({ model, field_count: Object.keys(fields || {}).length, fields });
    } catch (e) {
      errors.push({ model, error: e.message, detail: e.detail });
    }
  }

  return { ok: errors.length === 0, ...baseMeta(), model_count: out.length, models: out, errors };
}

async function buildContext(body = {}) {
  const limit = capLimit(body.limit);
  const keys = Array.isArray(body.sections) && body.sections.length ? new Set(body.sections) : null;
  const specs = keys ? CONTEXT_SPECS.filter((s) => keys.has(s.key) || keys.has(s.model)) : CONTEXT_SPECS;
  const sections = {};
  const errors = [];

  for (const spec of specs) {
    try {
      const exported = await exportModel(spec, capLimit(body[`${spec.key}_limit`] || limit));
      sections[spec.key] = exported;
    } catch (e) {
      errors.push({ key: spec.key, model: spec.model, error: e.message, detail: e.detail });
      sections[spec.key] = { key: spec.key, model: spec.model, error: e.message, detail: e.detail, data: [] };
    }
  }

  return {
    ok: errors.length === 0,
    ...baseMeta(),
    export_profile: 'lokalmart_assistant_context_v1',
    limit,
    section_count: Object.keys(sections).length,
    sections,
    errors,
    assistant_usage: {
      instruction: 'Upload this JSON to ChatGPT / Asisten Lokalmart, then ask for audit, cleanup plan, or migration-safe XLSX patch.',
      recommended_prompt: 'Baca file context_export ini sebagai kondisi Odoo Lokalmart saat ini. Audit struktur, data kosong, risiko import, dan buat rekomendasi patch XLSX yang aman.'
    }
  };
}

async function actionContextExport(body) {
  return buildContext(body);
}

function many2oneName(v) {
  return Array.isArray(v) ? v[1] : v || '';
}

function analyzeContext(context) {
  const s = context.sections || {};
  const products = s.products?.data || [];
  const partners = s.partners?.data || [];
  const tasks = s.tasks?.data || [];
  const customFields = s.custom_fields?.data || [];
  const pages = s.website_pages?.data || [];

  const issues = [];
  const stats = {
    products: products.length,
    partners: partners.length,
    tasks: tasks.length,
    custom_fields: customFields.length,
    website_pages: pages.length
  };

  const addIssue = (severity, area, title, records, suggestion) => {
    issues.push({ severity, area, title, count: records.length, sample: records.slice(0, 20), suggestion });
  };

  addIssue(
    'medium',
    'product',
    'Produk tanpa internal reference/default_code',
    products.filter((p) => !p.default_code),
    'Isi default_code stabil agar export/import dan operasional barcode lebih mudah ditelusuri.'
  );

  addIssue(
    'medium',
    'product',
    'Produk tanpa barcode',
    products.filter((p) => !p.barcode),
    'Produk yang akan dipakai untuk scan sebaiknya punya barcode unik atau Lokal Product ID.'
  );

  const barcodeMap = new Map();
  for (const p of products) {
    if (!p.barcode) continue;
    const arr = barcodeMap.get(p.barcode) || [];
    arr.push({ id: p.id, name: p.name, barcode: p.barcode });
    barcodeMap.set(p.barcode, arr);
  }
  addIssue(
    'high',
    'product',
    'Barcode duplikat',
    [...barcodeMap.values()].filter((arr) => arr.length > 1).flat(),
    'Barcode duplikat harus dibereskan sebelum import produk baru agar tidak terkena error Odoo.'
  );

  addIssue(
    'medium',
    'product',
    'Produk harga jual nol/kosong',
    products.filter((p) => Number(p.list_price || 0) <= 0),
    'Pisahkan produk katalog informasi dari produk jual. Produk jual sebaiknya punya harga/list_price.'
  );

  addIssue(
    'low',
    'product',
    'Produk tanpa kategori teknis',
    products.filter((p) => !p.categ_id),
    'Setiap product.template sebaiknya punya product.category teknis, terpisah dari ecommerce category.'
  );

  addIssue(
    'medium',
    'partner',
    'Partner tanpa kontak telepon/email',
    partners.filter((p) => !p.phone && !p.mobile && !p.email),
    'UMKM, supplier, agen, dan customer perlu minimal WhatsApp/telepon untuk operasional.'
  );

  addIssue(
    'medium',
    'project',
    'Task tanpa deadline',
    tasks.filter((t) => !t.date_deadline),
    'Task operasional Ground Zero/Pilot sebaiknya punya deadline atau SLA sederhana.'
  );

  addIssue(
    'low',
    'project',
    'Task tanpa user/PIC',
    tasks.filter((t) => !Array.isArray(t.user_ids) || t.user_ids.length === 0),
    'Tetapkan PIC agar tanggung jawab task jelas.'
  );

  addIssue(
    'high',
    'technical',
    'Custom Many2one required dengan ondelete set null/kosong',
    customFields.filter((f) => f.ttype === 'many2one' && f.required && (!f.on_delete && !f.ondelete || f.on_delete === 'set null' || f.ondelete === 'set null')),
    'Untuk Odoo Online/importer Lokalmart, custom Many2one baru sebaiknya required=False dulu, atau ondelete restrict/cascade jika memang wajib.'
  );

  addIssue(
    'low',
    'website',
    'Website page belum published',
    pages.filter((p) => p.is_published === false),
    'Pastikan hanya page yang siap publik yang dipublish. Page draft boleh tetap unpublished.'
  );

  return {
    ok: true,
    ...baseMeta(),
    audit_profile: 'lokalmart_assistant_audit_v1',
    stats,
    issue_count: issues.filter((i) => i.count > 0).length,
    issues: issues.filter((i) => i.count > 0),
    notes: [
      'Audit ini bersifat read-only dan tidak mengubah Odoo.',
      'Sample dibatasi 20 record per isu agar respons tidak terlalu besar.',
      'Untuk perbaikan, minta Asisten Lokalmart membuat XLSX patch per area: fields/ACL, produk, project/task, website/QWeb.'
    ]
  };
}

async function actionAudit(body) {
  const context = body.context && body.context.sections ? body.context : await buildContext(body);
  return analyzeContext(context);
}

function actionManifest() {
  return {
    ok: true,
    ...baseMeta(),
    purpose: 'Read-first bridge so Asisten Lokalmart can inspect Odoo through exported context, schema scan, and safe read RPC.',
    auth: {
      header: 'X-LM-ADMIN-TOKEN',
      note: 'Do not put token in public URLs. Header auth is safer than query tokens.'
    },
    actions: {
      health: { method: 'GET/POST', auth: false, description: 'Check bridge status and env readiness without exposing secrets.' },
      ping: { method: 'POST', auth: true, description: 'Authenticate to Odoo and read version.' },
      rpc: { method: 'POST', auth: true, description: 'Read-only execute_kw wrapper. Blocks create/write/unlink.' },
      schema_scan: { method: 'POST', auth: true, description: 'Read fields_get for core and custom models.' },
      context_export: { method: 'POST', auth: true, description: 'Export selected Lokalmart context sections for ChatGPT analysis.' },
      audit: { method: 'POST', auth: true, description: 'Run basic read-only data quality audit.' }
    },
    example_rpc: {
      action: 'rpc',
      model: 'product.template',
      method: 'search_read',
      args: [[['active', '=', true]]],
      kwargs: { fields: ['id', 'name', 'default_code', 'barcode', 'list_price'], limit: 10 }
    }
  };
}

function allowedOrigin(origin) {
  const configured = env('ALLOWED_ORIGINS');
  if (!configured) return origin || '*';
  const allowed = configured.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : allowed[0] || 'null';
}

function sendJson(req, res, status, obj) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin(origin));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-LM-ADMIN-TOKEN');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(obj, null, 2));
}

async function readJsonBody(req) {
  if (req.method === 'GET') return {};
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { throw httpError(400, 'Invalid JSON body.'); }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { throw httpError(400, 'Invalid JSON body.'); }
}

function checkToken(req, body, action) {
  if (action === 'health' || action === 'manifest') return;
  const expected = env('LM_ADMIN_TOKEN');
  if (!expected) throw httpError(500, 'LM_ADMIN_TOKEN is not configured.');
  const got = req.headers['x-lm-admin-token'] || body.token;
  if (!got || got !== expected) throw httpError(401, 'Unauthorized. Send X-LM-ADMIN-TOKEN header.');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(req, res, 200, { ok: true });
  if (!['GET', 'POST'].includes(req.method)) return sendJson(req, res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const body = await readJsonBody(req);
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = body.action || url.searchParams.get('action') || 'health';

    checkToken(req, body, action);

    let result;
    switch (action) {
      case 'health': result = await actionHealth(); break;
      case 'manifest': result = actionManifest(); break;
      case 'ping': result = await actionPing(); break;
      case 'rpc': result = await actionRpc(body); break;
      case 'schema_scan': result = await actionSchemaScan(body); break;
      case 'context_export': result = await actionContextExport(body); break;
      case 'audit': result = await actionAudit(body); break;
      default: throw httpError(400, `Unknown action: ${action}`);
    }

    return sendJson(req, res, 200, result);
  } catch (e) {
    const status = e.status || 500;
    return sendJson(req, res, status, {
      ok: false,
      bridge: 'lokalmart-odoo-ai-bridge',
      bridge_version: BRIDGE_VERSION,
      error: e.message || 'Internal error',
      detail: e.detail,
      generated_at: new Date().toISOString()
    });
  }
}
