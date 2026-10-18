#!/usr/bin/env python3
"""Turn site-template/ into a deploy-ready site/ folder.

  python3 finalize.py --origin https://noah.example.com \
      --parent https://example.com \
      --legal https://example.com/aviso-legal \
      --privacy https://example.com/privacidad \
      --out site
"""
import argparse, base64, datetime, hashlib, json, os, re, shutil, sys
from urllib.parse import urlparse

import segno

ap = argparse.ArgumentParser()
ap.add_argument('--origin', required=True, help='public URL of this site, e.g. https://noah.example.com (no trailing slash)')
ap.add_argument('--parent', required=True, help='URL of the main website (no trailing slash)')
ap.add_argument('--legal', required=True, help='full URL of the legal notice (aviso legal)')
ap.add_argument('--privacy', required=True, help='full URL of the privacy policy (Spanish)')
ap.add_argument('--legal-en', required=True, help='full URL of the terms of service (English)')
ap.add_argument('--privacy-en', required=True, help='full URL of the privacy policy (English)')
ap.add_argument('--out', default='site')
a = ap.parse_args()

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'site-template')
out = os.path.join(here, a.out) if not os.path.isabs(a.out) else a.out


def check_url(name, u, trailing_slash_ok=True):
    p = urlparse(u)
    if p.scheme != 'https' or not p.netloc:
        sys.exit(f'--{name} must be an absolute https URL, got: {u}')
    if not trailing_slash_ok and u.endswith('/'):
        sys.exit(f'--{name} must not end with "/": {u}')


check_url('origin', a.origin, False)
check_url('parent', a.parent, False)
check_url('legal', a.legal)
check_url('privacy', a.privacy)
check_url('legal-en', a.legal_en)
check_url('privacy-en', a.privacy_en)

if os.path.exists(out):
    shutil.rmtree(out)
shutil.copytree(src, out)

TEXT = ('.html', '.txt', '.xml', '.css', '_headers')
subs = {
    '__ORIGIN__': a.origin, '__PARENT_URL__': a.parent,
    '__LEGAL_URL__': a.legal, '__PRIVACY_URL__': a.privacy,
    '__LEGAL_URL_EN__': a.legal_en, '__PRIVACY_URL_EN__': a.privacy_en,
    '__LASTMOD__': datetime.date.today().isoformat(),
}
for root, _, files in os.walk(out):
    for f in files:
        if f.endswith(TEXT) or f == '_headers':
            p = os.path.join(root, f)
            t = open(p, encoding='utf-8').read()
            for k, v in subs.items():
                t = t.replace(k, v)
            open(p, 'w', encoding='utf-8').write(t)

# ---- QR code for the real address
idx = os.path.join(out, 'index.html')
h = open(idx, encoding='utf-8').read()
qr = segno.make(a.origin + '/', error='m')
svg = qr.svg_inline(scale=1, border=4, dark='#1d1d1f', light='#ffffff')
qw, qh = qr.symbol_size(scale=1, border=4)
svg, k = re.subn(r'<svg[^>]*>', f'<svg viewBox="0 0 {qw} {qh}" class="segno">', svg, count=1)
assert k == 1 and 'viewBox="0 0 %d %d"' % (qw, qh) in svg
h, n = re.subn(r'(<div class="qr-box"[^>]*>)<svg.*?</svg>(</div>)', lambda m: m.group(1) + svg + m.group(2), h, count=1, flags=re.S)
if n != 1:
    sys.exit('could not find the QR box in index.html')
open(idx, 'w', encoding='utf-8').write(h)

# ---- CSP hashes for the inline <script>/<style> blocks (computed on the FINAL file)
def sha(txt):
    return "'sha256-" + base64.b64encode(hashlib.sha256(txt.encode('utf-8')).digest()).decode() + "'"


scripts = [m.group(2) for m in re.finditer(r'<script(\s[^>]*)?>(.*?)</script>', h, re.S)
           if not (m.group(1) and ('src=' in m.group(1) or 'ld+json' in m.group(1)))]
styles = [m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', h, re.S)]
hp = os.path.join(out, '_headers')
hd = open(hp, encoding='utf-8').read()
hd = hd.replace('__CSP_SCRIPT__', ' '.join(sha(x) for x in scripts)).replace('__CSP_STYLE__', ' '.join(sha(x) for x in styles))
open(hp, 'w', encoding='utf-8').write(hd)

# ---------------------------------------------------------------- verification
problems = []
for root, _, files in os.walk(out):
    for f in files:
        p = os.path.join(root, f)
        if f.endswith(TEXT) or f == '_headers':
            t = open(p, encoding='utf-8').read()
            left = set(re.findall(r'__[A-Z_]{3,}__', t))
            if left:
                problems.append(f'unreplaced placeholders in {os.path.relpath(p, out)}: {sorted(left)}')

# local references exist
for ref in set(re.findall(r'(?:src|href)="([^"#?][^"]*)"', h)):
    if re.match(r'(https?:|mailto:|tel:|javascript:|data:)', ref):
        continue
    if not os.path.exists(os.path.join(out, ref.lstrip('/'))):
        problems.append(f'index.html references a missing file: {ref}')
for ref in re.findall(r"src:\s*'([^']+\.mp3)'", h):
    if not os.path.exists(os.path.join(out, ref)):
        problems.append(f'demo audio missing: {ref}')
for ref in re.findall(r'url\((fonts/[^)]+)\)', h):
    if not os.path.exists(os.path.join(out, ref)):
        problems.append(f'font missing: {ref}')

# JSON-LD valid + URLs consistent
ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
try:
    data = json.loads(ld.group(1))
    types = [x['@type'] for x in data['@graph']]
    assert types == ['Organization', 'WebSite', 'Service', 'FAQPage'], types
except Exception as e:
    problems.append(f'JSON-LD invalid: {e}')

canon = re.search(r'<link rel="canonical" href="([^"]+)"', h).group(1)
if canon != a.origin + '/':
    problems.append(f'canonical is {canon}')
title = re.search(r'<title[^>]*>(.*?)</title>', h).group(1)
if len(title) > 60:
    problems.append(f'title is {len(title)} chars')
if 'github.io' in h or 'fonts.googleapis' in h or 'fonts.gstatic' in h:
    problems.append('old GitHub / Google Fonts reference still present')
if 'dashboard.html' in os.listdir(out):
    problems.append('dashboard.html must not be deployed here')

print('script hashes:', len(scripts), '| style hashes:', len(styles))
print('files:')
for root, _, files in sorted(os.walk(out)):
    for f in sorted(files):
        p = os.path.join(root, f)
        print(f'  {os.path.relpath(p, out):28s} {os.path.getsize(p):>9,d} B')
if problems:
    print('\nPROBLEMS:')
    for x in problems:
        print('  -', x)
    sys.exit(1)
print('\nALL CHECKS PASSED  ->', out)
