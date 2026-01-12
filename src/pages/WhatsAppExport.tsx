import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads } from "@/hooks/useLeads";
import { detectPhoneType, formatWhatsAppLink } from "@/lib/phoneUtils";
import { MessageCircle, Search, Building2, MapPin, Star, ExternalLink, Phone, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

type MessageFilter = 'all' | 'sent' | 'pending';

const WhatsAppExport = () => {
  const navigate = useNavigate();
  const { leads, isLoading, markMessageSent } = useLeads();
  const [searchTerm, setSearchTerm] = useState("");
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');

  // Filter only mobile numbers (WhatsApp compatible)
  const mobileLeads = useMemo(() => {
    return leads.filter(lead => {
      const phoneType = detectPhoneType(lead.whatsapp_numero || lead.telefone_original);
      return phoneType === 'mobile';
    });
  }, [leads]);

  // Apply search and message filter
  const filteredLeads = useMemo(() => {
    let result = mobileLeads;
    
    // Message status filter
    if (messageFilter === 'sent') {
      result = result.filter(lead => lead.mensagem_enviada);
    } else if (messageFilter === 'pending') {
      result = result.filter(lead => !lead.mensagem_enviada);
    }
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead => 
        lead.nome_empresa.toLowerCase().includes(term) ||
        lead.categoria?.toLowerCase().includes(term) ||
        lead.endereco?.toLowerCase().includes(term) ||
        lead.whatsapp_numero?.includes(term) ||
        lead.telefone_original?.includes(term)
      );
    }
    
    return result;
  }, [mobileLeads, searchTerm, messageFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: mobileLeads.length,
    sent: mobileLeads.filter(l => l.mensagem_enviada).length,
    pending: mobileLeads.filter(l => !l.mensagem_enviada).length,
  }), [mobileLeads]);

  const handleWhatsAppClick = async (leadId: string, phoneNumber: string) => {
    const link = formatWhatsAppLink(phoneNumber);
    if (link) {
      // Mark as sent
      await markMessageSent(leadId);
      toast.success('Mensagem marcada como enviada!');
      // Open WhatsApp
      window.open(link, '_blank');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">Exportar WhatsApp</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Clique nos botões para enviar mensagem via WhatsApp
            </p>
          </div>
        </div>

        {/* Stats Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg shrink-0">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">Números Móveis Disponíveis</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {filteredLeads.length} de {stats.total} números WhatsApp
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2 self-start sm:self-auto">
                <Badge variant="outline" className="gap-1 px-2 sm:px-3 py-1 text-xs sm:text-sm">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {stats.sent} enviadas
                </Badge>
                <Badge variant="outline" className="gap-1 px-2 sm:px-3 py-1 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 text-orange-500" />
                  {stats.pending} pendentes
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa, categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={messageFilter} onValueChange={(v) => setMessageFilter(v as MessageFilter)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="sent">Mensagem Enviada</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum número móvel encontrado</h3>
              <p className="text-muted-foreground text-center mt-2">
                {searchTerm 
                  ? "Tente ajustar sua busca" 
                  : "Extraia leads com números de celular para visualizá-los aqui"}
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Leads Grid */
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLeads.map((lead) => {
              const phone = lead.whatsapp_numero || lead.telefone_original;
              const isSent = lead.mensagem_enviada;
              
              return (
                <Card key={lead.id} className={`hover:shadow-md transition-shadow ${isSent ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Status Badge */}
                    {isSent && (
                      <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Mensagem Enviada
                      </Badge>
                    )}

                    {/* Company Name */}
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate" title={lead.nome_empresa}>
                          {lead.nome_empresa}
                        </h3>
                        {lead.categoria && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {lead.categoria}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    {lead.endereco && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{lead.endereco}</span>
                      </div>
                    )}

                    {/* Rating */}
                    {lead.avaliacao && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span>{lead.avaliacao}</span>
                        {lead.total_avaliacoes && (
                          <span className="text-muted-foreground">
                            ({lead.total_avaliacoes} avaliações)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Phone Display */}
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{phone}</span>
                    </div>

                    {/* WhatsApp Button */}
                    <Button
                      onClick={() => handleWhatsAppClick(lead.id, phone!)}
                      className={isSent 
                        ? "w-full bg-green-700 hover:bg-green-800 text-white" 
                        : "w-full bg-green-600 hover:bg-green-700 text-white"
                      }
                    >
                      {isSent ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Enviar Novamente
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Enviar Mensagem
                        </>
                      )}
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>

                    {/* Sent timestamp */}
                    {isSent && lead.data_mensagem_enviada && (
                      <p className="text-xs text-muted-foreground text-center">
                        Enviada em {new Date(lead.data_mensagem_enviada).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppExport;
