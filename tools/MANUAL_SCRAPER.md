# Scraper manual do Google Maps

Este scraper abre um navegador Chromium real e coleta as empresas **uma por uma**,
sem usar Google Maps/Places API.

## Instalar

```bash
cd saveleads
python3 -m venv .venv-scraper
source .venv-scraper/bin/activate
pip install -r tools/requirements-manual-scraper.txt
python -m playwright install chromium
```

## Executar

Exemplo para eletricistas em Houston:

```bash
python tools/manual_google_maps_scraper.py \
  --query "Electrician" \
  --location "Houston, TX" \
  --max 500 \
  --output electrician_houston.csv
```

O navegador abre na tela. O script primeiro rola a lista de resultados e guarda os
links. Depois abre cada empresa individualmente e grava imediatamente no CSV.

Campos:

`empresa, telefone, site, endereco, categoria, avaliacao, total_avaliacoes, google_maps_url, query, localizacao, extraido_em`

## Retomar

O modo resume vem ligado por padrao. Se fechar o scraper, rode o mesmo comando e
as URLs que ja existem no CSV sao ignoradas.

## CAPTCHA

Se o Google mostrar verificacao humana/CAPTCHA, o scraper pausa. Resolva
manualmente no Chromium aberto e pressione ENTER no Terminal. O script nao tenta
burlar mecanismos antiabuso.

## Headless

Para rodar sem janela:

```bash
python tools/manual_google_maps_scraper.py \
  --query "Electrician" \
  --location "Houston, TX" \
  --max 200 \
  --headless
```

Para os primeiros testes, use com a janela aberta.
