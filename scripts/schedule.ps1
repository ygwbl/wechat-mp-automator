# Register one Windows scheduled task: GZH_Daily runs "node bin/gzh.js daily" (sync -> push draft -> report).
# It only pushes to the DRAFT box. It never publishes or mass-sends. No logon trigger.
#
#   powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1              # daily 08:00
#   powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1 -At 07:30
#   powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1 -Remove
param([string]$At = '08:00', [switch]$Remove)
$ErrorActionPreference = 'Stop'
$Name = 'GZH_Daily'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "removed $Name"
  exit 0
}
$Root = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node -ErrorAction Stop).Source
$Cli = Join-Path $Root 'bin\gzh.js'
$action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Cli`" daily" -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "ok: $Name daily at $At -> node bin\gzh.js daily"
