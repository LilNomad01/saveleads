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

function normalizePhone(raw: string | null | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (value.startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

async function getCredits(apiKey: string): Promise<{ ok: boolean; available: number; error?: string }> {
  try {
    const response = await fetch("https://api.veriphone.io/v3/credits", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        available: 0,
        error: String(payload?.message || payload?.type || `HTTP ${response.status}`),
      };
    }

    const limit = Number(payload?.limit || 0);
    const counter = Number(payload?.counter || 0);
    const payg = Number(payload?.payg || 0);
    const available = Math.max(0, limit - counter) + Math.max(0, payg);

    return { ok: true, available: Math.floor(available) };
  } catch (error) {
    return {
      ok: false,
      available: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function markKeyUnavailable(admin: any, id: string, message: string, hours = 12) {
  await admin
    .from("api_keys")
    .update({
      last_error: message.slice(0, 500),
      disabled_until: new Date(Date.now() + hours * 60 * 60_000).toISOString(),
    })
    .eq("id", id);
}

async function uploadAndStart(
  apiKey: string,
  csv: string,
): Promise<{ ok: boolean; fileId?: string; error?: string; code?: number }> {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "saveleads_verification.csv");
  form.append("column", "1");
  form.append("firstrow", "1");

  const uploadResponse = await fetch("https://api.veriphone.io/v3/file/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const uploadPayload = await uploadResponse.json().catch(() => null);
  if (!uploadResponse.ok || uploadPayload?.result !== "success") {
    return {
      ok: false,
      code: uploadResponse.status,
      error: String(uploadPayload?.message || uploadPayload?.type || `Upload HTTP ${uploadResponse.status}`),
    };
  }

  const fileId = String(uploadPayload?.id || "");
  if (!fileId) {
    return { ok: false, error: "Veriphone não retornou o ID do arquivo." };
  }

  const verifyResponse = await fetch(
    `https://api.veriphone.io/v3/file/verify?id=${encodeURIComponent(fileId)}&mode=static`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  const verifyPayload = await verifyResponse.json().catch(() => null);
  if (!verifyResponse.ok || verifyPayload?.status !== "success") {
    return {
      ok: false,
      code: verifyResponse.status,
      error: String(verifyPayload?.message || verifyPayload?.type || `Verify HTTP ${verifyResponse.status}`),
    };
  }

  return { ok: true, fileId };
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

  const requestedIds = Array.from(
    new Set(
      (Array.isArray(body?.leadIds) ? body.leadIds : [])
        .map((id: unknown) => String(id || "").trim())
        .filter(Boolean),
    ),
  );

  if (requestedIds.length === 0) {
    return json(200, { success: true, nothingToVerify: true, accepted: 0, acceptedLeadIds: [] });
  }

  if (requestedIds.length > 1000) {
    return json(400, {
      success: false,
      error: "Máximo de 1.000 leads por lote. O site divide automaticamente os selecionados.",
    });
  }

  const admin = createClient(supabaseUrl, serviceRole);

  const { data: rows, error: leadsError } = await admin
    .from("leads")
    .select("id, whatsapp_numero, telefone_original, phone_lookup_status, phone_lookup_provider")
    .in("id", requestedIds)
    .eq("user_id", user.id);

  if (leadsError) {
    return json(500, { success: false, error: `Erro ao carregar leads: ${leadsError.message}` });
  }

  const byId = new Map((rows || []).map((lead: any) => [String(lead.id), lead]));
  const eligible = requestedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .filter((lead: any) => {
      const phone = normalizePhone(lead.whatsapp_numero || lead.telefone_original);
      if (!phone) return false;
      return !(lead.phone_lookup_status === "verified" && lead.phone_lookup_provider === "veriphone");
    });

  if (eligible.length === 0) {
    return json(200, {
      success: true,
      nothingToVerify: true,
      accepted: 0,
      acceptedLeadIds: [],
      skippedAlreadyVerified: requestedIds.length,
      notice: "Todos os números deste lote já foram verificados pelo Veriphone ou não possuem telefone válido.",
    });
  }

  const { data: keyRows, error: keyError } = await admin
    .from("api_keys")
    .select("id,key_value,label,priority,last_used_at")
    .eq("user_id", user.id)
    .eq("provider", "veriphone")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (keyError) {
    return json(500, { success: false, error: `Erro ao carregar chaves Veriphone: ${keyError.message}` });
  }

  const seen = new Set<string>();
  const candidates: Array<{ id: string; key: string; label: string; available: number }> = [];

  for (const row of keyRows || []) {
    const key = normalizeKey(row.key_value);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const credits = await getCredits(key);
    if (!credits.ok) {
      await markKeyUnavailable(admin, row.id, credits.error || "Falha ao consultar créditos", 1);
      continue;
    }

    if (credits.available <= 0) {
      await markKeyUnavailable(admin, row.id, "Insufficient credits", 12);
      continue;
    }

    // If credits were replenished, immediately return the key to rotation.
    await admin
      .from("api_keys")
      .update({ disabled_until: null, last_error: null })
      .eq("id", row.id);

    candidates.push({
      id: row.id,
      key,
      label: row.label || "Veriphone",
      available: credits.available,
    });
  }

  candidates.sort((a, b) => b.available - a.available);

  if (candidates.length === 0) {
    return json(200, {
      success: false,
      code: "NO_VERIPHONE_CREDITS",
      error: "Nenhuma chave Veriphone possui créditos disponíveis agora.",
      remaining: eligible.length,
    });
  }

  let lastError = "Nenhuma chave conseguiu iniciar o lote.";

  for (const candidate of candidates) {
    const take = Math.min(1000, eligible.length, candidate.available);
    if (take <= 0) continue;

    const batch = eligible.slice(0, take);
    const csvLines = ["lead_id,phone"];
    for (const lead of batch as any[]) {
      const phone = normalizePhone(lead.whatsapp_numero || lead.telefone_original);
      csvLines.push(`${csvEscape(String(lead.id))},${csvEscape(phone)}`);
    }
    const csv = csvLines.join("\n");

    const started = await uploadAndStart(candidate.key, csv);
    if (!started.ok || !started.fileId) {
      lastError = started.error || "Falha ao iniciar lote Veriphone";
      const hours = started.code === 401 ? 24 : started.code === 402 ? 12 : 1;
      await markKeyUnavailable(admin, candidate.id, lastError, hours);
      continue;
    }

    const leadIds = batch.map((lead: any) => String(lead.id));

    const { data: job, error: jobError } = await admin
      .from("phone_verification_jobs")
      .insert({
        user_id: user.id,
        api_key_id: candidate.id,
        external_file_id: started.fileId,
        status: "verifying",
        total: leadIds.length,
        processed: 0,
        lead_ids: leadIds,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return json(500, {
        success: false,
        error: `Lote iniciado no Veriphone, mas não foi possível registrar o job: ${jobError?.message || "erro desconhecido"}`,
      });
    }

    await admin
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_error: null,
        disabled_until: null,
      })
      .eq("id", candidate.id);

    return json(200, {
      success: true,
      jobId: job.id,
      accepted: leadIds.length,
      acceptedLeadIds: leadIds,
      provider: "veriphone_bulk",
      keyLabel: candidate.label,
      creditsBefore: candidate.available,
      requested: requestedIds.length,
      skippedAlreadyVerified: requestedIds.length - eligible.length,
      remainingFromRequest: Math.max(0, eligible.length - leadIds.length),
    });
  }

  return json(200, {
    success: false,
    code: "VERIPHONE_START_FAILED",
    error: lastError,
    remaining: eligible.length,
  });
});
