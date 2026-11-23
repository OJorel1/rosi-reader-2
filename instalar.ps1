$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path","User") + ";$env:USERPROFILE\.cargo\bin"
}
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Step($t) { Write-Host "`n==> $t" -ForegroundColor Magenta }
# "--source winget" evita consultar a Microsoft Store (msstore), que falha em alguns PCs com erro de certificado
$wg = @("-e", "--source", "winget", "--accept-package-agreements", "--accept-source-agreements")
function Install-Pkg($id, $override) {
  if ($override) { winget install @wg --id $id --override $override } else { winget install @wg --id $id }
  # 0x8A15002B = já está instalado/sem atualização: tudo bem
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { throw "Falha ao instalar $id (código $LASTEXITCODE). Veja a mensagem acima." }
}

try {
  if (-not (Has winget)) { throw "winget nao encontrado. Atualize o 'Instalador de Aplicativo' na Microsoft Store e rode de novo." }
  Refresh-Path

  Step "Node.js"
  if (-not (Has node)) { Install-Pkg OpenJS.NodeJS.LTS; Refresh-Path }

  Step "Visual Studio Build Tools (C++)"
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  $hasVC = (Test-Path $vswhere) -and (& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
  if (-not $hasVC) {
    Install-Pkg Microsoft.VisualStudio.2022.BuildTools "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  }

  Step "Rust"
  if (-not (Has cargo)) { Install-Pkg Rustlang.Rustup; Refresh-Path }
  rustup default stable-msvc

  Step "Dependencias do projeto"
  npm install

  Step "Compilando o instalador (a primeira vez leva varios minutos)"
  npm run tauri build

  $exe = Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" | Select-Object -First 1
  if (-not $exe) { throw "Nao encontrei o instalador gerado." }
  Write-Host "`nPronto! Abrindo o instalador: $($exe.Name)" -ForegroundColor Green
  Start-Process $exe.FullName
}
catch {
  Write-Host "`nERRO: $_" -ForegroundColor Red
}
Read-Host "`nPressione Enter para fechar"
