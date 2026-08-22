#Requires -Version 5.1
<#
.SYNOPSIS
  現在のブランチから GitHub プルリクエストを作成する。

.DESCRIPTION
  GitHub CLI (gh) を優先し、未インストール時は GITHUB_TOKEN / GH_TOKEN で REST API を使う。
  本文は引数、環境変数 PR_BODY、または scripts/pr-body/<branch>.md を参照する。

.EXAMPLE
  ./scripts/create-pr.ps1 -Title "feat(extension): TASK-002 bootstrap"

.EXAMPLE
  $env:GITHUB_TOKEN = "<pat>"
  ./scripts/create-pr.ps1
#>
[CmdletBinding()]
param(
  [string] $Title,
  [string] $Body,
  [string] $BodyFile,
  [string] $Base = "main",
  [switch] $Draft
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-GhExecutable {
  $candidates = @(
    (Get-Command gh -ErrorAction SilentlyContinue)?.Source,
    "$env:ProgramFiles\GitHub CLI\gh.exe",
    "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
    "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  return $candidates | Select-Object -First 1
}

function Get-RepoSlug {
  $remote = git remote get-url origin
  if ($remote -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)") {
    return @{
      Owner = $Matches.owner
      Repo = $Matches.repo -replace '\.git$', ''
    }
  }

  throw "origin が GitHub リポジトリを指していません: $remote"
}

function Resolve-BodyText {
  param([string] $ExplicitBody, [string] $ExplicitFile, [string] $Branch)

  if ($ExplicitBody) {
    return $ExplicitBody
  }

  if ($ExplicitFile -and (Test-Path $ExplicitFile)) {
    return [string](Get-Content -Path $ExplicitFile -Raw -Encoding UTF8)
  }

  $branchBody = Join-Path $PSScriptRoot "pr-body/$Branch.md"
  if (Test-Path $branchBody) {
    return [string](Get-Content -Path $branchBody -Raw -Encoding UTF8)
  }

  $defaultBody = Join-Path $PSScriptRoot "pr-body/default.md"
  if (Test-Path $defaultBody) {
    return [string](Get-Content -Path $defaultBody -Raw -Encoding UTF8)
  }

  return @"
## 概要
- （ここに変更内容を書く）

## テスト計画
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
"@
}

function New-PullRequestViaApi {
  param(
    [hashtable] $Repo,
    [string] $Head,
    [string] $BaseBranch,
    [string] $PrTitle,
    [string] $PrBody,
    [string] $Token,
    [bool] $IsDraft
  )

  $headers = @{
    Authorization = "Bearer $Token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
  }

  $existingUri = "https://api.github.com/repos/$($Repo.Owner)/$($Repo.Repo)/pulls?head=$($Repo.Owner):$Head&state=open"
  $existing = Invoke-RestMethod -Method Get -Uri $existingUri -Headers $headers
  if ($existing.Count -gt 0) {
    Write-Host "既存の PR があります: $($existing[0].html_url)" -ForegroundColor Yellow
    Start-Process $existing[0].html_url
    return $existing[0]
  }

  $payloadObj = @{
    title = $PrTitle
    body = $PrBody
    head = $Head
    base = $BaseBranch
    draft = $IsDraft
  }
  $json = $payloadObj | ConvertTo-Json -Depth 5
  $uri = "https://api.github.com/repos/$($Repo.Owner)/$($Repo.Repo)/pulls"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -ContentType "application/json; charset=utf-8"
}

function Get-GitHubTokenFromCredential {
  $inputText = "protocol=https`nhost=github.com`n`n"
  $cred = $inputText | git credential fill 2>$null
  if (-not $cred) { return $null }
  $match = $cred | Select-String '^password=(.+)$'
  if (-not $match) { return $null }
  return $match.Matches[0].Groups[1].Value
}

$branch = (git branch --show-current).Trim()
if (-not $branch) {
  throw "現在のブランチを取得できませんでした。"
}

if ($branch -eq $Base) {
  throw "ベースブランチ ($Base) 上では PR を作成できません。feature ブランチに切り替えてください。"
}

$upstream = git rev-parse --abbrev-ref "@{u}" 2>$null
if (-not $upstream) {
  Write-Host "upstream 未設定のため push します..." -ForegroundColor Yellow
  git push -u origin HEAD
}

$title = if ($Title) { $Title } else { git log -1 --pretty=%s }
$bodyText = Resolve-BodyText -ExplicitBody $Body -ExplicitFile $BodyFile -Branch $branch
$ghPath = Get-GhExecutable
$token = $env:GITHUB_TOKEN
if (-not $token) { $token = $env:GH_TOKEN }
if (-not $token) { $token = Get-GitHubTokenFromCredential }

if ($ghPath) {
  $args = @(
    "pr", "create",
    "--base", $Base,
    "--head", $branch,
    "--title", $title,
    "--body", $bodyText
  )
  if ($Draft) { $args += "--draft" }

  & $ghPath @args
  if ($LASTEXITCODE -ne 0) {
    throw "gh pr create が失敗しました。`gh auth login` を実行してください。"
  }
  & $ghPath pr view --web
  exit 0
}

if (-not $token) {
  throw @"
GitHub CLI (gh) が見つからず、GITHUB_TOKEN / GH_TOKEN も未設定です。

次のいずれかを実行してください:
  1. GitHub CLI をインストール: winget install GitHub.cli
  2. 認証: gh auth login
  3. または PAT を設定: `$env:GITHUB_TOKEN = '<token>'

その後: ./scripts/create-pr.ps1
"@
}

$repo = Get-RepoSlug
$response = New-PullRequestViaApi -Repo $repo -Head $branch -BaseBranch $Base -PrTitle $title -PrBody $bodyText -Token $token -IsDraft:$Draft.IsPresent
Write-Host "PR を作成しました: $($response.html_url)" -ForegroundColor Green
Start-Process $response.html_url
