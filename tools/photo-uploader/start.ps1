# Savvy In Teal photo uploader — one command, does the whole setup.
#
#   powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Finds Python, installs what is missing, starts the local upload server, and
# prints the URL to open on a phone.
#
# Written for Windows PowerShell 5.1, which is what ships with Windows. Two
# things that matters for:
#   - Native-command stream redirection (`*> $null`, `2>&1`) wraps each stderr
#     line in an ErrorRecord and trips $ErrorActionPreference='Stop'. So this
#     script never redirects native streams; it suppresses them by preference
#     and branches on $LASTEXITCODE instead.
#   - `&&` / `||` do not exist here.

Set-Location -Path $PSScriptRoot
$passthrough = $args

Write-Host ""
Write-Host "Savvy In Teal - photo uploader setup" -ForegroundColor Cyan
Write-Host ""

# Run a native command, discard its output, return its exit code.
function Invoke-Quiet {
    param([string]$Exe, [string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        $null = & $Exe @Arguments 2>&1
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
}

# --- Python -----------------------------------------------------------------
# `py -3` is preferred: `python` on a clean Windows install is often the
# Microsoft Store stub, which exits non-zero instead of reporting a version.
$exe = $null
# Typed as [string[]] deliberately. PowerShell unwraps a single-element array
# on assignment, so a plain `$prefix = @("-3")` becomes the STRING "-3" — and
# `"-3" + @("-c","import PIL")` then string-concatenates into one mangled
# argument instead of building an argument list.
[string[]]$prefix = @()
foreach ($candidate in @("py", "python")) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if (-not $command) { continue }
    $probe = if ($candidate -eq "py") { @("-3", "--version") } else { @("--version") }
    if ((Invoke-Quiet $command.Source $probe) -eq 0) {
        $exe = $command.Source
        $prefix = if ($candidate -eq "py") { [string[]]@("-3") } else { [string[]]@() }
        break
    }
}
if (-not $exe) {
    Write-Host "Python 3 was not found." -ForegroundColor Red
    Write-Host "Install it from https://python.org/downloads (tick 'Add python.exe to PATH'), then run this again."
    exit 1
}
Write-Host "  python: $exe $($prefix -join ' ')"

# --- Dependencies -----------------------------------------------------------
if ((Invoke-Quiet $exe ($prefix + @("-c", "import PIL"))) -ne 0) {
    Write-Host "  installing Pillow..." -ForegroundColor Yellow
    if ((Invoke-Quiet $exe ($prefix + @("-m", "pip", "install", "--quiet", "--disable-pip-version-check", "Pillow"))) -ne 0) {
        Write-Host "Could not install Pillow. Try:  $exe -m pip install Pillow" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  Pillow: ok"

# Optional. Only needed if an iPhone is set to keep original HEIC files —
# Safari normally hands over a JPEG when a photo goes through a web form.
if ((Invoke-Quiet $exe ($prefix + @("-c", "import pillow_heif"))) -ne 0) {
    Write-Host "  installing HEIC support (optional)..." -ForegroundColor Yellow
    if ((Invoke-Quiet $exe ($prefix + @("-m", "pip", "install", "--quiet", "--disable-pip-version-check", "pillow-heif"))) -eq 0) {
        Write-Host "  HEIC: ok"
    } else {
        Write-Host "  HEIC: skipped (iPhone photos still work via Safari's JPEG conversion)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  HEIC: ok"
}

Write-Host ""
# Extra arguments (e.g. --port 9000) pass straight through to the server.
& $exe @($prefix + @("upload_server.py") + $passthrough)
