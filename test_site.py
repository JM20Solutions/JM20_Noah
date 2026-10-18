import http.server, threading, os, re, sys, json, mimetypes
from playwright.sync_api import sync_playwright

ROOT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/noah-test'
PORT = 8765

# headers from the real _headers file ("/*" block only; cache rules irrelevant here)
star = {}
cur = None
for line in open(os.path.join(ROOT, '_headers'), encoding='utf-8'):
    if not line.strip():
        continue
    if not line.startswith(' '):
        cur = line.strip()
    elif cur == '/*':
        k, v = line.strip().split(': ', 1)
        star[k] = v


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split('?')[0]
        if path.endswith('/'):
            path += 'index.html'
        fp = os.path.join(ROOT, path.lstrip('/'))
        status = 200
        if not os.path.isfile(fp):
            fp, status = os.path.join(ROOT, '404.html'), 404
        data = open(fp, 'rb').read()
        ctype = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
        rng = self.headers.get('Range')
        self.send_response(206 if (rng and status == 200) else status)
        if rng and status == 200:
            m = re.match(r'bytes=(\d*)-(\d*)', rng)
            s = int(m.group(1) or 0)
            e = int(m.group(2)) if m.group(2) else len(data) - 1
            self.send_header('Content-Range', f'bytes {s}-{e}/{len(data)}')
            data = data[s:e + 1]
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Accept-Ranges', 'bytes')
        for k, v in star.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)


srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}'

results = []


def ok(name, cond, detail=''):
    results.append((bool(cond), name, detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page()
    msgs, errs, reqs, csp = [], [], [], []
    page.on('console', lambda m: msgs.append((m.type, m.text)))
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('request', lambda r: reqs.append(r.url))
    resp_status = {}
    page.on('response', lambda r: resp_status.__setitem__(r.url, r.status))
    page.goto(BASE + '/', wait_until='networkidle')
    page.wait_for_timeout(1200)

    bad = [m for m in msgs if m[0] in ('error', 'warning')]
    ok('no console errors/warnings (CSP enforced)', not bad and not errs, str(bad[:3] + errs[:3]))
    ext = [u for u in reqs if not u.startswith(BASE) and not u.startswith('data:')]
    ok('zero requests to external hosts', not ext, str(ext))
    fonts = [u for u in resp_status if '/fonts/' in u]
    ok('self-hosted Inter loads (200)', fonts and all(resp_status[u] == 200 for u in fonts), str([u.split('/')[-1] for u in fonts]))
    hdr = page.evaluate("""async()=>{const r=await fetch('/',{cache:'no-store'});return Object.fromEntries(r.headers)}""")
    ok('CSP header present on response', 'content-security-policy' in hdr)
    ok('landmarks: header/nav/main/footer = 1 each',
       page.evaluate("['header','nav.nav','main','footer'].map(s=>document.querySelectorAll(s).length).join()") == '1,1,1,1')
    ok('exactly one h1', page.locator('h1').count() == 1)
    ok('title <= 60 chars', len(page.title()) <= 60, page.title())
    ok('canonical == test origin', page.get_attribute('link[rel=canonical]', 'href') == 'https://noah.example.test/')

    # ---- skip link
    page.keyboard.press('Tab')
    page.wait_for_timeout(400)
    sk = page.evaluate("(()=>{const e=document.activeElement;const r=e.getBoundingClientRect();return {cls:e.className,top:r.top,txt:e.textContent}})()")
    ok('first Tab stop is the skip link and it is on-screen', sk['cls'] == 'skip-link' and sk['top'] >= 0, str(sk))
    page.keyboard.press('Enter')
    ok('skip link moves focus to <main>', page.evaluate("document.activeElement.id") == 'main')

    # ---- sticky header
    page.evaluate("window.scrollTo(0,1500)")
    page.wait_for_timeout(200)
    ok('header stays stuck to top after scroll', page.evaluate("document.querySelector('.site-header').getBoundingClientRect().top") == 0)
    page.evaluate("window.scrollTo(0,0)")

    # ---- tabs (mouse)
    page.locator('#tab-reschedule').click()
    st = page.evaluate("""()=>({sel:document.querySelector('#tab-reschedule').getAttribute('aria-selected'),
        ti:[...document.querySelectorAll('.tab-btn')].map(b=>b.tabIndex).join(),
        lb:document.getElementById('demoPanel').getAttribute('aria-labelledby'),
        title:document.getElementById('panelTitle').textContent,
        src:document.querySelector('#demoAudio source').getAttribute('src')})""")
    ok('tab click: aria-selected / roving tabindex / panel label / content / audio src',
       st['sel'] == 'true' and st['ti'] == '-1,0,-1' and st['lb'] == 'tab-reschedule' and st['title'] == 'Cambio de cita' and st['src'] == 'audio/reschedule.mp3', str(st))
    # ---- tabs (keyboard)
    page.locator('#tab-reschedule').focus()
    page.keyboard.press('ArrowRight')
    ok('ArrowRight -> Cancelar', page.evaluate("document.activeElement.id") == 'tab-cancel')
    page.keyboard.press('Home')
    ok('Home -> first tab', page.evaluate("document.activeElement.id") == 'tab-booking')
    page.keyboard.press('End')
    ok('End -> last tab', page.evaluate("document.activeElement.id") == 'tab-cancel')
    page.locator('#tab-booking').click()

    # ---- audio actually loads
    page.wait_for_timeout(800)
    au = page.evaluate("""()=>{const a=document.getElementById('demoAudio');return {rs:a.readyState,d:a.duration,err:a.error&&a.error.code,errMsgShown:!document.getElementById('audioErr').hidden}}""")
    ok('booking audio loads metadata (duration > 0), no error banner', au['rs'] >= 1 and (au['d'] or 0) > 0 and not au['errMsgShown'], str(au))
    for t in ('reschedule', 'cancel'):
        page.locator(f'#tab-{t}').click(); page.wait_for_timeout(700)
        d = page.evaluate("document.getElementById('demoAudio').duration")
        ok(f'{t} audio loads (duration > 0)', (d or 0) > 0, str(d))
    page.locator('#tab-booking').click()
    ok('audio is not fully downloaded on load (preload=metadata)', page.get_attribute('#demoAudio', 'preload') == 'metadata')

    # ---- FAQ
    vis0 = page.evaluate("[...document.querySelectorAll('.faq-a')].map(e=>getComputedStyle(e).visibility).join()")
    ok('FAQ answers hidden from assistive tech while closed', set(vis0.split(',')) == {'hidden'}, vis0)
    page.locator('.faq-q').first.scroll_into_view_if_needed()
    page.locator('.faq-q').first.click(); page.wait_for_timeout(600)
    f = page.evaluate("""()=>({exp:document.querySelector('.faq-q').getAttribute('aria-expanded'),vis:getComputedStyle(document.querySelector('.faq-a')).visibility,
       ctrl:document.querySelector('.faq-q').getAttribute('aria-controls')})""")
    ok('FAQ opens: aria-expanded=true, answer visible', f['exp'] == 'true' and f['vis'] == 'visible', str(f))

    # ---- language toggle
    page.locator('.lang-btn[data-lang=en]').click(); page.wait_for_timeout(300)
    en = page.evaluate("""()=>({lang:document.documentElement.lang,title:document.title,
        sub:document.getElementById('panelSub').textContent,skip:document.querySelector('.skip-link').textContent,
        foot:[...document.querySelectorAll('.footer-links a')].map(a=>a.textContent).join('|'),
        flabel:document.querySelector('.footer-links').getAttribute('aria-label'),
        qr:document.querySelector('.qr-box').getAttribute('aria-label'),
        tlang:document.getElementById('transcript').lang})""")
    ok('EN toggle: html lang, title, subtitle fixed, skip link, footer, qr label',
       en['lang'] == 'en' and 'AI receptionist' in en['title'] and en['sub'].startswith('Haircut') and en['skip'] == 'Skip to content'
       and en['foot'] == 'JM20 AI Solutions website|Terms of service|Privacy policy' and en['qr'] == 'QR code: https://noah.example.test/', str(en))
    ok('transcript keeps lang="es" while UI is English', en['tlang'] == 'es')
    enh = page.evaluate("[...document.querySelectorAll('.footer-links a')].map(a=>a.href).join('|')")
    ok('EN UI: legal links point to the ENGLISH pages', enh == 'https://example.test/|https://example.test/terms-of-service|https://example.test/privacy-policy', enh)
    page.locator('.lang-btn[data-lang=es]').click()

    # ---- footer links / QR
    ok('footer links point to parent/legal/privacy',
       page.evaluate("[...document.querySelectorAll('.footer-links a')].map(a=>a.href).join('|')") ==
       'https://example.test/|https://example.test/terminos-de-servicio|https://example.test/politica-de-privacidad')
    qb = page.evaluate("(()=>{const s=document.querySelector('.qr-box svg');const r=s.getBoundingClientRect();return {w:r.width,h:r.height,vb:s.getAttribute('viewBox'),paths:s.querySelectorAll('path').length}})()")
    ok('QR fills its 148px box (rendered size, viewBox, paths)', qb['w'] >= 140 and qb['h'] >= 140 and qb['vb'] and qb['paths'] == 2, str(qb))

    # ---- 404
    r = page.goto(BASE + '/no-such-page')
    ok('unknown URL -> real 404 status with 404 page', r.status == 404 and 'Página no encontrada' in page.content())

    # ---- screenshots
    page.goto(BASE + '/', wait_until='networkidle'); page.wait_for_timeout(1000)
    page.screenshot(path='/tmp/shot_top.png')
    page.evaluate("window.scrollTo(0,document.body.scrollHeight)"); page.wait_for_timeout(1200)
    page.screenshot(path='/tmp/shot_bottom.png')
    m = b.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2).new_page()
    m.goto(BASE + '/', wait_until='networkidle'); m.wait_for_timeout(800)
    ok('mobile: no horizontal scroll', m.evaluate("document.documentElement.scrollWidth<=window.innerWidth"))
    m.screenshot(path='/tmp/shot_mobile.png')
    b.close()

fails = [r for r in results if not r[0]]
print(f'\n{len(results)-len(fails)}/{len(results)} passed')
sys.exit(1 if fails else 0)
