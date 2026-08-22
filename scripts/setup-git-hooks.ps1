#Requires -Version 5.1
<#
.SYNOPSIS
  Configure a local git alias to push and create a pull request.

.EXAMPLE
  ./scripts/setup-git-hooks.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel).Trim()
$pushPrPath = Join-Path $repoRoot "scripts/push-pr.ps1"

if (-not (Test-Path $pushPrPath)) {
  throw "scripts/push-pr.ps1 was not found."
}

$aliasPrefix = [string][char]33
$aliasValue = $aliasPrefix + 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $pushPrPath + '"'
git config --local alias.pushpr $aliasValue

Write-Host "Configured:" -ForegroundColor Green
Write-Host "  git pushpr   # push, then create PR from scripts/pr-body/<branch>.md"
Write-Host ""
Write-Host "GitHub auth (first time only):" -ForegroundColor Yellow
Write-Host "  winget install GitHub.cli"
Write-Host "  gh auth login"
Write-Host ""
Write-Host "Or set a PAT:" -ForegroundColor Yellow
Write-Host '  $env:GITHUB_TOKEN = "<personal-access-token>"'
