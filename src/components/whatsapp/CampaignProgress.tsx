import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Play, Pause, StopCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignProgressProps {
  isRunning: boolean;
  isPaused: boolean;
  progress: number;
  totalLeads: number;
  sentCount: number;
  errorCount: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function CampaignProgress({
  isRunning,
  isPaused,
  progress,
  totalLeads,
  sentCount,
  errorCount,
  onStart,
  onPause,
  onStop,
}: CampaignProgressProps) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Controle da Campanha</h3>
          <p className="text-sm text-muted-foreground">
            {isRunning
              ? isPaused
                ? "Campanha pausada"
                : "Campanha em andamento..."
              : "Pronto para iniciar"}
          </p>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button variant="whatsapp" onClick={onStart}>
              <Play className="h-4 w-4" />
              Iniciar Campanha
            </Button>
          ) : (
            <>
              <Button
                variant={isPaused ? "whatsapp" : "outline"}
                onClick={onPause}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    Continuar
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pausar
                  </>
                )}
              </Button>
              <Button variant="destructive" onClick={onStop}>
                <StopCircle className="h-4 w-4" />
                Parar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-3" />
        
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
            <p className="text-xs text-muted-foreground">Total de Leads</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/10">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-2xl font-bold text-success">{sentCount}</p>
            </div>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-2xl font-bold text-destructive">{errorCount}</p>
            </div>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>
      </div>
    </div>
  );
}
