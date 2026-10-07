import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, CircleAlert, Download, FileSpreadsheet, Loader2, Pause,
  Play, RotateCcw, ShieldCheck, Smartphone, Upload, Wifi,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "pending" | "mobile" | "fixed_line" | "voip" | "unknown" | "invalid" | "duplicate" | "error";
type Contact = {
  id: number;
  name: string;
  phone: string;
  status: Status;
  valid: boolean | null;
  carrier: string;
  country: string;
  e164: string;
  note: string;
};
type Verification = {
  id: number;
  valid: boolean;
  type: string;
  carrier: string;
  country: string;
  e164: string;
};

function parseCsv(input: string): string[][] {
  const firstLine = (input.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "");
  const separators = [",", ";", "\t"];
  const separator = separators.sort(
    (a, b) => firstLine.split(b).length - firstLine.split(a).length,
  )[0];
  const lines: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === separator && !quoted) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      row.push(field);
      if (row.some(value => value.trim())) lines.push(row);
      row = [];
      field = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(value => value.trim())) lines.push(row);
  }
  return lines;
}

function cleanHeader(raw: string): string {
  return raw.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function normalizeUsPhone(value: string): { phone: string; reason: string } {
  const digits = value.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(us)) {
    return { phone: "", reason: "Número dos EUA inválido ou fora do padrão NANP" };
  }
  if (/^(800|833|844|855|866|877|888)/.test(us)) {
    return { phone: "", reason: "Número toll-free removido pela regra geral" };
  }
  return { phone: "+1" + us, reason: "" };
}

function classify(type: string, valid: boolean): Status {
  if (!valid) return "invalid";
  if (type === "mobile") return "mobile";
  if (type === "fixed_line" || type === "landline") return "fixed_line";
  if (type.includes("voip")) return "voip";
  return "unknown";
}

function escapeCsv(value: string, protectFormula = false): string {
  let cleaned = String(value ?? "");
  if (protectFormula && /^[\s]*[=+\-@\t\r]/.test(cleaned)) cleaned = "'" + cleaned;
  return '"' + cleaned.replace(/"/g, '""') + '"';
}

function saveCsv(filename: string, headers: string[], body: string[][]): void {
  const text = "\uFEFF" + [headers, ...body].map(
    row => row.map((value, index) => escapeCsv(value, index === 0)).join(","),
  ).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function callVerifier(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("verify-csv-veriphone", { body });
  if (error) throw new Error(data?.error || error.message || "Erro ao acessar o verificador");
  if (!data?.success) throw new Error(data?.error || "Não foi possível verificar os números");
  return data;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export default function CsvVerification() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<Contact[]>([]);
  const rowsRef = useRef<Contact[]>([]);
  const [running, setRunning] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const pauseRef = useRef(false);
  const runningRef = useRef(false);
  const [jobText, setJobText] = useState("");
  const [providerProgress, setProviderProgress] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "mobile" | "other">("all");
  const [busyImport, setBusyImport] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const counts = useMemo(() => rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {} as Record<Status, number>), [rows]);
  const total = rows.length;
  const pending = counts.pending || 0;
  const done = total - pending;
  const mobile = counts.mobile || 0;
  const invalid = (counts.invalid || 0) + (counts.duplicate || 0);
  const fixed = counts.fixed_line || 0;
  const voip = counts.voip || 0;
  const unknown = (counts.unknown || 0) + (counts.error || 0);
  const preview = rows.filter(row => (
    filter === "all" || (filter === "mobile" ? row.status === "mobile" : row.status !== "mobile")
  )).slice(0, 100);

  const updateRows = (next: Contact[]) => {
    rowsRef.current = next;
    setRows(next);
  };

  const importCsv = async (file?: File) => {
    if (!file || runningRef.current) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Selecione um arquivo CSV.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("O CSV deve ter no máximo 20 MB.");
      return;
    }
    setBusyImport(true);
    try {
      const text = await file.text();
      const matrix = parseCsv(text);
      if (!matrix.length) throw new Error("O arquivo está vazio.");
      if (matrix.length > 200001) throw new Error("Limite de 200 mil contatos por importação.");
      const first = matrix[0].map(cleanHeader);
      const find = (candidates: string[]) => first.findIndex(value => candidates.includes(value));
      const phones = ["phone", "phonenumber", "telefone", "numero", "number", "mobile", "celular", "whatsapp", "whatsappnumero", "telephone"];
      const names = ["name", "nome", "company", "companyname", "businessname", "empresa", "razaosocial"];
      const colPhone = find(phones);
      const colName = find(names);
      const hasHeader = colPhone >= 0;
      const phoneIndex = hasHeader ? colPhone : matrix[0].length >= 2 ? 1 : 0;
      const nameIndex = colName >= 0 ? colName : matrix[0].length >= 2 ? 0 : -1;
      const data = hasHeader ? matrix.slice(1) : matrix;
      const seen = new Set<string>();
      const parsed = data.map((cells, index): Contact => {
        const raw = String(cells[phoneIndex] ?? "").trim();
        const name = nameIndex >= 0 ? String(cells[nameIndex] ?? "").trim() : "";
        const normalized = normalizeUsPhone(raw);
        let status: Status = "pending";
        let note = "";
        if (!normalized.phone) {
          status = "invalid";
          note = normalized.reason || "Sem telefone";
        } else if (seen.has(normalized.phone)) {
          status = "duplicate";
          note = "Telefone duplicado dentro do arquivo";
        } else {
          seen.add(normalized.phone);
        }
        return {
          id: index, name, phone: normalized.phone || raw,
          status, valid: null, carrier: "", country: "", e164: normalized.phone, note,
        };
      });
      updateRows(parsed);
      setFilename(file.name);
      setProviderProgress(0);
      setJobText("");
      setFilter("all");
      toast.success(String(parsed.length) + " registros carregados e preparados para verificação.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar o CSV");
    } finally {
      setBusyImport(false);
    }
  };

  const refreshCredits = async () => {
    try {
      const response = await callVerifier({ action: "credits" });
      setCredits(response.available);
      toast.info(String(response.available) + " créditos disponíveis em " + String(response.keys) + " chave(s).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao consultar créditos");
    }
  };

  const verify = async () => {
    if (runningRef.current || !rowsRef.current.some(row => row.status === "pending")) return;
    runningRef.current = true;
    pauseRef.current = false;
    setPauseRequested(false);
    setRunning(true);
    setProviderProgress(0);
    try {
      while (!pauseRef.current) {
        const candidates = rowsRef.current.filter(row => row.status === "pending").slice(0, 1000);
        if (!candidates.length) break;
        setJobText("Enviando lote de " + candidates.length + " telefones à Veriphone...");
        const started = await callVerifier({
          action: "start",
          rows: candidates.map(row => ({ id: row.id, name: row.name, phone: row.phone })),
        });
        if (!started.accepted) throw new Error("Nenhum telefone foi aceito pela Veriphone.");
        setJobText("Verificando " + started.accepted + " contatos (" + started.keyLabel + ")...");
        let completed = false;
        for (let attempt = 0; attempt < 1200; attempt++) {
          const progress = await callVerifier({
            action: "status", fileId: started.fileId, keyId: started.keyId,
          });
          setProviderProgress(Math.min(100, Math.round(
            100 * (Number(progress.processed || 0) / Math.max(1, Number(started.accepted))),
          )));
          if (progress.status === "completed") {
            completed = true;
            break;
          }
          if (progress.status === "deleted" || progress.status === "error") {
            throw new Error("A Veriphone interrompeu o lote: " + progress.status);
          }
          await wait(3000);
        }
        if (!completed) throw new Error("Tempo de verificação excedido. Tente continuar mais tarde.");
        setJobText("Baixando resultados do lote...");
        const download = await callVerifier({
          action: "download", fileId: started.fileId, keyId: started.keyId,
        });
        const results = new Map<number, Verification>(
          (download.results as Verification[]).map(item => [item.id, item]),
        );
        const acceptedIds = new Set<number>(candidates.slice(0, Number(started.accepted)).map(item => item.id));
        updateRows(rowsRef.current.map(row => {
          if (!acceptedIds.has(row.id)) return row;
          const result = results.get(row.id);
          if (!result) {
            return { ...row, status: "error", note: "Resultado ausente no retorno do provedor" };
          }
          const status = classify(result.type, result.valid);
          return {
            ...row, status, valid: result.valid,
            carrier: result.carrier || "", country: result.country || "",
            e164: result.e164 || row.phone,
            note: status === "mobile" ? "Linha móvel (não comprova entrega de SMS)" :
              status === "unknown" ? "Tipo de linha não identificado" : "",
          };
        }));
        setProviderProgress(0);
      }
      const left = rowsRef.current.filter(row => row.status === "pending").length;
      setJobText(left ? "Pausado com " + left + " contatos pendentes." : "Verificação concluída.");
      if (left) toast.info("Processamento pausado. Clique em Continuar para os próximos lotes.");
      else toast.success("Verificação finalizada! Os CSVs estão disponíveis para download.");
    } catch (error) {
      setJobText("Interrompido: " + (error instanceof Error ? error.message : "erro inesperado"));
      toast.error(error instanceof Error ? error.message : "Erro ao verificar CSV");
    } finally {
      runningRef.current = false;
      setRunning(false);
      setPauseRequested(false);
      pauseRef.current = false;
    }
  };

  const downloadAll = () => {
    saveCsv("saveleads_verificacao_completa.csv",
      ["name", "phone", "phone_valid", "phone_type", "carrier", "country", "e164", "status", "observacao"],
      rows.map(row => [
        row.name, row.phone, row.valid === null ? "" : String(row.valid),
        row.status, row.carrier, row.country, row.e164, row.status, row.note,
      ]),
    );
  };

  const downloadMobile = () => {
    saveCsv("saveleads_somente_mobile.csv", ["name", "phone"], rows
      .filter(row => row.status === "mobile" && row.valid)
      .map(row => [row.name, row.e164 || row.phone]));
  };

  if (loading) return (
    <DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" /></div></DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ShieldCheck className="h-6 w-6 text-primary" /> Verificação de telefones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importe seu CSV, consulte o tipo de linha na Veriphone e baixe os números móveis separados.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-5 w-5" /> Importar lista</CardTitle>
            <CardDescription>CSV com colunas <strong>name, phone</strong> (ou nome/telefone). Formato americano +1 ou DDD + número.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".csv,text/csv" aria-label="Selecionar CSV"
              disabled={running || busyImport}
              onChange={event => { void importCsv(event.target.files?.[0]); event.target.value = ""; }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{filename ? <><FileSpreadsheet className="mr-1 inline h-4 w-4" /> {filename}</> : "Nenhum arquivo selecionado."}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => { void refreshCredits(); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Consultar créditos
              </Button>
            </div>
            {credits !== null && (
              <p className="text-xs text-muted-foreground">{credits.toLocaleString("pt-BR")} créditos Veriphone disponíveis na última consulta.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Importados", total, FileSpreadsheet],
            ["Móveis", mobile, Smartphone],
            ["Fixos", fixed, Wifi],
            ["VoIP", voip, Wifi],
            ["Inválidos / repetidos", invalid, CircleAlert],
            ["Desconhecidos / erro", unknown, CircleAlert],
          ].map(([label, count, Icon]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{String(label)}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{Number(count).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">Processamento em lotes</p>
                <p className="text-xs text-muted-foreground">
                  {done.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} analisados • {pending.toLocaleString("pt-BR")} pendentes
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {running ? (
                  <Button variant="outline" disabled={pauseRequested} onClick={() => { pauseRef.current = true; setPauseRequested(true); }}>
                    <Pause className="mr-2 h-4 w-4" /> {pauseRequested ? "Pausando após lote..." : "Pausar"}
                  </Button>
                ) : (
                  <Button onClick={() => { void verify(); }} disabled={!pending || busyImport}>
                    <Play className="mr-2 h-4 w-4" /> {done && pending ? "Continuar" : "Iniciar verificação"}
                  </Button>
                )}
              </div>
            </div>
            <Progress value={total ? done / total * 100 : 0} className="h-2" />
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>{jobText || "Os números só consomem créditos quando você iniciar a verificação."}</span>
              <span>{total ? Math.floor(done / total * 100) : 0}%</span>
            </div>
            {running && providerProgress > 0 && (
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Lote atual: {providerProgress}%</p><Progress value={providerProgress} className="h-1" /></div>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" disabled={!rows.length} onClick={downloadAll}>
                <Download className="mr-2 h-4 w-4" /> Baixar resultado completo
              </Button>
              <Button variant="secondary" disabled={!mobile} onClick={downloadMobile}>
                <Download className="mr-2 h-4 w-4" /> Baixar somente móveis ({mobile.toLocaleString("pt-BR")})
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A Veriphone identifica o tipo cadastrado da linha, mas não confirma entrega de SMS nem consentimento para mensagens.
              Mantenha esta aba aberta enquanto os lotes estão sendo processados.
            </p>
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-base">Prévia dos contatos</CardTitle>
                <CardDescription>Até 100 registros exibidos. Os downloads incluem todos.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todos</Button>
                <Button size="sm" variant={filter === "mobile" ? "default" : "outline"} onClick={() => setFilter("mobile")}>Móveis</Button>
                <Button size="sm" variant={filter === "other" ? "default" : "outline"} onClick={() => setFilter("other")}>Demais</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Empresa</th><th className="px-2 py-2 font-medium">Telefone</th>
                  <th className="px-2 py-2 font-medium">Tipo</th><th className="px-2 py-2 font-medium">Operadora</th>
                </tr></thead>
                <tbody>
                  {preview.map(row => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="max-w-[240px] truncate px-2 py-2">{row.name || "Sem nome"}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{row.phone}</td>
                      <td className="px-2 py-2">
                        <Badge variant={row.status === "mobile" ? "default" : "outline"}>
                          {row.status === "mobile" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
                          {({
                            pending: "Pendente", mobile: "Mobile", fixed_line: "Fixo", voip: "VoIP",
                            unknown: "Desconhecido", invalid: "Inválido", duplicate: "Repetido", error: "Erro",
                          } as Record<Status, string>)[row.status]}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{row.carrier || row.note || "—"}</td>
                    </tr>
                  ))}
                  {!preview.length && <tr><td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">Nenhum contato neste filtro.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
