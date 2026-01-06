import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { QRCodeConnect } from "@/components/whatsapp/QRCodeConnect";
import { MessageConfigurator } from "@/components/whatsapp/MessageConfigurator";
import { CampaignProgress } from "@/components/whatsapp/CampaignProgress";
import { StatCard } from "@/components/ui/stat-card";
import { MessageCircle, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MessageBlock {
  id: string;
  content: string;
  delay: number;
  image?: string;
}

export default function WhatsAppManager() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MessageBlock[]>([
    {
      id: "msg-1",
      content: "Olá {{empresa}}! 👋\n\nVim através do seu perfil e gostaria de apresentar uma oportunidade incrível para o seu negócio.",
      delay: 5,
    },
    {
      id: "msg-2",
      content: "Trabalhamos com soluções que podem aumentar suas vendas em até 40%.\n\nPosso te contar mais?",
      delay: 10,
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const totalLeads = 150;

  const handleConnect = () => {
    setIsConnected(true);
    toast.success("WhatsApp conectado com sucesso!");
  };

  const handleStart = () => {
    if (!isConnected) {
      toast.error("Conecte seu WhatsApp primeiro!");
      return;
    }
    if (messages.length === 0 || !messages.some((m) => m.content)) {
      toast.error("Configure pelo menos uma mensagem!");
      return;
    }
    setIsRunning(true);
    setIsPaused(false);
    simulateCampaign();
    toast.success("Campanha iniciada!");
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    toast.info(isPaused ? "Campanha retomada" : "Campanha pausada");
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    toast.warning("Campanha interrompida");
  };

  const simulateCampaign = () => {
    let currentProgress = 0;
    let sent = 0;
    let errors = 0;

    const interval = setInterval(() => {
      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsRunning(false);
        toast.success("Campanha finalizada!");
        return;
      }

      currentProgress += Math.random() * 5;
      sent += Math.floor(Math.random() * 3);
      if (Math.random() > 0.9) errors += 1;

      setProgress(Math.min(currentProgress, 100));
      setSentCount(sent);
      setErrorCount(errors);
    }, 1000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Gerenciador de Disparos
          </h1>
          <p className="text-muted-foreground">
            Configure e dispare campanhas via WhatsApp
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Leads na Fila"
            value={totalLeads}
            description="aguardando disparo"
            icon={MessageCircle}
            variant="navy"
          />
          <StatCard
            title="Mensagens Enviadas"
            value={sentCount}
            description="nesta campanha"
            icon={Send}
            variant="accent"
          />
          <StatCard
            title="Taxa de Sucesso"
            value={sentCount > 0 ? `${Math.round((sentCount / (sentCount + errorCount)) * 100)}%` : "0%"}
            description="mensagens entregues"
            icon={CheckCircle2}
          />
          <StatCard
            title="Erros"
            value={errorCount}
            description="falhas de envio"
            icon={AlertCircle}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* QR Code Connect */}
          <div className="lg:col-span-1">
            <QRCodeConnect isConnected={isConnected} onConnect={handleConnect} />
          </div>

          {/* Campaign Progress */}
          <div className="lg:col-span-2">
            <CampaignProgress
              isRunning={isRunning}
              isPaused={isPaused}
              progress={progress}
              totalLeads={totalLeads}
              sentCount={sentCount}
              errorCount={errorCount}
              onStart={handleStart}
              onPause={handlePause}
              onStop={handleStop}
            />
          </div>
        </div>

        {/* Message Configurator */}
        <MessageConfigurator
          messages={messages}
          onMessagesChange={setMessages}
        />
      </div>
    </DashboardLayout>
  );
}
