# Sets up the daily Flyary backup as a Windows scheduled task for the current user (no admin rights needed).
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1 [-Time 12:30]
# The task runs scripts\run-backup.ps1 every day at the given time. If the PC was off or asleep, it
# runs as soon as possible afterwards. Remove it again with:
#   Unregister-ScheduledTask -TaskName 'Flyary Backup' -Confirm:$false
param([string]$Time = '12:30')
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'run-backup.ps1'
if (-not (Test-Path $script)) { throw "run-backup.ps1 not found next to this script" }
$null = Get-Command node -ErrorAction Stop

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName 'Flyary Backup' -Description 'Daily backup of the Flyary database and files (scripts/db-backup.mjs)' `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

$task = Get-ScheduledTask -TaskName 'Flyary Backup'
"Task '$($task.TaskName)' registered: daily at $Time, state $($task.State)."
"Run it once now to test:  Start-ScheduledTask -TaskName 'Flyary Backup'"
