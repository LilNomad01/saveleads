import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeKey(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += ch;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell !== ""));
}

function mapType(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "mobile") return "mobile";
  if (value === "fixed_line" || value === "landline") return "landline";
  if (value === "voip") return "nonFixedVoip";
  return value;
}

function parseBoolean(value: string | null | undefined): boolean {
  return ["true", "1", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Método não permitido" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return json(500, { success: false, error: "Configuração interna incompleta" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { success: false, error: "Sessão não autenticada" });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return json(401, { success: false, error: "Sessão inválida ou expirada" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "Body JSON inválido" });
  }

  const jobId = String(body?.jobId || "").trim();
  if (!jobId) return json(400, { success: false, error: "jobId obrigatório" });

  const admin = createClient(supabaseUrl, serviceRole);

  const { data: job, error: jobError } = await admin
    .from("phone_verification_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobError || !job) {
    return json(404, { success: false, error: "Job não encontrado" });
  }

  if (job.status === "completed") {
    return json(200, {
      success: true,
      status: "completed",
      processed: job.total,
      total: job.total,
      completed: true,
    });
  }

  if (job.status === "error") {
    return json(200, {
      success: false,
      status: "error",
      processed: job.processed || 0,
      total: job.total,
      error: job.error || "Falha na verificação em lote",
    });
  }

  const { data: keyRow, error: keyError } = await admin
    .from("api_keys")
    .select("id,key_value,label")
    .eq("id", job.api_key_id)
    .maybeSingle();

  if (keyError || !keyRow) {
    await admin.from("phone_verification_jobs").update({
      status: "error",
      error: "Chave Veriphone do job não foi encontrada.",
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    return json(200, { success: false, status: "error", error: "Chave Veriphone não encontrada" });
  }

  const apiKey = normalizeKey(keyRow.key_value);
  const infoResponse = await fetch(
    `https://api.veriphone.io/v3/file/get?id=${encodeURIComponent(job.external_file_id)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  const info = await infoResponse.json().catch(() => null);
  if (!infoResponse.ok) {
    const message = String(info?.message || info?.type || `Veriphone HTTP ${infoResponse.status}`);
    return json(200, {
      success: false,
      status: "error",
      error: message,
      processed: job.processed || 0,
      total: job.total,
    });
  }

  const providerStatus = String(info?.status || "").toLowerCase();
  const processed = Math.min(Number(info?.position || 0), Number(job.total || 0));

  if (providerStatus && providerStatus !== "completed") {
    if (providerStatus === "deleted") {
      await admin.from("phone_verification_jobs").update({
        status: "error",
        processed,
        error: "Arquivo de verificação foi removido no Veriphone.",
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      return json(200, {
        success: false,
        status: "error",
        error: "Arquivo removido no Veriphone",
        processed,
        total: job.total,
      });
    }

    await admin.from("phone_verification_jobs").update({
      status: "verifying",
      processed,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    return json(200, {
      success: true,
      status: providerStatus || "verifying",
      processed,
      total: job.total,
      completed: false,
    });
  }

  if (providerStatus !== "completed") {
    return json(200, {
      success: true,
      status: "verifying",
      processed,
      total: job.total,
      completed: false,
    });
  }

  const downloadResponse = await fetch(
    `https://api.veriphone.io/v3/file/download?id=${encodeURIComponent(job.external_file_id)}&as=saveleads_results.csv`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );

  if (!downloadResponse.ok) {
    const message = `Falha ao baixar resultados do Veriphone: HTTP ${downloadResponse.status}`;
    await admin.from("phone_verification_jobs").update({
      status: "error",
      error: message,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    return json(200, {
      success: false,
      status: "error",
      error: message,
      processed,
      total: job.total,
    });
  }

  const csv = await downloadResponse.text();
  const rows = parseCsv(csv);

  if (rows.length < 2) {
    const message = "Veriphone concluiu o lote, mas o arquivo de resultados veio vazio.";
    await admin.from("phone_verification_jobs").update({
      status: "error",
      error: message,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    return json(200, { success: false, status: "error", error: message, processed, total: job.total });
  }

  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, "").trim().toLowerCase());
  const indexOf = (...names: string[]) => {
    for (const name of names) {
      const index = header.indexOf(name.toLowerCase());
      if (index >= 0) return index;
    }
    return -1;
  };

  const idIndex = indexOf("lead_id");
  const validIndex = indexOf("phone_valid");
  const e164Index = indexOf("e164");
  const typeIndex = indexOf("type", "phone_type");
  const carrierIndex = indexOf("carrier");

  if (idIndex < 0 || validIndex < 0) {
    const message = "Formato de resultado do Veriphone inesperado: colunas obrigatórias não encontradas.";
    await admin.from("phone_verification_jobs").update({
      status: "error",
      error: message,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    return json(200, { success: false, status: "error", error: message, processed, total: job.total });
  }

  const results: Array<Record<string, unknown>> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[idIndex] || "").trim();
    if (!id) continue;

    const e164 = e164Index >= 0 ? String(row[e164Index] || "").trim() : "";
    const e164Digits = e164.replace(/\D/g, "");

    results.push({
      id,
      phone_valid: parseBoolean(row[validIndex]),
      phone_line_type: typeIndex >= 0 ? mapType(row[typeIndex]) : null,
      phone_carrier: carrierIndex >= 0 ? String(row[carrierIndex] || "").trim() : null,
      e164_digits: e164Digits || null,
    });
  }

  const { data: applied, error: applyError } = await admin.rpc(
    "apply_phone_verification_results",
    {
      p_user_id: user.id,
      p_results: results,
    },
  );

  if (applyError) {
    const message = `Erro ao aplicar resultados: ${applyError.message}`;
    await admin.from("phone_verification_jobs").update({
      status: "error",
      error: message,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", job.id);

    return json(200, { success: false, status: "error", error: message, processed, total: job.total });
  }

  await admin.from("phone_verification_jobs").update({
    status: "completed",
    processed: job.total,
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }).eq("id", job.id);

  await admin.from("api_keys").update({
    last_used_at: new Date().toISOString(),
    last_error: null,
    disabled_until: null,
  }).eq("id", keyRow.id);

  return json(200, {
    success: true,
    status: "completed",
    processed: job.total,
    total: job.total,
    completed: true,
    updated: Number(applied || 0),
  });
});
