# Script de Despliegue de Seguridad IA
Write-Host "Iniciando despliegue de seguridad para IA..." -ForegroundColor Cyan

# Intentar cargar la clave desde el archivo .env
$geminiKey = ""
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^VITE_GEMINI_API_KEY\s*=\s*`"(.*)`"") {
            $geminiKey = $Matches[1]
        } elseif ($line -match "^VITE_GEMINI_API_KEY\s*=\s*(.*)") {
            $geminiKey = $Matches[1].Trim("'").Trim('"')
        }
    }
}

if ([string]::IsNullOrEmpty($geminiKey)) {
    Write-Host "No se encontró VITE_GEMINI_API_KEY en el archivo .env." -ForegroundColor Yellow
    $geminiKey = Read-Host "Introduce tu GEMINI_API_KEY manualmente"
}

if ([string]::IsNullOrEmpty($geminiKey)) {
    Write-Host "No se ha proporcionado la clave GEMINI_API_KEY. Abortando." -ForegroundColor Red
    Pause
    Exit
}

Write-Host "Iniciando sesión en Supabase..." -ForegroundColor Cyan
Invoke-Expression "npx -y supabase login"

Write-Host "Configurando secretos en Supabase..." -ForegroundColor Cyan
# Escapar la clave para evitar problemas en PowerShell
$setSecretCmd = "npx -y supabase secrets set GEMINI_API_KEY=`"$geminiKey`""
Invoke-Expression $setSecretCmd

Write-Host "Desplegando la función de IA..." -ForegroundColor Cyan
Invoke-Expression "npx -y supabase functions deploy ai-consejos"

Write-Host "¡Hecho! La IA ahora es segura y persistente." -ForegroundColor Green
Pause
