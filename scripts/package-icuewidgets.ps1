param(
  [string]$CliPath = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$buildRoot = Join-Path $root ".icuewidget-build"
$outRoot = Join-Path $root "dist\icuewidgets"

if (-not $CliPath) {
  $cmd = Get-Command icuewidget -ErrorAction SilentlyContinue
  if ($cmd) {
    $CliPath = $cmd.Source
  } else {
    $defaultCli = Join-Path $env:LOCALAPPDATA "Programs\iCUEWidgetCLI\bin\icuewidget.exe"
    if (Test-Path $defaultCli) { $CliPath = $defaultCli }
  }
}

if (-not $CliPath -or -not (Test-Path $CliPath)) {
  throw "icuewidget CLI not found. Install WidgetBuilder CLI first."
}

function Reset-Directory($path) {
  $full = [System.IO.Path]::GetFullPath($path)
  $rootFull = [System.IO.Path]::GetFullPath($root)
  if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete outside repo: $full"
  }
  if (Test-Path $full) { Remove-Item -LiteralPath $full -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $full | Out-Null
}

function Copy-Tree($src, $dst) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -LiteralPath $src -Force | ForEach-Object {
    if ($_.Name -in @(".git", "node_modules", "dist", "build", ".next", "coverage", "vendor", "target")) { return }
    Copy-Item -LiteralPath $_.FullName -Destination $dst -Recurse -Force
  }
}

function New-IconSvg($path, $accent, $label) {
  New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
  @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#050505"/>
  <rect x="7" y="7" width="50" height="50" rx="11" fill="$accent" opacity=".16"/>
  <rect x="7.5" y="7.5" width="49" height="49" rx="10.5" fill="none" stroke="$accent" stroke-opacity=".55"/>
  <text x="32" y="39" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="700" fill="$accent">$label</text>
</svg>
"@ | Set-Content -LiteralPath $path -Encoding utf8
}

function Update-IndexForPackage($path) {
  $html = Get-Content -LiteralPath $path -Raw
  $html = $html.Replace("../productivity/theme-loader.js", "./theme-loader.js")
  $html = $html.Replace("../productivity/size-loader.js", "./size-loader.js")
  $html = $html.Replace("../productivity/xeneon-edge.css", "./xeneon-edge.css")
  $html = $html.Replace("../theme-loader.js", "./theme-loader.js")
  $html = $html.Replace("../size-loader.js", "./size-loader.js")
  $html = $html.Replace("../xeneon-edge.css", "./xeneon-edge.css")
  $html = $html.Replace("../widget-polish.css", "./widget-polish.css")
  $html = $html.Replace("../../widget-polish.css", "./widget-polish.css")
  $html = [regex]::Replace($html, '<link rel="icon"[^>]*>', '<link rel="icon" type="image/svg+xml" href="resources/icon.svg" />')
  if ($html -notmatch '<link rel="icon"') {
    $html = [regex]::Replace($html, '(<title>.*?</title>)', "`$1`r`n    <link rel=`"icon`" type=`"image/svg+xml`" href=`"resources/icon.svg`" />", 1)
  }
  Set-Content -LiteralPath $path -Value $html -Encoding utf8
}

function New-IcueWidgetArchive($source, $output) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipPath = "$output.zip"
  if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  if (Test-Path $output) { Remove-Item -LiteralPath $output -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($source, $zipPath)
  Move-Item -LiteralPath $zipPath -Destination $output -Force
}

$widgets = @(
  @{ slug="ai-assistant"; source="ai-assistant"; name="AI Assistant"; id="com.stealthylabshq.aiassistant"; desc="AI assistant widget for iCUE."; accent="#a78bfa"; label="AI" },
  @{ slug="spotify-visualizer"; source="spotify-visualizer"; name="Spotify Visualizer"; id="com.stealthylabshq.spotifyvisualizer"; desc="Spotify playback visualizer for iCUE."; accent="#1DB954"; label="SP" },
  @{ slug="iss-horizon"; source="iss-horizon"; name="ISS Horizon"; id="com.stealthylabshq.isshorizon"; desc="ISS tracking widget for iCUE."; accent="#00c8ff"; label="IS" },
  @{ slug="news-radar"; source="news-radar"; name="News Radar"; id="com.stealthylabshq.newsradar"; desc="News feed widget for iCUE."; accent="#0984e3"; label="NR" },
  @{ slug="budget"; source="productivity\budget"; name="Budget"; id="com.stealthylabshq.budget"; desc="Budget tracker widget for iCUE."; accent="#f9ca24"; label="BU" },
  @{ slug="daily-focus"; source="productivity\daily-focus"; name="Daily Focus"; id="com.stealthylabshq.dailyfocus"; desc="Daily focus widget for iCUE."; accent="#a29bfe"; label="DF" },
  @{ slug="habit-tracker"; source="productivity\habit-tracker"; name="Habit Tracker"; id="com.stealthylabshq.habittracker"; desc="Habit tracker widget for iCUE."; accent="#00b894"; label="HT" },
  @{ slug="hydration"; source="productivity\hydration"; name="Hydration"; id="com.stealthylabshq.hydration"; desc="Hydration tracker widget for iCUE."; accent="#00cec9"; label="HY" },
  @{ slug="notes"; source="productivity\notes"; name="Quick Notes"; id="com.stealthylabshq.quicknotes"; desc="Quick notes widget for iCUE."; accent="#fdcb6e"; label="NO" },
  @{ slug="pomodoro"; source="productivity\pomodoro"; name="Pomodoro"; id="com.stealthylabshq.pomodoro"; desc="Pomodoro timer widget for iCUE."; accent="#00c8ff"; label="PO" },
  @{ slug="posture-reminder"; source="productivity\posture-reminder"; name="Posture Reminder"; id="com.stealthylabshq.posturereminder"; desc="Posture and blink reminder widget for iCUE."; accent="#55efc4"; label="PR" },
  @{ slug="quick-clipboard"; source="productivity\quick-clipboard"; name="Quick Clipboard"; id="com.stealthylabshq.quickclipboard"; desc="Quick clipboard widget for iCUE."; accent="#74b9ff"; label="QC" },
  @{ slug="timer"; source="productivity\timer"; name="Timer"; id="com.stealthylabshq.timer"; desc="Timer and countdown widget for iCUE."; accent="#00c8ff"; label="TI" }
)

Reset-Directory $buildRoot
Reset-Directory $outRoot

$sharedFiles = @("widget-polish.css", "productivity\theme-loader.js", "productivity\size-loader.js", "productivity\xeneon-edge.css")

foreach ($widget in $widgets) {
  $src = Join-Path $root $widget.source
  $dst = Join-Path $buildRoot $widget.slug
  Copy-Tree $src $dst

  foreach ($shared in $sharedFiles) {
    $sharedSrc = Join-Path $root $shared
    if (Test-Path $sharedSrc) {
      Copy-Item -LiteralPath $sharedSrc -Destination (Join-Path $dst (Split-Path $shared -Leaf)) -Force
    }
  }

  New-IconSvg (Join-Path $dst "resources\icon.svg") $widget.accent $widget.label
  Update-IndexForPackage (Join-Path $dst "index.html")

  $manifest = [ordered]@{
    author = "StealthyLabsHQ"
    id = $widget.id
    name = $widget.name
    description = $widget.desc
    version = "1.0.0"
    preview_icon = "resources/icon.svg"
    min_framework_version = "1.0.0"
    os = @(@{ platform = "windows" })
    supported_devices = @(@{ type = "dashboard_lcd" })
    interactive = $true
  }
  $manifestJson = $manifest | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText((Join-Path $dst "manifest.json"), $manifestJson, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText((Join-Path $dst "translation.json"), "{}", [System.Text.UTF8Encoding]::new($false))

  & $CliPath validate $dst
  if ($LASTEXITCODE -ne 0) { throw "Validation failed for $($widget.slug)" }

  $output = Join-Path $outRoot ($widget.slug + ".icuewidget")
  & $CliPath package $dst --output $output
  if ($LASTEXITCODE -ne 0) { throw "Packaging failed for $($widget.slug)" }
  if ((Get-Item -LiteralPath $output).Length -le 22) {
    New-IcueWidgetArchive $dst $output
  }
}

Write-Host "Packaged $($widgets.Count) widgets into $outRoot"
