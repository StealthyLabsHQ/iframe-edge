param(
  [string]$CliPath = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$buildRoot = Join-Path $root "icuewidget-build"
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

function Get-IconSvgFragment($icon, $label) {
  switch ($icon) {
    "ai" { return @'
<path d="M32 12l3.7 10.3L46 26l-10.3 3.7L32 40l-3.7-10.3L18 26l10.3-3.7L32 12z" fill="currentColor" stroke="none"/>
<path d="M45 38l1.8 5.2L52 45l-5.2 1.8L45 52l-1.8-5.2L38 45l5.2-1.8L45 38z" fill="currentColor" stroke="none" opacity=".75"/>
'@ }
    "spotify" { return @'
<circle cx="32" cy="32" r="17" fill="currentColor" stroke="none"/>
<path d="M22 27c7-2 15-1.5 21 2" stroke="#050505" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M24 33c5.5-1.4 12-.9 17 1.7" stroke="#050505" stroke-width="2.4" stroke-linecap="round" fill="none"/>
<path d="M26 38c4-1 9-.6 13 1.3" stroke="#050505" stroke-width="2" stroke-linecap="round" fill="none"/>
'@ }
    "iss" { return @'
<path d="M18 36l28-14" fill="none"/>
<path d="M27 27l10 10" fill="none"/>
<rect x="14" y="31" width="11" height="8" rx="2"/>
<rect x="39" y="20" width="11" height="8" rx="2"/>
<rect x="27" y="28" width="10" height="8" rx="2" fill="currentColor" stroke="none"/>
'@ }
    "news" { return @'
<rect x="18" y="16" width="28" height="34" rx="3"/>
<path d="M24 25h16M24 32h16M24 39h10"/>
<path d="M40 39h1"/>
'@ }
    "budget" { return @'
<path d="M32 15v34"/>
<path d="M42 23c-3-4-14-5-17 0-4 7 17 6 14 14-2.5 6-14 5-18 0"/>
'@ }
    "focus" { return @'
<circle cx="32" cy="32" r="18"/>
<circle cx="32" cy="32" r="10"/>
<circle cx="32" cy="32" r="3" fill="currentColor" stroke="none"/>
'@ }
    "habit" { return @'
<rect x="16" y="17" width="32" height="32" rx="6"/>
<path d="M23 33l6 6 13-15"/>
'@ }
    "hydration" { return @'
<path d="M32 14c8 10 13 17 13 25a13 13 0 0 1-26 0c0-8 5-15 13-25z"/>
<path d="M25 40c2 4 6 6 11 5"/>
'@ }
    "notes" { return @'
<path d="M20 15h18l8 8v26H20z"/>
<path d="M38 15v9h8"/>
<path d="M26 31h13M26 38h13"/>
'@ }
    "pomodoro" { return @'
<path d="M32 20c8 0 15 6 15 14s-7 16-15 16-15-8-15-16 7-14 15-14z"/>
<path d="M32 20c-2-5 1-8 5-8"/>
<path d="M28 20l-5-5M36 20l5-5"/>
'@ }
    "posture" { return @'
<circle cx="32" cy="16" r="5"/>
<path d="M32 22v16"/>
<path d="M22 30h20"/>
<path d="M32 38l-9 11M32 38l9 11"/>
'@ }
    "clipboard" { return @'
<rect x="20" y="18" width="24" height="32" rx="4"/>
<path d="M27 18c0-3 2-5 5-5s5 2 5 5"/>
<path d="M26 30h12M26 37h12"/>
'@ }
    "timer" { return @'
<path d="M23 15h18"/>
<path d="M24 49h16"/>
<path d="M26 15c0 9 12 9 12 17S26 40 26 49"/>
<path d="M38 15c0 9-12 9-12 17s12 8 12 17"/>
'@ }
    default { return "<text x=`"32`" y=`"39`" text-anchor=`"middle`" font-family=`"Inter, Arial, sans-serif`" font-size=`"19`" font-weight=`"700`" fill=`"currentColor`" stroke=`"none`">$label</text>" }
  }
}

function New-IconSvg($path, $accent, $label, $icon) {
  New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
  $glyph = Get-IconSvgFragment $icon $label
  $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="$accent" opacity=".16"/>
  <circle cx="32" cy="32" r="27.5" fill="none" stroke="$accent" stroke-opacity=".58"/>
  <g color="$accent" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none">
$glyph
  </g>
</svg>
"@
  [System.IO.File]::WriteAllText($path, $svg, [System.Text.UTF8Encoding]::new($false))
}

function Update-HtmlForPackage($path, $title, $updateAssetPaths) {
  $html = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))
  $html = [regex]::Replace($html, '(?i)<!doctype\s+html>', '<!DOCTYPE html>', 1)
  if ($updateAssetPaths) {
    $html = $html.Replace("../productivity/theme-loader.js", "./theme-loader.js")
    $html = $html.Replace("../productivity/size-loader.js", "./size-loader.js")
    $html = $html.Replace("../productivity/xeneon-edge.css", "./xeneon-edge.css")
    $html = $html.Replace("../theme-loader.js", "./theme-loader.js")
    $html = $html.Replace("../size-loader.js", "./size-loader.js")
    $html = $html.Replace("../xeneon-edge.css", "./xeneon-edge.css")
    $html = $html.Replace("../../widget-polish.css", "./widget-polish.css")
    $html = $html.Replace("../widget-polish.css", "./widget-polish.css")
    $html = [regex]::Replace($html, '<link rel="icon"[^>]*>', '<link rel="icon" type="image/svg+xml" href="resources/icon.svg" />')
  }
  $html = [regex]::Replace($html, '<title>.*?</title>', "", 1)
  $viewportPattern = '<meta\b(?=[^>]*\bname=["'']viewport["''])[^>]*>'
  if ($html -notmatch $viewportPattern) {
    $html = [regex]::Replace($html, '(<meta\s+charset=["''][^"'']+["'']\s*/?>)', "`$1`r`n    <meta name=`"viewport`" content=`"width=device-width, initial-scale=1.0`" />", 1)
  }
  $titleKey = $title.Replace("'", "\'")
  $titleTag = "<title>tr('$titleKey')</title>"
  if ($html -match $viewportPattern) {
    $html = [regex]::Replace($html, "($viewportPattern)", "`$1`r`n    $titleTag", 1)
  } else {
    $html = [regex]::Replace($html, '(<meta\s+charset=["''][^"'']+["'']\s*/?>)', "`$1`r`n    $titleTag", 1)
  }
  if ($html -notmatch '\bicueEvents\s*=') {
    $html = [regex]::Replace($html, '</head>', "    <script src=`"./scripts/icue-events-bridge.js`"></script>`r`n</head>", 1)
  }
  if ($updateAssetPaths -and $html -notmatch '<link rel="icon"') {
    $html = [regex]::Replace($html, '(<title>.*?</title>)', "`$1`r`n    <link rel=`"icon`" type=`"image/svg+xml`" href=`"resources/icon.svg`" />", 1)
  }
  [System.IO.File]::WriteAllText($path, $html, [System.Text.UTF8Encoding]::new($false))
}

function Move-RootAssetsForPackage($dst, $indexPath) {
  $html = [System.IO.File]::ReadAllText($indexPath, [System.Text.UTF8Encoding]::new($false))
  $moves = @()

  Get-ChildItem -LiteralPath $dst -File -Filter *.js | ForEach-Object {
    $targetDir = Join-Path $dst "scripts"
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $target = Join-Path $targetDir $_.Name
    Move-Item -LiteralPath $_.FullName -Destination $target -Force
    $moves += @{ Name = $_.Name; Prefix = "scripts" }
  }

  Get-ChildItem -LiteralPath $dst -File -Filter *.css | ForEach-Object {
    $targetDir = Join-Path $dst "styles"
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $target = Join-Path $targetDir $_.Name
    Move-Item -LiteralPath $_.FullName -Destination $target -Force
    $moves += @{ Name = $_.Name; Prefix = "styles" }
  }

  foreach ($move in $moves) {
    $name = [regex]::Escape($move.Name)
    $prefix = $move.Prefix
    $html = [regex]::Replace($html, "(`"|')(\./)?$name(`"|')", "`${1}./$prefix/$($move.Name)`${3}")
  }

  [System.IO.File]::WriteAllText($indexPath, $html, [System.Text.UTF8Encoding]::new($false))
}

function New-TranslationJson($path, $title, $extraKeys = @()) {
  $keys = @($title, "Settings") + $extraKeys | Select-Object -Unique
  $translation = [ordered]@{}
  @("en", "de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh_CN", "zh_TW", "uk") | ForEach-Object {
    $values = [ordered]@{}
    foreach ($key in $keys) {
      $values[$key] = $key
    }
    $translation[$_] = [ordered]@{
      translation = $values
    }
  }
  $json = $translation | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
}

function New-IcueWidgetArchive($source, $output) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path $output) { Remove-Item -LiteralPath $output -Force }

  $zip = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $sourceFull = [System.IO.Path]::GetFullPath($source).TrimEnd('\')
    $files = Get-ChildItem -LiteralPath $sourceFull -Recurse -File | ForEach-Object {
      $relative = $_.FullName.Substring($sourceFull.Length + 1).Replace('\', '/')
      [PSCustomObject]@{ File = $_; Relative = $relative }
    }
    $priority = @("index.html", "manifest.json", "translation.json", "resources/icon.svg")
    $orderedFiles = @()
    foreach ($name in $priority) {
      $orderedFiles += $files | Where-Object { $_.Relative -eq $name }
    }
    $orderedFiles += $files | Where-Object { $priority -notcontains $_.Relative } | Sort-Object Relative

    $orderedFiles | ForEach-Object {
      $relative = $_.Relative
      $entry = $zip.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
      $entryStream = $entry.Open()
      $fileStream = [System.IO.File]::OpenRead($_.File.FullName)
      try {
        $fileStream.CopyTo($entryStream)
      } finally {
        $fileStream.Dispose()
        $entryStream.Dispose()
      }
    }
  } finally {
    $zip.Dispose()
  }
}

$widgets = @(
  @{ slug="ai-assistant"; source="ai-assistant"; name="AI Assistant"; id="com.stealthylabshq.aiassistant"; desc="AI assistant widget for iCUE."; accent="#a78bfa"; label="AI"; icon="ai" },
  @{ slug="spotify-visualizer"; source="spotify-visualizer"; name="Spotify Visualizer"; id="com.stealthylabshq.spotifyvisualizer"; desc="Spotify playback visualizer for iCUE."; accent="#1DB954"; label="SP"; icon="spotify"; keys=@("Spotify Connection", "Spotify Client ID", "Refresh Token", "Spotify Developer Dashboard"); plugins=@("widgetbuilder.linkprovider:Url:1.0") },
  @{ slug="iss-horizon"; source="iss-horizon"; name="ISS Horizon"; id="com.stealthylabshq.isshorizon"; desc="ISS tracking widget for iCUE."; accent="#00c8ff"; label="IS"; icon="iss" },
  @{ slug="news-radar"; source="news-radar"; name="News Radar"; id="com.stealthylabshq.newsradar"; desc="News feed widget for iCUE."; accent="#0984e3"; label="NR"; icon="news" },
  @{ slug="budget"; source="productivity\budget"; name="Budget"; id="com.stealthylabshq.budget"; desc="Budget tracker widget for iCUE."; accent="#f9ca24"; label="BU"; icon="budget" },
  @{ slug="daily-focus"; source="productivity\daily-focus"; name="Daily Focus"; id="com.stealthylabshq.dailyfocus"; desc="Daily focus widget for iCUE."; accent="#a29bfe"; label="DF"; icon="focus" },
  @{ slug="habit-tracker"; source="productivity\habit-tracker"; name="Habit Tracker"; id="com.stealthylabshq.habittracker"; desc="Habit tracker widget for iCUE."; accent="#00b894"; label="HT"; icon="habit" },
  @{ slug="hydration"; source="productivity\hydration"; name="Hydration"; id="com.stealthylabshq.hydration"; desc="Hydration tracker widget for iCUE."; accent="#00cec9"; label="HY"; icon="hydration" },
  @{ slug="notes"; source="productivity\notes"; name="Quick Notes"; id="com.stealthylabshq.quicknotes"; desc="Quick notes widget for iCUE."; accent="#fdcb6e"; label="NO"; icon="notes" },
  @{ slug="pomodoro"; source="productivity\pomodoro"; name="Pomodoro"; id="com.stealthylabshq.pomodoro"; desc="Pomodoro timer widget for iCUE."; accent="#00c8ff"; label="PO"; icon="pomodoro" },
  @{ slug="posture-reminder"; source="productivity\posture-reminder"; name="Posture Reminder"; id="com.stealthylabshq.posturereminder"; desc="Posture and blink reminder widget for iCUE."; accent="#55efc4"; label="PR"; icon="posture" },
  @{ slug="quick-clipboard"; source="productivity\quick-clipboard"; name="Quick Clipboard"; id="com.stealthylabshq.quickclipboard"; desc="Quick clipboard widget for iCUE."; accent="#74b9ff"; label="QC"; icon="clipboard" },
  @{ slug="timer"; source="productivity\timer"; name="Timer"; id="com.stealthylabshq.timer"; desc="Timer and countdown widget for iCUE."; accent="#00c8ff"; label="TI"; icon="timer" }
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

  $bridgeDir = Join-Path $dst "scripts"
  New-Item -ItemType Directory -Force -Path $bridgeDir | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $bridgeDir "icue-events-bridge.js"), "icueEvents={onDataUpdated:function(){},onICUEInitialized:function(){}};`n", [System.Text.UTF8Encoding]::new($false))

  $iconPath = Join-Path $dst "resources\icon.svg"
  $sourceIcon = Join-Path $root "svg\$($widget.icon).svg"
  if (Test-Path $sourceIcon) {
    New-Item -ItemType Directory -Force -Path (Split-Path $iconPath) | Out-Null
    Copy-Item -LiteralPath $sourceIcon -Destination $iconPath -Force
  } else {
    New-IconSvg $iconPath $widget.accent $widget.label $widget.icon
  }
  $indexPath = Join-Path $dst "index.html"
  Update-HtmlForPackage $indexPath $widget.name $true
  Move-RootAssetsForPackage $dst $indexPath
  Get-ChildItem -LiteralPath $dst -Recurse -Filter *.html | Where-Object {
    $_.FullName -ne $indexPath
  } | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
  }

  $manifest = [ordered]@{
    author = "StealthyLabsHQ"
    id = $widget.id
    name = $widget.name
    description = $widget.desc
    version = "1.0.0"
    preview_icon = "resources/icon.svg"
    min_framework_version = "1.0.0"
    os = @(@{ platform = "windows" })
    supported_devices = @([ordered]@{ type = "dashboard_lcd"; features = @("sensor-screen") })
    interactive = $true
  }
  if ($widget.ContainsKey("plugins")) {
    $manifest.required_plugins = $widget["plugins"]
  }
  $manifestJson = $manifest | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText((Join-Path $dst "manifest.json"), $manifestJson, [System.Text.UTF8Encoding]::new($false))
  $translationKeys = @()
  if ($widget.ContainsKey("keys")) { $translationKeys = $widget["keys"] }
  New-TranslationJson (Join-Path $dst "translation.json") $widget.name $translationKeys

  & $CliPath validate $dst
  if ($LASTEXITCODE -ne 0) { throw "Validation failed for $($widget.slug)" }

  $output = Join-Path $outRoot ($widget.slug + ".icuewidget")
  & $CliPath package $dst --output $output
  if ($LASTEXITCODE -ne 0) { throw "Packaging failed for $($widget.slug)" }
  New-IcueWidgetArchive $dst $output
}

Write-Host "Packaged $($widgets.Count) widgets into $outRoot"
