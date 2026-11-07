# Kalorie

Webová aplikace (PWA) pro evidenci kalorií. Vyfotíte jídlo, případně dopíšete upřesnění, a Claude odhadne kalorie a makroživiny. Běží na GitHub Pages a na iPhonu se dá přidat na plochu jako aplikace.

## Jak to funguje

- Aplikace je čistě statická, nemá žádný server. Volá Claude API přímo z prohlížeče.
- Váš Anthropic API klíč i všechny záznamy jsou uložené jen v telefonu (localStorage). Do repozitáře se nic z toho nedostane.
- Fotka se před odesláním zmenší (max. 1568 px), v deníku zůstává jen malý náhled.
- Výchozí model je Claude Opus 5.5. V Nastavení můžete přepnout na levnější Sonnet 5.5 nebo Haiku 5.5.

## Instalace na iPhone

1. Otevřete adresu aplikace v Safari (`https://krivoht.github.io/my-app/`).
2. Sdílet → **Přidat na plochu**.
3. V aplikaci otevřete ⚙︎ a vložte API klíč z https://console.anthropic.com.

## Záloha

Data jsou jen v telefonu. Smazáním dat Safari nebo odinstalováním z plochy se ztratí. V Nastavení je **Exportovat / Importovat** (JSON).

## Vývoj

```bash
npm install
npm run dev
```

Po každém pushi do `main` se aplikace automaticky sestaví a nasadí na GitHub Pages (`.github/workflows/deploy.yml`).
