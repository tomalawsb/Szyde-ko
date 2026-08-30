# Szydełko Studio 2.0

Responsywna PWA do projektowania, przeliczania i analizy wzorów szydełkowych.

## Najważniejsze funkcje

- tryb prosty: zwiększ, zmniejsz, nowy wzór, zmiana włóczki/szydełka, sprawdzenie wzoru,
- projekty okrągłe, kwadratowe i prostokątne z osobnym sposobem rysowania,
- jednostki cm/mm,
- własny wymiar próbki zamiast sztywnego 10 cm,
- osobna gęstość oczek i rzędów dla próbki źródłowej i docelowej,
- przeliczanie liczby oczek oraz liczby okrążeń/rzędów,
- tryby przeliczania: automatyczny, zachowaj raport, zachowaj liczbę motywów, ustaw liczbę motywów, najbliższa liczba całkowita,
- edytor graficzny symboli: dodawanie, zaznaczanie, wielokrotny wybór, przeciąganie i usuwanie,
- tworzenie raportu z zaznaczonych symboli,
- zoom, obracanie, reset widoku, kółko myszy i pinch-to-zoom na ekranie dotykowym,
- podgląd: schemat / instrukcja / oba,
- rozszerzona biblioteka symboli PL / US / UK,
- kontrola raportów, powtórzeń, przyrostów, próbki i graficznych grup raportu,
- eksport projektu JSON, schematu SVG, instrukcji tekstowej oraz druk/PDF,
- import JSON, autosave w localStorage, undo/redo,
- praca offline przez Service Worker,
- skalowanie interfejsu 80–150%,
- responsywny układ PC/tablet/telefon z pełną nawigacją mobilną.

## Uruchomienie lokalne

W katalogu projektu uruchom np.:

```powershell
python -m http.server 8080
```

Potem otwórz `http://localhost:8080`.

Service Worker i instalacja PWA wymagają HTTP/HTTPS.

## Wysłanie projektu na GitHub

W katalogu jest `Deploy-GitHub.ps1`. Domyślnie synchronizuje projekt z:

`https://github.com/tomalawsb/Szyde-ko.git`

Uruchom:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Deploy-GitHub.ps1
```

Skrypt klonuje bieżące repozytorium do katalogu tymczasowego, synchronizuje pliki, tworzy commit tylko przy zmianach i wykonuje push na `main`. Nie przechowuje tokenu; używa uwierzytelnienia skonfigurowanego w Git / Git Credential Manager.

## GitHub Pages

Repo zawiera workflow `.github/workflows/pages.yml`. GitHub Pages trzeba jednorazowo włączyć w ustawieniach repozytorium i jako źródło wybrać **GitHub Actions**. Następnie workflow **Deploy GitHub Pages** można uruchomić ręcznie z zakładki Actions.

## Ważne

Ocena możliwego falowania lub podwijania jest heurystyczna. Konstrukcje koronkowe, łuki, klastry i nietypowe naprężenie nitki mogą celowo odbiegać od prostego modelu geometrycznego.
