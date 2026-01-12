import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Map, 
  MessageCircle, 
  BarChart3, 
  CheckCircle2, 
  ArrowRight,
  Phone,
  Users,
  Clock,
  Shield,
  Sparkles,
  ChevronRight
} from "lucide-react";

const features = [
  {
    icon: Map,
    title: "Extração do Google Maps",
    description: "Extraia leads reais diretamente do Google Maps com informações completas: nome, telefone, endereço e avaliações."
  },
  {
    icon: Phone,
    title: "Detecção de WhatsApp",
    description: "Identifica automaticamente números móveis compatíveis com WhatsApp para suas campanhas de outreach."
  },
  {
    icon: MessageCircle,
    title: "Envio em Massa",
    description: "Interface otimizada para enviar mensagens via WhatsApp Web de forma rápida e organizada."
  },
  {
    icon: BarChart3,
    title: "Analytics Completo",
    description: "Dashboard com métricas em tempo real: leads extraídos, mensagens enviadas e taxa de conversão."
  },
  {
    icon: Shield,
    title: "Dados Seguros",
    description: "Seus leads ficam armazenados de forma segura na nuvem, acessíveis de qualquer dispositivo."
  },
  {
    icon: Sparkles,
    title: "Filtros Inteligentes",
    description: "Filtre leads por avaliação, tipo de telefone, categoria e status para campanhas mais eficientes."
  }
];

const steps = [
  {
    number: "01",
    title: "Busque no Google Maps",
    description: "Digite o tipo de negócio e a localização. Ex: 'Pizzaria em São Paulo'"
  },
  {
    number: "02",
    title: "Extraia os Leads",
    description: "Nossa IA extrai automaticamente todos os dados das empresas encontradas"
  },
  {
    number: "03",
    title: "Filtre por WhatsApp",
    description: "Identifique os leads com números móveis prontos para receber mensagens"
  },
  {
    number: "04",
    title: "Envie Mensagens",
    description: "Use nossa interface para enviar mensagens personalizadas via WhatsApp"
  }
];

const stats = [
  { value: "50K+", label: "Leads Extraídos" },
  { value: "98%", label: "Precisão dos Dados" },
  { value: "10x", label: "Mais Rápido" },
  { value: "24/7", label: "Disponibilidade" }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">LeadFlow</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Recursos
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Como Funciona
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm">Entrar</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="hidden sm:flex">
                  Começar Grátis
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Automatize sua prospecção B2B
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            Extraia leads do{" "}
            <span className="text-primary">Google Maps</span>
            {" "}e envie via{" "}
            <span className="text-accent">WhatsApp</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Ferramenta completa para prospecção B2B. Extraia empresas, filtre por WhatsApp e 
            dispare mensagens em massa de forma organizada e eficiente.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                Começar Gratuitamente
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                Ver Como Funciona
              </Button>
            </a>
          </div>
          
          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Sem cartão de crédito
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Setup em 2 minutos
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Suporte em português
            </span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Recursos</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa para prospectar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas para automatizar sua prospecção e aumentar suas vendas B2B.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Como Funciona</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              4 passos simples para começar
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Do zero à primeira mensagem enviada em menos de 5 minutos.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-5xl font-bold text-primary/20 mb-4">{step.number}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-8 -right-4 h-6 w-6 text-muted-foreground/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Preços</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Comece grátis, escale conforme cresce
            </h2>
            <p className="text-lg text-muted-foreground">
              Teste todas as funcionalidades sem compromisso.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <div className="p-8 rounded-2xl border border-border bg-card">
              <h3 className="text-xl font-semibold mb-2">Gratuito</h3>
              <p className="text-muted-foreground mb-6">Para começar a prospectar</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">R$ 0</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  50 extrações/mês
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Filtros básicos
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Exportação CSV
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Dashboard básico
                </li>
              </ul>
              <Link to="/auth">
                <Button variant="outline" className="w-full">Começar Grátis</Button>
              </Link>
            </div>
            
            {/* Pro Plan */}
            <div className="p-8 rounded-2xl border-2 border-primary bg-card relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Mais Popular</Badge>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">Para prospecção profissional</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">R$ 97</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Extrações ilimitadas
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Todos os filtros avançados
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Exportação Excel + WhatsApp
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Analytics completo
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Suporte prioritário
                </li>
              </ul>
              <Link to="/auth">
                <Button className="w-full">Assinar Pro</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Pronto para acelerar suas vendas?
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Junte-se a milhares de profissionais que já usam LeadFlow para prospectar clientes B2B.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-base px-8">
              Criar Conta Grátis
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">LeadFlow</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Termos</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">Contato</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 LeadFlow. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
