$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot

# 1. Servidor MORDUK (puerto 8420)
$net = netstat -ano
if (-not ($net | Select-String ':8420\s.*LISTENING')) {
    Start-Process node -ArgumentList 'server.js', '--no-browser' -WindowStyle Hidden -WorkingDirectory $raiz
    Start-Sleep 3
}
$net = netstat -ano
Write-Host ('servidor MORDUK: ' + $(if ($net | Select-String ':8420\s.*LISTENING') { 'ACTIVO' } else { 'FALLO' }))

# 2. Cerebro Qwen 7B (puerto 1234)
if (-not ($net | Select-String ':1234\s.*LISTENING')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $raiz 'tools\iniciar-servidor.ps1')
    Start-Sleep 2
    $net = netstat -ano
}
Write-Host ('cerebro Qwen: ' + $(if ($net | Select-String ':1234\s.*LISTENING') { 'ACTIVO' } else { 'FALLO' }))

# 3. Autoarranque con Windows
$vbs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\MORDUK.vbs'
$cmdPath = Join-Path $raiz 'iniciar-morduk.cmd'
$line = 'CreateObject("WScript.Shell").Run "cmd /c ""' + $cmdPath + '""", 0, False'
Set-Content -Path $vbs -Value $line -Encoding ASCII
Write-Host 'autoarranque con Windows: instalado'

# 4. Acceso directo en el Escritorio
$ws = New-Object -ComObject WScript.Shell
$icono = Join-Path $raiz 'assets\morduk.png'
$lnk = $ws.CreateShortcut((Join-Path $env:USERPROFILE 'Desktop\MORDUK.lnk'))
$lnk.TargetPath = $vbs
$lnk.Description = 'MORDUK - Asistente con voz de Escanor'
$lnk.IconLocation = $icono + ',0'
$lnk.Save()
Write-Host 'acceso directo en el Escritorio: MORDUK.lnk'

# 5. Verificación final
$final = netstat -ano
Write-Host '--- INSTALACION FINAL ---'
Write-Host ('servidor: ' + $(if ($final | Select-String ':8420\s.*LISTENING') { 'OK' } else { 'FALLO' }))
Write-Host ('cerebro : ' + $(if ($final | Select-String ':1234\s.*LISTENING') { 'OK' } else { 'FALLO' }))