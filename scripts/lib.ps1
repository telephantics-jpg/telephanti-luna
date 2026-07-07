# Shared Luna paths — dot-source from scripts:  . "$PSScriptRoot\lib.ps1"
$script:LunaScripts = $PSScriptRoot
$script:LunaRoot = Split-Path $PSScriptRoot -Parent
$script:LunaDesktopFolderName = "Luna-Telephanti"

function Get-LunaDesktopRoots {
    $dirs = @()
    $shellDesk = [Environment]::GetFolderPath("Desktop")
    if ($shellDesk -and (Test-Path $shellDesk)) {
        $dirs += $shellDesk
    }
    foreach ($extra in @(
        (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
        (Join-Path $env:USERPROFILE "Desktop")
    )) {
        if ($extra -and (Test-Path $extra) -and ($dirs -notcontains $extra)) {
            $dirs += $extra
        }
    }
    return $dirs | Select-Object -Unique
}

function Get-LunaArtifactsFolder {
    $root = (Get-LunaDesktopRoots | Select-Object -First 1)
    if (-not $root) {
        $root = Join-Path $env:USERPROFILE "Desktop"
    }
    $folder = Join-Path $root $script:LunaDesktopFolderName
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }
    return $folder
}