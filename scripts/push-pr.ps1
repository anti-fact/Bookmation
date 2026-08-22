#Requires -Version 5.1
<#
.SYNOPSIS
  push 後に PR 作成スクリプトを実行する。
#>
[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $PushArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$branch = (git branch --show-current).Trim()
if ($branch -eq "main" -or $branch -eq "master") {
  git push @PushArgs
  exit $LASTEXITCODE
}

if (-not (git rev-parse --abbrev-ref "@{u}" 2>$null)) {
  git push -u origin HEAD @PushArgs
} else {
  git push @PushArgs
}

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& (Join-Path $PSScriptRoot "create-pr.ps1")
exit $LASTEXITCODE
