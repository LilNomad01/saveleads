import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeads, Lead } from "@/hooks/useLeads";
import { formatWhatsAppLink, detectPhoneType } from "@/lib/phoneUtils";
import { toast } from "sonner";
import {
  Send,
  Play,
  Pause,
  Square,
  Clock,
  MessageCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Users,
  Timer,
  RotateCcw,
  Shuffle,
  Phone,
  ChevronRight,
} from "lucide-react";

interface DispatchLog {
  id: string;
  time: string;
  empresa: string;
  numero: string;
  status: "enviado" | "falha" | "pulado";
  mensagem?: string;
}

type DispatchStatus = "idle" | "running" | "paused" | "completed" | "stopped";

export default function AutoDispatch() {
  const { leads, markMessageSent } = useLeads();

  // Campaign config
  const [campaignName, setCampaignName] = useState("Campanha WhatsApp");
  const [messageTemplates, setMessageTemplates] = useState<string[]>([
    "Olá {empresa}! Tudo bem? Gostaria de apresentar nossos serviços para vocês. Podemos conversar?",
  ]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(40);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [skipSent, setSkipSent] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Dispatch state
  const [status, setStatus] = useState<DispatchStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [stats, setStats] = useState({ sent: 0, failed: 0, skipped: 0 });

  const dispatchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<DispatchStatus>("idle");
  const indexRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  // Get eligible leads (mobile only, with WhatsApp number)
  const eligibleLeads = useMemo(() => {
    let filtered = leads.filter((l) => {
      const phoneType = detectPhoneType(l.whatsapp_numero || l.telefone_original);
      return l.whatsapp_numero && phoneType === "mobile";
    });

    if (skipSent) {
      filtered = filtered.filter((l) => !l.mensagem_enviada);
    }

    if (filterCategory && filterCategory !== "all") {
      filtered = filtered.filter((l) => l.categoria === filterCategory);
    }

    if (randomizeOrder) {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    }

    return filtered;
  }, [leads, skipSent, filterCategory, randomizeOrder]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(leads.map((l) => l.categoria).filter(Boolean));
    return Array.from(cats) as string[];
  }, [leads]);

  // Build message from template
  const buildMessage = useCallback(
    (lead: Lead) => {
      const template =
        messageTemplates.length > 1
          ? messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
          : messageTemplates[0];

      return template
        .replace(/{empresa}/g, lead.nome_empresa)
        .replace(/{categoria}/g, lead.categoria || "")
        .replace(/{endereco}/g, lead.endereco || "")
        .replace(/{telefone}/g, lead.whatsapp_numero || "");
    },
    [messageTemplates]
  );

  // Random delay between min and max
  const getDelay = useCallback(() => {
    return (Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin) * 1000;
  }, [delayMin, delayMax]);

  // Core dispatch function
  const dispatchNext = useCallback(async () => {
    if (statusRef.current !== "running") return;
    const idx = indexRef.current;

    if (idx >= eligibleLeads.length) {
      setStatus("completed");
      toast.success("Disparo concluído! Todas as mensagens foram processadas.");
      return;
    }

    const lead = eligibleLeads[idx];
    const phone = lead.whatsapp_numero!;
    const message = buildMessage(lead);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    try {
      // Open WhatsApp link
      window.open(whatsappUrl, "_blank");

      // Mark as sent in DB
      await markMessageSent(lead.id);

      const log: DispatchLog = {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString("pt-BR"),
        empresa: lead.nome_empresa,
        numero: phone,
        status: "enviado",
      };

      setLogs((prev) => [log, ...prev]);
      setStats((prev) => ({ ...prev, sent: prev.sent + 1 }));
    } catch {
      const log: DispatchLog = {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString("pt-BR"),
        empresa: lead.nome_empresa,
        numero: phone,
        status: "falha",
        mensagem: "Erro ao abrir WhatsApp",
      };
      setLogs((prev) => [log, ...prev]);
      setStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
    }

    const nextIdx = idx + 1;
    setCurrentIndex(nextIdx);
    indexRef.current = nextIdx;

    if (nextIdx < eligibleLeads.length && statusRef.current === "running") {
      const delay = getDelay();
      const delaySec = Math.ceil(delay / 1000);
      setCountdown(delaySec);

      // Countdown timer
      let remaining = delaySec;
      countdownRef.current = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      }, 1000);

      dispatchRef.current = setTimeout(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setCountdown(0);
        dispatchNext();
      }, delay);
    } else if (nextIdx >= eligibleLeads.length) {
      setStatus("completed");
      toast.success("Disparo concluído!");
    }
  }, [eligibleLeads, buildMessage, getDelay, markMessageSent]);

  // Controls
  const handleStart = () => {
    if (eligibleLeads.length === 0) {
      toast.error("Nenhum lead elegível para disparo.");
      return;
    }
    if (messageTemplates[0].trim() === "") {
      toast.error("Configure pelo menos uma mensagem.");
      return;
    }

    setStatus("running");
    setLogs([]);
    setCurrentIndex(0);
    indexRef.current = 0;
    setStats({ sent: 0, failed: 0, skipped: 0 });
    toast.info("Disparo iniciado!");

    // Small delay to let state update
    setTimeout(() => {
      statusRef.current = "running";
      dispatchNext();
    }, 500);
  };

  const handlePause = () => {
    setStatus("paused");
    if (dispatchRef.current) clearTimeout(dispatchRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    toast.warning("Disparo pausado.");
  };

  const handleResume = () => {
    setStatus("running");
    statusRef.current = "running";
    toast.info("Disparo retomado!");
    setTimeout(() => dispatchNext(), 1000);
  };

  const handleStop = () => {
    setStatus("stopped");
    if (dispatchRef.current) clearTimeout(dispatchRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    toast.error("Disparo interrompido.");
  };

  const handleReset = () => {
    setStatus("idle");
    setCurrentIndex(0);
    indexRef.current = 0;
    setLogs([]);
    setStats({ sent: 0, failed: 0, skipped: 0 });
    setCountdown(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dispatchRef.current) clearTimeout(dispatchRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const addTemplate = () => {
    setMessageTemplates((prev) => [...prev, ""]);
    setActiveTemplateIndex(messageTemplates.length);
  };

  const removeTemplate = (index: number) => {
    if (messageTemplates.length <= 1) return;
    setMessageTemplates((prev) => prev.filter((_, i) => i !== index));
    setActiveTemplateIndex(0);
  };

  const updateTemplate = (index: number, value: string) => {
    setMessageTemplates((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const progress =
    eligibleLeads.length > 0
      ? Math.round((currentIndex / eligibleLeads.length) * 100)
      : 0;

  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isIdle = status === "idle";
  const isFinished = status === "completed" || status === "stopped";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" />
              Disparo Automático
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Envie mensagens em massa via WhatsApp Web com intervalo automático
            </p>
          </div>
          {isRunning && (
            <Badge
              variant="outline"
              className="animate-pulse bg-accent/10 text-accent border-accent self-start sm:self-auto"
            >
              <span className="mr-2 h-2 w-2 rounded-full bg-accent animate-ping" />
              Disparando...
            </Badge>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Fila</span>
              </div>
              <p className="text-2xl font-bold">{eligibleLeads.length}</p>
              <p className="text-xs text-muted-foreground">leads elegíveis</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Enviados</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">nesta sessão</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground">Falhas</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">com erro</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium text-muted-foreground">Próximo</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {countdown > 0 ? `${countdown}s` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">intervalo</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        {!isIdle && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Progresso: {currentIndex} / {eligibleLeads.length}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              {isRunning && currentIndex < eligibleLeads.length && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Próximo: {eligibleLeads[currentIndex]?.nome_empresa}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Config */}
          <div className="space-y-6">
            {/* Message Templates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-accent" />
                  Mensagens
                </CardTitle>
                <CardDescription>
                  Use variáveis: <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{empresa}"}</code>{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{categoria}"}</code>{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{endereco}"}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {messageTemplates.map((template, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Mensagem {i + 1}
                        {messageTemplates.length > 1 && " (aleatória)"}
                      </Label>
                      {messageTemplates.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive"
                          onClick={() => removeTemplate(i)}
                          disabled={!isIdle}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={template}
                      onChange={(e) => updateTemplate(i, e.target.value)}
                      placeholder="Digite sua mensagem..."
                      rows={3}
                      disabled={!isIdle}
                      className="text-sm"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTemplate}
                  disabled={!isIdle || messageTemplates.length >= 5}
                  className="w-full"
                >
                  + Adicionar variação de mensagem
                </Button>
              </CardContent>
            </Card>

            {/* Delay & Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-accent" />
                  Configurações de Envio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Delay Range */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Intervalo entre mensagens</Label>
                    <Badge variant="secondary" className="font-mono">
                      {delayMin}s – {delayMax}s
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Mínimo (seg)</Label>
                      <Slider
                        value={[delayMin]}
                        onValueChange={(v) => setDelayMin(Math.min(v[0], delayMax - 1))}
                        min={5}
                        max={120}
                        step={5}
                        disabled={!isIdle}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Máximo (seg)</Label>
                      <Slider
                        value={[delayMax]}
                        onValueChange={(v) => setDelayMax(Math.max(v[0], delayMin + 1))}
                        min={10}
                        max={180}
                        step={5}
                        disabled={!isIdle}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Intervalos maiores reduzem risco de bloqueio pelo WhatsApp
                  </p>
                </div>

                <Separator />

                {/* Filter Category */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filtrar por categoria</Label>
                  <Select
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                    disabled={!isIdle}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Pular já enviados</Label>
                      <p className="text-xs text-muted-foreground">
                        Ignora leads que já receberam mensagem
                      </p>
                    </div>
                    <Switch
                      checked={skipSent}
                      onCheckedChange={setSkipSent}
                      disabled={!isIdle}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Ordem aleatória</Label>
                      <p className="text-xs text-muted-foreground">
                        Embaralha a ordem dos leads
                      </p>
                    </div>
                    <Switch
                      checked={randomizeOrder}
                      onCheckedChange={setRandomizeOrder}
                      disabled={!isIdle}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Controls & Logs */}
          <div className="space-y-6">
            {/* Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-5 w-5 text-accent" />
                  Controles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Campaign Name */}
                <div className="space-y-1">
                  <Label className="text-sm">Nome da campanha</Label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    disabled={!isIdle}
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {isIdle && (
                    <Button
                      onClick={handleStart}
                      className="col-span-2 bg-green-600 hover:bg-green-700 text-white h-12 text-base"
                      disabled={eligibleLeads.length === 0}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Iniciar Disparo ({eligibleLeads.length} leads)
                    </Button>
                  )}

                  {isRunning && (
                    <>
                      <Button
                        onClick={handlePause}
                        variant="outline"
                        className="h-12 text-base border-orange-500 text-orange-600 hover:bg-orange-50"
                      >
                        <Pause className="h-5 w-5 mr-2" />
                        Pausar
                      </Button>
                      <Button
                        onClick={handleStop}
                        variant="outline"
                        className="h-12 text-base border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Parar
                      </Button>
                    </>
                  )}

                  {isPaused && (
                    <>
                      <Button
                        onClick={handleResume}
                        className="h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Retomar
                      </Button>
                      <Button
                        onClick={handleStop}
                        variant="outline"
                        className="h-12 text-base border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Parar
                      </Button>
                    </>
                  )}

                  {isFinished && (
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="col-span-2 h-12 text-base"
                    >
                      <RotateCcw className="h-5 w-5 mr-2" />
                      Nova Campanha
                    </Button>
                  )}
                </div>

                {/* Summary when finished */}
                {isFinished && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-sm font-semibold">
                      {status === "completed" ? "✅ Disparo concluído!" : "⏹ Disparo interrompido"}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-green-600">{stats.sent}</p>
                        <p className="text-xs text-muted-foreground">Enviados</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{stats.failed}</p>
                        <p className="text-xs text-muted-foreground">Falhas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-600">{stats.skipped}</p>
                        <p className="text-xs text-muted-foreground">Pulados</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dispatch Logs */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-5 w-5 text-accent" />
                    Log de Envio
                  </CardTitle>
                  {logs.length > 0 && (
                    <Badge variant="secondary">{logs.length} registros</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Send className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">Nenhum envio realizado ainda</p>
                      <p className="text-xs mt-1">Inicie o disparo para ver os logs aqui</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 animate-fadeIn"
                        >
                          {log.status === "enviado" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          ) : log.status === "falha" ? (
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{log.empresa}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {log.numero}
                            </p>
                            {log.mensagem && (
                              <p className="text-xs text-red-500 mt-0.5">{log.mensagem}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {log.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
