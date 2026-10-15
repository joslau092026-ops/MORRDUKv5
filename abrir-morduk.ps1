$perfil = Join-Path $env:TEMP 'morduk-chrome-profile'
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList @(
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    ('--user-data-dir=' + $perfil),
    '--window-size=1280,850',
    '--app=http://localhost:8420'
)
Write-Host 'MORDUK abierto en Chrome'