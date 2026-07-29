/**
 * 封面图保底：CDN 加载失败时回退到 data-cover-fallback / 本地 cover
 */
(function () {
  'use strict'

  function bindImgFallback (img) {
    if (!img || img.dataset.coverBound) return
    img.dataset.coverBound = '1'

    const fallback = img.getAttribute('data-cover-fallback')
    if (!fallback) return

    const applyFallback = () => {
      if (img.dataset.coverFallen) return
      img.dataset.coverFallen = '1'
      img.onerror = null
      img.src = fallback
    }

    img.addEventListener('error', applyFallback)
    if (img.complete && img.naturalWidth === 0 && img.src) applyFallback()
  }

  function bindBgFallback (el, fallback) {
    if (!el || !fallback || el.dataset.coverFallen) return

    const style = el.getAttribute('style') || ''
    const match = style.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i)
    const url = match && match[1]
    if (!url || url.startsWith('/') || url.startsWith(window.location.origin)) return

    const tester = new Image()
    tester.onerror = () => {
      el.dataset.coverFallen = '1'
      el.style.backgroundImage = `url("${fallback}")`
    }
    tester.onload = () => {}
    tester.src = url
  }

  function init () {
    document.querySelectorAll('img[data-cover-fallback]').forEach(bindImgFallback)

    const items = document.querySelectorAll('.categoryBar-list-item')
    const pool = (window.COVER_LOCAL_POOL && window.COVER_LOCAL_POOL.length)
      ? window.COVER_LOCAL_POOL
      : []

    items.forEach((el, index) => {
      const fallback = el.getAttribute('data-cover-fallback')
        || (pool.length ? pool[index % pool.length] : '')
      if (fallback) bindBgFallback(el, fallback)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  if (window.btf && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('pjaxComplete', init, 'coverFallback')
  }
})()
