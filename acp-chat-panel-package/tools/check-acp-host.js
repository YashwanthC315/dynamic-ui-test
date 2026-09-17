// Dev helper: run in the browser console or include as a dev-only script.
// Checks dynamic container background, containment, and resizing wiring.
(function runAcpHostChecks(){
  const warnings = [];

  const formEls = document.querySelectorAll('.acp-workspace__form .acp-dynamic-container, acp-dynamic-container');
  if (!formEls || formEls.length === 0) {
    console.info('ACPHOST: no dynamic containers found (ok if none open)');
  }

  formEls.forEach(el => {
    const bg = getComputedStyle(el).backgroundColor || '';
    if (!bg || bg === 'transparent' || bg.endsWith('0)')) {
      warnings.push('Dynamic container has transparent background: ' + (el.outerHTML.slice(0,200)));
    }
    const stage = el.closest('.acp-workspace__stage');
    if (!stage) {
      warnings.push('Dynamic container is not inside .acp-workspace__stage; it may be mounted to the wrong container.');
    }
    // check pointer-events
    const pe = getComputedStyle(el).pointerEvents;
    if (pe === 'none') warnings.push('Dynamic container has pointer-events:none — it will not receive input.');
    // check width binding heuristic: presence of attribute or inline style width
    const hasWidthAttr = el.hasAttribute('formWidth') || el.hasAttribute('form-width');
    const inlineWidth = el.style && el.style.width;
    if (!hasWidthAttr && !inlineWidth) warnings.push('Dynamic container has no formWidth binding or inline width — verify host binds [formWidth].');
  });

  if (warnings.length) {
    console.warn('ACPHOST CHECKS FOUND ISSUES:\n' + warnings.join('\n'));
  } else {
    console.info('ACPHOST: All quick checks passed.');
  }
})();
