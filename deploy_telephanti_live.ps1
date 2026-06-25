# telephanti.com = Luna live (Squarespace DNS -> Render cloud). No Beacons. No home PC.
$ErrorActionPreference = "Stop"
$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$Desktop = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path $Desktop)) {
    $Desktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
}

$RenderDash = "https://dashboard.render.com/"
$SquarespaceDns = "https://account.squarespace.com/domains"
$RenderApexIp = "216.24.57.1"

$guide = @"
TELEPHANTI.COM = LUNA (live on the internet)
============================================

Goal: https://telephanti.com opens Luna for everyone.
Your PC does NOT need to stay on.

You need TWO things:
  1) Luna running on Render (cloud server)
  2) Squarespace DNS pointing telephanti.com at Render

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Put Luna on GitHub (one-time)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Open PowerShell in:
  $Base

Run:

  git init
  git add Dockerfile render.yaml server.py telephanti_url.py requirements.txt static quantum_samples luna_quantum_lines.json make_icons.py .dockerignore .env.example .gitignore
  git commit -m "Luna live on telephanti.com"

  gh repo create telephanti-luna --private --source=. --push

(Install Git: winget install Git.Git)
(Install GitHub CLI: winget install GitHub.cli — then gh auth login)

NEVER commit .env — your API key stays local only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Deploy on Render
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Open: $RenderDash
2. New + -> Blueprint
3. Connect GitHub repo: telephanti-luna
4. Render reads render.yaml automatically
5. Environment tab -> add:
     XAI_API_KEY = (copy from your local .env file)
6. Wait for deploy (5-10 min)
7. Note your app URL, e.g. telephanti-luna.onrender.com
8. Test: https://YOUR-APP.onrender.com  (should show Luna)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Add telephanti.com in Render
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Render -> your Luna service -> Settings -> Custom Domains -> Add:

  telephanti.com
  www.telephanti.com

Render will show DNS instructions. Use these in Squarespace:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Squarespace DNS (telephanti.com -> Luna)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Open: $SquarespaceDns
2. Click telephanti.com -> DNS Settings

3. DELETE old records that point elsewhere:
   - Any A / CNAME for @ (root)
   - Any CNAME for www
   (Keep MX email records if you use them.)

4. ADD:

   TYPE: A
   HOST: @
   DATA: $RenderApexIp

   TYPE: CNAME
   HOST: www
   DATA: YOUR-APP.onrender.com
          (replace with your real Render hostname from Step 2)

5. Save. Wait 15 min – 48 hrs for DNS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Verify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Render dashboard: custom domain shows Verified + SSL
- Browser (incognito): https://telephanti.com  -> Luna loads
- https://telephanti.com/luna  -> Luna
- Your PC can be off; Luna still works.

COST
----
Render starter plan ~`$7/month. Domain renewal via Squarespace separately.

NOT BEACONS
-----------
Beacons cannot run Luna. telephanti.com goes straight to Render/Luna.
You can still add a Beacons link elsewhere later if you want.

LOCAL PC
--------
Desktop Luna at http://127.0.0.1:8767 still works separately.
Remove fake local DNS if you added it:
  Delete "127.0.0.1 telephanti.com" from hosts file (Notepad as Admin).
"@

$outPath = Join-Path $Desktop "Deploy-Telephanti-Luna-Live.txt"
Set-Content -Path $outPath -Value $guide -Encoding UTF8

Write-Host ""
Write-Host "Live Luna guide saved:"
Write-Host "  $outPath"
Write-Host ""
Write-Host "Summary: GitHub -> Render -> Squarespace DNS A @ $RenderApexIp"
Start-Process $RenderDash
Start-Sleep -Milliseconds 600
Start-Process $SquarespaceDns
explorer.exe /select,"$outPath"