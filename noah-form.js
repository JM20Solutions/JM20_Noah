/* Noah demo-request form. Opens from every "Reserva una demo" / plan button.
   Saves the lead to Supabase (public.leads_noah); a database webhook then sends the emails. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wiavnyuchdsfztzhvaua.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXZueXVjaGRzZnp0emh2YXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI2ODQsImV4cCI6MjA4NjU3ODY4NH0.dXz7vyFglA_lihma__rbtBT8afZZ1YUJEkAmqpFOL6c';
  var TRIGGER = 'a[href*="jmsolutions-mng6gi/noah-calendar"]';

  var TX = {
    es: {
      title: 'Reserva tu demo de 15 min',
      sub: 'Cuéntanos sobre tu negocio y te enviamos por email el enlace para elegir día y hora.',
      name: 'Nombre', business: 'Nombre de tu negocio', phone: 'Teléfono', email: 'Correo electrónico',
      where: 'Dónde quieres ver la demo', meet: 'Google Meet', onsite: 'En mi negocio',
      comments: 'Comentarios', commentsPh: 'Cuéntanos qué necesitas para preparar la reunión.',
      legalA: 'Al enviar aceptas nuestra ', legalLink: 'política de privacidad', legalHref: '/politica-de-privacidad', legalB: '.',
      submit: 'Enviar solicitud', sending: 'Enviando…',
      err: 'Algo salió mal. Inténtalo de nuevo en unos minutos.',
      doneTitle: '¡Solicitud recibida!',
      doneBody: 'Te hemos enviado un email con el enlace para elegir día y hora. Si no lo ves, revisa la carpeta de spam.',
      close: 'Cerrar',
      tool: 'Solicita una demo de 15 minutos de Noah, la recepcionista de IA para negocios. Guarda la solicitud y envía por email a la persona un enlace para elegir día y hora. No reserva directamente.',
      pName: 'Nombre y apellidos de la persona de contacto', pBusiness: 'Nombre del negocio',
      pPhone: 'Teléfono de contacto con prefijo de país', pEmail: 'Correo electrónico donde recibir el enlace de reserva',
      pWhere: 'Dónde se hará la demo: google_meet (videollamada) o en_mi_negocio (presencial)',
      pComments: 'Opcional: qué necesita el negocio', pHp: 'Campo antispam. Dejar siempre vacío.'
    },
    en: {
      title: 'Book your 15-min demo',
      sub: 'Tell us about your business and we will email you the link to pick a day and time.',
      name: 'Name', business: 'Business name', phone: 'Phone', email: 'Email',
      where: 'Where do you want to see the demo', meet: 'Google Meet', onsite: 'At my business',
      comments: 'Comments', commentsPh: 'Tell us what you need so we can prepare the meeting.',
      legalA: 'By submitting you accept our ', legalLink: 'privacy policy', legalHref: '/privacy-policy', legalB: '.',
      submit: 'Send request', sending: 'Sending…',
      err: 'Something went wrong. Please try again in a few minutes.',
      doneTitle: 'Request received!',
      doneBody: 'We have emailed you the link to pick a day and time. If you do not see it, check your spam folder.',
      close: 'Close',
      tool: 'Request a 15-minute demo of Noah, the AI receptionist for businesses. Saves the request and emails the person a link to pick a day and time. It does not book directly.',
      pName: 'Full name of the contact person', pBusiness: 'Business name',
      pPhone: 'Contact phone number with country code', pEmail: 'Email address to receive the booking link',
      pWhere: 'Where the demo takes place: google_meet (video call) or en_mi_negocio (in person)',
      pComments: 'Optional: what the business needs', pHp: 'Anti-spam field. Always leave empty.'
    }
  };

  var overlay, card, lastTrigger, currentLang, currentPlan = '';

  function getLang() {
    return (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
  }

  function render(lang) {
    var t = TX[lang];
    currentLang = lang;
    card.innerHTML =
      '<button type="button" class="nf-close" aria-label="' + t.close + '">&times;</button>' +
      '<div class="nf-view-form">' +
        '<h2 id="nf-title">' + t.title + '</h2>' +
        '<p class="nf-sub">' + t.sub + '</p>' +
        '<form id="nf-form" novalidate>' +
          '<div class="nf-field"><label for="nf-name">' + t.name + ' *</label>' +
            '<input id="nf-name" name="full_name" type="text" required maxlength="120" autocomplete="name"></div>' +
          '<div class="nf-field"><label for="nf-business">' + t.business + ' *</label>' +
            '<input id="nf-business" name="business_name" type="text" required maxlength="160" autocomplete="organization"></div>' +
          '<div class="nf-field"><label for="nf-phone">' + t.phone + ' *</label>' +
            '<input id="nf-phone" name="phone" type="tel" required minlength="5" maxlength="30" autocomplete="tel" placeholder="+34 600 000 000"></div>' +
          '<div class="nf-field"><label for="nf-email">' + t.email + ' *</label>' +
            '<input id="nf-email" name="email" type="email" required maxlength="254" autocomplete="email"></div>' +
          '<div class="nf-field"><span class="nf-legend">' + t.where + '</span><div class="nf-radios">' +
            '<label><input type="radio" name="meeting_type" value="google_meet" checked> ' + t.meet + '</label>' +
            '<label><input type="radio" name="meeting_type" value="en_mi_negocio"> ' + t.onsite + '</label>' +
          '</div></div>' +
          '<div class="nf-field"><label for="nf-comments">' + t.comments + '</label>' +
            '<textarea id="nf-comments" name="comments" maxlength="2000" placeholder="' + t.commentsPh + '"></textarea></div>' +
          '<div class="nf-hp" aria-hidden="true"><label for="nf-website">Website</label>' +
            '<input id="nf-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
          '<p class="nf-legal">' + t.legalA + '<a href="' + t.legalHref + '" target="_blank" rel="noopener">' + t.legalLink + '</a>' + t.legalB + '</p>' +
          '<div class="nf-error" role="alert">' + t.err + '</div>' +
          '<button type="submit" class="btn-primary nf-submit">' + t.submit + '</button>' +
        '</form>' +
      '</div>' +
      '<div class="nf-done" style="display:none" role="status">' +
        '<div class="nf-tick">&#10003;</div>' +
        '<h2>' + t.doneTitle + '</h2>' +
        '<p class="nf-sub">' + t.doneBody + '</p>' +
        '<button type="button" class="btn-primary nf-close-done">' + t.close + '</button>' +
      '</div>';

    card.querySelector('.nf-close').addEventListener('click', close);
    card.querySelector('.nf-close-done').addEventListener('click', close);
    card.querySelector('#nf-form').addEventListener('submit', onSubmit);
  }

  function open(plan, trigger) {
    var lang = getLang();
    if (lang !== currentLang || card.querySelector('.nf-done').style.display !== 'none') render(lang);
    currentPlan = plan || '';
    lastTrigger = trigger || null;
    overlay.classList.add('nf-open');
    document.documentElement.classList.add('nf-lock');
    var first = card.querySelector('#nf-name');
    if (first) setTimeout(function () { first.focus(); }, 30);
  }

  function close() {
    overlay.classList.remove('nf-open');
    document.documentElement.classList.remove('nf-lock');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = e.target, t = TX[currentLang];
    var errBox = form.querySelector('.nf-error'), btn = form.querySelector('.nf-submit');
    errBox.classList.remove('nf-show');
    if (!form.reportValidity()) return;

    var v = function (n) { return (form.elements[n].value || '').trim(); };
    var meeting = form.elements['meeting_type'].value === 'en_mi_negocio' ? 'en_mi_negocio' : 'google_meet';

    // Anti-spam trap: bots fill the hidden field. Pretend success, send nothing.
    if (v('website')) { showDone(); return; }

    btn.disabled = true; btn.textContent = t.sending;
    fetch(SUPABASE_URL + '/rest/v1/leads_noah', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        full_name: v('full_name'),
        business_name: v('business_name'),
        phone: v('phone'),
        email: v('email'),
        meeting_type: meeting,
        comments: v('comments') || null,
        plan: currentPlan || null,
        lang: currentLang
      })
    }).then(function (res) {
      if (res.ok) showDone();
      else throw new Error('http ' + res.status);
    }).catch(function () {
      errBox.classList.add('nf-show');
      btn.disabled = false; btn.textContent = t.submit;
    });
  }

  function showDone() {
    card.querySelector('.nf-view-form').style.display = 'none';
    var d = card.querySelector('.nf-done');
    d.style.display = 'block';
    var b = d.querySelector('.nf-close-done'); if (b) b.focus();
  }

  function trapTab(e) {
    if (e.key !== 'Tab') return;
    var f = card.querySelectorAll('button:not([disabled]),a[href],input:not([tabindex="-1"]),textarea');
    var vis = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
    if (!vis.length) return;
    var first = vis[0], last = vis[vis.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* WebMCP (Chrome): lets a browser AI agent call "reservar_demo_noah".
     It opens the visible form and pre-fills it; the PERSON reviews and presses Send.
     Browsers without WebMCP skip this silently. */
  function registerAgentTool() {
    try {
      var mc = document.modelContext;
      if (!mc || typeof mc.registerTool !== 'function') return;
      var es = TX.es;
      Promise.resolve(mc.registerTool({
        name: 'reservar_demo_noah',
        description: es.tool + ' | ' + TX.en.tool + ' The person must review the pre-filled form and press the send button themselves.',
        inputSchema: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: es.pName },
            business_name: { type: 'string', description: es.pBusiness },
            phone: { type: 'string', description: es.pPhone },
            email: { type: 'string', description: es.pEmail },
            meeting_type: { type: 'string', enum: ['google_meet', 'en_mi_negocio'], description: es.pWhere },
            comments: { type: 'string', description: es.pComments },
            plan: { type: 'string', description: 'Optional plan of interest: Starter, Pro, Anual or Pay As You Go' }
          },
          required: ['full_name', 'business_name', 'phone', 'email']
        },
        annotations: { readOnlyHint: false },
        execute: function (a) {
          a = a || {};
          open(String(a.plan || '').slice(0, 60), null);
          var f = card.querySelector('#nf-form');
          if (!f) return 'The form could not be opened.';
          var set = function (n, v) { if (v != null && f.elements[n]) f.elements[n].value = String(v); };
          set('full_name', a.full_name); set('business_name', a.business_name);
          set('phone', a.phone); set('email', a.email); set('comments', a.comments);
          if (a.meeting_type === 'google_meet' || a.meeting_type === 'en_mi_negocio') {
            Array.prototype.forEach.call(f.querySelectorAll('input[name="meeting_type"]'), function (r) {
              r.checked = (r.value === a.meeting_type);
            });
          }
          return f.checkValidity()
            ? 'The demo request form is open and pre-filled. The person must review it and press "Enviar solicitud"; they will then receive an email with a link to pick a day and time.'
            : 'The form is open but some fields are missing or invalid (check phone and email). The person must correct them and press "Enviar solicitud".';
        }
      })).catch(function () {});
    } catch (e) {}
  }

  function init() {
    overlay = document.createElement('div');
    overlay.className = 'nf-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'nf-title');
    card = document.createElement('div');
    card.className = 'nf-card';
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    render(getLang());
    registerAgentTool();

    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('nf-open')) return;
      if (e.key === 'Escape') close(); else trapTab(e);
    });

    // Every existing Cal.com link on the page now opens this form instead.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest(TRIGGER);
      if (!a) return;
      e.preventDefault();
      var plan = '';
      try { plan = (new URL(a.href).searchParams.get('notes') || '').replace(/^Plan:\s*/i, ''); } catch (x) {}
      open(plan, a);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
