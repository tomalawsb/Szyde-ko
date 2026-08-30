# Szydełko Studio

Responsywna PWA do projektowania, przeliczania i wstępnej analizy wzorów szydełkowych.

## Co działa

- projekt i parametry próbki,
- okrążenia, raporty, powtórzenia i przyrosty,
- graficzny podgląd okrągłego schematu SVG,
- przeliczanie rozmiaru z uwzględnieniem zmiany gęstości,
- korekta wyniku do pełnego raportu,
- kontrola spójności liczby oczek / raportów / przyrostów,
- biblioteka podstawowych symboli PL / US / UK,
- eksport projektu do JSON,
- eksport schematu do SVG,
- kopiowanie instrukcji tekstowej,
- druk / zapis do PDF przez przeglądarkę,
- import projektu JSON,
- autosave w `localStorage`,
- cofanie / ponawianie,
- praca offline dzięki Service Worker,
- skalowanie UI 80–150%,
- układ desktop / tablet / telefon.

## Uruchomienie lokalne

Najprościej uruchomić lokalny serwer HTTP w katalogu projektu, np.:

```powershell
python -m http.server 8080
```

Następnie otworzyć `http://localhost:8080`.

> Service Worker i instalacja PWA wymagają HTTP/HTTPS. Samo dwukrotne kliknięcie `index.html` nie daje pełnego trybu PWA.

## Wysłanie projektu na GitHub

W katalogu jest `Deploy-GitHub.ps1`. Domyślnie wysyła projekt do:

`https://github.com/tomalawsb/Szyde-ko.git`

Uruchom z PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Deploy-GitHub.ps1
```

Skrypt:

1. klonuje aktualne repo do katalogu tymczasowego,
2. synchronizuje pliki projektu,
3. tworzy commit tylko wtedy, gdy są zmiany,
4. wysyła gałąź `main`,
5. usuwa katalog tymczasowy.

Nie zapisuje tokenu GitHub. Korzysta z logowania skonfigurowanego w Git / Git Credential Manager.

## GitHub Pages

Repo zawiera workflow `.github/workflows/pages.yml`. Po włączeniu GitHub Pages w trybie **GitHub Actions** kolejne push'e na `main` będą automatycznie publikowały aplikację.

## Uwaga dotycząca obliczeń

Analiza możliwego falowania lub ściągania jest heurystyczna. Wzory koronkowe, łuki z oczek łańcuszka, różne napięcie nitki i nietypowe konstrukcje wymagają oceny osoby wykonującej robótkę.
