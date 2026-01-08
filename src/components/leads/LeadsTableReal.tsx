import { useState } from 'react';
import { Download, Send, Phone, Globe, Star, MapPin, Loader2, Trash2, Copy, Check, FileSpreadsheet } from 'lucide-react';
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
import { Lead } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

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
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  const exportPhonesToXLSX = () => {
    const leadsToExport = leads.filter(l => selectedLeads.has(l.id) && l.whatsapp_numero);
    if (leadsToExport.length === 0) {
      toast.error('Nenhum lead com telefone válido selecionado');
      return;
    }

    // Extrair somente números
    const phoneData = leadsToExport.map(l => ({
      'Telefone': l.whatsapp_numero ? `+${l.whatsapp_numero}` : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(phoneData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Telefones');
    
    XLSX.writeFile(workbook, `telefones_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${leadsToExport.length} números exportados!`);
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

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-8 shadow-card border border-border flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Leads Extraídos</h3>
          <p className="text-sm text-muted-foreground">
            {leads.length} leads • {selectedLeads.size} selecionados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
            Exportar Telefones (XLSX)
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
          <Button 
            size="sm" 
            className="bg-whatsapp hover:bg-whatsapp/90"
            disabled={selectedLeads.size === 0}
          >
            <Send className="h-4 w-4" />
            Enviar para Campanha
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={leads.length > 0 && selectedLeads.size === leads.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Nenhum lead encontrado. Inicie uma extração acima.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const status = statusConfig[lead.status || 'extraido'];
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
                        <span className="flex items-center gap-1 text-whatsapp font-medium">
                          <Phone className="h-3 w-3" />
                          +{lead.whatsapp_numero}
                        </span>
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
