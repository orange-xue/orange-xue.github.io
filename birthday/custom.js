/**
 * 生日页扩展 — 采用「保持姿势」降低误判
 * - 🤏 捏合保持：打开信封正面
 * - ☝️ 竖食指保持：翻转看信
 * - ✊ 握拳保持（更久）：关闭信封
 * - ✋ 摊掌保持：进入塔罗
 */
(function () {
  'use strict'

  const LETTER_URL = './letter.md'
  const PHOTOS_URL = './photos.json'
  const LOVING_URL = '/loving/'

  // 保持时长（毫秒）——刻意偏长，避免一晃就触发
  const HOLD = {
    PINCH_OPEN: 1200,
    INDEX_FLIP: 1000,
    FIST_CLOSE: 1500,
    PALM_TAROT: 500,
    FIST_TAROT_FLIP: 900
  }
  const PINCH_DIST = 0.055
  const LOCK_AFTER_MS = 900

  const Phase = {
    NONE: 'none',
    WAIT_PINCH: 'wait_pinch',
    WAIT_FLIP: 'wait_flip',
    CARD_OPEN: 'card_open',
    WAIT_PALM: 'wait_palm',
    TAROT: 'tarot',
    DONE: 'done'
  }

  let phase = Phase.NONE
  let letterHtml = ''
  let letterMeta = { title: '写给你', from: '' }
  let photos = []
  let tarotIndex = 0
  let flippedSet = new Set()
  let lastHandX = null
  let gestureLockUntil = 0
  let lastLabel = ''
  let holdStart = null
  let holdKind = ''

  function $(id) { return document.getElementById(id) }

  function dist2 (a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function resetHold () {
    holdStart = null
    holdKind = ''
  }

  /** 同一姿势连续保持 needMs 才算成功；换姿势则清零 */
  function holdProgress (kind, active, needMs, now) {
    if (!active) {
      if (holdKind === kind) resetHold()
      return 0
    }
    if (holdKind !== kind) {
      holdKind = kind
      holdStart = now
    }
    if (!holdStart) holdStart = now
    return Math.min(1, (now - holdStart) / needMs)
  }

  function isFist (lm) {
    const tips = [8, 12, 16, 20]
    const pips = [6, 10, 14, 18]
    const wrist = lm[0]
    let curled = 0
    for (let i = 0; i < 4; i++) {
      if (dist2(lm[tips[i]], wrist) <= dist2(lm[pips[i]], wrist) * 1.02) curled++
    }
    // 四指都收拢才算握拳，减少半握误判
    return curled >= 3
  }

  function isOpenPalm (lm) {
    const tips = [8, 12, 16, 20]
    const mcps = [5, 9, 13, 17]
    const wrist = lm[0]
    let extended = 0
    for (let i = 0; i < 4; i++) {
      if (dist2(lm[tips[i]], wrist) > dist2(lm[mcps[i]], wrist) * 1.2) extended++
    }
    return extended >= 3 && !isFist(lm) && !isPinching(lm) && !isIndexUp(lm)
  }

  function isPinching (lm) {
    // 拇指+食指靠近，且其余指相对收拢，避免「随便一碰」
    const pinch = dist2(lm[4], lm[8]) < PINCH_DIST
    if (!pinch) return false
    const wrist = lm[0]
    const othersIn = [12, 16, 20].filter(i => dist2(lm[i], wrist) < dist2(lm[8], wrist) * 1.05).length
    return othersIn >= 1
  }

  function isIndexUp (lm) {
    // 竖食指：食指伸展，其余三指收拢（拇指可自然收拢）
    const wrist = lm[0]
    const indexExt = dist2(lm[8], wrist) > dist2(lm[5], wrist) * 1.2
    const indexUp = lm[8].y < lm[6].y && lm[8].y < lm[5].y
    let curled = 0
    ;[[12, 10], [16, 14], [20, 18]].forEach(([tip, pip]) => {
      if (dist2(lm[tip], wrist) < dist2(lm[pip], wrist) * 1.08) curled++
    })
    return indexExt && indexUp && curled >= 2 && !isPinching(lm)
  }

  function setHint (text) {
    const el = $('gesture-hint')
    if (!el) return
    if (!text) {
      el.classList.add('hidden')
      el.textContent = ''
      return
    }
    el.textContent = text
    el.classList.remove('hidden')
  }

  function hintWithBar (base, progress) {
    const pct = Math.round(progress * 100)
    const bar = '●'.repeat(Math.max(0, Math.floor(pct / 20))) + '○'.repeat(Math.max(0, 5 - Math.floor(pct / 20)))
    setHint(`${base}  ${bar} ${pct}%`)
  }

  function parseFrontMatter (raw) {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (!m) return { meta: {}, body: raw }
    const meta = {}
    m[1].split(/\r?\n/).forEach(line => {
      const i = line.indexOf(':')
      if (i > -1) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    })
    return { meta, body: m[2].trim() }
  }

  function simpleMarkdown (md) {
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/  \n/g, '<br>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>')
  }

  async function loadLetter () {
    try {
      const res = await fetch(LETTER_URL + '?t=' + Date.now())
      const raw = await res.text()
      const { meta, body } = parseFrontMatter(raw)
      letterMeta.title = meta.title || '写给你'
      letterMeta.from = meta.from || ''
      letterHtml = simpleMarkdown(body)
      if (letterMeta.from) {
        letterHtml += `<div class="letter-from">${letterMeta.from.replace(/</g, '&lt;')}</div>`
      }
    } catch (e) {
      letterHtml = '<p>信封内容加载失败，请稍后再试。</p>'
    }
  }

  async function loadPhotos () {
    try {
      const res = await fetch(PHOTOS_URL)
      photos = await res.json()
    } catch (e) {
      photos = [
        { src: '/img/birthcard.jpg', title: '今日之光' },
        { src: '/img/loving-bg.jpg', title: '并肩之路' }
      ]
    }
  }

  function lockGesture (ms) {
    gestureLockUntil = Date.now() + (ms || LOCK_AFTER_MS)
    resetHold()
  }

  function openEnvelopeFront () {
    if (phase !== Phase.WAIT_PINCH) return
    lockGesture(1000)
    phase = Phase.WAIT_FLIP

    const reveal = $('reveal-btn')
    if (reveal) reveal.classList.add('hidden')

    const card = $('flip-card-container')
    if (!card) return
    card.classList.add('letter-card')
    card.classList.remove('hidden', 'flipped')

    setHint('☝️ 竖起食指并保持，翻转信封')
    lastLabel = 'envelope shown'
    if (window.log) window.log('捏合保持：打开信封正面')
  }

  function flipEnvelope () {
    if (phase !== Phase.WAIT_FLIP) return
    lockGesture(1000)
    phase = Phase.CARD_OPEN

    const card = $('flip-card-container')
    if (card) card.classList.add('flipped')

    const title = $('letter-title')
    if (title) title.textContent = letterMeta.title
    const body = $('letter-md-body')
    if (body) body.innerHTML = letterHtml

    setHint('✊ 握拳并保持，关闭信封')
    lastLabel = 'flipped'
    if (window.log) window.log('竖食指保持：翻转信封')
  }

  function closeEnvelope () {
    if (phase !== Phase.CARD_OPEN) return
    lockGesture(1000)
    const card = $('flip-card-container')
    if (card) {
      card.classList.remove('flipped')
      setTimeout(() => card.classList.add('hidden'), 450)
    }
    phase = Phase.WAIT_PALM
    setHint('✋ 张开手掌并保持，开启塔罗')
    lastLabel = 'closed'
    if (window.log) window.log('握拳保持：关闭信封')
  }

  function buildTarot () {
    const stage = $('tarot-stage')
    if (!stage) return
    stage.innerHTML = ''
    flippedSet = new Set()
    tarotIndex = Math.floor(photos.length / 2)

    photos.forEach((p, idx) => {
      const el = document.createElement('div')
      el.className = 'tarot-card'
      el.dataset.index = String(idx)
      el.innerHTML = `
        <div class="tarot-card-inner">
          <div class="tarot-face tarot-back"><span>Arcana</span></div>
          <div class="tarot-face tarot-front">
            <img src="${p.src}" alt="${p.title || ''}" loading="lazy">
            <div class="tarot-caption">${p.title || ''}</div>
          </div>
        </div>`
      el.addEventListener('click', () => {
        tarotIndex = idx
        layoutTarot()
        flipCurrentTarot()
      })
      stage.appendChild(el)
    })
    layoutTarot()
  }

  function layoutTarot () {
    const cards = document.querySelectorAll('#tarot-stage .tarot-card')
    const count = cards.length
    cards.forEach((el, idx) => {
      let offset = idx - tarotIndex
      if (offset > count / 2) offset -= count
      else if (offset < -count / 2) offset += count
      const rotation = offset * 11
      const translateX = offset * 118
      const translateZ = (1 - Math.abs(offset) / 5) * 130
      const scale = Math.max(0.42, 1.2 - Math.abs(offset) * 0.16)
      const opacity = Math.max(0.15, 1 - Math.abs(offset) * 0.22)
      el.style.opacity = String(opacity)
      el.style.zIndex = String(Math.round(100 - Math.abs(offset) * 10))
      el.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateZ(${rotation}deg) scale(${scale})`
    })
  }

  function flipCurrentTarot () {
    if (phase !== Phase.TAROT) return
    const el = document.querySelector(`#tarot-stage .tarot-card[data-index="${tarotIndex}"]`)
    if (!el || flippedSet.has(tarotIndex)) return
    el.classList.add('is-flipped')
    flippedSet.add(tarotIndex)
    lockGesture(700)
    if (flippedSet.size >= photos.length) {
      phase = Phase.DONE
      setHint('')
      const hint = $('tarot-hint')
      if (hint) hint.textContent = '照片已全部翻开'
      const btn = $('enter-loving-btn')
      if (btn) btn.classList.remove('hidden')
    } else {
      const hint = $('tarot-hint')
      if (hint) hint.textContent = `已翻开 ${flippedSet.size}/${photos.length} · 挥手选牌 · 握拳保持翻开`
    }
  }

  function enterTarot () {
    if (phase !== Phase.WAIT_PALM) return
    lockGesture(1000)
    phase = Phase.TAROT
    setHint('')

    const surprise = $('surprise-layer')
    if (surprise) {
      surprise.classList.remove('hidden')
      surprise.classList.add('active')
    }
    const card = $('flip-card-container')
    if (card) card.classList.add('hidden')

    const layer = $('tarot-layer')
    if (layer) layer.classList.remove('hidden')
    buildTarot()
    const hint = $('tarot-hint')
    if (hint) hint.textContent = '挥手选牌 · 握拳保持翻开照片'
    lastLabel = 'tarot'
    if (window.log) window.log('摊掌保持：进入塔罗展示')
  }

  function onHand (landmarks) {
    if (!landmarks || Date.now() < gestureLockUntil) return
    const now = Date.now()
    const fist = isFist(landmarks)
    const palm = isOpenPalm(landmarks)
    const pinching = isPinching(landmarks)
    const indexUp = isIndexUp(landmarks)
    const x = landmarks[9] ? landmarks[9].x : landmarks[0].x

    if (phase === Phase.WAIT_PINCH) {
      const p = holdProgress('pinch', pinching, HOLD.PINCH_OPEN, now)
      if (pinching) hintWithBar('🤏 捏合并保持打开信封', p)
      else setHint('🤏 拇指食指捏合，保持约 1 秒打开信封')
      if (p >= 1) openEnvelopeFront()
    } else if (phase === Phase.WAIT_FLIP) {
      const p = holdProgress('index', indexUp, HOLD.INDEX_FLIP, now)
      if (indexUp) hintWithBar('☝️ 竖食指并保持翻转', p)
      else setHint('☝️ 竖起食指，保持约 1 秒翻转信封')
      if (p >= 1) flipEnvelope()
    } else if (phase === Phase.CARD_OPEN) {
      const p = holdProgress('fist', fist, HOLD.FIST_CLOSE, now)
      if (fist) hintWithBar('✊ 握拳并保持关闭', p)
      else setHint('✊ 握拳并保持约 1.5 秒关闭信封')
      if (p >= 1) closeEnvelope()
    } else if (phase === Phase.WAIT_PALM) {
      const p = holdProgress('palm', palm, HOLD.PALM_TAROT, now)
      if (palm) hintWithBar('✋ 摊掌并保持开启塔罗', p)
      else setHint('✋ 张开手掌，保持约 0.5 秒开启塔罗')
      if (p >= 1) enterTarot()
    } else if (phase === Phase.TAROT) {
      if (fist) {
        const p = holdProgress('fistFlip', true, HOLD.FIST_TAROT_FLIP, now)
        lastLabel = `fist ${Math.round(p * 100)}%`
        if (p >= 1) flipCurrentTarot()
      } else {
        if (holdKind === 'fistFlip') resetHold()
        if (lastHandX != null) {
          const delta = x - lastHandX
          if (Math.abs(delta) > 0.02) {
            const move = delta > 0 ? -1 : 1
            tarotIndex = (tarotIndex + move + photos.length) % photos.length
            layoutTarot()
            gestureLockUntil = Date.now() + 160
            lastLabel = move > 0 ? 'swipe →' : 'swipe ←'
          }
        }
      }
    }

    lastHandX = x
  }

  function beginAfterCelebration () {
    phase = Phase.WAIT_PINCH
    resetHold()
    lastHandX = null
    const reveal = $('reveal-btn')
    if (reveal) {
      reveal.classList.remove('hidden')
      reveal.textContent = '🤏 捏合保持打开信封（也可点击）'
    }
    setHint('🤏 拇指食指捏合，保持约 1 秒打开信封')
    const cam = $('cam-preview-container')
    if (cam) cam.classList.remove('hidden')
  }

  function wireUi () {
    const reveal = $('reveal-btn')
    if (reveal) {
      reveal.addEventListener('click', (e) => {
        e.stopPropagation()
        if (phase === Phase.WAIT_PINCH || phase === Phase.NONE) {
          phase = Phase.WAIT_PINCH
          openEnvelopeFront()
        }
      })
    }

    const loving = $('enter-loving-btn')
    if (loving) {
      loving.addEventListener('click', (e) => {
        e.stopPropagation()
        location.href = LOVING_URL
      })
    }

    const nextBtn = $('next-surprise-btn')
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (phase === Phase.WAIT_PINCH || phase === Phase.NONE) {
          phase = Phase.WAIT_PINCH
          openEnvelopeFront()
        } else if (phase === Phase.WAIT_FLIP) {
          flipEnvelope()
        }
      })
    }

    const closeBtn = $('close-card-btn')
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (phase === Phase.CARD_OPEN) closeEnvelope()
      })
    }
  }

  async function init () {
    await Promise.all([loadLetter(), loadPhotos()])
    wireUi()

    window.BirthdayGestures = {
      beginAfterCelebration,
      onHand,
      openEnvelope: openEnvelopeFront,
      closeEnvelope,
      enterTarot,
      flipEnvelope,
      debugLabel: function () { return lastLabel || phase }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
