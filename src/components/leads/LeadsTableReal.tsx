import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Phone, Globe, Star, MapPin, Loader2, Trash2, Copy, Check, FileSpreadsheet, Smartphone, MessageCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { detectPhoneType, formatWhatsAppLink, phoneTypeFromLookup, isVerifiedMobile, PhoneType } from '@/lib/phoneUtils';
import { LeadFilters, LeadFiltersState, defaultFilters } from './LeadFilters';

interface LeadsTableRealProps {
  leads: Lead[];
  allLeads?: Lead[];
  isLoading: boolean;
  onDelete?: (leadIds: string[]) => Promise<boolean>;
  onExtractPhones?: (leadIds: string[]) => string[];
  onVerifyPhones?: (leadIds: string[]) => Promise<boolean>;
  isVerifyingPhones?: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  extraido: { label: 'Extraído', variant: 'secondary' },
  validado: { label: 'Validado', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'outline' },
  entregue: { label: 'Entregue', variant: 'default' },
  falhou: { label: 'Falhou', variant: 'destructive' },
};

const hasRealWebsite = (site: string | null | undefined) => {
  if (!site?.trim()) return false;
  const normalized = site.trim().toLowerCase();

  // Versões antigas do extrator salvavam a URL da ficha do Google Maps
  // no campo de site. Isso não deve contar como website da empresa.
  return !(
    normalized.includes('google.com/maps') ||
    normalized.includes('maps.google.') ||
    normalized.includes('goo.gl/maps')
  );
};

const toWebsiteHref = (site: string) => {
  const trimmed = site.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getLeadPhoneType = (lead: Lead): PhoneType => {
  if (lead.phone_lookup_status === 'verified' || lead.phone_lookup_status === 'local') {
    return phoneTypeFromLookup(
      lead.phone_line_type,
      lead.phone_lookup_status,
      lead.phone_valid
    );
  }

  // Conservative fallback only classifies explicit Brazilian +55 numbers.
  return detectPhoneType(lead.whatsapp_numero);
};

const isLeadVerifiedMobile = (lead: Lead) => {
  if (
    isVerifiedMobile(
      lead.phone_line_type,
      lead.phone_lookup_status,
      lead.phone_valid
    )
  ) {
    return true;
  }

  // Keep existing Brazilian workflow working without guessing US numbers.
  return lead.phone_lookup_status !== 'verified' &&
    detectPhoneType(lead.whatsapp_numero) === 'mobile';
};

const isLeadActuallyUnverified = (lead: Lead) => {
  if (!lead.whatsapp_numero) return false;
  const status = String(lead.phone_lookup_status || 'unverified');
  return status === 'unverified' || status === 'error';
};

const isLeadLocalUncertain = (lead: Lead) => {
  return !!lead.whatsapp_numero &&
    lead.phone_lookup_status === 'local' &&
    getLeadPhoneType(lead) === 'unknown';
};

const getLeadPhoneTypeLabel = (lead: Lead) => {
  if (!lead.whatsapp_numero) return 'Sem telefone';
  if (lead.phone_lookup_status === 'error') return 'Erro no lookup';
  if (['verified', 'local'].includes(lead.phone_lookup_status) && lead.phone_valid === false) return 'Inválido';

  const type = getLeadPhoneType(lead);
  if (type === 'mobile') {
    if (lead.phone_lookup_status === 'verified' && lead.phone_lookup_provider === 'veriphone') {
      return 'Móvel (Veriphone)';
    }
    if (lead.phone_lookup_status === 'local') return 'Móvel (estimado)';
    return 'Móvel';
  }
  if (type === 'landline') return lead.phone_lookup_status === 'local' ? 'Fixo (estimado)' : 'Fixo';
  if (type === 'voip') return lead.phone_lookup_status === 'local' ? 'VoIP (estimado)' : 'VoIP';

  if (lead.phone_lookup_status === 'local') return 'Tipo incerto (local)';
  if (lead.phone_lookup_status === 'verified') return 'Tipo incerto';

  return 'Não verificado';
};

export function LeadsTableReal({ leads, allLeads, isLoading, onDelete, onExtractPhones, onVerifyPhones, isVerifyingPhones = false }: LeadsTableRealProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filters, setFilters] = useState<LeadFiltersState>(defaultFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 250;
  const globalLeads = allLeads ?? leads;

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

      // Phone type filter. US/international numbers are never guessed by length.
      // Veriphone can verify line type; libphonenumber is only a free local fallback.
      if (filters.phoneType !== 'all') {
        const phoneType = getLeadPhoneType(lead);
        if (filters.phoneType === 'mobile' && phoneType !== 'mobile') return false;
        if (filters.phoneType === 'landline' && phoneType !== 'landline') return false;
        if (filters.phoneType === 'voip' && phoneType !== 'voip') return false;
        if (filters.phoneType === 'unverified' && !isLeadActuallyUnverified(lead)) return false;
        if (filters.phoneType === 'uncertain' && !isLeadLocalUncertain(lead)) return false;
        if (filters.phoneType === 'none' && lead.whatsapp_numero) return false;
      }

      // Status filter
      if (filters.status !== 'all' && (lead.status || 'extraido') !== filters.status) return false;

      // Rating filter
      if (filters.minRating !== null && (!lead.avaliacao || lead.avaliacao < filters.minRating)) return false;

      // Website filter
      const hasWebsite = hasRealWebsite(lead.site);
      if (filters.hasWebsite === 'yes' && !hasWebsite) return false;
      if (filters.hasWebsite === 'no' && hasWebsite) return false;

      return true;
    });
  }, [leads, filters]);

  // Keep every loaded lead available in memory for filters/selection/export, but
  // render the table in pages so thousands of rows do not freeze the browser.
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / ROWS_PER_PAGE));
  const pageStart = (currentPage - 1) * ROWS_PER_PAGE;
  const pageEnd = Math.min(pageStart + ROWS_PER_PAGE, filteredLeads.length);
  const paginatedLeads = useMemo(
    () => filteredLeads.slice(pageStart, pageEnd),
    [filteredLeads, pageStart, pageEnd]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Stats for filtered results
  const stats = useMemo(() => {
    const mobileCount = filteredLeads.filter(isLeadVerifiedMobile).length;
    const landlineCount = filteredLeads.filter(l => getLeadPhoneType(l) === 'landline').length;
    const voipCount = filteredLeads.filter(l => getLeadPhoneType(l) === 'voip').length;
    const unverifiedCount = filteredLeads.filter(isLeadActuallyUnverified).length;
    const uncertainCount = filteredLeads.filter(isLeadLocalUncertain).length;
    return {
      total: filteredLeads.length,
      mobile: mobileCount,
      landline: landlineCount,
      voip: voipCount,
      unverified: unverifiedCount,
      uncertain: uncertainCount
    };
  }, [filteredLeads]);

  // Global stats are computed from every Google Maps lead loaded in the account,
  // regardless of the selected extraction/batch or the current table page.
  const globalStats = useMemo(() => {
    const mobile = globalLeads.filter(isLeadVerifiedMobile).length;
    const unverified = globalLeads.filter(isLeadActuallyUnverified).length;
    const uncertain = globalLeads.filter(isLeadLocalUncertain).length;

    return {
      total: globalLeads.length,
      mobile,
      unverified,
      uncertain,
    };
  }, [globalLeads]);

  const toggleLead = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const allFilteredSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) => selectedLeads.has(lead.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedLeads((current) => {
        const next = new Set(current);
        filteredLeads.forEach((lead) => next.delete(lead.id));
        return next;
      });
    } else {
      setSelectedLeads((current) => {
        const next = new Set(current);
        filteredLeads.forEach((lead) => next.add(lead.id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedLeads(new Set(filteredLeads.map((lead) => lead.id)));
    toast.success(`${filteredLeads.length} leads selecionados — todas as páginas.`);
  };

  const selectAllUnverified = () => {
    const unverified = globalLeads.filter(isLeadActuallyUnverified);
    setSelectedLeads(new Set(unverified.map((lead) => lead.id)));

    if (unverified.length === 0) {
      toast.info('Não há leads realmente não verificados. Os resultados locais/incertos ficam separados.');
      return;
    }

    toast.success(`${unverified.length} leads realmente não verificados selecionados — todos os lotes.`);
  };

  const selectAllMobile = () => {
    const mobileLeads = globalLeads.filter(isLeadVerifiedMobile);
    setSelectedLeads(new Set(mobileLeads.map(l => l.id)));

    if (mobileLeads.length === 0) {
      toast.info('Nenhum móvel verificado. Selecione os não verificados e clique em Verificar grátis primeiro.');
      return;
    }

    toast.success(`${mobileLeads.length} móveis selecionados — todos os lotes e páginas.`);
  };

  const selectWithoutWebsite = () => {
    // Seleciona SOMENTE empresas sem site real E com telefone movel/WhatsApp.
    // Exclui telefone fixo e empresas sem numero movel.
    const leadsWithoutWebsiteMobile = filteredLeads.filter(
      l => !hasRealWebsite(l.site) && isLeadVerifiedMobile(l)
    );

    setSelectedLeads(new Set(leadsWithoutWebsiteMobile.map(l => l.id)));

    if (leadsWithoutWebsiteMobile.length === 0) {
      toast.info('Nenhuma empresa sem site + móvel verificado encontrada nos resultados atuais.');
      return;
    }

    toast.success(`${leadsWithoutWebsiteMobile.length} empresas sem site + móvel verificado selecionadas!`);
  };

  const exportPhonesToXLSX = () => {
    const leadsToExport = globalLeads.filter(l => selectedLeads.has(l.id) && l.whatsapp_numero);
    if (leadsToExport.length === 0) {
      toast.error('Nenhum lead com telefone válido selecionado');
      return;
    }

    const phoneData = leadsToExport.map(l => {
      const mobile = isLeadVerifiedMobile(l);
      return {
        'Empresa': l.nome_empresa,
        'Telefone': l.whatsapp_numero ? `+${l.whatsapp_numero}` : '',
        'Cidade': l.cidade || '',
        'Endereço': l.endereco || '',
        'Categoria': l.categoria || '',
        'Tipo': getLeadPhoneTypeLabel(l),
        'Operadora': l.phone_carrier || '',
        'Fonte da verificação': l.phone_lookup_provider || '',
        'Verificado': l.phone_lookup_status === 'verified' ? 'Sim' : l.phone_lookup_status === 'local' ? 'Somente formato local' : 'Não',
        'WhatsApp Link': mobile ? `https://wa.me/${l.whatsapp_numero}` : '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(phoneData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Telefones');
    
    XLSX.writeFile(workbook, `telefones_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${leadsToExport.length} números exportados com status de verificação.`);
  };

  const exportMobileOnly = () => {
    const mobileLeads = globalLeads.filter(isLeadVerifiedMobile);
    if (mobileLeads.length === 0) {
      toast.error('Nenhum telefone móvel verificado. Faça o Lookup antes de exportar.');
      return;
    }

    const phoneData = mobileLeads.map(l => ({
      'Empresa': l.nome_empresa,
      'Telefone': `+${l.whatsapp_numero}`,
      'Cidade': l.cidade || '',
      'Endereço': l.endereco || '',
      'Categoria': l.categoria || '',
      'Operadora': l.phone_carrier || '',
      'Fonte da verificação': l.phone_lookup_provider || '',
      'Tipo': 'Móvel verificado',
    }));

    const worksheet = XLSX.utils.json_to_sheet(phoneData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Moveis verificados');
    
    XLSX.writeFile(workbook, `moveis_verificados_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${mobileLeads.length} números móveis exportados — todos os lotes!`);
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

  const handleVerifyPhones = async () => {
    if (!onVerifyPhones) return;

    const ids = Array.from(selectedLeads);
    if (ids.length === 0) {
      toast.error('Selecione pelo menos um lead para verificar.');
      return;
    }

    await onVerifyPhones(ids);
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
      <div className="p-3 sm:p-4 border-b border-border">
        <LeadFilters 
          filters={filters} 
          onFiltersChange={setFilters}
          statusOptions={statusOptions}
        />
      </div>

      {/* Stats Bar */}
      <div className="px-3 sm:px-4 py-2 bg-muted/30 border-b border-border flex items-center gap-2 sm:gap-4 text-xs sm:text-sm overflow-x-auto">
        <span className="text-muted-foreground whitespace-nowrap">
          {stats.total} leads
        </span>
        <Badge variant="outline" className="gap-1 shrink-0">
          <Smartphone className="h-3 w-3 text-green-500" />
          {stats.mobile} móveis
        </Badge>
        <Badge variant="outline" className="gap-1 shrink-0">
          <Phone className="h-3 w-3 text-blue-500" />
          {stats.landline} fixos
        </Badge>
        <Badge variant="outline" className="gap-1 shrink-0">
          <Phone className="h-3 w-3 text-amber-500" />
          {stats.voip} VoIP
        </Badge>
        <Badge variant="outline" className="gap-1 shrink-0">
          <ShieldCheck className="h-3 w-3 text-muted-foreground" />
          {stats.unverified} não verificados
        </Badge>
        <Badge variant="outline" className="gap-1 shrink-0">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {stats.uncertain} tipo incerto
        </Badge>
        {globalLeads.length !== leads.length && (
          <>
            <span className="mx-1 h-4 w-px bg-border shrink-0" />
            <Badge variant="secondary" className="gap-1 shrink-0">
              Geral: {globalStats.total} leads
            </Badge>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Smartphone className="h-3 w-3" />
              {globalStats.mobile} móveis em todos os lotes
            </Badge>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <ShieldCheck className="h-3 w-3" />
              {globalStats.unverified} realmente não verificados
            </Badge>
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Phone className="h-3 w-3" />
              {globalStats.uncertain} tipo incerto
            </Badge>
          </>
        )}
      </div>

      {/* Frontend pagination: all leads stay loaded; only 250 rows render at a time. */}
      {filteredLeads.length > 0 && (
        <div className="px-3 sm:px-4 py-2 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="text-muted-foreground">
            Mostrando {pageStart + 1}-{pageEnd} de {filteredLeads.length} leads carregados
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Anterior
            </Button>
            <span className="min-w-[110px] text-center text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="p-3 sm:p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Leads Extraídos</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {selectedLeads.size} selecionados
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isMobile ? (
              <>
                <Button
                  variant={allFilteredSelected ? "default" : "outline"}
                  size="sm"
                  onClick={selectAllFiltered}
                  disabled={filteredLeads.length === 0}
                  className="flex-1 text-xs"
                >
                  <Check className="h-3 w-3" />
                  Todos ({filteredLeads.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllUnverified}
                  disabled={globalStats.unverified === 0}
                  className="flex-1 text-xs"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Não verif. real ({globalStats.unverified})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllMobile}
                  className="flex-1 text-xs"
                >
                  <Smartphone className="h-3 w-3" />
                  Todos móveis ({globalStats.mobile})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectWithoutWebsite}
                  className="flex-1 text-xs"
                >
                  <Globe className="h-3 w-3" />
                  Sem site + Móvel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyPhones}
                  disabled={selectedLeads.size === 0 || isVerifyingPhones}
                  className="flex-1 text-xs"
                >
                  {isVerifyingPhones ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                  Verificar grátis
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      disabled={selectedLeads.size === 0 || isDeleting}
                      className="text-xs"
                    >
                      <Trash2 className="h-3 w-3" />
                      {selectedLeads.size > 0 && `(${selectedLeads.size})`}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir leads?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedLeads.size} lead(s) serão excluídos permanentemente.
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
              </>
            ) : (
              <>
                <Button
                  variant={allFilteredSelected ? "default" : "outline"}
                  size="sm"
                  onClick={selectAllFiltered}
                  disabled={filteredLeads.length === 0}
                >
                  <Check className="h-4 w-4" />
                  Selecionar Todos ({filteredLeads.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllUnverified}
                  disabled={globalStats.unverified === 0}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Não verificados reais ({globalStats.unverified})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllMobile}
                >
                  <Smartphone className="h-4 w-4" />
                  Selecionar Todos os Móveis ({globalStats.mobile})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectWithoutWebsite}
                >
                  <Globe className="h-4 w-4" />
                  Sem site + Móvel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyPhones}
                  disabled={selectedLeads.size === 0 || isVerifyingPhones}
                >
                  {isVerifyingPhones ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {isVerifyingPhones ? 'Verificando...' : 'Verificar grátis'}
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
                  Exportar Todos os Móveis ({globalStats.mobile})
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cards View */}
      {isMobile ? (
        <div className="p-3 space-y-3">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {leads.length === 0 
                ? 'Nenhum lead encontrado. Inicie uma extração.'
                : 'Nenhum lead corresponde aos filtros.'}
            </div>
          ) : (
            paginatedLeads.map((lead) => {
              const status = statusConfig[lead.status || 'extraido'];
              const phoneType = getLeadPhoneType(lead);
              const isMobilePhone = isLeadVerifiedMobile(lead);
              
              return (
                <div 
                  key={lead.id}
                  className={cn(
                    "p-3 rounded-lg border border-border bg-background",
                    selectedLeads.has(lead.id) && 'bg-muted/50 border-primary/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      checked={selectedLeads.has(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{lead.nome_empresa}</p>
                          {lead.endereco && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {lead.endereco}
                            </p>
                          )}
                        </div>
                        <Badge variant={status.variant} className="shrink-0 text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {lead.whatsapp_numero && (
                          <span className={cn(
                            "flex items-center gap-1 font-medium",
                            isMobilePhone ? "text-green-600" : "text-blue-600"
                          )}>
                            {isMobilePhone ? <Smartphone className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                            +{lead.whatsapp_numero}
                          </span>
                        )}
                        {lead.avaliacao && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {lead.avaliacao}
                          </span>
                        )}
                        {hasRealWebsite(lead.site) && lead.site && (
                          <a 
                            href={toWebsiteHref(lead.site)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            Site
                          </a>
                        )}
                      </div>
                      
                      {isMobilePhone && lead.whatsapp_numero && (
                        <Button
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-xs h-8"
                          onClick={() => openWhatsApp(lead.whatsapp_numero!)}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={allFilteredSelected}
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
              paginatedLeads.map((lead) => {
                const status = statusConfig[lead.status || 'extraido'];
                const phoneType = getLeadPhoneType(lead);
                const isMobile = isLeadVerifiedMobile(lead);
                
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
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={isMobile ? 'default' : 'secondary'}
                            className={cn(isMobile && "bg-green-600 hover:bg-green-700")}
                          >
                            {getLeadPhoneTypeLabel(lead)}
                          </Badge>
                          {(lead.phone_carrier || lead.phone_lookup_provider) && (
                            <span className="text-[11px] text-muted-foreground max-w-[170px] truncate">
                              {lead.phone_carrier || (lead.phone_lookup_provider === 'veriphone' ? 'Veriphone grátis' : 'libphonenumber local')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasRealWebsite(lead.site) && lead.site ? (
                        <a 
                          href={toWebsiteHref(lead.site)} 
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
      )}
    </div>
  );
}
