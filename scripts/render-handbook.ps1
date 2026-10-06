param([switch]$ExportPdf, [switch]$School, [string]$DocumentPath)
$ErrorActionPreference = 'Stop'
$manualRoot = Split-Path $PSScriptRoot -Parent
$manualStem = if ($School) { 'Betriebshandbuch-Flugschulen-v1.5' } else { 'Benutzerhandbuch-Piloten-v1.6' }
$manualDocx = if ($DocumentPath) { (Resolve-Path -LiteralPath $DocumentPath).Path } else { Join-Path $manualRoot "docs/$manualStem.docx" }
$manualPreview = Join-Path $manualRoot $(if ($School) { '.handbook-preview/school' } else { '.handbook-preview' })
[void](New-Item -ItemType Directory -Path $manualPreview -Force)
$manualWord = $null
$manualDocument = $null
try {
    $manualWord = New-Object -ComObject Word.Application
    $manualWord.Visible = $false
    $manualWord.DisplayAlerts = 0
    $manualDocument = $manualWord.Documents.Open($manualDocx, $false, $false)
    $manualDocument.ShowSpellingErrors = $false
    $manualDocument.ShowGrammaticalErrors = $false
    $manualDocument.Fields.Update() | Out-Null
    foreach ($manualToc in $manualDocument.TablesOfContents) { $manualToc.Update() }
    $manualWord.ActiveWindow.View.Type = 3
    $manualDocument.Repaginate()
    foreach ($manualToc in $manualDocument.TablesOfContents) { $manualToc.UpdatePageNumbers() }
    $manualDocument.Save()
    $manualPages = $manualWord.ActiveWindow.Panes.Item(1).Pages
    $manualPageIndex = @()
    for ($manualPage = 1; $manualPage -le $manualPages.Count; $manualPage++) {
        $manualImage = Join-Path $manualPreview ('page{0:D2}.emf' -f $manualPage)
        [IO.File]::WriteAllBytes($manualImage, [byte[]]$manualPages.Item($manualPage).EnhMetaFileBits)
        $manualStart = $manualDocument.GoTo(1, 1, $manualPage).Start
        $manualEnd = if ($manualPage -lt $manualPages.Count) { $manualDocument.GoTo(1, 1, ($manualPage + 1)).Start } else { $manualDocument.Content.End }
        $manualPageIndex += @{ page = $manualPage; text = $manualDocument.Range($manualStart, $manualEnd).Text }
        Write-Output "Checked page $manualPage / $($manualPages.Count)"
    }
    ConvertTo-Json -InputObject $manualPageIndex -Depth 3 | Set-Content -LiteralPath (Join-Path $manualPreview $(if ($School) { 'v1.5-pages.json' } else { 'v1.6-pages.json' })) -Encoding UTF8
    if ($ExportPdf) {
        $manualDocument.ExportAsFixedFormat(([IO.Path]::ChangeExtension($manualDocx, '.pdf')), 17)
    }
} finally {
    if ($manualDocument) { $manualDocument.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($manualDocument) }
    if ($manualWord) { $manualWord.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($manualWord) }
}
