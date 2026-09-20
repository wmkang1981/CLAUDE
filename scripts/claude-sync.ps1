[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("start", "end", "list")]
    [string]$Action,

    [Parameter(Position = 1)]
    [string]$Project
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Get-ProjectPath([string]$Name) {
    Join-Path $RepoRoot "projects\$Name"
}

function Invoke-Git {
    param([string[]]$GitArgs)
    Push-Location $RepoRoot
    try {
        & git @GitArgs
        if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
}

switch ($Action) {

    "list" {
        Invoke-Git @("pull", "--ff-only")
        $projDir = Join-Path $RepoRoot "projects"
        Get-ChildItem $projDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_.Name }
    }

    "start" {
        if (-not $Project) { throw "사용법: claude-sync.ps1 start -Project <이름>" }

        Push-Location $RepoRoot
        $dirty = git status --porcelain
        Pop-Location
        if ($dirty) {
            Write-Warning "저장소에 커밋되지 않은 변경사항이 있습니다. 먼저 'claude-sync.ps1 end'로 업로드하거나 직접 정리한 뒤 다시 시도하세요."
            exit 1
        }

        Invoke-Git @("pull", "--ff-only")

        $path = Get-ProjectPath $Project
        if (-not (Test-Path $path)) {
            Write-Host "새 프로젝트 '$Project'를 생성합니다."
            New-Item -ItemType Directory -Path $path | Out-Null
            "# $Project`n`n$(Get-Date -Format 'yyyy-MM-dd')에 생성됨 ($env:COMPUTERNAME)" |
                Out-File (Join-Path $path "README.md") -Encoding utf8
            Invoke-Git @("add", "projects/$Project")
            Invoke-Git @("commit", "-m", "projects($Project): init on $env:COMPUTERNAME")
            Invoke-Git @("push")
        }

        Write-Host ""
        Write-Host "준비 완료: $path"
        Write-Host "Claude Code에서 이 폴더를 작업 디렉터리로 열어 작업을 시작하세요."
        Write-Host "플러그인을 최근에 추가/변경했다면 Claude 세션에서 '/plugin marketplace update' 를 한 번 실행하세요."
    }

    "end" {
        Push-Location $RepoRoot
        try {
            if ($Project) {
                $path = Get-ProjectPath $Project
                if (-not (Test-Path $path)) { throw "프로젝트 '$Project' 폴더가 없습니다: $path" }
                git add "projects/$Project"
            }
            else {
                git add -A
            }

            git diff --cached --quiet
            if ($LASTEXITCODE -eq 0) {
                Write-Host "커밋할 변경사항이 없습니다."
            }
            else {
                $target = if ($Project) { $Project } else { "all" }
                $msg = "sync($target): $env:COMPUTERNAME $(Get-Date -Format 's')"
                & git commit -m $msg
                if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
            }
        }
        finally {
            Pop-Location
        }

        Invoke-Git @("pull", "--rebase")
        Invoke-Git @("push")
        Write-Host "업로드 완료."
    }
}
