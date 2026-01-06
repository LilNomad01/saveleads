import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  ImagePlus,
  MessageSquare,
  Variable,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBlock {
  id: string;
  content: string;
  delay: number;
  image?: string;
}

interface MessageConfiguratorProps {
  messages: MessageBlock[];
  onMessagesChange: (messages: MessageBlock[]) => void;
}

const variables = [
  { key: "{{empresa}}", label: "Nome da Empresa" },
  { key: "{{telefone}}", label: "Telefone" },
  { key: "{{cidade}}", label: "Cidade" },
];

export function MessageConfigurator({
  messages,
  onMessagesChange,
}: MessageConfiguratorProps) {
  const [activeMessage, setActiveMessage] = useState<string | null>(
    messages[0]?.id || null
  );

  const addMessage = () => {
    if (messages.length >= 5) return;
    const newMessage: MessageBlock = {
      id: `msg-${Date.now()}`,
      content: "",
      delay: 5,
    };
    onMessagesChange([...messages, newMessage]);
    setActiveMessage(newMessage.id);
  };

  const removeMessage = (id: string) => {
    const updated = messages.filter((m) => m.id !== id);
    onMessagesChange(updated);
    if (activeMessage === id) {
      setActiveMessage(updated[0]?.id || null);
    }
  };

  const updateMessage = (id: string, updates: Partial<MessageBlock>) => {
    onMessagesChange(
      messages.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const insertVariable = (variable: string) => {
    if (!activeMessage) return;
    const message = messages.find((m) => m.id === activeMessage);
    if (message) {
      updateMessage(activeMessage, {
        content: message.content + variable,
      });
    }
  };

  const activeMessageData = messages.find((m) => m.id === activeMessage);

  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-whatsapp/10">
              <MessageSquare className="h-5 w-5 text-whatsapp" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Mensagens da Campanha
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure até 5 mensagens sequenciais
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addMessage}
            disabled={messages.length >= 5}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Message List */}
        <div className="p-4 space-y-2">
          {messages.map((message, index) => (
            <button
              key={message.id}
              onClick={() => setActiveMessage(message.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                activeMessage === message.id
                  ? "bg-whatsapp/10 border border-whatsapp/30"
                  : "hover:bg-muted border border-transparent"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  Mensagem {index + 1}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {message.content || "Clique para editar..."}
                </p>
              </div>
              {messages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMessage(message.id);
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </button>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma mensagem configurada</p>
            </div>
          )}
        </div>

        {/* Message Editor */}
        <div className="md:col-span-2 p-4 space-y-4">
          {activeMessageData ? (
            <>
              <div className="space-y-2">
                <Label>Conteúdo da Mensagem</Label>
                <Textarea
                  placeholder="Digite sua mensagem aqui... Use {{empresa}} para personalização"
                  value={activeMessageData.content}
                  onChange={(e) =>
                    updateMessage(activeMessage!, { content: e.target.value })
                  }
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Label className="w-full text-sm flex items-center gap-2">
                  <Variable className="h-4 w-4" />
                  Variáveis Dinâmicas
                </Label>
                {variables.map((v) => (
                  <Button
                    key={v.key}
                    variant="secondary"
                    size="sm"
                    onClick={() => insertVariable(v.key)}
                    className="text-xs"
                  >
                    {v.key}
                    <span className="text-muted-foreground ml-1">
                      {v.label}
                    </span>
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delay">Delay (segundos)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min={1}
                    max={60}
                    value={activeMessageData.delay}
                    onChange={(e) =>
                      updateMessage(activeMessage!, {
                        delay: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mídia</Label>
                  <Button variant="outline" className="w-full">
                    <ImagePlus className="h-4 w-4" />
                    Adicionar Imagem
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Selecione uma mensagem para editar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
