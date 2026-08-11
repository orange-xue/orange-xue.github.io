/**
 * 日记页：解密后启用时间轴。
 * 注意：hbe 解密后结构为 #hexo-blog-encrypt > div(包裹全文) + button，
 * 且会把容器设为 display:inline，必须进内层 div 包卡片并靠 CSS 强制 block。
 */
(function () {
  'use strict'

  const ZODIAC = ['monkey', 'rooster', 'dog', 'pig', 'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat']
  const LABELS = { monkey: '猴', rooster: '鸡', dog: '狗', pig: '猪', rat: '鼠', ox: '牛', tiger: '虎', rabbit: '兔', dragon: '龙', snake: '蛇', horse: '马', goat: '羊' }

  function root () {
    return document.querySelector('.diary-page')
  }

  function isLocked (el) {
    return !!(el && el.querySelector('#hbePass'))
  }

  /** 真正承载 md 内容的节点（解密后内层 div） */
  function contentHost (el) {
    const encrypt = el.querySelector('#hexo-blog-encrypt')
    if (!encrypt) return el
    const inner = Array.from(encrypt.children).find((node) => {
      return node.tagName === 'DIV' && !node.classList.contains('hbe-button')
    })
    return inner || encrypt
  }

  function decorateYears (scope) {
    scope.querySelectorAll('h2').forEach((h2) => {
      if (h2.querySelector('.diary-zodiac')) return
      const year = parseInt(String(h2.textContent || '').trim(), 10)
      if (!Number.isFinite(year)) return
      const name = ZODIAC[((year % 12) + 12) % 12]
      const icon = document.createElement('span')
      icon.className = 'diary-zodiac'
      icon.setAttribute('role', 'img')
      icon.setAttribute('aria-label', LABELS[name] || name)
      icon.title = year + ' · ' + (LABELS[name] || name) + '年'
      icon.style.backgroundImage = 'url("/img/zodiac/' + name + '.svg")'
      h2.insertBefore(icon, h2.firstChild)
    })
  }

  function markIntro (scope) {
    const first = scope.firstElementChild
    if (first && first.tagName === 'P' && !first.classList.contains('diary-intro')) {
      first.classList.add('diary-intro')
    }
  }

  function wrapCards (scope) {
    if (scope.querySelector('.diary-card')) return

    const list = Array.from(scope.children).filter((node) => {
      return !(node.classList && node.classList.contains('hbe-button'))
    })

    let card = null
    list.forEach((node) => {
      const tag = node.tagName
      if (tag === 'H2') {
        card = null
        return
      }
      if (tag === 'H3') {
        card = document.createElement('article')
        card.className = 'diary-card'
        node.parentNode.insertBefore(card, node)
        card.appendChild(node)
        return
      }
      if (card) card.appendChild(node)
    })
  }

  function refresh () {
    const el = root()
    if (!el) return
    if (isLocked(el)) {
      el.classList.remove('diary-unlocked')
      return
    }
    el.classList.add('diary-unlocked')

    const encrypt = el.querySelector('#hexo-blog-encrypt')
    if (encrypt) {
      encrypt.style.display = 'block'
      encrypt.style.width = '100%'
    }

    const host = contentHost(el)
    if (host && host !== encrypt) {
      host.style.display = 'block'
      host.style.width = '100%'
    }

    markIntro(host)
    wrapCards(host)
    decorateYears(host)
  }

  function bind () {
    refresh()
    const el = root()
    if (!el) return
    const box = el.querySelector('#hexo-blog-encrypt')
    if (box && !box.dataset.diaryObserved) {
      box.dataset.diaryObserved = '1'
      new MutationObserver(() => {
        // 解密瞬间会改 DOM，稍后再包卡片，避免与 hbe 抢写
        setTimeout(refresh, 0)
      }).observe(box, { childList: true, subtree: true })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind)
  } else {
    bind()
  }

  document.addEventListener('pjax:complete', bind)

  if (window.btf && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('encrypt', () => setTimeout(refresh, 0), 'diaryTimeline')
    window.btf.addGlobalFn('pjaxComplete', bind, 'diaryTimelinePjax')
  }
})()
