param(
  [string]$OutputDir = "brand-assets/reels",
  [string]$FramesDir = ".tmp/reel-equipos-parejos-frames"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$width = 720
$height = 1280
$fps = 24
$durationSeconds = 15
$totalFrames = $fps * $durationSeconds

$repoRoot = (Resolve-Path ".").Path
$outputPath = Join-Path $repoRoot $OutputDir
$framesPath = Join-Path $repoRoot $FramesDir
$videoPath = Join-Path $outputPath "reel-equipos-parejos.mp4"
$thumbnailPath = Join-Path $outputPath "reel-equipos-parejos-thumb.png"

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
if (Test-Path $framesPath) {
  Remove-Item -LiteralPath $framesPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $framesPath | Out-Null

$fontBold = New-Object System.Drawing.Font("Arial", 54, [System.Drawing.FontStyle]::Bold)
$fontTitle = New-Object System.Drawing.Font("Arial", 64, [System.Drawing.FontStyle]::Bold)
$fontSmall = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)
$fontTiny = New-Object System.Drawing.Font("Arial", 22, [System.Drawing.FontStyle]::Regular)

$white = [System.Drawing.Brushes]::White
$slate = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
$dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 2, 6, 23))
$emerald = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
$emeraldSoft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 6, 95, 70))
$cyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 34, 211, 238))
$amber = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 251, 191, 36))
$danger = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 113, 113))
$muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))

function Draw-CenteredText {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [int]$Y,
    [int]$MaxWidth = 620
  )

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $rect = New-Object System.Drawing.RectangleF(50, $Y, $MaxWidth, 260)
  $Graphics.DrawString($Text, $Font, $Brush, $rect, $format)
}

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

function Draw-PlayerChip {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [string]$Name,
    [System.Drawing.Brush]$Brush
  )

  Draw-RoundedRect -Graphics $Graphics -Rect ([System.Drawing.Rectangle]::new($X, $Y, 230, 74)) -Radius 24 -Brush $Brush
  $Graphics.FillEllipse($white, $X + 18, $Y + 18, 38, 38)
  $Graphics.DrawString($Name, $fontSmall, $white, $X + 70, $Y + 20)
}

function Draw-Brand {
  param([System.Drawing.Graphics]$Graphics)
  $Graphics.DrawString("FABRICA DE FUTBOL", $fontTiny, $muted, 42, 1182)
  $Graphics.FillEllipse($emerald, 42, 48, 28, 28)
  $Graphics.DrawString("Futbol amateur, ordenado", $fontTiny, $muted, 82, 48)
}

$slides = @(
  @{ Start = 0; End = 3; Eyebrow = "EN TODO GRUPO PASA"; Main = "El que arma equipos siempre cae con los mejores"; Accent = "casualidad, obvio"; Mode = "pick" },
  @{ Start = 3; End = 6; Eyebrow = "DESPUES DEL 9-2"; Main = "Todos dicen: no estaban parejos"; Accent = "y tienen razon"; Mode = "score" },
  @{ Start = 6; End = 9; Eyebrow = "CON DATOS"; Main = "Cargas niveles, invitados y arqueros"; Accent = "la app propone equipos mas parejos"; Mode = "balance" },
  @{ Start = 9; End = 12; Eyebrow = "DESPUES DEL PARTIDO"; Main = "El resultado actualiza ranking e historial"; Accent = "sin planillas eternas"; Mode = "ranking" },
  @{ Start = 12; End = 15; Eyebrow = "PROBALO GRATIS"; Main = "Tu grupo ordenado desde el proximo partido"; Accent = "fabricadefutbol.com.ar"; Mode = "cta" }
)

for ($i = 0; $i -lt $totalFrames; $i++) {
  $t = $i / $fps
  $slide = $slides | Where-Object { $t -ge $_.Start -and $t -lt $_.End } | Select-Object -First 1
  if (-not $slide) { $slide = $slides[-1] }
  $localT = ($t - $slide.Start) / ($slide.End - $slide.Start)
  $ease = [Math]::Sin([Math]::Min(1, $localT) * [Math]::PI / 2)
  $yOffset = [int]((1 - $ease) * 50)

  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Rectangle]::new(0, 0, $width, $height)),
    ([System.Drawing.Color]::FromArgb(255, 2, 6, 23)),
    ([System.Drawing.Color]::FromArgb(255, 15, 23, 42)),
    90
  )
  $graphics.FillRectangle($bg, 0, 0, $width, $height)
  $bg.Dispose()

  $pulse = [int](120 + 35 * [Math]::Sin($t * 2.4))
  $haloBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($pulse, 16, 185, 129))
  $graphics.FillEllipse($haloBrush, -160, 850, 420, 420)
  $graphics.FillEllipse($haloBrush, 480, -90, 300, 300)
  $haloBrush.Dispose()

  Draw-Brand -Graphics $graphics
  Draw-CenteredText -Graphics $graphics -Text $slide.Eyebrow -Font $fontSmall -Brush $emerald -Y (160 + $yOffset)
  Draw-CenteredText -Graphics $graphics -Text $slide.Main -Font $fontTitle -Brush $white -Y (230 + $yOffset)

  $accentRect = [System.Drawing.Rectangle]::new(70, 520, 580, 92)
  Draw-RoundedRect -Graphics $graphics -Rect $accentRect -Radius 24 -Brush $emeraldSoft
  Draw-CenteredText -Graphics $graphics -Text $slide.Accent -Font $fontSmall -Brush $white -Y 542 -MaxWidth 580

  switch ($slide.Mode) {
    "pick" {
      Draw-PlayerChip -Graphics $graphics -X 84 -Y 720 -Name "Crack" -Brush $emerald
      Draw-PlayerChip -Graphics $graphics -X 370 -Y 720 -Name "Figura" -Brush $emerald
      Draw-PlayerChip -Graphics $graphics -X 84 -Y 820 -Name "Admin" -Brush $amber
      Draw-PlayerChip -Graphics $graphics -X 370 -Y 820 -Name "Amigo" -Brush $danger
      $graphics.DrawString("Equipo A", $fontSmall, $white, 88, 670)
      $graphics.DrawString("Equipo B", $fontSmall, $muted, 374, 670)
    }
    "score" {
      $graphics.DrawString("9", (New-Object System.Drawing.Font("Arial", 150, [System.Drawing.FontStyle]::Bold)), $danger, 172, 700)
      $graphics.DrawString("-", $fontTitle, $muted, 330, 760)
      $graphics.DrawString("2", (New-Object System.Drawing.Font("Arial", 150, [System.Drawing.FontStyle]::Bold)), $emerald, 420, 700)
      $graphics.DrawString("chat del grupo explotando", $fontSmall, $muted, 172, 910)
    }
    "balance" {
      $graphics.FillRectangle($emerald, 110, 780, 210, 22)
      $graphics.FillRectangle($cyan, 400, 780, 210, 22)
      $graphics.DrawString("Nivel", $fontSmall, $white, 124, 710)
      $graphics.DrawString("Rendimiento", $fontSmall, $white, 394, 710)
      $graphics.DrawString("Arqueros separados", $fontSmall, $amber, 210, 880)
    }
    "ranking" {
      for ($rank = 1; $rank -le 4; $rank++) {
        $rowY = 690 + (($rank - 1) * 88)
        Draw-RoundedRect -Graphics $graphics -Rect ([System.Drawing.Rectangle]::new(90, $rowY, 540, 68)) -Radius 18 -Brush $slate
        $graphics.DrawString("#$rank", $fontSmall, $emerald, 120, $rowY + 16)
        $graphics.DrawString(("Jugador " + $rank), $fontSmall, $white, 210, $rowY + 16)
        $graphics.DrawString((1100 - ($rank * 24)), $fontSmall, $amber, 500, $rowY + 16)
      }
    }
    "cta" {
      Draw-RoundedRect -Graphics $graphics -Rect ([System.Drawing.Rectangle]::new(92, 730, 536, 112)) -Radius 28 -Brush $emerald
      Draw-CenteredText -Graphics $graphics -Text "Crear mi grupo gratis" -Font $fontBold -Brush $white -Y 752 -MaxWidth 536
      $graphics.DrawString("1 mes gratis. Despues ARS 5.000/mes por grupo.", $fontTiny, $muted, 92, 890)
    }
  }

  $framePath = Join-Path $framesPath ("frame_{0:D4}.png" -f $i)
  $bitmap.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($i -eq 0) {
    $bitmap.Save($thumbnailPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }

  $graphics.Dispose()
  $bitmap.Dispose()
}

& ffmpeg -y -framerate $fps -i (Join-Path $framesPath "frame_%04d.png") -c:v libx264 -pix_fmt yuv420p -movflags +faststart $videoPath
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg failed with exit code $LASTEXITCODE"
}

Remove-Item -LiteralPath $framesPath -Recurse -Force

Write-Output $videoPath
