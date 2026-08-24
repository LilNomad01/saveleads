# Lead Navigator Pro

Crie um SaaS de Automação de Marketing B2B com foco em prospecção via Google Maps e WhatsApp. A interface deve ser moderna, limpa (estilo Dashboard administrativa) e dividida em 3 módulos principais:

Módulo 1: Extrator de Leads (Google Maps)

Interface de busca com campos para 'Palavra-chave' (ex: Pizzaria) e 'Localização' (ex: São Paulo).

Tabela dinâmica para exibir os resultados em tempo real contendo: Nome da Empresa, Telefone, Site e Status de Extração.

Botão para 'Exportar para Excel' e botão 'Enviar para Campanha de Disparo'.

Nota técnica: Implemente a lógica de interface que simula a conexão com uma API de busca (como Google Places API ou um serviço de scraping como SerpApi/Outscraper).

Módulo 2: Gerenciador de Disparos (WhatsApp)

Área de conexão via QR Code (estilo WhatsApp Web).

Configurador de mensagens sequenciais: Permitir configurar até 5 blocos de mensagens diferentes.

Suporte para upload de imagem/mídia para acompanhar o disparo.

Opção de variáveis dinâmicas no texto, como 'Olá {{empresa}}'.

Botão 'Iniciar Campanha' com barra de progresso.

Módulo 3: Dashboard de Analytics

Cards de resumo no topo: 'Total de Leads Extraídos', 'Leads Qualificados', 'Mensagens Enviadas' e 'Taxa de Entrega'.

Gráfico de linha ou barras mostrando o desempenho das extrações e disparos por dia.

Lista de 'Atividade Recente' mostrando os últimos números contatados.

Design e UX:

Use uma paleta de cores profissional (Azul escuro, Branco e detalhes em Verde para o WhatsApp).

Use componentes do Shadcn/UI se possível.

O layout deve ser responsivo com uma barra lateral de navegação (Sidebar).

Garanta que a transição entre a extração de dados e a configuração do disparo seja fluida (fluxo de usuário contínuo)."

Dicas extras para o seu projeto:
A questão da extração real: O Lovable constrói a interface e a lógica de estado, mas ele não consegue "raspar" o Google Maps sozinho por causa de restrições de segurança do navegador. Você precisará conectar esse front-end que ele criar a uma API externa (como a SerpApi para o Google Maps e a Evolution API ou Z-API para o WhatsApp) para que o sistema funcione de verdade.

Persistência de dados: Peça ao Lovable para usar Supabase para salvar os leads extraídos. Ele tem integração nativa e facilitará muito sua vida para criar o banco de dados dos leads.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://saveleads.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/98740743-6310-46e0-a771-f42a3939683f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
