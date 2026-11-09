# dsh-dapusa · 小光桌面浮窗（Windows 原生，PowerShell + WinForms）
# 浮在所有窗口最上层；DSH 最小化后仍显示。托盘图标提供菜单。
#
# Host 端启动方式（desktop-float.js）：
#   powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File float.ps1 `
#       -Quotes <quotes.json> -Minutes 10 -ParentPid <pid> -Settings <settings.json> -State <state.json>
#
# 不需要编译器。父进程（DSH Host）退出后 5 秒内自退。

param(
    [Parameter(Mandatory = $true)][string]$Quotes,
    [int]$Minutes = 10,
    [int]$ParentPid = 0,
    [string]$Settings = '',
    [string]$State = ''
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:WinFormsAssembly = [System.Windows.Forms.Form].Assembly.Location
$script:DrawingAssembly = [System.Drawing.Color].Assembly.Location

Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class XgNative {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}

public class XgForm : Form {
    public XgForm() {
        this.DoubleBuffered = true;
        this.SetStyle(ControlStyles.OptimizedDoubleBuffer, true);
        this.SetStyle(ControlStyles.AllPaintingInWmPaint, true);
        this.SetStyle(ControlStyles.UserPaint, true);
    }
}
'@ -ReferencedAssemblies @($script:WinFormsAssembly, $script:DrawingAssembly)
[void][XgNative]::SetProcessDPIAware()

# ---------------- 运行状态 ----------------
$script:ErrorLog = if ($State) { Join-Path ([System.IO.Path]::GetDirectoryName($State)) 'error.log' } else { Join-Path $env:TEMP 'xiaoguang-float-error.log' }
$script:Clock = [System.Diagnostics.Stopwatch]::StartNew()
$script:QuotesList = @()
$script:Enabled = $true
$script:Minutes = if ($Minutes -gt 0) { $Minutes } else { 10 }
$script:AutoStart = $true
$script:Current = $null
$script:LastText = ''
$script:BubbleVisible = $false
$script:Quitting = $false
$script:Dragging = $false
$script:Dragged = $false
$script:FigureRect = $null
$script:BtnNextRect = $null
$script:BtnHideRect = $null
$script:SettingsMtime = 0

function Log-Error {
    param($ErrorRecord)
    try {
        $line = ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($ErrorRecord | Out-String))
        [System.IO.File]::AppendAllText($script:ErrorLog, $line, (New-Object System.Text.UTF8Encoding($false)))
    } catch { }
}

function Read-JsonFile {
    param([string]$Path)
    try {
        if (-not $Path) { return $null }
        if (-not (Test-Path -LiteralPath $Path)) { return $null }
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if (-not $raw) { return $null }
        return ($raw | ConvertFrom-Json)
    } catch { return $null }
}

function Write-JsonFile {
    param([string]$Path, $Value)
    try {
        if (-not $Path) { return }
        $json = $Value | ConvertTo-Json -Compress -Depth 6
        [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
    } catch { Log-Error $_ }
}

function Load-Settings {
    $s = Read-JsonFile $Settings
    if ($null -ne $s) {
        if ($null -ne $s.autoStart) { $script:AutoStart = [bool]$s.autoStart }
        if ($null -ne $s.enabled) { $script:Enabled = [bool]$s.enabled }
        if ($null -ne $s.minutes) {
            $m = [int]$s.minutes
            if ($m -gt 0) { $script:Minutes = $m }
        }
    }
    if ($Settings -and (Test-Path -LiteralPath $Settings)) {
        $script:SettingsMtime = (Get-Item -LiteralPath $Settings).LastWriteTimeUtc.Ticks
    }
}

function Save-Settings {
    Write-JsonFile $Settings @{ autoStart = [bool]$script:AutoStart; enabled = [bool]$script:Enabled; minutes = [int]$script:Minutes }
    if ($Settings -and (Test-Path -LiteralPath $Settings)) {
        $script:SettingsMtime = (Get-Item -LiteralPath $Settings).LastWriteTimeUtc.Ticks
    }
}

function Write-State {
    try {
        if (-not $State) { return }
        $visible = $false
        if ($null -ne $script:Form) { $visible = [bool]$script:Form.Visible }
        Write-JsonFile $State @{
            pid = $PID
            menuBar = ($null -ne $script:Tray)
            windowVisible = $visible
            autoStart = [bool]$script:AutoStart
            enabled = [bool]$script:Enabled
            minutes = [int]$script:Minutes
            quoteCount = $script:QuotesList.Count
        }
    } catch { Log-Error $_ }
}

function Pick-Quote {
    if ($script:QuotesList.Count -eq 0) { return $null }
    for ($i = 0; $i -lt 8; $i++) {
        $idx = Get-Random -Minimum 0 -Maximum $script:QuotesList.Count
        $q = $script:QuotesList[$idx]
        if ($q.text -ne $script:LastText) { return $q }
    }
    return $script:QuotesList[0]
}

# ---------------- 字体与颜色 ----------------
$script:FontFamily = $null
foreach ($name in @('Microsoft YaHei UI', 'Microsoft YaHei', 'SimHei', 'SimSun')) {
    try {
        $probe = [System.Drawing.Font]::new($name, [single]10)
        $script:FontFamily = $name
        $probe.Dispose()
        break
    } catch { }
}
if (-not $script:FontFamily) { $script:FontFamily = 'Arial' }

function New-UIFont {
    param([double]$Size, $Style)
    if ($null -eq $Style) { $Style = [System.Drawing.FontStyle]::Regular }
    return [System.Drawing.Font]::new($script:FontFamily, [single]$Size, $Style)
}

$script:FontQuote = New-UIFont 10.5 $null
$script:FontSource = New-UIFont 8.5 $null
$script:FontButton = New-UIFont 8.5 $null

$script:Gold = [System.Drawing.Color]::FromArgb(222, 179, 102)
$script:GoldDeep = [System.Drawing.Color]::FromArgb(188, 140, 69)
$script:Ink = [System.Drawing.Color]::FromArgb(74, 56, 31)
$script:InkSoft = [System.Drawing.Color]::FromArgb(115, 94, 61)
$script:Cream = [System.Drawing.Color]::FromArgb(255, 252, 244)
$script:CreamDeep = [System.Drawing.Color]::FromArgb(249, 236, 209)

# ---------------- 绘图辅助 ----------------
function New-RoundRect {
    param([single]$X, [single]$Y, [single]$W, [single]$H, [single]$R)
    $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = $R * 2
    $p.AddArc($X, $Y, $d, $d, 180, 90)
    $p.AddArc(($X + $W - $d), $Y, $d, $d, 270, 90)
    $p.AddArc(($X + $W - $d), ($Y + $H - $d), $d, $d, 0, 90)
    $p.AddArc($X, ($Y + $H - $d), $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function Draw-Card {
    param($g, [single]$X, [single]$Y, [single]$W, [single]$H, [single]$R)
    $shadow = New-RoundRect ($X + 3) ($Y + 4) $W $H $R
    $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 90, 66, 30))
    $g.FillPath($shadowBrush, $shadow)
    $shadowBrush.Dispose(); $shadow.Dispose()

    $path = New-RoundRect $X $Y $W $H $R
    $rectF = [System.Drawing.RectangleF]::new($X, $Y, $W, $H)
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rectF, $script:Cream, $script:CreamDeep, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($brush, $path)
    $pen = [System.Drawing.Pen]::new($script:Gold, [single]1)
    $g.DrawPath($pen, $path)
    $pen.Dispose(); $brush.Dispose(); $path.Dispose()
}

function Draw-Pill {
    param($g, [single]$X, [single]$Y, [single]$W, [single]$H, [string]$Text, $Font)
    $path = New-RoundRect $X $Y $W $H ($H / 2)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 250, 239))
    $g.FillPath($brush, $path)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 205, 165, 95), [single]1)
    $g.DrawPath($pen, $path)
    $fmt = [System.Drawing.StringFormat]::new()
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $inkBrush = [System.Drawing.SolidBrush]::new($script:InkSoft)
    $g.DrawString($Text, $Font, $inkBrush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $fmt)
    $inkBrush.Dispose(); $fmt.Dispose(); $pen.Dispose(); $brush.Dispose(); $path.Dispose()
}

# ---------------- 画小光 ----------------
function Draw-Figure {
    param($g, [single]$Fx, [single]$Fy, [single]$Scale, [double]$T, [double]$GazeX, [double]$GazeY)

    $g.Save()
    $bob = [math]::Sin($T * 1.6) * 2.2
    $g.TranslateTransform($Fx, [single]($Fy + $bob * $Scale))
    $g.ScaleTransform($Scale, $Scale)
    $sway = [math]::Sin($T * 1.65) * 2.2
    $g.TranslateTransform(32, 50)
    $g.RotateTransform([single]$sway)
    $g.TranslateTransform(-32, -50)

    $gold = $script:Gold
    $goldDeep = $script:GoldDeep

    # 呼吸光晕
    $breath = 0.72 + 0.28 * (0.5 + 0.5 * [math]::Sin($T * 1.4))
    $aura = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $aura.AddEllipse(2, 3, 60, 60)
    $auraBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($aura)
    $auraBrush.CenterColor = [System.Drawing.Color]::FromArgb([int](120 * $breath), 255, 232, 178)
    $auraBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 255, 220, 150))
    $g.FillPath($auraBrush, $aura)
    $auraBrush.Dispose(); $aura.Dispose()

    # 飞旋光轨
    $orbitAngle = ($T * 22.5) % 360
    $dashPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 233, 198, 132), [single]0.9)
    $dashPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dot
    $g.DrawEllipse($dashPen, [single]13.5, [single]11, [single]37, [single]37)
    $dashPen.Dispose()
    $starBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 251, 231, 174))
    foreach ($spin in @(0, 180)) {
        $a = (($orbitAngle + $spin) * [math]::PI / 180)
        $cx = 32 + 18.5 * [math]::Cos($a)
        $cy = 29.5 + 18.5 * [math]::Sin($a)
        $star = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $star.AddPolygon([System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new([single]$cx, [single]($cy - 1.6)),
            [System.Drawing.PointF]::new([single]($cx + 1.6), [single]$cy),
            [System.Drawing.PointF]::new([single]$cx, [single]($cy + 1.6)),
            [System.Drawing.PointF]::new([single]($cx - 1.6), [single]$cy)
        ))
        $g.FillPath($starBrush, $star)
        $star.Dispose()
    }
    $starBrush.Dispose()

    # 尾巴光带
    $tailPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170, 231, 189, 120), [single]1.6)
    $tailPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tailPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tail = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $tail.AddBezier([single]40, [single]47, [single]47, [single]46.5, [single]51, [single]43.5, [single]53.5, [single]38.5)
    $g.DrawPath($tailPen, $tail)
    $tailPen.Dispose(); $tail.Dispose()

    # 光之衣
    $robe = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $robe.AddBezier([single]32, [single]36.8, [single]25.6, [single]36.8, [single]21.9, [single]41.6, [single]20.9, [single]46.9)
    $robe.AddBezier([single]20.9, [single]46.9, [single]20.2, [single]50.6, [single]21.2, [single]52.6, [single]23.7, [single]52.6)
    $robe.AddLine([single]23.7, [single]52.6, [single]40.3, [single]52.6)
    $robe.AddBezier([single]40.3, [single]52.6, [single]42.8, [single]52.6, [single]43.8, [single]50.5, [single]43.1, [single]46.9)
    $robe.AddBezier([single]43.1, [single]46.9, [single]42.1, [single]41.6, [single]38.4, [single]36.8, [single]32, [single]36.8)
    $robe.CloseFigure()
    $robeRect = [System.Drawing.RectangleF]::new(20, 37, 24, 16)
    $robeBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($robeRect, [System.Drawing.Color]::FromArgb(255, 253, 247), [System.Drawing.Color]::FromArgb(238, 194, 122), [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($robeBrush, $robe)
    $robePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(140, 201, 154, 82), [single]0.8)
    $g.DrawPath($robePen, $robe)
    $robePen.Dispose(); $robeBrush.Dispose(); $robe.Dispose()

    # 底光
    $basePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(140, 231, 189, 120), [single]1.4)
    $basePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $basePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $base = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $base.AddBezier([single]19, [single]56.2, [single]24, [single]59.6, [single]40, [single]59.6, [single]45, [single]55.8)
    $g.DrawPath($basePen, $base)
    $basePen.Dispose(); $base.Dispose()

    # 头（歪着）
    $g.Save()
    $tilt = -5 + [math]::Sin($T * 0.9) * 2.0
    $g.TranslateTransform(32, 28)
    $g.RotateTransform([single]$tilt)
    $g.TranslateTransform(-32, -28)

    $headRect = [System.Drawing.RectangleF]::new(21.7, 17.7, 20.6, 20.6)
    $headBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($headRect, [System.Drawing.Color]::FromArgb(255, 255, 252), [System.Drawing.Color]::FromArgb(243, 201, 139), [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    $headPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(140, 201, 154, 82), [single]0.8)
    $g.FillEllipse($headBrush, $headRect)
    $g.DrawEllipse($headPen, $headRect)
    $headPen.Dispose(); $headBrush.Dispose()

    # 呆毛
    $hairPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(230, 226, 181, 102), [single]1.7)
    $hairPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $hairPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $hair = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $hair.AddBezier([single]29.2, [single]18.6, [single]28.2, [single]15.2, [single]30.4, [single]13.2, [single]33.4, [single]14.1)
    $hair.AddBezier([single]33.4, [single]14.1, [single]36.0, [single]14.9, [single]35.4, [single]17.9, [single]33.2, [single]18.4)
    $g.DrawPath($hairPen, $hair)
    $hairPen.Dispose(); $hair.Dispose()

    # 眉间觉知光
    $browTwinkle = 0.55 + 0.45 * (0.5 + 0.5 * [math]::Sin($T * 2.4 + 1.1))
    $spark = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $spark.AddPolygon([System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(32, 21.0),
        [System.Drawing.PointF]::new([single]33.0, [single]22.3),
        [System.Drawing.PointF]::new(32, 23.6),
        [System.Drawing.PointF]::new([single]31.0, [single]22.3)
    ))
    $sparkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int](255 * $browTwinkle), 255, 254, 248))
    $g.FillPath($sparkBrush, $spark)
    $sparkBrush.Dispose(); $spark.Dispose()

    # 挑眉
    $inkPen = [System.Drawing.Pen]::new($script:InkSoft, [single]1.0)
    $inkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $inkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $brows = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $brows.AddBezier([single]25.5, [single]23.3, [single]26.7, [single]22.4, [single]28.1, [single]22.3, [single]29.3, [single]22.8)
    $brows.AddBezier([single]34.7, [single]22.7, [single]35.9, [single]22.2, [single]37.3, [single]22.3, [single]38.5, [single]23.2)
    $g.DrawPath($inkPen, $brows)
    $brows.Dispose()

    # 眼睛（眨眼 + 看鼠标）
    $phase = $T % 4.6
    $open = 1.0
    if ($phase -gt 4.15 -and $phase -lt 4.38) { $open = 0.12 }
    $eyeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(90, 61, 21))
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 253, 245))
    foreach ($eyeX in @(28.1, 35.9)) {
        $cx = $eyeX + $GazeX
        $cy = 27.7 + $GazeY
        $rx = 2.05
        $ry = 2.5 * $open
        $g.FillEllipse($eyeBrush, [single]($cx - $rx), [single]($cy - $ry), [single]($rx * 2), [single]($ry * 2))
        if ($open -gt 0.3) {
            $g.FillEllipse($whiteBrush, [single]($cx + 0.15), [single]($cy - 1.6), [single]1.44, [single]1.44)
        }
    }
    $whiteBrush.Dispose(); $eyeBrush.Dispose()

    # 脸颊
    $cheekBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(80, 243, 199, 138))
    $g.FillEllipse($cheekBrush, [single]24.5, [single]30.0, [single]2.7, [single]2.7)
    $g.FillEllipse($cheekBrush, [single]36.7, [single]29.8, [single]2.7, [single]2.7)
    $cheekBrush.Dispose()

    # 微笑
    $smile = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $smile.AddBezier([single]29.7, [single]32.3, [single]30.9, [single]33.8, [single]33.3, [single]34.0, [single]34.6, [single]32.6)
    $g.DrawPath($inkPen, $smile)
    $smile.Dispose(); $inkPen.Dispose()
    $g.Restore()

    # 好奇的灵光球
    $orbTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * [math]::Sin($T * 2.1))
    $orbHaloBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(26, 255, 233, 176))
    $g.FillEllipse($orbHaloBrush, [single]11.2, [single]15.4, [single]10.8, [single]10.8)
    $orbHaloBrush.Dispose()
    $orbBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([int](240 * $orbTwinkle), 255, 246, 217))
    $g.FillEllipse($orbBrush, [single]13.5, [single]17.7, [single]6.2, [single]6.2)
    $orbBrush.Dispose()
    $orbSpark = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $orbSpark.AddPolygon([System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new([single]22.4, [single]15.6),
        [System.Drawing.PointF]::new([single]23.4, [single]16.7),
        [System.Drawing.PointF]::new([single]22.4, [single]17.8),
        [System.Drawing.PointF]::new([single]21.4, [single]16.7)
    ))
    $orbSparkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(200, 251, 231, 174))
    $g.FillPath($orbSparkBrush, $orbSpark)
    $orbSparkBrush.Dispose(); $orbSpark.Dispose()

    $g.Restore()
}

function Draw-All {
    param($g)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear($script:Form.BackColor)
    $t = $script:Clock.Elapsed.TotalSeconds
    $w = $script:Form.ClientSize.Width
    $h = $script:Form.ClientSize.Height

    if ($script:BubbleVisible -and $null -ne $script:Current) {
        Draw-Card $g 12 12 ($w - 24) 200 16
        $quoteText = '「' + $script:Current.text + '」'
        $fmt = [System.Drawing.StringFormat]::new()
        $fmt.Alignment = [System.Drawing.StringAlignment]::Near
        $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
        $inkBrush = [System.Drawing.SolidBrush]::new($script:Ink)
        $g.DrawString($quoteText, $script:FontQuote, $inkBrush, [System.Drawing.RectangleF]::new(30, 28, ($w - 60), 118), $fmt)
        $inkBrush.Dispose(); $fmt.Dispose()

        $src = '——《' + $script:Current.title + '》' + $script:Current.date
        $srcFmt = [System.Drawing.StringFormat]::new()
        $srcFmt.Alignment = [System.Drawing.StringAlignment]::Far
        $srcBrush = [System.Drawing.SolidBrush]::new($script:InkSoft)
        $g.DrawString($src, $script:FontSource, $srcBrush, [System.Drawing.RectangleF]::new(30, 148, ($w - 60), 24), $srcFmt)
        $srcBrush.Dispose(); $srcFmt.Dispose()

        $script:BtnNextRect = [System.Drawing.Rectangle]::new([int]($w - 176), 176, 78, 24)
        $script:BtnHideRect = [System.Drawing.Rectangle]::new([int]($w - 92), 176, 62, 24)
        Draw-Pill $g $script:BtnNextRect.X $script:BtnNextRect.Y $script:BtnNextRect.Width $script:BtnNextRect.Height '换一句' $script:FontButton
        Draw-Pill $g $script:BtnHideRect.X $script:BtnHideRect.Y $script:BtnHideRect.Width $script:BtnHideRect.Height '隐藏' $script:FontButton
    }

    $figSize = 110.0
    $scale = $figSize / 64.0
    $fx = $w - $figSize - 14
    $fy = $h - $figSize - 10
    $script:FigureRect = [System.Drawing.Rectangle]::new([int]$fx, [int]$fy, [int]$figSize, [int]$figSize)

    $cp = $script:Form.PointToClient([System.Windows.Forms.Cursor]::Position)
    $centerX = $fx + 32 * $scale
    $centerY = $fy + 32 * $scale
    $gazeX = [math]::Max(-1.15, [math]::Min(1.15, (($cp.X - $centerX) / 220.0) * 1.3))
    $gazeY = [math]::Max(-0.95, [math]::Min(0.95, (($cp.Y - $centerY) / 220.0) * 1.3))

    Draw-Figure $g $fx $fy $scale $t $gazeX $gazeY
}

# ---------------- 窗口行为 ----------------
function Layout-For {
    param([bool]$Bubble)
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    try { if ($null -ne $script:Form -and $script:Form.Handle -ne [IntPtr]::Zero) { $screen = [System.Windows.Forms.Screen]::FromControl($script:Form) } } catch { }
    $wa = $screen.WorkingArea
    if ($Bubble) { $w = 380; $h = 348 } else { $w = 150; $h = 150 }
    $script:Form.Size = [System.Drawing.Size]::new($w, $h)
    $script:Form.Location = [System.Drawing.Point]::new(($wa.Right - $w - 26), ($wa.Bottom - $h - 26))
    try {
        $regionPath = New-RoundRect 0 0 $w $h 18
        $region = [System.Drawing.Region]::new($regionPath)
        $script:Form.Region = $region
        $region.Dispose()
        $regionPath.Dispose()
    } catch { Log-Error $_ }
}

function Show-Quote {
    try {
        $q = Pick-Quote
        if ($null -eq $q) { return }
        $script:Current = $q
        $script:LastText = $q.text
        $script:BubbleVisible = $true
        Layout-For $true
        $script:Form.Show()
        $script:Form.TopMost = $true
        $script:HideTimer.Stop()
        $script:HideTimer.Start()
        $script:Form.Invalidate()
        Write-State
    } catch { Log-Error $_ }
}

function Hide-Quote {
    try {
        $script:BubbleVisible = $false
        $script:HideTimer.Stop()
        Layout-For $false
        $script:Form.Invalidate()
        Write-State
    } catch { Log-Error $_ }
}

function Schedule-Next {
    $script:QuoteTimer.Stop()
    if (-not $script:Enabled) { return }
    $base = $script:Minutes * 60000.0
    $jitter = 0.6 + (Get-Random -Minimum 0.0 -Maximum 1.0) * 0.8
    $delay = [int][math]::Max(45000, $base * $jitter)
    $script:QuoteTimer.Interval = $delay
    $script:QuoteTimer.Start()
}

function Apply-Interval {
    param([int]$M)
    if ($M -le 0) {
        $script:Enabled = $false
    } else {
        $script:Enabled = $true
        $script:Minutes = $M
    }
    Save-Settings
    if ($script:Enabled) {
        Schedule-Next
    } else {
        $script:QuoteTimer.Stop()
        Hide-Quote
    }
    Write-State
}

function Toggle-Window {
    try {
        if ($script:Form.Visible) {
            $script:Form.Hide()
        } else {
            $script:Form.Show()
            $script:Form.TopMost = $true
            $script:Form.Invalidate()
        }
        Write-State
    } catch { Log-Error $_ }
}

function Handle-Click {
    param($e)
    try {
        if ($e.Button -ne [System.Windows.Forms.MouseButtons]::Left) { return }
        if ($script:Dragged) { $script:Dragged = $false; return }
        if ($null -ne $script:BtnNextRect -and $script:BtnNextRect.Contains($e.Location)) { Show-Quote; return }
        if ($null -ne $script:BtnHideRect -and $script:BtnHideRect.Contains($e.Location)) { Hide-Quote; return }
        if ($null -ne $script:FigureRect -and $script:FigureRect.Contains($e.Location)) { Show-Quote }
    } catch { Log-Error $_ }
}

# ---------------- 托盘 ----------------
function New-TrayIcon {
    $bmp = [System.Drawing.Bitmap]::new(32, 32)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $body = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 241, 206, 132))
    $g.FillEllipse($body, 4, 4, 24, 24)
    $body.Dispose()
    $ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 120, 85, 36))
    $g.FillEllipse($ink, 10, 12, 4, 5)
    $g.FillEllipse($ink, 18, 12, 4, 5)
    $ink.Dispose()
    $g.Dispose()
    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $bmp.Dispose()
    return $icon
}

function Rebuild-Menu {
    try {
        $script:Menu.Items.Clear()

        $read = [System.Windows.Forms.ToolStripMenuItem]::new('念一句法义')
        $read.Add_Click({ Show-Quote }.GetNewClosure())
        [void]$script:Menu.Items.Add($read)

        $label = '显示小光'
        if ($script:Form.Visible) { $label = '收起小光' }
        $toggle = [System.Windows.Forms.ToolStripMenuItem]::new($label)
        $toggle.Add_Click({ Toggle-Window }.GetNewClosure())
        [void]$script:Menu.Items.Add($toggle)

        $interval = [System.Windows.Forms.ToolStripMenuItem]::new('随机间隔')
        foreach ($m in @(0, 3, 5, 10, 20, 30, 60)) {
            $itemLabel = "$m 分钟"
            if ($m -eq 0) { $itemLabel = '关闭' }
            $item = [System.Windows.Forms.ToolStripMenuItem]::new($itemLabel)
            if ($m -eq 0) { $item.Checked = (-not $script:Enabled) } else { $item.Checked = ($script:Enabled -and $script:Minutes -eq $m) }
            $item.Tag = $m
            $item.Add_Click({
                param($sender, $eventArgs)
                try { Apply-Interval ([int]$sender.Tag) } catch { Log-Error $_ }
            }.GetNewClosure())
            [void]$interval.DropDownItems.Add($item)
        }
        [void]$script:Menu.Items.Add($interval)

        $auto = [System.Windows.Forms.ToolStripMenuItem]::new('DSH 启动时自动浮出')
        $auto.Checked = [bool]$script:AutoStart
        $auto.Add_Click({
            $script:AutoStart = -not $script:AutoStart
            Save-Settings
            Write-State
        }.GetNewClosure())
        [void]$script:Menu.Items.Add($auto)

        [void]$script:Menu.Items.Add([System.Windows.Forms.ToolStripSeparator]::new())

        $quit = [System.Windows.Forms.ToolStripMenuItem]::new('退出小光')
        $quit.Add_Click({
            try {
                $script:Quitting = $true
                if ($null -ne $script:Tray) { $script:Tray.Visible = $false; $script:Tray.Dispose() }
                [System.Windows.Forms.Application]::Exit()
            } catch { }
        }.GetNewClosure())
        [void]$script:Menu.Items.Add($quit)
    } catch { Log-Error $_ }
}

# ---------------- 启动 ----------------
try {
    Load-Settings

    $quotesRaw = Read-JsonFile $Quotes
    if ($null -ne $quotesRaw) {
        foreach ($q in $quotesRaw) { $script:QuotesList += $q }
    }

    [System.Windows.Forms.Application]::EnableVisualStyles()
    [System.Windows.Forms.Application]::SetUnhandledExceptionMode([System.Windows.Forms.UnhandledExceptionMode]::CatchException)
    [System.Windows.Forms.Application]::add_ThreadException({ param($s, $e) Log-Error $e.Exception })

    $script:Menu = [System.Windows.Forms.ContextMenuStrip]::new()
    $script:Menu.Add_Opening({ Rebuild-Menu }.GetNewClosure())

    $script:Form = [XgForm]::new()
    $script:Form.Text = '小光'
    $script:Form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $script:Form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    $script:Form.ShowInTaskbar = $false
    $script:Form.TopMost = $true
    $script:Form.BackColor = [System.Drawing.Color]::FromArgb(250, 244, 231)
    $script:Form.ContextMenuStrip = $script:Menu
    $script:Form.Add_Paint({ param($s, $e) try { Draw-All $e.Graphics } catch { Log-Error $_ } }.GetNewClosure())
    $script:Form.Add_MouseClick({ param($s, $e) Handle-Click $e }.GetNewClosure())
    $script:Form.Add_MouseDown({
        param($s, $e)
        if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
            $script:DragStart = [System.Windows.Forms.Cursor]::Position
            $script:DragWin = $script:Form.Location
            $script:Dragging = $true
            $script:Dragged = $false
        }
    }.GetNewClosure())
    $script:Form.Add_MouseMove({
        param($s, $e)
        if ($script:Dragging) {
            $p = [System.Windows.Forms.Cursor]::Position
            $dx = $p.X - $script:DragStart.X
            $dy = $p.Y - $script:DragStart.Y
            if ([math]::Abs($dx) -gt 3 -or [math]::Abs($dy) -gt 3) {
                $script:Dragged = $true
                $script:Form.Location = [System.Drawing.Point]::new(($script:DragWin.X + $dx), ($script:DragWin.Y + $dy))
            }
        }
    }.GetNewClosure())
    $script:Form.Add_MouseUp({ param($s, $e) $script:Dragging = $false }.GetNewClosure())
    $script:Form.Add_FormClosing({
        param($s, $e)
        if (-not $script:Quitting) { $e.Cancel = $true; $script:Form.Hide(); Write-State }
    }.GetNewClosure())

    $script:Tray = [System.Windows.Forms.NotifyIcon]::new()
    $script:Tray.Icon = New-TrayIcon
    $script:Tray.Text = '小光 · 桌面浮窗'
    $script:Tray.Visible = $true
    $script:Tray.ContextMenuStrip = $script:Menu
    $script:Tray.Add_MouseClick({
        param($s, $e)
        if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Toggle-Window }
    }.GetNewClosure())

    $script:QuoteTimer = [System.Windows.Forms.Timer]::new()
    $script:QuoteTimer.Interval = (Get-Random -Minimum 6000 -Maximum 12000)
    $script:QuoteTimer.Add_Tick({
        try {
            $script:QuoteTimer.Stop()
            Show-Quote
            Schedule-Next
        } catch { Log-Error $_ }
    }.GetNewClosure())

    $script:HideTimer = [System.Windows.Forms.Timer]::new()
    $script:HideTimer.Interval = 26000
    $script:HideTimer.Add_Tick({ try { $script:HideTimer.Stop(); Hide-Quote } catch { Log-Error $_ } }.GetNewClosure())

    $script:AnimTimer = [System.Windows.Forms.Timer]::new()
    $script:AnimTimer.Interval = 40
    $script:AnimTimer.Add_Tick({ try { if ($script:Form.Visible) { $script:Form.Invalidate() } } catch { } }.GetNewClosure())

    $script:StateTimer = [System.Windows.Forms.Timer]::new()
    $script:StateTimer.Interval = 4000
    $script:StateTimer.Add_Tick({
        try {
            Write-State
            if ($Settings -and (Test-Path -LiteralPath $Settings)) {
                $mtime = (Get-Item -LiteralPath $Settings).LastWriteTimeUtc.Ticks
                if ($mtime -ne $script:SettingsMtime) {
                    Load-Settings
                    if ($script:Enabled) { Schedule-Next } else { $script:QuoteTimer.Stop() }
                    $script:Form.Invalidate()
                }
            }
        } catch { Log-Error $_ }
    }.GetNewClosure())

    if ($ParentPid -gt 0) {
        $script:WatchTimer = [System.Windows.Forms.Timer]::new()
        $script:WatchTimer.Interval = 5000
        $script:WatchTimer.Add_Tick({
            try {
                $p = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
                if ($null -eq $p) {
                    $script:Quitting = $true
                    if ($null -ne $script:Tray) { $script:Tray.Visible = $false; $script:Tray.Dispose() }
                    [System.Windows.Forms.Application]::Exit()
                }
            } catch { }
        }.GetNewClosure())
        $script:WatchTimer.Start()
    }

    Layout-For $false
    $script:Form.Show()
    $script:Form.TopMost = $true
    if ($script:Enabled) { $script:QuoteTimer.Start() }
    $script:AnimTimer.Start()
    $script:StateTimer.Start()
    Write-State
    $script:Form.Invalidate()

    [System.Windows.Forms.Application]::Run($script:Form)
} catch {
    Log-Error $_
    try { if ($null -ne $script:Tray) { $script:Tray.Visible = $false; $script:Tray.Dispose() } } catch { }
    exit 1
}
