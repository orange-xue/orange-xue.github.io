(function () {
  'use strict'

  const GAP = 18

  function getColumnCount () {
    if (window.innerWidth <= 600) return 1
    if (window.innerWidth <= 900) return 2
    return 3
  }

  function formatDate (el) {
    const raw = el.getAttribute('datetime')
    if (!raw) return
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return
    Array.from(el.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove()
    })
    el.appendChild(document.createTextNode(` ${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`))
  }

  function bindCopyButtons () {
    document.querySelectorAll('#waterfall .bber-reply').forEach(btn => {
      if (btn.dataset.bound) return
      btn.dataset.bound = '1'
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-copy') || ''
        if (!text) return
        navigator.clipboard.writeText(text).then(() => {
          btn.classList.add('is-copied')
          setTimeout(() => btn.classList.remove('is-copied'), 1500)
        }).catch(() => {})
      })
    })
  }

  function layoutWaterfall () {
    const container = document.getElementById('waterfall')
    if (!container) return

    const items = Array.from(container.querySelectorAll('.item'))
    if (!items.length) return

    items.forEach(item => {
      item.style.position = 'static'
      item.style.width = 'auto'
      item.style.left = 'auto'
      item.style.top = 'auto'
    })

    const cols = getColumnCount()
    const width = container.clientWidth
    const colWidth = (width - GAP * (cols - 1)) / cols
    const colHeights = new Array(cols).fill(0)

    items.forEach(item => {
      item.style.width = `${colWidth}px`
      item.style.position = 'absolute'
      const minCol = colHeights.indexOf(Math.min(...colHeights))
      item.style.left = `${minCol * (colWidth + GAP)}px`
      item.style.top = `${colHeights[minCol]}px`
      colHeights[minCol] += item.offsetHeight + GAP
    })

    container.style.height = `${Math.max(...colHeights, 0)}px`
    container.classList.add('is-ready')
  }

  function init () {
    document.querySelectorAll('#waterfall time.datatime').forEach(formatDate)
    bindCopyButtons()
    layoutWaterfall()

    let resizeTimer
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(layoutWaterfall, 120)
    })

    if (window.btf && typeof window.btf.addGlobalFn === 'function') {
      window.btf.addGlobalFn('pjaxComplete', () => {
        document.querySelectorAll('#waterfall time.datatime').forEach(formatDate)
        bindCopyButtons()
        layoutWaterfall()
      }, 'essayWaterfall')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
