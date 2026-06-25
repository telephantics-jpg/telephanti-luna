# telephanti.com on Squarespace -> point DNS to Beacons
$ErrorActionPreference = "Stop"
$Desktop = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path $Desktop)) {
    $Desktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
}

$SquarespaceDomains = "https://account.squarespace.com/domains"
$BeaconsConnect = "https://account.beacons.ai/account-settings/home/custom-domain"
$BeaconsEditor = "https://account.beacons.ai/account/home/home"

$guide = @"
TELEPHANTI.COM — SQUARESPACE DNS -> BEACONS
===========================================

You bought telephanti.com through Squarespace. DNS is edited IN SQUARESPACE,
not in Beacons. Beacons only tells you what records to add.

PART 1 — Start in Beacons (get the SSL record)
------------------------------------------------
1. Open: $BeaconsConnect
2. Click Connect
3. Enter: telephanti.com
4. COPY the _acme-challenge CNAME value Beacons shows (unique to you)
   Keep that tab open.

PART 2 — Squarespace DNS (the main work)
----------------------------------------
1. Open: $SquarespaceDomains
2. Log in
3. Click: telephanti.com
4. Open: DNS Settings  (or DNS -> Custom records)

5. DELETE conflicting records first (important!)
   Remove any existing A, AAAA, or CNAME for:
     @   (root / blank host)
     www
   Squarespace default records often point to their own servers —
   those block Beacons until removed.

   KEEP: MX records (email), TXT records you need — do not delete those.

6. ADD these Custom records:

   Record 1 — root domain
     TYPE:  A
     HOST:  @          (blank in some Squarespace screens = @)
     DATA:  34.49.161.242
     TTL:   3600 (or default)

   Record 2 — wildcard (covers subdomains)
     TYPE:  A
     HOST:  *
     DATA:  34.49.161.242
     TTL:   3600

   Record 3 — SSL certificate (from Beacons Part 1)
     TYPE:  CNAME
     HOST:  _acme-challenge
     DATA:  (paste exact value from Beacons — often ends in .goog or similar)
     TTL:   3600

7. Click Save after each record.

PART 3 — Back to Beacons
------------------------
1. In Beacons custom domain screen, click Verify / Refresh
2. Wait for green checkmark + SSL lock (can take 15 min – 48 hrs)
3. Open Beacons editor: $BeaconsEditor
4. Build page -> Publish (top right)

PART 4 — Test
-------------
Open https://telephanti.com in incognito.
You should see your Beacons page.

SQUARESPACE TIPS
----------------
- "Host" @ means telephanti.com (root). www is separate if you add it later.
- If Save fails on CNAME: remove trailing dot from the value if Squarespace adds one.
- If domain is tied to a Squarespace website: DNS change moves the domain to
  Beacons instead — your Squarespace site won't show on telephanti.com anymore.
- DNS propagation: usually 15–60 minutes; worst case 48 hours.

LATER — Luna subdomain (optional)
---------------------------------
When Luna is on Render, add in Squarespace DNS:

  TYPE: CNAME   HOST: luna   DATA: your-app.onrender.com

That overrides the wildcard * for luna.telephanti.com only.

TROUBLESHOOTING
---------------
Still Squarespace parking page? Old A records not deleted.
SSL error? _acme-challenge CNAME missing or wrong.
Beacons says not connected? Wait longer, then re-verify in Beacons.
"@

$outPath = Join-Path $Desktop "Squarespace-Telephanti-Beacons.txt"
Set-Content -Path $outPath -Value $guide -Encoding UTF8

Write-Host "Squarespace guide saved: $outPath"
Write-Host "Opening Squarespace Domains + Beacons..."
Start-Process $SquarespaceDomains
Start-Sleep -Milliseconds 700
Start-Process $BeaconsConnect
explorer.exe /select,"$outPath"