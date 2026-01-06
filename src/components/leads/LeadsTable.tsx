import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Send,
  Phone,
  Globe,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Lead {
  id: string;
  company: string;
  phone: string;
  website: string;
  status: "extracted" | "pending" | "error";
}

interface LeadsTableProps {
  leads: Lead[];
  onExport: (selectedIds: string[]) => void;
  onSendToCampaign: (selectedIds: string[]) => void;
}

const statusConfig = {
  extracted: {
    label: "Extraído",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/20",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-warning/10 text-warning border-warning/20",
  },
  error: {
    label: "Erro",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function LeadsTable({ leads, onExport, onSendToCampaign }: LeadsTableProps) {
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const toggleAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => l.id));
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-card rounded-xl shadow-card border border-border animate-slide-up">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Leads Extraídos
          </h3>
          <p className="text-sm text-muted-foreground">
            {leads.length} leads encontrados •{" "}
            {selectedLeads.length} selecionados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport(selectedLeads)}
            disabled={selectedLeads.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            variant="whatsapp"
            size="sm"
            onClick={() => onSendToCampaign(selectedLeads)}
            disabled={selectedLeads.length === 0}
          >
            <Send className="h-4 w-4" />
            Enviar para Campanha
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.length === leads.length && leads.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-10 w-10 opacity-30" />
                    <p>Nenhum lead extraído ainda</p>
                    <p className="text-sm">
                      Use o formulário acima para buscar leads
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead, index) => {
                const status = statusConfig[lead.status];
                const StatusIcon = status.icon;
                return (
                  <TableRow
                    key={lead.id}
                    className={cn(
                      "transition-colors",
                      selectedLeads.includes(lead.id) && "bg-muted/50"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleLead(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.company}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {lead.phone}
                      </code>
                    </TableCell>
                    <TableCell>
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        {lead.website.replace(/^https?:\/\//, "")}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("gap-1", status.className)}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
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
