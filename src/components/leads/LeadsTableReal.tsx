import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Phone, Globe, Star, MapPin, Loader2, Trash2, Copy, Check, FileSpreadsheet, Smartphone, MessageCircle, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Lead } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { detectPhoneType, getPhoneTypeLabel, formatWhatsAppLink, isWhatsAppCompatible } from '@/lib/phoneUtils';
import { LeadFilters, LeadFiltersState, defaultFilters } from './LeadFilters';

interface LeadsTableRealProps {
  leads: Lead[];
  isLoading: boolean;
  onDelete?: (leadIds: string[]) => Promise<boolean>;
  onExtractPhones?: (leadIds: string[]) => string[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  extraido: { label: 'Extraído', variant: 'secondary' },
  validado: { label: 'Validado', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'outline' },
  entregue: { label: 'Entregue', variant: 'default' },
  falhou: { label: 'Falhou', variant: 'destructive' },
};

export function LeadsTableReal({ leads, isLoading, onDelete, onExtractPhones }: LeadsTableRealProps) {
  const navigate = useNavigate();
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filters, setFilters] = useState<LeadFiltersState>(defaultFilters);

  // Get unique status options
  const statusOptions = useMemo(() => {
    const statuses = new Set(leads.map(l => l.status || 'extraido'));
    return Array.from(statuses);
  }, [leads]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          lead.nome_empresa.toLowerCase().includes(searchLower) ||
          (lead.whatsapp_numero && lead.whatsapp_numero.includes(filters.search)) ||
          (lead.endereco && lead.endereco.toLowerCase().includes(searchLower)) ||
          (lead.categoria && lead.categoria.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Phone type filter
      if (filters.phoneType !== 'all') {
        const phoneType = detectPhoneType(lead.whatsapp_numero);
        if (filters.phoneType === 'mobile' && phoneType !== 'mobile') return false;
        if (filters.phoneType === 'landline' && phoneType !== 'landline') return false;
        if (filters.phoneType === 'none' && lead.whatsapp_numero) return false;
      }

      // Status filter
      if (filters.status !== 'all' && (lead.status || 'extraido') !== filters.status) return false;

      // Rating filter
      if (filters.minRating !== null && (!lead.avaliacao || lead.avaliacao < filters.minRating)) return false;

      // Website filter
      if (filters.hasWebsite === 'yes' && !lead.site) return false;
      if (filters.hasWebsite === 'no' && lead.site) return false;

      return true;
    });
  }, [leads, filters]);

  // Stats for filtered results
  const stats = useMemo(() => {
    const mobileCount = filteredLeads.filter(l => isWhatsAppCompatible(l.whatsapp_numero)).length;
    const landlineCount = filteredLeads.filter(l => detectPhoneType(l.whatsapp_numero) === 'landline').length;
    return { total: filteredLeads.length, mobile: mobileCount, landline: landlineCount };
  }, [filteredLeads]);

  const toggleLead = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const toggleAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const selectAllMobile = () => {
    const mobileLeads = filteredLeads.filter(l => isWhatsAppCompatible(l.whatsapp_numero));
    setSelectedLeads(new Set(mobileLeads.map(l => l.id)));
    toast.success(`${mobileLeads.length} leads móveis selecionados!`);
  };

  const exportPhonesToXLSX = () => {
    const leadsToExport = filteredLeads.filter(l => selectedLeads.has(l.id) && l.whatsapp_numero);
    if (leadsToExport.length === 0) {
      toast.error('Nenhum lead com telefone válido selecionado');
      return;
    }

    const phoneData = leadsToExport.map(l => {
      const isMobile = isWhatsAppCompatible(l.whatsapp_numero);
      return {
        'Empresa': l.nome_empresa,
        'Telefone': l.whatsapp_numero ? `+${l.whatsapp_numero}` : '',
        'Tipo': isMobile ? 'Móvel' : 'Fixo',
        'WhatsApp Link': isMobile ? `https://wa.me/${l.whatsapp_numero}` : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(phoneData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Telefones');
    
    XLSX.writeFile(workbook, `telefones_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${leadsToExport.length} números exportados com links wa.me!`);
  };

  const exportMobileOnly = () => {
    const mobileLeads = filteredLeads.filter(l => isWhatsAppCompatible(l.whatsapp_numero));
    if (mobileLeads.length === 0) {
      toast.error('Nenhum telefone móvel encontrado');
      return;
    }

    const phoneData = mobileLeads.map(l => ({
      'Empresa': l.nome_empresa,
      'Telefone': `+${l.whatsapp_numero}`,
      'WhatsApp Link': `https://wa.me/${l.whatsapp_numero}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(phoneData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WhatsApp');
    
    XLSX.writeFile(workbook, `whatsapp_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${mobileLeads.length} números WhatsApp exportados!`);
  };

  const handleExtractPhones = () => {
    if (!onExtractPhones) return;
    
    const phones = onExtractPhones(Array.from(selectedLeads));
    if (phones.length === 0) {
      toast.error('Nenhum telefone válido encontrado nos leads selecionados');
      return;
    }

    const phoneList = phones.join('\n');
    navigator.clipboard.writeText(phoneList);
    setCopied(true);
    toast.success(`${phones.length} números copiados para a área de transferência!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    const success = await onDelete(Array.from(selectedLeads));
    if (success) {
      setSelectedLeads(new Set());
    }
    setIsDeleting(false);
  };

  const openWhatsApp = (phoneNumber: string) => {
    const link = formatWhatsAppLink(phoneNumber);
    if (link) {
      window.open(link, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-8 shadow-card border border-border flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-border">
        <LeadFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          statusOptions={statusOptions}
        />
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {stats.total} leads encontrados
        </span>
        <Badge variant="outline" className="gap-1">
          <Smartphone className="h-3 w-3 text-green-500" />
          {stats.mobile} móveis
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Phone className="h-3 w-3 text-blue-500" />
          {stats.landline} fixos
        </Badge>
      </div>

      {/* Actions Bar */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Leads Extraídos</h3>
          <p className="text-sm text-muted-foreground">
            {selectedLeads.size} selecionados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={selectAllMobile}
          >
            <Smartphone className="h-4 w-4" />
            Selecionar Móveis
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExtractPhones}
            disabled={selectedLeads.size === 0}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar Telefones'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportPhonesToXLSX}
            disabled={selectedLeads.size === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Selecionados
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportMobileOnly}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar XLSX
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => navigate('/whatsapp-export')}
            className="bg-green-600 hover:bg-green-700"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir WhatsApp
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={selectedLeads.size === 0 || isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedLeads.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir leads selecionados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. {selectedLeads.size} lead(s) serão excluídos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {leads.length === 0 
                    ? 'Nenhum lead encontrado. Inicie uma extração acima.'
                    : 'Nenhum lead corresponde aos filtros aplicados.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => {
                const status = statusConfig[lead.status || 'extraido'];
                const phoneType = detectPhoneType(lead.whatsapp_numero);
                const isMobile = phoneType === 'mobile';
                
                return (
                  <TableRow 
                    key={lead.id}
                    className={cn(selectedLeads.has(lead.id) && 'bg-muted/50')}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={() => toggleLead(lead.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{lead.nome_empresa}</span>
                        {lead.endereco && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {lead.endereco}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.whatsapp_numero ? (
                        <span className={cn(
                          "flex items-center gap-1 font-medium",
                          isMobile ? "text-green-600" : "text-blue-600"
                        )}>
                          {isMobile ? <Smartphone className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                          +{lead.whatsapp_numero}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.whatsapp_numero ? (
                        <Badge variant={isMobile ? 'default' : 'secondary'} className={cn(
                          isMobile && "bg-green-600 hover:bg-green-700"
                        )}>
                          {getPhoneTypeLabel(phoneType)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.site ? (
                        <a 
                          href={`https://${lead.site}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Globe className="h-3 w-3" />
                          {lead.site}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.avaliacao ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {lead.avaliacao}
                          {lead.total_avaliacoes && (
                            <span className="text-xs text-muted-foreground">
                              ({lead.total_avaliacoes})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {isMobile && lead.whatsapp_numero ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => openWhatsApp(lead.whatsapp_numero!)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Enviar mensagem via WhatsApp
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
