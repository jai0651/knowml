/* KnowML — shared in-page modal, replacing native confirm()/alert()/prompt().
   Native dialogs block the render thread, look like the browser rather than
   the site, and can't hold more than one field — which is why "add a comment
   on this passage" needed two of them back to back. One reusable component,
   three call shapes: confirm, alert, form. */
(function () {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function openModal(bodyEl, opts) {
    opts = opts || {};
    var overlay = el('div', 'kml-modal-overlay');
    var box = el('div', 'kml-modal-box');
    if (opts.title) box.appendChild(el('div', 'kml-modal-title', opts.title));
    box.appendChild(bodyEl);
    overlay.appendChild(box);

    var closeFn;
    var promise = new Promise(function (resolve) {
      var settled = false;
      closeFn = function (result) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey);
        overlay.classList.remove('open');
        document.body.style.overflow = prevOverflow;
        setTimeout(function () { overlay.remove(); }, 150);
        resolve(result);
      };
      function onKey(e) { if (e.key === 'Escape') closeFn(opts.escapeValue); }
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeFn(opts.escapeValue); });
    });

    var prevOverflow = document.body.style.overflow;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      overlay.classList.add('open');
      var first = box.querySelector('input, textarea');
      if (first) { first.focus(); if (first.select) first.select(); }
      else { var primary = box.querySelector('.kml-modal-primary'); if (primary) primary.focus(); }
    });

    return { promise: promise, close: closeFn };
  }

  function confirmDialog(message, opts) {
    opts = opts || {};
    var body = el('div', 'kml-modal-body');
    body.appendChild(el('p', 'kml-modal-msg', message));
    var actions = el('div', 'kml-modal-actions');
    var cancelBtn = el('button', 'kml-modal-btn', opts.cancelLabel || 'Cancel');
    var okBtn = el('button', 'kml-modal-btn kml-modal-primary' + (opts.danger ? ' kml-modal-danger' : ''), opts.confirmLabel || 'Confirm');
    cancelBtn.type = 'button'; okBtn.type = 'button';
    actions.appendChild(cancelBtn); actions.appendChild(okBtn);
    body.appendChild(actions);

    var m = openModal(body, { title: opts.title, escapeValue: false });
    cancelBtn.addEventListener('click', function () { m.close(false); });
    okBtn.addEventListener('click', function () { m.close(true); });
    return m.promise;
  }

  function alertDialog(message, opts) {
    opts = opts || {};
    var body = el('div', 'kml-modal-body');
    body.appendChild(el('p', 'kml-modal-msg', message));
    var actions = el('div', 'kml-modal-actions');
    var okBtn = el('button', 'kml-modal-btn kml-modal-primary', opts.okLabel || 'OK');
    okBtn.type = 'button';
    actions.appendChild(okBtn);
    body.appendChild(actions);

    var m = openModal(body, { title: opts.title || 'Heads up' });
    okBtn.addEventListener('click', function () { m.close(undefined); });
    return m.promise;
  }

  function formDialog(opts) {
    opts = opts || {};
    var body = el('div', 'kml-modal-body');
    if (opts.description) body.appendChild(el('p', 'kml-modal-desc', opts.description));
    var inputs = {};
    (opts.fields || []).forEach(function (f) {
      var wrap = el('label', 'kml-modal-field');
      wrap.appendChild(el('span', 'kml-modal-field-label', f.label));
      var input = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
      if (f.type !== 'textarea') input.type = f.type || 'text';
      input.className = 'kml-modal-input';
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.value) input.value = f.value;
      if (f.maxlength) input.maxLength = f.maxlength;
      wrap.appendChild(input);
      body.appendChild(wrap);
      inputs[f.id] = { el: input, required: !!f.required };
    });
    var actions = el('div', 'kml-modal-actions');
    var cancelBtn = el('button', 'kml-modal-btn', opts.cancelLabel || 'Cancel');
    var okBtn = el('button', 'kml-modal-btn kml-modal-primary', opts.submitLabel || 'Submit');
    cancelBtn.type = 'button'; okBtn.type = 'button';
    actions.appendChild(cancelBtn); actions.appendChild(okBtn);
    body.appendChild(actions);

    var m = openModal(body, { title: opts.title, escapeValue: null });

    function submit() {
      var values = {}, ok = true;
      Object.keys(inputs).forEach(function (id) {
        var field = inputs[id];
        var v = field.el.value.trim();
        values[id] = v;
        field.el.classList.toggle('kml-modal-input--error', field.required && !v);
        if (field.required && !v) ok = false;
      });
      if (!ok) return;
      m.close(values);
    }
    cancelBtn.addEventListener('click', function () { m.close(null); });
    okBtn.addEventListener('click', submit);
    body.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
    });
    return m.promise;
  }

  window.KMLModal = { confirm: confirmDialog, alert: alertDialog, form: formDialog };
})();
