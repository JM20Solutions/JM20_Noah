/* Noah missed-call calculator.
   Pure client-side: nothing is sent anywhere until the visitor submits the demo form.
   The CTA reuses the existing demo form (noah-form.js) and adds the numbers to its comments box.
   Keep NOAH_MONTHLY / NOAH_SETUP in sync with the pricing section of index.html. */
(function () {
  'use strict';

  var NOAH_MONTHLY = 49;   // Starter plan, EUR per month (+ VAT)
  var NOAH_SETUP = 180;    // one-time installation, EUR (+ VAT)

  var LIMITS = {
    calls:  { min: 0, max: 500 },
    missed: { min: 0, max: 100 },
    book:   { min: 0, max: 100 },
    ticket: { min: 0, max: 1000 },
    days:   { min: 1, max: 31 }
  };

  var TX = {
    es: {
      h2: '¿Cuánto te cuestan las llamadas sin contestar?',
      sub: 'Pon tus números y míralo en 20 segundos. Es una estimación con tus propios datos.',
      calls: 'Llamadas que recibes al día', callsH: 'Cuenta todas las llamadas del negocio.',
      missed: 'De esas, ¿qué % no puedes contestar?', missedH: 'Con un cliente en la silla, a mediodía, fuera de horario…',
      book: 'De las perdidas, ¿qué % acabaría en reserva?', bookH: 'Cuenta solo las que no volverían a llamar.',
      ticket: 'Precio medio por cliente', ticketH: 'Lo que cobras de media por cada cita.',
      days: 'Días que abres al mes', daysH: 'Por ejemplo, 26.',
      example: 'Valores de ejemplo. Cámbialos por los tuyos.',
      label: 'Estás perdiendo aproximadamente',
      big: '{month} al mes',
      detail: '≈ {year} al año · ≈ {bookings} {bw} al mes',
      bw1: 'reserva', bwN: 'reservas',
      noah: 'Con el plan Starter de Noah ({price} al mes + {setup} de instalación única, más IVA), recuperar {n} {nw} al mes ya cubre la cuota.',
      nw1: 'reserva', nwN: 'reservas',
      note: 'Estimación basada en los datos que has introducido. No es una garantía de resultados.',
      cta: 'Reserva una demo de 15 min',
      ctaNote: 'Añadimos estos números a tu solicitud para preparar la demo.',
      hero: 'Calcula lo que pierdes',
      comment: 'Calculadora: {calls} llamadas/día, {missed}% sin contestar, {book}% acabarían en reserva, {ticket} € de media, {days} días/mes. Estimación: {month} al mes.',
      locale: 'es-ES'
    },
    en: {
      h2: 'How much do unanswered calls cost you?',
      sub: 'Enter your numbers and see it in 20 seconds. It is an estimate based on your own data.',
      calls: 'Calls you receive per day', callsH: 'Count every call the business gets.',
      missed: 'What % of those can you not answer?', missedH: 'With a client in the chair, at lunch, after hours…',
      book: 'Of the missed ones, what % would end in a booking?', bookH: 'Count only those who would not call back.',
      ticket: 'Average price per client', ticketH: 'What you charge on average per appointment.',
      days: 'Days you open per month', daysH: 'For example, 26.',
      example: 'Example values. Change them to yours.',
      label: 'You are losing roughly',
      big: '{month} a month',
      detail: '≈ {year} a year · ≈ {bookings} {bw} a month',
      bw1: 'booking', bwN: 'bookings',
      noah: 'With the Noah Starter plan ({price} a month + {setup} one-time setup, plus VAT), recovering {n} {nw} a month already covers the fee.',
      nw1: 'booking', nwN: 'bookings',
      note: 'Estimate based on the data you entered. Not a guarantee of results.',
      cta: 'Book a 15-min demo',
      ctaNote: 'We add these numbers to your request so we can prepare the demo.',
      hero: 'Calculate what you lose',
      comment: 'Calculator: {calls} calls/day, {missed}% unanswered, {book}% would end in a booking, {ticket} EUR average, {days} days/month. Estimate: {month} a month.',
      locale: 'en-GB'
    }
  };

  var IDS = ['calls', 'missed', 'book', 'ticket', 'days'];

  function clamp(name, raw) {
    var n = parseFloat(String(raw).replace(',', '.'));
    if (!isFinite(n)) n = 0;
    var l = LIMITS[name];
    return Math.min(l.max, Math.max(l.min, n));
  }

  // Pure calculation, no DOM. Exposed for testing.
  function compute(v) {
    var bookings = v.calls * (v.missed / 100) * (v.book / 100) * v.days;
    var month = bookings * v.ticket;
    return {
      bookings: bookings,
      month: month,
      year: month * 12,
      breakeven: v.ticket > 0 ? Math.ceil(NOAH_MONTHLY / v.ticket) : null
    };
  }

  function lang() {
    return (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
  }

  function fill(tpl, map) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; });
  }

  function eur(n, locale) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
  }

  function read() {
    var v = {};
    IDS.forEach(function (id) {
      var el = document.getElementById('calc-' + id);
      v[id] = clamp(id, el ? el.value : 0);
    });
    return v;
  }

  function setText(sel, text) {
    var el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  var last = { text: '' };

  function render() {
    var t = TX[lang()];
    var v = read();
    var r = compute(v);
    var b = Math.round(r.bookings);

    setText('[data-c="h2"]', t.h2);
    setText('[data-c="sub"]', t.sub);
    IDS.forEach(function (id) {
      setText('[data-c="' + id + '"]', t[id]);
      setText('[data-c="' + id + 'H"]', t[id + 'H']);
    });
    setText('[data-c="example"]', t.example);
    setText('[data-c="label"]', t.label);
    setText('[data-c="note"]', t.note);
    setText('[data-c="cta"]', t.cta);
    setText('[data-c="ctaNote"]', t.ctaNote);
    setText('#calcHeroLink', t.hero);

    var month = eur(r.month, t.locale);
    setText('[data-c="big"]', fill(t.big, { month: month }));
    setText('[data-c="detail"]', fill(t.detail, {
      year: eur(r.year, t.locale),
      bookings: new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 }).format(b),
      bw: b === 1 ? t.bw1 : t.bwN
    }));

    var noahEl = document.querySelector('[data-c="noah"]');
    if (noahEl) {
      if (r.breakeven) {
        noahEl.style.display = '';
        noahEl.textContent = fill(t.noah, {
          price: eur(NOAH_MONTHLY, t.locale), setup: eur(NOAH_SETUP, t.locale),
          n: r.breakeven, nw: r.breakeven === 1 ? t.nw1 : t.nwN
        });
      } else {
        noahEl.style.display = 'none';
      }
    }

    last.text = fill(t.comment, {
      calls: v.calls, missed: v.missed, book: v.book, ticket: v.ticket, days: v.days, month: month
    });
  }

  function init() {
    var section = document.getElementById('calculadora');
    if (!section) return;

    IDS.forEach(function (id) {
      var el = document.getElementById('calc-' + id);
      if (el) el.addEventListener('input', render);
    });

    // The existing demo form (noah-form.js) opens from this link. Once it is open,
    // add the calculator numbers to its comments box, unless the visitor already typed something.
    var cta = document.getElementById('calcCta');
    if (cta) {
      cta.addEventListener('click', function () {
        setTimeout(function () {
          var box = document.getElementById('nf-comments');
          if (box && !box.value) box.value = last.text;
        }, 80);
      });
    }

    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render();
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute, clamp: clamp };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
