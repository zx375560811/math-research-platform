param(
    [string]$JrePath = (Join-Path $PSScriptRoot '..\.preview\jre\jdk-17.0.20.1+1-jre'),
    [string]$Output = (Join-Path $PSScriptRoot '..\.preview\dist'),
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$jar = Join-Path $root 'backend\target\math-server.jar'
$version = '1.0.0'
$name = "Axiom-Desktop-$version"
$stage = Join-Path $Output $name

function Invoke-Robocopy([string]$source, [string]$destination, [string[]]$excludeDirs = @()) {
    $args = @($source, $destination, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    if ($excludeDirs.Count -gt 0) { $args += '/XD'; $args += $excludeDirs }
    & robocopy @args | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $source -> $destination" }
}

if (-not $SkipBuild) {
    $env:JAVA_HOME = Join-Path $root '.preview\jdk\jdk-17.0.20.1+1'
    $mvn = Join-Path $root '.preview\maven\apache-maven-3.9.11\bin\mvn.cmd'
    Push-Location (Join-Path $root 'backend')
    try {
        & $mvn -B "-Dmaven.repo.local=$root\.preview\m2" package
        if ($LASTEXITCODE -ne 0) { throw "Maven build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
}

if (-not (Test-Path $jar)) { throw "Missing $jar" }
if (-not (Test-Path $JrePath)) { throw "Missing JRE: $JrePath" }

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage, (Join-Path $stage 'app'), (Join-Path $stage 'frontend'), (Join-Path $stage 'runtime'), (Join-Path $stage 'data'), (Join-Path $stage 'logs') | Out-Null

Copy-Item $jar (Join-Path $stage 'app\math-server.jar')
Invoke-Robocopy (Join-Path $root 'frontend') (Join-Path $stage 'frontend') @('tests', 'node_modules')
Invoke-Robocopy $JrePath (Join-Path $stage 'runtime')
Copy-Item (Join-Path $PSScriptRoot 'launcher\start.bat') $stage
Copy-Item (Join-Path $PSScriptRoot 'launcher\run-server.bat') $stage
Copy-Item (Join-Path $PSScriptRoot 'launcher\stop.bat') $stage
Copy-Item (Join-Path $PSScriptRoot 'launcher\stop.ps1') $stage
Copy-Item (Join-Path $PSScriptRoot 'launcher\README.txt') $stage
Set-Content -Path (Join-Path $stage 'VERSION.txt') -Value $version -Encoding ASCII

$zip = Join-Path $Output "$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Client: $zip ($size MB)"
Write-Host "Stage:  $stage"
