Add-Type -AssemblyName System.Drawing

function New-Icon($size, $path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'HighQuality'
    $g.InterpolationMode = 'HighQualityBicubic'

    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(44, 24, 16))
    $g.FillRectangle($bg, 0, 0, $size, $size)

    $gold = [System.Drawing.Color]::FromArgb(212, 160, 23)
    $pen = New-Object System.Drawing.Pen($gold, [Math]::Max(2, $size / 48))
    $g.DrawEllipse($pen, $size * 0.12, $size * 0.12, $size * 0.76, $size * 0.76)

    $innerSize = $size * 0.55
    $innerX = ($size - $innerSize) / 2
    $innerY = ($size - $innerSize) / 2
    $g.FillEllipse($pen.Brush, $innerX, $innerY, $innerSize, $innerSize)

    try {
        $fontSize = $size * 0.35
        $fc = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 230, 211))
        $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold)
        $fmt = New-Object System.Drawing.StringFormat
        $fmt.Alignment = 'Center'
        $fmt.LineAlignment = 'Center'
        $g.DrawString('B', $font, $fc, $size / 2, $size / 2, $fmt)
        $font.Dispose()
        $fc.Dispose()
        $fmt.Dispose()
    } catch {}

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

New-Icon 192 "icon-192.png"
New-Icon 512 "icon-512.png"
Write-Host "Icons created"
