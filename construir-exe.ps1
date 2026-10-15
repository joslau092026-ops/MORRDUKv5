$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot
$dist = Join-Path $raiz 'dist\MORDUK-portable'
$electronDist = Join-Path $raiz 'node_modules\electron\dist'

if (-not (Test-Path $electronDist)) { Write-Host 'FALTA node_modules\electron\dist'; exit 1 }

if (Test-Path $dist) { Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path $dist | Out-Null

Write-Host '1/5 copiando el runtime de Electron…'
Copy-Item "$electronDist\*" $dist -Recurse -Force

Write-Host '2/5 renombrando a MORDUK.exe…'
Rename-Item (Join-Path $dist 'electron.exe') 'MORDUK.exe' -Force

Write-Host '3/5 instalando la app de MORDUK…'
$app = Join-Path $dist 'resources\app'
New-Item -ItemType Directory -Force -Path (Join-Path $app 'electron') | Out-Null

# manifiesto de la app
'{ "name": "morduk", "productName": "MORDUK", "version": "0.21.0", "main": "electron/main.js" }' | Set-Content -Path (Join-Path $app 'package.json') -Encoding UTF8

# código y datos
Copy-Item (Join-Path $raiz 'electron\main.js') (Join-Path $app 'electron\main.js') -Force
foreach ($f in @('server.js','cerebro.js','package.json')) { Copy-Item (Join-Path $raiz $f) (Join-Path $app $f) -Force }
foreach ($d in @('lib','ui','config','data','openclaw','assets')) { Copy-Item (Join-Path $raiz $d) (Join-Path $app $d) -Recurse -Force }

# herramientas: servidor del cerebro (llama.cpp Vulkan)
$llamaSrc = Join-Path $raiz 'tools\llama'
if (Test-Path $llamaSrc) {
    New-Item -ItemType Directory -Force -Path (Join-Path $app 'tools') | Out-Null
    Copy-Item $llamaSrc (Join-Path $app 'tools\llama') -Recurse -Force
    $z = Join-Path $app 'tools\llama\llama.zip'
    if (Test-Path $z) { Remove-Item $z -Force }
}
$ps1 = Join-Path $raiz 'tools\iniciar-servidor.ps1'
if (Test-Path $ps1) { Copy-Item $ps1 (Join-Path $app 'tools\iniciar-servidor.ps1') -Force }

if (Test-Path (Join-Path $raiz 'LEEME-CEREBRO.txt')) { Copy-Item (Join-Path $raiz 'LEEME-CEREBRO.txt') (Join-Path $app 'LEEME-CEREBRO.txt') -Force }

Write-Host '4/5 verificación…'
$okExe = Test-Path (Join-Path $dist 'MORDUK.exe')
$okApp = Test-Path (Join-Path $app 'package.json')
$okMain = Test-Path (Join-Path $app 'electron\main.js')
$okLlama = Test-Path (Join-Path $app 'tools\llama\llama-server.exe')
$okData = Test-Path (Join-Path $app 'data\fishaudio.json')
Write-Host ("MORDUK.exe: " + $okExe + " | manifiesto: " + $okApp + " | main.js: " + $okMain + " | cerebro: " + $okLlama + " | datos: " + $okData)

$tam = [math]::Round((Get-ChildItem $dist -Recurse | Measure-Object Length -Sum).Sum / 1MB, 0)
Write-Host ("5/5 tamaño de la carpeta portable: " + $tam + " MB")

# zip portable
$zip = Join-Path $raiz '..\MORDUK-portable.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $dist -DestinationPath $zip -CompressionLevel Optimal
Write-Host ("ZIP portable: " + (Get-Item $zip).FullName + " → " + [math]::Round((Get-Item $zip).Length/1MB,0) + " MB")