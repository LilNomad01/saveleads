import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { QRCodeConnect } from "@/components/whatsapp/QRCodeConnect";
import { MessageConfigurator } from "@/components/whatsapp/MessageConfigurator";
import { CampaignProgress } from "@/components/whatsapp/CampaignProgress";
import { StatCard } from "@/components/ui/stat-card";
import { MessageCircle, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLeads } from "@/hooks/useLeads";
import { useCampaigns, MessageBlock } from "@/hooks/useCampaigns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function WhatsAppManager() {
  const { leads, isLoading: leadsLoading, updateLeadStatus } = useLeads();
  const { campaigns, createCampaign, updateCampaign, updateCampaignStats } = useCampaigns();
  
  const [isConnected, setIsConnected] = useState(false);
  const [campaignName, setCampaignName] = useState("");
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
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(40);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);

  // Leads com WhatsApp válido
  const validLeads = leads.filter(l => l.whatsapp_numero && l.status !== 'enviado' && l.status !== 'entregue');
  const totalLeads = validLeads.length;

  const handleConnect = () => {
    setIsConnected(true);
    toast.success("WhatsApp conectado com sucesso!");
  };

  const handleStart = async () => {
    if (!isConnected) {
      toast.error("Conecte seu WhatsApp primeiro!");
      return;
    }
    if (messages.length === 0 || !messages.some((m) => m.content)) {
      toast.error("Configure pelo menos uma mensagem!");
      return;
    }
    if (totalLeads === 0) {
      toast.error("Nenhum lead disponível para envio!");
      return;
    }

    // Criar campanha no banco
    const name = campaignName || `Campanha ${new Date().toLocaleDateString('pt-BR')}`;
    const campaign = await createCampaign(name, messages, delayMin, delayMax);
    
    if (campaign) {
      setCurrentCampaignId(campaign.id);
      setIsRunning(true);
      setIsPaused(false);
      setProgress(0);
      setSentCount(0);
      setDeliveredCount(0);
      setErrorCount(0);
      
      await updateCampaign(campaign.id, { status: 'em_andamento' });
      simulateCampaign(campaign.id);
      toast.success("Campanha iniciada!");
    }
  };

  const handlePause = async () => {
    setIsPaused(!isPaused);
    if (currentCampaignId) {
      await updateCampaign(currentCampaignId, { 
        status: isPaused ? 'em_andamento' : 'pausada' 
      });
    }
    toast.info(isPaused ? "Campanha retomada" : "Campanha pausada");
  };

  const handleStop = async () => {
    setIsRunning(false);
    setIsPaused(false);
    if (currentCampaignId) {
      await updateCampaign(currentCampaignId, { status: 'cancelada' });
      await updateCampaignStats(currentCampaignId, sentCount, deliveredCount, errorCount);
    }
    toast.warning("Campanha interrompida");
  };

  const simulateCampaign = (campaignId: string) => {
    let currentProgress = 0;
    let sent = 0;
    let delivered = 0;
    let errors = 0;
    const leadsToProcess = [...validLeads];
    let processedLeads: string[] = [];

    const interval = setInterval(async () => {
      if (currentProgress >= 100 || sent >= totalLeads) {
        clearInterval(interval);
        setIsRunning(false);
        
        // Atualizar status dos leads processados
        if (processedLeads.length > 0) {
          await updateLeadStatus(processedLeads, 'enviado');
        }
        
        await updateCampaign(campaignId, { status: 'concluida' });
        await updateCampaignStats(campaignId, sent, delivered, errors);
        toast.success("Campanha finalizada!");
        return;
      }

      // Simular envio
      const increment = Math.min(Math.floor(Math.random() * 3) + 1, totalLeads - sent);
      for (let i = 0; i < increment && sent + i < leadsToProcess.length; i++) {
        processedLeads.push(leadsToProcess[sent + i].id);
      }
      
      sent += increment;
      
      // 90% chance de entrega
      if (Math.random() > 0.1) {
        delivered += increment;
      } else {
        errors += 1;
        delivered += increment - 1;
      }

      currentProgress = (sent / totalLeads) * 100;

      setProgress(Math.min(currentProgress, 100));
      setSentCount(sent);
      setDeliveredCount(delivered);
      setErrorCount(errors);
    }, (delayMin + Math.random() * (delayMax - delayMin)) * 100); // Scaled down for demo
  };

  if (leadsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

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
            value={sentCount > 0 ? `${Math.round((deliveredCount / sentCount) * 100)}%` : "0%"}
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
          <div className="lg:col-span-1 space-y-4">
            <QRCodeConnect isConnected={isConnected} onConnect={handleConnect} />
            
            {/* Campaign Config */}
            <div className="bg-card rounded-xl p-4 shadow-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Configuração</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="campaignName">Nome da Campanha</Label>
                  <Input 
                    id="campaignName"
                    placeholder="Ex: Promoção Janeiro"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="delayMin">Delay Mín (seg)</Label>
                    <Input 
                      id="delayMin"
                      type="number"
                      min={5}
                      max={120}
                      value={delayMin}
                      onChange={(e) => setDelayMin(parseInt(e.target.value) || 15)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="delayMax">Delay Máx (seg)</Label>
                    <Input 
                      id="delayMax"
                      type="number"
                      min={10}
                      max={180}
                      value={delayMax}
                      onChange={(e) => setDelayMax(parseInt(e.target.value) || 40)}
                    />
                  </div>
                </div>
              </div>
            </div>
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
