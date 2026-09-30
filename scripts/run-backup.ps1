# Runs one Flyary backup (scripts/db-backup.mjs) and writes a log file.
# Started daily by the scheduled task from scripts/install-backup-task.ps1; can also be run by hand:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-backup.ps1
# Logs: <backup folder>\logs\backup-<date>.log, kept for 60 days. The backup reports itself to Flyary,
# which pushes a warning to the admins when a run fails or no run arrives for 48 hours.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$backupRoot = if ($env:FLYARY_BACKUP_DIR) { $env:FLYARY_BACKUP_DIR } else { Join-Path $env:USERPROFILE 'FlyaryBackups' }
$logs = Join-Path $backupRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = Join-Path $logs ("backup-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'))

Set-Location $repo
$node = (Get-Command node -ErrorAction Stop).Source
"Flyary backup $(Get-Date -Format o) on $env:COMPUTERNAME" | Out-File -FilePath $log -Encoding utf8
# cmd does the redirection: in Windows PowerShell 5.1, redirected stderr of a native program (warnings)
# would otherwise turn into a terminating error.
& cmd.exe /c "`"$node`" scripts\db-backup.mjs >> `"$log`" 2>&1"
$code = $LASTEXITCODE
"Exit code $code at $(Get-Date -Format o)" | Out-File -FilePath $log -Encoding utf8 -Append

Get-ChildItem $logs -Filter 'backup-*.log' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-60) } | Remove-Item -Force
exit $code
