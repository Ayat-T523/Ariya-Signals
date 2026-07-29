# run-market-intelligence-refresh.ps1
#
# Wrapper invoked by the "AriyaSignals-MarketIntelligenceRefresh" Windows
# Scheduled Task (weekly, Mondays 06:00 local time). Task Scheduler captures
# no console output on its own, so this appends a timestamped block to
# logs/market-intelligence-refresh.log for every run -- check that file to
# see whether the last run succeeded, was skipped (insufficient signal), or
# failed (e.g. Ollama not running).
#
# Requires local Ollama running with OLLAMA_MODEL pulled. If the machine is
# asleep or Ollama isn't running at trigger time, this run fails silently
# except for the log -- there's no alerting on top of this.

$ProjectRoot = "C:\Users\Ayat\Documents\Claude\Projects\Ariya-Signals"
$LogFile     = Join-Path $ProjectRoot "logs\market-intelligence-refresh.log"

New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot "logs") | Out-Null
Set-Location $ProjectRoot

$separator = "`n" + ("=" * 70) + "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] run-market-intelligence-refresh`n" + ("=" * 70)
Add-Content -Path $LogFile -Value $separator

try {
    $output = & node --env-file=.env.local scripts\refresh-market-intelligence.mjs 2>&1
    Add-Content -Path $LogFile -Value $output
    Add-Content -Path $LogFile -Value "[exit code: $LASTEXITCODE]"
} catch {
    Add-Content -Path $LogFile -Value "FAILED TO RUN: $_"
}
