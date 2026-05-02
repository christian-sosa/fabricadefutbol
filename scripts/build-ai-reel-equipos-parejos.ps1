param(
  [string]$ScenesDir = "brand-assets/reels/ai-scenes",
  [string]$OutputDir = "brand-assets/reels",
  [string]$FramesDir = ".tmp/reel-ai-equipos-parejos-frames"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$width = 1080
$height = 1920
$fps = 24
$durationSeconds = 15
$totalFrames = $fps * $durationSeconds

$repoRoot = (Resolve-Path ".").Path
$scenesPath = Join-Path $repoRoot $ScenesDir
$outputPath = Join-Path $repoRoot $OutputDir
$framesPath = Join-Path $repoRoot $FramesDir
$videoPath = Join-Path $outputPath "reel-ai-equipos-parejos.mp4"
$thumbnailPath = Join-Path $outputPath "reel-ai-equipos-parejos-thumb.png"

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
if (Test-Path $framesPath) {
  Remove-Item -LiteralPath $framesPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $framesPath | Out-Null

$sceneFiles = 1..5 | ForEach-Object { Join-Path $scenesPath ("scene-{0:D2}.png" -f $_) }
foreach ($sceneFile in $sceneFiles) {
  if (-not (Test-Path $sceneFile)) {
    throw "Missing scene file: $sceneFile"
  }
}

$fontEyebrow = New-Object System.Drawing.Font("Arial", 38, [System.Drawing.FontStyle]::Bold)
$fontTitle = New-Object System.Drawing.Font("Arial", 76, [System.Drawing.FontStyle]::Bold)
$fontCaption = New-Object System.Drawing.Font("Arial", 36, [System.Drawing.FontStyle]::Bold)
$fontBrand = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)
$fontSmall = New-Object System.Drawing.Font("Arial", 26, [System.Drawing.FontStyle]::Regular)

$white = [System.Drawing.Brushes]::White
$emerald = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
$slateText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 226, 232, 240))
$muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$blackTop = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(172, 2, 6, 23))
$blackBottom = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(118, 2, 6, 23))
$emeraldSoft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(224, 16, 185, 129))
$slateCard = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(218, 15, 23, 42))

function Draw-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Rectangle]$Rect,
    [int]$Radius,
    [System.Drawing.Brush]$Brush
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}

function Draw-TextBox {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H,
    [System.Drawing.StringAlignment]$Alignment = [System.Drawing.StringAlignment]::Near
  )

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = $Alignment
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::Word
  $rect = New-Object System.Drawing.RectangleF($X, $Y, $W, $H)
  $Graphics.DrawString($Text, $Font, $Brush, $rect, $format)
}

function Draw-CoverImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Image]$Image,
    [double]$Zoom,
    [double]$PanX,
    [double]$PanY
  )

  $srcW = $Image.Width
  $srcH = $Image.Height
  $targetRatio = $width / $height
  $srcRatio = $srcW / $srcH

  if ($srcRatio -gt $targetRatio) {
    $cropH = $srcH / $Zoom
    $cropW = $cropH * $targetRatio
  } else {
    $cropW = $srcW / $Zoom
    $cropH = $cropW / $targetRatio
  }

  $maxX = [Math]::Max(0, $srcW - $cropW)
  $maxY = [Math]::Max(0, $srcH - $cropH)
  $srcX = [Math]::Min($maxX, [Math]::Max(0, ($maxX / 2) + ($PanX * $maxX / 2)))
  $srcY = [Math]::Min($maxY, [Math]::Max(0, ($maxY / 2) + ($PanY * $maxY / 2)))

  $srcRect = New-Object System.Drawing.RectangleF($srcX, $srcY, $cropW, $cropH)
  $dstRect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
  $Graphics.DrawImage($Image, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
}

$slides = @(
  @{
    Start = 0; End = 3; Scene = 0
    Eyebrow = "EN TODO GRUPO PASA"
    Title = "El que arma equipos siempre cae con los mejores"
    Caption = "Casualidad, obvio."
  },
  @{
    Start = 3; End = 6; Scene = 1
    Eyebrow = "DESPUES DEL 9-2"
    Title = "La frase de siempre:"
    Caption = "No estaban parejos."
  },
  @{
    Start = 6; End = 9; Scene = 2
    Eyebrow = "CON DATOS"
    Title = "Cargas niveles, invitados y arqueros"
    Caption = "Y la app propone equipos mas parejos."
  },
  @{
    Start = 9; End = 12; Scene = 3
    Eyebrow = "DESPUES DEL PARTIDO"
    Title = "Resultado, ranking e historial"
    Caption = "Todo queda guardado para el grupo."
  },
  @{
    Start = 12; End = 15; Scene = 4
    Eyebrow = "PROBALO GRATIS"
    Title = "Tu grupo ordenado desde el proximo partido"
    Caption = "fabricadefutbol.com.ar"
  }
)

$sceneImages = $sceneFiles | ForEach-Object { [System.Drawing.Image]::FromFile($_) }

try {
  for ($i = 0; $i -lt $totalFrames; $i++) {
    $t = $i / $fps
    $slide = $slides | Where-Object { $t -ge $_.Start -and $t -lt $_.End } | Select-Object -First 1
    if (-not $slide) { $slide = $slides[-1] }
    $localT = ($t - $slide.Start) / ($slide.End - $slide.Start)
    $ease = [Math]::Sin([Math]::Min(1, [Math]::Max(0, $localT)) * [Math]::PI / 2)
    $fadeAlpha = [int](255 * [Math]::Min(1, $localT * 3))
    $titleY = 190 + [int]((1 - $ease) * 44)
    $zoom = 1.02 + (0.075 * $ease)
    $panX = [Math]::Sin($t * 0.55) * 0.12
    $panY = [Math]::Cos($t * 0.45) * 0.10

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    Draw-CoverImage -Graphics $graphics -Image $sceneImages[$slide.Scene] -Zoom $zoom -PanX $panX -PanY $panY

    $graphics.FillRectangle($blackTop, 0, 0, $width, 610)
    $graphics.FillRectangle($blackBottom, 0, 1500, $width, 420)

    $fadeWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($fadeAlpha, 255, 255, 255))
    $fadeEmerald = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($fadeAlpha, 16, 185, 129))
    $fadeSlate = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($fadeAlpha, 226, 232, 240))

    Draw-TextBox -Graphics $graphics -Text $slide.Eyebrow -Font $fontEyebrow -Brush $fadeEmerald -X 72 -Y (120 + [int]((1 - $ease) * 24)) -W 936 -H 70
    Draw-TextBox -Graphics $graphics -Text $slide.Title -Font $fontTitle -Brush $fadeWhite -X 72 -Y $titleY -W 936 -H 285

    $captionRect = [System.Drawing.Rectangle]::new(72, 1518, 936, 144)
    Draw-RoundedRect -Graphics $graphics -Rect $captionRect -Radius 34 -Brush $(if ($slide.Scene -eq 4) { $emeraldSoft } else { $slateCard })
    Draw-TextBox -Graphics $graphics -Text $slide.Caption -Font $fontCaption -Brush $white -X 108 -Y 1554 -W 864 -H 80 -Alignment ([System.Drawing.StringAlignment]::Center)

    $progressW = [int](936 * (($i + 1) / $totalFrames))
    Draw-RoundedRect -Graphics $graphics -Rect ([System.Drawing.Rectangle]::new(72, 1768, 936, 12)) -Radius 6 -Brush $slateCard
    Draw-RoundedRect -Graphics $graphics -Rect ([System.Drawing.Rectangle]::new(72, 1768, $progressW, 12)) -Radius 6 -Brush $emerald

    $graphics.DrawString("FABRICA DE FUTBOL", $fontBrand, $slateText, 72, 1814)
    $graphics.DrawString("Equipos parejos, ranking e historial para tu grupo", $fontSmall, $muted, 72, 1854)

    $fadeWhite.Dispose()
    $fadeEmerald.Dispose()
    $fadeSlate.Dispose()

    $framePath = Join-Path $framesPath ("frame_{0:D4}.png" -f $i)
    $bitmap.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
    if ($i -eq 0) {
      $bitmap.Save($thumbnailPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $graphics.Dispose()
    $bitmap.Dispose()
  }

  & ffmpeg -y -framerate $fps -i (Join-Path $framesPath "frame_%04d.png") -c:v libx264 -pix_fmt yuv420p -crf 19 -movflags +faststart $videoPath
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed with exit code $LASTEXITCODE"
  }
} finally {
  foreach ($image in $sceneImages) {
    $image.Dispose()
  }
  if (Test-Path $framesPath) {
    Remove-Item -LiteralPath $framesPath -Recurse -Force
  }
}

Write-Output $videoPath
