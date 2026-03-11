import { useState } from 'react';
import { Trash2, Loader2, Star, Globe, MapPin, MessageSquare } from 'lucide-react';
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
import { ReviewLead } from '@/hooks/useReviewsLeads';
import { toast } from 'sonner';

interface ReviewsLeadsTableProps {
  leads: ReviewLead[];
  isLoading: boolean;
  onDelete?: (ids: string[]) => Promise<boolean>;
}

export function ReviewsLeadsTable({ leads, isLoading, onDelete }: ReviewsLeadsTableProps) {
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
    if (ok) { setSelected(new Set()); toast.success('Reviews deletados!'); }
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
            <Star className="h-4 w-4 text-yellow-500" />
            Reviews Negativos
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
                <AlertDialogTitle>Excluir reviews?</AlertDialogTitle>
                <AlertDialogDescription>{selected.size} review(s) serão excluídos permanentemente.</AlertDialogDescription>
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
        <div className="p-8 text-center text-muted-foreground">Nenhum review negativo encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === leads.length && leads.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Rating Médio</TableHead>
                <TableHead>Total Reviews</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Data Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map(lead => (
                <TableRow key={lead.id} className={selected.has(lead.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{lead.empresa}</TableCell>
                  <TableCell>
                    {lead.rating !== null ? (
                      <Badge variant={lead.rating <= 2 ? 'destructive' : 'outline'} className="gap-1">
                        <Star className="h-3 w-3" />{lead.rating}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {lead.rating_medio !== null ? (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {lead.rating_medio}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>{lead.total_reviews?.toLocaleString() || '—'}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                    {lead.review ? (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        {lead.review}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{lead.autor || '—'}</TableCell>
                  <TableCell className="text-sm">{lead.telefone || '—'}</TableCell>
                  <TableCell>
                    {lead.website ? (
                      <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Site
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {lead.cidade ? (
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />{lead.cidade}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lead.data_review ? new Date(lead.data_review).toLocaleDateString('pt-BR') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
