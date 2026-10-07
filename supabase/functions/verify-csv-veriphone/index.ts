import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeKey(value: unknown): string {
  return String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
}

function csvCell(raw: unknown): string {
  const value = String(raw ?? "");
  return '"' + value.replace(/"/g, '""') + '"';
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (ch === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

type Candidate = { id: string; key: string; label: string; available: number };
async function credits(key: string): Promise<number> {
  try {
    const response = await fetch("https://api.veriphone.io/v3/credits", {
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(14000),
    });
    if (!response.ok) return 0;
    const data = await response.json();
    const planBalance = Math.max(0, Number(data.limit || 0) - Number(data.counter || 0));
    return Math.floor(Math.max(0, planBalance + Number(data.payg || 0)));
  } catch {
    return 0;
  }
}

async function apiRequest(url: string, key: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any; text?: string }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: "Bearer " + key,
    },
    signal: AbortSignal.timeout(25000),
  });
  const content = await response.text();
  let data: any;
  try { data = JSON.parse(content); } catch { data = null; }
  return { ok: response.ok, status: response.status, data, text: content };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return respond({ success: false, error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return respond({ success: false, error: "Configuração interna ausente" }, 500);

  const bearer = request.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer ")) return respond({ success: false, error: "Faça login novamente" }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: bearer } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth?.user) return respond({ success: false, error: "Sessão inválida" }, 401);

  let body: any;
  try { body = await request.json(); }
  catch { return respond({ success: false, error: "JSON inválido" }, 400); }

  const action = String(body?.action || "");
  if (!["credits", "start", "status", "download"].includes(action)) {
    return respond({ success: false, error: "Ação desconhecida" }, 400);
  }

  const admin = createClient(url, service);
  const { data: apiKeys, error: keysError } = await admin
    .from("api_keys")
    .select("id,label,key_value,disabled_until,priority")
    .eq("user_id", auth.user.id)
    .eq("provider", "veriphone")
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (keysError) return respond({ success: false, error: "Falha ao carregar chaves: " + keysError.message }, 500);

  const now = Date.now();
  const candidates: Candidate[] = (apiKeys || [])
    .filter((row: any) => !row.disabled_until || Date.parse(row.disabled_until) <= now)
    .map((row: any) => ({
      id: String(row.id),
      key: normalizeKey(row.key_value),
      label: String(row.label || "Veriphone"),
      available: 0,
    }))
    .filter((item: Candidate) => item.key);

  if (candidates.length === 0) {
    const { data: profile } = await admin.from("profiles")
      .select("veriphone_api_key").eq("user_id", auth.user.id).maybeSingle();
    const legacyKey = normalizeKey(profile?.veriphone_api_key || Deno.env.get("VERIPHONE_API_KEY"));
    if (legacyKey) candidates.push({ id: "profile", key: legacyKey, label: "Veriphone (chave principal)", available: 0 });
  }
  if (!candidates.length) {
    return respond({ success: false, code: "NO_KEYS", error: "Cadastre uma API Key Veriphone em Configurações." });
  }

  if (action === "credits" || action === "start") {
    await Promise.all(candidates.map(async (candidate) => {
      candidate.available = await credits(candidate.key);
    }));
    candidates.sort((a, b) => b.available - a.available);
  }

  if (action === "credits") {
    return respond({
      success: true,
      keys: candidates.length,
      available: candidates.reduce((sum, candidate) => sum + candidate.available, 0),
    });
  }

  if (action === "start") {
    const rows = body?.rows;
    if (!Array.isArray(rows) || !rows.length || rows.length > 1000) {
      return respond({ success: false, error: "Envie de 1 a 1.000 contatos por lote." }, 400);
    }
    for (const row of rows) {
      if (!Number.isSafeInteger(row?.id) || row.id < 0 ||
          typeof row.name !== "string" || row.name.length > 250 ||
          typeof row.phone !== "string" || !/^\+1[2-9]\d{9}$/.test(row.phone)) {
        return respond({ success: false, error: "Lote contém contato inválido." }, 400);
      }
    }
    const ready = candidates.filter(candidate => candidate.available > 0);
    if (!ready.length) return respond({
      success: false, code: "NO_CREDITS", error: "Nenhuma das chaves Veriphone cadastradas tem créditos disponíveis.",
    });

    let lastError = "Não foi possível iniciar o lote.";
    for (const candidate of ready) {
      const count = Math.min(rows.length, candidate.available);
      const subset = rows.slice(0, count);
      const csv = ['"row_id","name","phone"'].concat(
        subset.map((row: any) => csvCell(row.id) + "," + csvCell(row.name) + "," + csvCell(row.phone)),
      ).join("\n") + "\n";
      const form = new FormData();
      form.set("file", new File([csv], "saveleads.csv", { type: "text/csv" }));
      form.set("column", "2");
      form.set("firstrow", "1");

      try {
        const uploaded = await apiRequest("https://api.veriphone.io/v3/file/upload", candidate.key, {
          method: "POST", body: form,
        });
        if (!uploaded.ok || !uploaded.data?.id) {
          lastError = String(uploaded.data?.message || "Upload Veriphone falhou: HTTP " + uploaded.status);
          continue;
        }
        const fileId = String(uploaded.data.id);
        const verified = await apiRequest(
          "https://api.veriphone.io/v3/file/verify?id=" + encodeURIComponent(fileId) + "&default_country=US&mode=static",
          candidate.key, { method: "POST" },
        );
        if (!verified.ok || verified.data?.status !== "success") {
          lastError = String(verified.data?.message || "Verificação recusada: HTTP " + verified.status);
          continue;
        }
        if (candidate.id !== "profile") {
          await admin.from("api_keys").update({
            last_used_at: new Date().toISOString(), last_error: null,
          }).eq("id", candidate.id).eq("user_id", auth.user.id);
        }
        return respond({
          success: true, fileId, keyId: candidate.id, keyLabel: candidate.label,
          accepted: subset.length, remaining: rows.length - subset.length,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Erro de conexão com Veriphone";
      }
    }
    return respond({ success: false, code: "VERIPHONE_FAILED", error: lastError });
  }

  const keyId = String(body?.keyId || "");
  const fileId = String(body?.fileId || "");
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(fileId)) {
    return respond({ success: false, error: "Identificador de lote inválido" }, 400);
  }
  const candidate = candidates.find(item => item.id === keyId);
  if (!candidate) return respond({ success: false, error: "A chave deste lote não está disponível na sua conta" }, 403);

  try {
    if (action === "status") {
      const result = await apiRequest(
        "https://api.veriphone.io/v3/file/get?id=" + encodeURIComponent(fileId), candidate.key,
      );
      if (!result.ok || !result.data?.status) {
        return respond({ success: false, error: "Não foi possível consultar o progresso no Veriphone" });
      }
      return respond({
        success: true, status: String(result.data.status),
        processed: Number(result.data.position || 0),
        total: Number(result.data.lastrow || 0),
      });
    }

    const status = await apiRequest(
      "https://api.veriphone.io/v3/file/get?id=" + encodeURIComponent(fileId), candidate.key,
    );
    if (!status.ok || status.data?.status !== "completed") {
      return respond({ success: false, error: "O lote ainda não foi concluído no Veriphone" });
    }
    const download = await apiRequest(
      "https://api.veriphone.io/v3/file/download?id=" + encodeURIComponent(fileId),
      candidate.key,
    );
    if (!download.ok || !download.text) {
      return respond({ success: false, error: "Falha ao baixar resultados da Veriphone" });
    }
    const matrix = parseCsv(download.text);
    const header = (matrix.shift() || []).map(item => item.replace(/^\uFEFF/, "").trim().toLowerCase());
    const col = (...names: string[]) => names.map(name => header.indexOf(name)).find(index => index !== -1) ?? -1;
    const idIndex = col("row_id");
    const validIndex = col("phone_valid");
    const typeIndex = col("type", "phone_type");
    const e164Index = col("e164");
    const carrierIndex = col("carrier");
    const countryIndex = col("country");
    if (idIndex === -1 || validIndex === -1 || typeIndex === -1) {
      return respond({ success: false, error: "Colunas obrigatórias ausentes no resultado Veriphone" });
    }
    const results = matrix.filter(row => row.some(Boolean)).map(row => ({
      id: Number(row[idIndex]),
      valid: ["true", "1", "yes"].includes(String(row[validIndex] || "").toLowerCase()),
      type: String(row[typeIndex] || "unknown").toLowerCase().trim() || "unknown",
      carrier: carrierIndex < 0 ? "" : String(row[carrierIndex] || ""),
      country: countryIndex < 0 ? "" : String(row[countryIndex] || ""),
      e164: e164Index < 0 ? "" : String(row[e164Index] || ""),
    }));
    return respond({ success: true, results });
  } catch (error) {
    return respond({ success: false, error: error instanceof Error ? error.message : "Erro interno na Veriphone" });
  }
});
