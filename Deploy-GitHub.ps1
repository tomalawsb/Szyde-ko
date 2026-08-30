param(
    [string]$RepoUrl = "https://github.com/tomalawsb/Szyde-ko.git",
    [string]$Branch = "main",
    [string]$CommitMessage = "Aktualizacja Szydelko Studio"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Brak programu '$Name' w PATH. Zainstaluj Git for Windows i uruchom skrypt ponownie."
    }
}

Require-Command "git"

$Source = Split-Path -Parent $MyInvocation.MyCommand.Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("SzydelkoDeploy_" + [guid]::NewGuid().ToString("N"))
$CloneDir = Join-Path $TempRoot "repo"

Write-Host "=== Szydelko Studio -> GitHub ===" -ForegroundColor Cyan
Write-Host "Zrodlo: $Source"
Write-Host "Repo:   $RepoUrl"

New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

try {
    Write-Host "[1/5] Klonowanie repozytorium..." -ForegroundColor Yellow
    & git clone $RepoUrl $CloneDir
    if ($LASTEXITCODE -ne 0) { throw "git clone zakonczyl sie bledem." }

    Write-Host "[2/5] Kopiowanie plikow projektu..." -ForegroundColor Yellow
    # /MIR synchronizuje takze usuniecia, ale katalog .git pozostaje nietkniety.
    $RoboArgs = @(
        $Source,
        $CloneDir,
        "/MIR",
        "/XD", ".git",
        "/XF", "*.zip",
        "/R:1", "/W:1",
        "/NFL", "/NDL", "/NJH", "/NJS", "/NP"
    )
    & robocopy @RoboArgs | Out-Null
    $RoboCode = $LASTEXITCODE
    if ($RoboCode -ge 8) { throw "Robocopy zakonczyl sie bledem $RoboCode." }

    Write-Host "[3/5] Przygotowanie galezi $Branch..." -ForegroundColor Yellow
    & git -C $CloneDir checkout -B $Branch
    if ($LASTEXITCODE -ne 0) { throw "Nie mozna przygotowac galezi $Branch." }

    & git -C $CloneDir add -A
    $Status = & git -C $CloneDir status --porcelain
    if (-not $Status) {
        Write-Host "Brak zmian do wyslania. Repozytorium jest aktualne." -ForegroundColor Green
        exit 0
    }

    Write-Host "[4/5] Tworzenie commita..." -ForegroundColor Yellow
    & git -C $CloneDir commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        throw "Commit nie powiodl sie. Sprawdz konfiguracje git user.name i user.email."
    }

    Write-Host "[5/5] Wysylanie na GitHub..." -ForegroundColor Yellow
    & git -C $CloneDir push -u origin $Branch
    if ($LASTEXITCODE -ne 0) {
        throw "Push nie powiodl sie. Sprawdz logowanie GitHub/Git Credential Manager i uprawnienia do repozytorium."
    }

    Write-Host "Gotowe. Pliki sa na GitHubie." -ForegroundColor Green
}
finally {
    if (Test-Path $TempRoot) { Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
