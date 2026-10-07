#!/usr/bin/env python3
"""
Save Leads - Manual Google Maps Scraper

Abre um Chromium real com Playwright, pesquisa no Google Maps, coleta os links
dos resultados e abre cada empresa uma por uma para extrair os dados.
Nao usa Google Places/Maps API.

Se aparecer CAPTCHA/verificacao humana, o script pausa para o operador resolver
manualmente no navegador aberto. Nao tenta burlar mecanismos antiabuso.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import re
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import quote_plus

from playwright.async_api import Page, async_playwright


@dataclass
class Lead:
    empresa: str = ""
    telefone: str = ""
    site: str = ""
    endereco: str = ""
    categoria: str = ""
    avaliacao: str = ""
    total_avaliacoes: str = ""
    google_maps_url: str = ""
    query: str = ""
    localizacao: str = ""
    extraido_em: str = ""


FIELDS = list(Lead.__dataclass_fields__.keys())


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def strip_label(value: str | None, *labels: str) -> str:
    text = clean(value)
    for label in labels:
        if text.lower().startswith(label.lower()):
            return text[len(label):].lstrip(" :")
    return text


def existing_urls(path: Path) -> set[str]:
    if not path.exists() or path.stat().st_size == 0:
        return set()
    urls: set[str] = set()
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                url = clean(row.get("google_maps_url"))
                if url:
                    urls.add(url)
    except Exception:
        pass
    return urls


def save_row(path: Path, lead: Lead) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists() and path.stat().st_size > 0
    with path.open("a", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if not exists:
            writer.writeheader()
        writer.writerow(asdict(lead))


async def text_first(page: Page, selectors: list[str]) -> str:
    for selector in selectors:
        try:
            item = page.locator(selector).first
            if await item.count():
                value = clean(await item.inner_text(timeout=1200))
                if value:
                    return value
        except Exception:
            pass
    return ""


async def attr_first(page: Page, selectors: list[str], attr: str) -> str:
    for selector in selectors:
        try:
            item = page.locator(selector).first
            if await item.count():
                value = clean(await item.get_attribute(attr, timeout=1200))
                if value:
                    return value
        except Exception:
            pass
    return ""


async def has_challenge(page: Page) -> bool:
    selectors = [
        "text=/unusual traffic/i",
        "text=/verify you are human/i",
        "text=/not a robot/i",
        "iframe[src*='recaptcha']",
        "form[action*='sorry']",
    ]
    for selector in selectors:
        try:
            if await page.locator(selector).count():
                return True
        except Exception:
            pass
    return False


async def handle_challenge(page: Page, headless: bool) -> None:
    if not await has_challenge(page):
        return
    if headless:
        raise RuntimeError(
            "Google pediu verificacao humana. Rode sem --headless e resolva manualmente."
        )
    print("\n[!] Google pediu verificacao humana/CAPTCHA.")
    print("    Resolva no navegador aberto e volte ao Terminal.")
    await asyncio.to_thread(input, "    Pressione ENTER depois de resolver... ")
    await page.wait_for_timeout(1000)


async def accept_consent(page: Page) -> None:
    for selector in [
        "button:has-text('Accept all')",
        "button:has-text('Aceitar tudo')",
        "button:has-text('I agree')",
        "button:has-text('Concordo')",
    ]:
        try:
            item = page.locator(selector).first
            if await item.count() and await item.is_visible(timeout=500):
                await item.click(timeout=1200)
                await page.wait_for_timeout(500)
                return
        except Exception:
            pass


async def collect_links(page: Page, term: str, max_results: int, headless: bool) -> list[str]:
    url = f"https://www.google.com/maps/search/{quote_plus(term)}?hl=en"
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await accept_consent(page)
    await handle_challenge(page, headless)

    try:
        await page.wait_for_selector("div[role='feed']", timeout=20000)
    except Exception:
        links = await page.locator("a[href*='/maps/place/']").evaluate_all(
            "els => els.map(e => e.href)"
        )
        return list(dict.fromkeys(links))[:max_results]

    feed = page.locator("div[role='feed']").first
    found: list[str] = []
    seen: set[str] = set()
    same_count = 0
    previous = -1

    while len(found) < max_results and same_count < 8:
        hrefs = await feed.locator("a[href*='/maps/place/']").evaluate_all(
            "els => els.map(e => e.href)"
        )

        for href in hrefs:
            if href and href not in seen:
                seen.add(href)
                found.append(href)
                if len(found) >= max_results:
                    break

        print(f"\r[busca] {len(found)} empresas encontradas...", end="", flush=True)

        if len(found) == previous:
            same_count += 1
        else:
            previous = len(found)
            same_count = 0

        if await page.locator("text=/You've reached the end of the list/i").count():
            break

        try:
            await feed.evaluate("el => el.scrollBy(0, Math.max(el.clientHeight, 1000))")
        except Exception:
            await page.mouse.wheel(0, 1300)

        await page.wait_for_timeout(1000)
        await handle_challenge(page, headless)

    print()
    return found[:max_results]


async def extract_company(
    page: Page,
    url: str,
    query: str,
    location: str,
    headless: bool,
) -> Lead:
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await handle_challenge(page, headless)
    await page.wait_for_timeout(700)

    empresa = await text_first(page, ["h1.DUwDvf", "[role='main'] h1", "h1"])

    telefone = ""
    phone = page.locator(
        "button[data-item-id^='phone:tel:'], a[data-item-id^='phone:tel:']"
    ).first
    try:
        if await phone.count():
            data_id = await phone.get_attribute("data-item-id")
            if data_id and data_id.startswith("phone:tel:"):
                telefone = data_id.replace("phone:tel:", "", 1)
            if not telefone:
                telefone = strip_label(
                    await phone.get_attribute("aria-label"), "Phone", "Telefone"
                )
    except Exception:
        pass

    site = await attr_first(
        page,
        [
            "a[data-item-id='authority']",
            "a[aria-label^='Website']",
            "a[aria-label^='Site']",
        ],
        "href",
    )

    endereco = ""
    address = page.locator("button[data-item-id='address']").first
    try:
        if await address.count():
            endereco = strip_label(
                await address.get_attribute("aria-label"), "Address", "Endereco", "Endereço"
            )
    except Exception:
        pass

    categoria = await text_first(
        page,
        [
            "button.DkEaL",
            "button[jsaction*='pane.rating.category']",
            "[jsaction*='category']",
        ],
    )

    avaliacao = ""
    total_avaliacoes = ""
    try:
        rating = clean(await page.locator("div.F7nice").first.inner_text(timeout=1200))
        m = re.search(r"\b([0-5](?:[\.,]\d)?)\b", rating)
        if m:
            avaliacao = m.group(1).replace(",", ".")
        m = re.search(r"\(([\d.,]+)\)", rating)
        if m:
            total_avaliacoes = re.sub(r"\D", "", m.group(1))
    except Exception:
        pass

    if not total_avaliacoes:
        reviews_label = await attr_first(
            page,
            [
                "button[jsaction*='pane.reviewChart.moreReviews']",
                "button[aria-label*='reviews']",
                "button[aria-label*='avaliações']",
            ],
            "aria-label",
        )
        m = re.search(r"([\d.,]+)", reviews_label)
        if m:
            total_avaliacoes = re.sub(r"\D", "", m.group(1))

    return Lead(
        empresa=empresa,
        telefone=clean(telefone),
        site=site,
        endereco=endereco,
        categoria=categoria,
        avaliacao=avaliacao,
        total_avaliacoes=total_avaliacoes,
        google_maps_url=page.url or url,
        query=query,
        localizacao=location,
        extraido_em=time.strftime("%Y-%m-%d %H:%M:%S"),
    )


async def main(args: argparse.Namespace) -> int:
    output = Path(args.output).expanduser().resolve()
    done = existing_urls(output) if args.resume else set()
    search_term = f"{args.query} {args.location}".strip()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=args.headless,
            slow_mo=0 if args.headless else 30,
        )
        context = await browser.new_context(
            locale="en-US",
            viewport={"width": 1440, "height": 960},
        )

        search_page = await context.new_page()
        print(f"[+] Pesquisa: {search_term}")
        links = await collect_links(search_page, search_term, args.max, args.headless)
        await search_page.close()

        todo = [url for url in links if url not in done]
        print(f"[+] Encontradas: {len(links)} | pendentes: {len(todo)}")
        print(f"[+] Salvando em: {output}")

        detail = await context.new_page()
        saved = 0

        for index, url in enumerate(todo, 1):
            try:
                lead = await extract_company(
                    detail, url, args.query, args.location, args.headless
                )
                save_row(output, lead)
                saved += 1
                print(
                    f"[{index}/{len(todo)}] "
                    f"{lead.empresa or '(sem nome)'} | "
                    f"{lead.telefone or 'sem telefone'}"
                )
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                print(f"[{index}/{len(todo)}] ERRO: {exc}", file=sys.stderr)

            await detail.wait_for_timeout(int(args.delay * 1000))

        await browser.close()

    print(f"\n[OK] {saved} empresas salvas.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scraper manual de empresas do Google Maps sem API."
    )
    parser.add_argument("--query", required=True, help="Ex.: Electrician")
    parser.add_argument("--location", required=True, help="Ex.: Houston, TX")
    parser.add_argument("--max", type=int, default=200, help="Maximo de empresas")
    parser.add_argument(
        "--output", default="leads_google_maps.csv", help="CSV de saida"
    )
    parser.add_argument(
        "--delay", type=float, default=1.2, help="Pausa entre empresas em segundos"
    )
    parser.add_argument("--headless", action="store_true")
    parser.add_argument(
        "--no-resume",
        dest="resume",
        action="store_false",
        help="Nao ignora URLs que ja estao no CSV",
    )
    parser.set_defaults(resume=True)
    args = parser.parse_args()
    args.max = max(1, min(args.max, 5000))
    args.delay = max(0.3, args.delay)
    return args


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main(parse_args())))
    except KeyboardInterrupt:
        print("\n[!] Interrompido. O CSV ja contem tudo salvo ate agora.")
        raise SystemExit(130)
