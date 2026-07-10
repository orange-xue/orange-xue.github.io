(function () {
  'use strict'

  /**
   * 打卡配置说明：
   * - 键名：省份全称，需与地图一致（如 安徽省、浙江省）
   * - 值：数组，同一省份可添加多条打卡记录
   * - city：市区名（可重复，表示同一城市多次打卡）
   * - date / note：日期与备注
   */
  const CHECKINS = {
    '安徽省': [
      { city: '繁昌县', date: '2002-08-23', note: '小蛇大驾光临' },
      { city: '繁昌县', date: '2002-11-14', note: '小橙驾到，统统闪开' },
      { city: '芜湖市', date: '2025-01-31', note: '萌宠馆!rua' }
    ],
    '浙江省': [
      { city: '杭州市', date: '2024-06-01', note: '西湖边' }
    ],
    '上海市': [
      { city: '上海市', date: '2024-08-15', note: '第一次远行' }
    ],
    '江苏省': [
      { city: '南京市', date: '2025-01-20', note: '南京' }
    ]
  }

  const GATE = {
    question: '现在你是一只海鸥,请选择你的任务',
    options: [
      '1.去码头整一根薯条',
      '2.叼走一条蛇'
    ],
    answers: ['2.叼走一条蛇', '叼走一条蛇', '2']
  }

  const DIARY_URL = '/loving/diary/'

  const LIT_COLORS = {
    light: [255, 240, 244],
    dark: [210, 100, 125]
  }

  const UNCHECKED_COLOR = {
    light: 'rgba(120, 175, 230, 0.45)',
    dark: 'rgba(90, 140, 210, 0.35)'
  }

  function normalizeProvinceName (name) {
    return name.replace(/(省|市|自治区|特别行政区|壮族自治区|维吾尔自治区|回族自治区)$/u, '')
  }

  function getCheckinKeyForMapName (mapName) {
    if (CHECKINS[mapName]) return mapName
    return Object.keys(CHECKINS).find(key => normalizeProvinceName(key) === mapName) || null
  }

  function getCheckinsByMapName (mapName) {
    const key = getCheckinKeyForMapName(mapName)
    if (!key) return []
    return getProvinceCheckins(key)
  }

  function getProvinceCheckins (province) {
    const records = CHECKINS[province]
    if (!records) return []
    return Array.isArray(records) ? records : [records]
  }

  function getCheckedProvinces () {
    return Object.keys(CHECKINS).filter(name => getProvinceCheckins(name).length > 0)
  }

  function getTotalCheckins () {
    return getCheckedProvinces().reduce((sum, name) => sum + getProvinceCheckins(name).length, 0)
  }

  function formatCheckinLine (record, index) {
    const city = record.city ? `${record.city} · ` : ''
    const note = record.note ? ` · ${record.note}` : ''
    return `${index + 1}. ${city}${record.date}${note}`
  }

  function getMaxCheckinCount () {
    return getCheckedProvinces().reduce((max, name) => {
      const count = getProvinceCheckins(name).length
      return Math.max(max, count)
    }, 0)
  }

  function getUncheckedColor (isDark) {
    return isDark ? UNCHECKED_COLOR.dark : UNCHECKED_COLOR.light
  }

  function getLitColor (count, maxCount, isDark) {
    if (count <= 0) return getUncheckedColor(isDark)
    if (maxCount <= 1) {
      return rgbToHex(LIT_COLORS.dark[0], LIT_COLORS.dark[1], LIT_COLORS.dark[2])
    }
    const ratio = (count - 1) / (maxCount - 1)
    const r = Math.round(LIT_COLORS.light[0] + (LIT_COLORS.dark[0] - LIT_COLORS.light[0]) * ratio)
    const g = Math.round(LIT_COLORS.light[1] + (LIT_COLORS.dark[1] - LIT_COLORS.light[1]) * ratio)
    const b = Math.round(LIT_COLORS.light[2] + (LIT_COLORS.dark[2] - LIT_COLORS.light[2]) * ratio)
    return rgbToHex(r, g, b)
  }

  function rgbToHex (r, g, b) {
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
  }

  function normalizeAnswer (value) {
    return value.trim().replace(/\s+/g, '')
  }

  function isGateAnswerCorrect (value) {
    const answer = normalizeAnswer(value)
    return GATE.answers.some(item => normalizeAnswer(item) === answer)
  }

  function formatTooltip (mapName) {
    const records = getCheckinsByMapName(mapName)
    const displayName = getCheckinKeyForMapName(mapName) || mapName
    if (!records.length) return `${displayName}<br/>还未打卡`
    const lines = records.map((record, index) => formatCheckinLine(record, index)).join('<br/>')
    return `<strong>${displayName}</strong>（${records.length} 次）<br/>${lines}`
  }

  const GEO_URLS = [
    () => (window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.root || '/') + 'js/china-geo.json',
    'https://cdn.jsdelivr.net/npm/echarts@5.4.3/map/json/china.json',
    'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/china.json'
  ]

  function loadChinaGeoJson (index = 0) {
    if (index >= GEO_URLS.length) {
      return Promise.reject(new Error('geo load failed'))
    }
    const url = typeof GEO_URLS[index] === 'function' ? GEO_URLS[index]() : GEO_URLS[index]
    return fetch(url).then(res => {
      if (!res.ok) throw new Error('geo http error')
      return res.json()
    }).catch(() => loadChinaGeoJson(index + 1))
  }

  function buildSeriesData (geoJson, maxCount, isDark) {
    const uncheckedColor = getUncheckedColor(isDark)
    const borderColor = isDark ? '#555' : '#fff'
    return geoJson.features.map(feature => {
      const name = feature.properties.name
      const count = getCheckinsByMapName(name).length
      const litColor = getLitColor(count, maxCount, isDark)
      return {
        name,
        value: count,
        itemStyle: {
          areaColor: count > 0 ? litColor : uncheckedColor,
          borderColor,
          borderWidth: 1,
          shadowBlur: count > 0 ? 6 + count * 2 : 0,
          shadowColor: count > 0 ? 'rgba(210, 100, 125, 0.35)' : 'transparent'
        }
      }
    })
  }

  function initMap () {
    const container = document.getElementById('loving-china-map')
    if (!container || !window.echarts) return

    const chart = echarts.init(container)
    const checkedProvinces = getCheckedProvinces()
    const maxCount = getMaxCheckinCount()
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

    loadChinaGeoJson()
      .then(geoJson => {
        echarts.registerMap('china', geoJson)

        chart.setOption({
          tooltip: {
            trigger: 'item',
            formatter: params => formatTooltip(params.name)
          },
          visualMap: {
            show: false,
            min: 1,
            max: maxCount,
            inRange: {
              color: [
                rgbToHex(LIT_COLORS.light[0], LIT_COLORS.light[1], LIT_COLORS.light[2]),
                rgbToHex(LIT_COLORS.dark[0], LIT_COLORS.dark[1], LIT_COLORS.dark[2])
              ]
            }
          },
          series: [{
            type: 'map',
            map: 'china',
            roam: true,
            scaleLimit: { min: 0.8, max: 3 },
            label: { show: false },
            emphasis: {
              label: { show: true, color: '#666' },
              itemStyle: { areaColor: rgbToHex(255, 200, 215) }
            },
            data: buildSeriesData(geoJson, maxCount, isDark)
          }]
        })

        const provinceCountEl = document.getElementById('loving-province-count')
        const placeCountEl = document.getElementById('loving-place-count')
        if (provinceCountEl) provinceCountEl.textContent = String(checkedProvinces.length)
        if (placeCountEl) placeCountEl.textContent = String(getTotalCheckins())

        new MutationObserver(() => {
          const dark = document.documentElement.getAttribute('data-theme') === 'dark'
          chart.setOption({
            series: [{
              data: buildSeriesData(geoJson, maxCount, dark)
            }]
          })
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      })
      .catch(() => {
        container.innerHTML = '<p style="text-align:center;padding:40px 0;color:#999;">地图加载失败，请刷新重试</p>'
      })

    window.addEventListener('resize', () => chart.resize())
  }

  function renderGateQuestion (questionEl) {
    if (!questionEl) return
    const lines = [GATE.question, ...(GATE.options || [])]
    questionEl.innerHTML = lines.join('<br>')
  }

  function initGate () {
    const form = document.getElementById('loving-gate-form')
    const input = document.getElementById('loving-gate-answer')
    const error = document.getElementById('loving-gate-error')
    const questionEl = document.getElementById('loving-gate-question')
    if (!form || !input) return

    if (questionEl) renderGateQuestion(questionEl)

    form.addEventListener('submit', event => {
      event.preventDefault()
      if (isGateAnswerCorrect(input.value)) {
        sessionStorage.setItem('loving_gate_passed', '1')
        window.location.href = DIARY_URL
        return
      }
      if (error) error.textContent = '答案不对，再想想吧'
      input.value = ''
      input.focus()
    })
  }

  function boot () {
    initGate()
    if (window.echarts) {
      initMap()
    } else if (window.btf && typeof window.btf.getScript === 'function') {
      window.btf.getScript('https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js')
        .then(initMap)
        .catch(() => {
          const container = document.getElementById('loving-china-map')
          if (container) {
            container.innerHTML = '<p style="text-align:center;padding:40px 0;color:#999;">地图脚本加载失败</p>'
          }
        })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
