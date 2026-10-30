param(
    [string]$JrePath = (Join-Path $PSScriptRoot '..\..\.preview\jre\jdk-17.0.20.1+1-jre'),
    [string]$Output = (Join-Path $PSScriptRoot '..\..\.preview\dist'),
    [string]$Version = '1.0.0',
    [string]$WebView2Version = '1.0.4314.35',
    [switch]$SkipBackend,
    [switch]$SkipSelfTest
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$jar = Join-Path $root 'backend\target\math-server.jar'
$name = "Axiom-Desktop-EXE-$Version"
$stage = Join-Path $Output $name
$workspace = Join-Path $root '.preview'
$sdk = Join-Path $workspace 'webview2'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not $SkipBackend) {
    $env:JAVA_HOME = Join-Path $workspace 'jdk\jdk-17.0.20.1+1'
    $mvn = Join-Path $workspace 'maven\apache-maven-3.9.11\bin\mvn.cmd'
    Push-Location (Join-Path $root 'backend')
    try {
        & $mvn -B "-Dmaven.repo.local=$workspace\m2" package
        if ($LASTEXITCODE -ne 0) { throw "Maven build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
}
if (-not (Test-Path $jar)) { throw "Missing $jar" }
if (-not (Test-Path $JrePath)) { throw "Missing JRE: $JrePath" }
if (-not (Test-Path $csc)) { throw "Missing .NET Framework C# compiler: $csc" }

# WebView2 SDK is only needed to compile; the runtime is provided by Windows.
New-Item -ItemType Directory -Force $workspace | Out-Null
$nupkg = Join-Path $workspace "webview2-$WebView2Version.nupkg"
if (-not (Test-Path $nupkg)) {
    Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$WebView2Version/microsoft.web.webview2.$WebView2Version.nupkg" -OutFile $nupkg -TimeoutSec 120
}
if (-not (Test-Path (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'))) {
    $zip = Join-Path $workspace 'webview2.zip'
    Copy-Item $nupkg $zip -Force
    if (Test-Path $sdk) { Remove-Item $sdk -Recurse -Force }
    Expand-Archive $zip -DestinationPath $sdk
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage, (Join-Path $stage 'app'), (Join-Path $stage 'frontend'), (Join-Path $stage 'runtime') | Out-Null

$png = Join-Path $root 'frontend\brand\sources\axiom-approved.png'
$ico = Join-Path $stage 'app.ico'
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($png)
$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($image, 0, 0, 256, 256)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Create($ico)
$icon.Save($stream)
$stream.Close()
$graphics.Dispose(); $bitmap.Dispose(); $image.Dispose()

$refs = @(
    (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll'),
    (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'),
    'System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll'
)
$compile = @('/nologo', '/target:winexe', '/platform:x64', '/codepage:65001', "/out:$stage\Axiom.exe", "/win32icon:$ico")
foreach ($reference in $refs) { $compile += "/reference:$reference" }
$compile += (Join-Path $PSScriptRoot 'Program.cs')
& $csc @compile
if ($LASTEXITCODE -ne 0) { throw "csc failed ($LASTEXITCODE)" }

Copy-Item (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.Core.dll') $stage
Copy-Item (Join-Path $sdk 'lib\net462\Microsoft.Web.WebView2.WinForms.dll') $stage
Copy-Item (Join-Path $sdk 'runtimes\win-x64\native\WebView2Loader.dll') $stage
Copy-Item $jar (Join-Path $stage 'app\math-server.jar')
& robocopy (Join-Path $root 'frontend') (Join-Path $stage 'frontend') /E /XD tests node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy frontend failed ($LASTEXITCODE)" }
& robocopy $JrePath (Join-Path $stage 'runtime') /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy JRE failed ($LASTEXITCODE)" }
Copy-Item (Join-Path $PSScriptRoot 'README.txt') $stage
Set-Content -Path (Join-Path $stage 'VERSION.txt') -Value $Version -Encoding ASCII

if (-not $SkipSelfTest) {
    $test = Start-Process -FilePath (Join-Path $stage 'Axiom.exe') -ArgumentList '--selftest' -WorkingDirectory $stage -WindowStyle Hidden -PassThru -Wait
    $result = Join-Path $stage 'selftest-result.txt'
    if ($test.ExitCode -ne 0 -or -not (Test-Path $result) -or -not ((Get-Content $result -Raw) -match '^OK ')) {
        throw "Client selftest failed; see $result"
    }
    Remove-Item (Join-Path $stage 'selftest') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $result -Force -ErrorAction SilentlyContinue
}

$zip = Join-Path $Output "$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "EXE client: $zip ($size MB)"
Write-Host "Stage:      $stage"
