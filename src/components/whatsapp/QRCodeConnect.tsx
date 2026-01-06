import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Smartphone, CheckCircle2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface QRCodeConnectProps {
  isConnected: boolean;
  onConnect: () => void;
}

export function QRCodeConnect({ isConnected, onConnect }: QRCodeConnectProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      onConnect();
    }, 2000);
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-lg",
              isConnected ? "bg-success/10" : "bg-whatsapp/10"
            )}
          >
            <Smartphone
              className={cn(
                "h-5 w-5",
                isConnected ? "text-success" : "text-whatsapp"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Conexão WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              {isConnected
                ? "Dispositivo conectado e pronto"
                : "Escaneie o QR Code para conectar"}
            </p>
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2 text-success">
            <Wifi className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">Online</span>
          </div>
        )}
      </div>

      {isConnected ? (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">WhatsApp Conectado!</p>
            <p className="text-sm text-muted-foreground">
              Seu dispositivo está pronto para disparos
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Reconectar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Simulated QR Code */}
          <div className="relative">
            <div className="w-48 h-48 bg-white rounded-xl p-3 shadow-inner border">
              <div className="w-full h-full bg-gradient-to-br from-navy to-navy-light rounded-lg flex items-center justify-center">
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-6 h-6 rounded-sm",
                        Math.random() > 0.5 ? "bg-white" : "bg-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            {isRefreshing && (
              <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-whatsapp animate-spin" />
              </div>
            )}
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              1. Abra o WhatsApp no seu celular
            </p>
            <p className="text-sm text-muted-foreground">
              2. Vá em Configurações → Aparelhos conectados
            </p>
            <p className="text-sm text-muted-foreground">
              3. Escaneie este QR Code
            </p>
          </div>
          <Button
            variant="whatsapp"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Gerando novo código...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar QR Code
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
