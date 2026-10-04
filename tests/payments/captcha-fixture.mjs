// Served only by the Playwright route, never referenced by the application.
const widgets = new Map(), seed = crypto.randomUUID()
let sequence = 0
window.turnstile = {
  render(container, options) {
    const id = String(++sequence), button = document.createElement('button')
    button.type = 'button'; button.textContent = 'Verificacao ficticia'
    button.setAttribute('aria-label', 'Concluir verificacao ficticia')
    button.dataset.size = options.size
    button.style.cssText = `width:${options.size === 'compact' ? 150 : 300}px;height:${options.size === 'compact' ? 140 : 65}px;border:1px solid #888;border-radius:4px;background:#222;color:#eee;`
    const verify = () => options.callback(`fixtureCaptcha_${seed}_${++sequence}`)
    button.onclick = verify; container.append(button)
    widgets.set(id, { button, options, verify })
    return id
  },
  reset(id) { const widget = widgets.get(id); if (widget) widget.button.disabled = false },
  remove(id) { widgets.get(id)?.button.remove(); widgets.delete(id) },
}
window.__captchaFixture = {
  expire() { for (const widget of widgets.values()) widget.options['expired-callback']() },
  fail() { for (const widget of widgets.values()) widget.options['error-callback']() },
}
