import { useState } from 'react';
import { Trash2, Loader2, ExternalLink, Briefcase, MapPin, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LinkedinLead } from '@/hooks/useLinkedinLeads';
import { toast } from 'sonner';

interface LinkedinLeadsTableProps {
  leads: LinkedinLead[];
  isLoading: boolean;
  onDelete?: (ids: string[]) => Promise<boolean>;
}

export function LinkedinLeadsTable({ leads, isLoading, onDelete }: LinkedinLeadsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleAll = () => {
    setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)));
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    const ok = await onDelete(Array.from(selected));
    if (ok) { setSelected(new Set()); toast.success('Leads deletados!'); }
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
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Leads LinkedIn
          </h3>
          <p className="text-sm text-muted-foreground">{leads.length} resultados • {selected.size} selecionados</p>
        </div>
        {selected.size > 0 && onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-1" />Excluir ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir leads?</AlertDialogTitle>
                <AlertDialogDescription>{selected.size} lead(s) serão excluídos permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {leads.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Nenhum lead do LinkedIn encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === leads.length && leads.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Conexões</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map(lead => (
                <TableRow key={lead.id} className={selected.has(lead.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{lead.nome}</TableCell>
                  <TableCell>{lead.cargo || '—'}</TableCell>
                  <TableCell>{lead.empresa || '—'}</TableCell>
                  <TableCell>
                    {lead.setor ? <Badge variant="outline">{lead.setor}</Badge> : '—'}
                  </TableCell>
                  <TableCell>
                    {lead.localizacao ? (
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />{lead.localizacao}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>{lead.conexoes?.toLocaleString() || '—'}</TableCell>
                  <TableCell className="text-sm">{lead.email || '—'}</TableCell>
                  <TableCell>
                    {lead.perfil_url ? (
                      <a href={lead.perfil_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> Perfil
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(lead.data_extracao).toLocaleDateString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
