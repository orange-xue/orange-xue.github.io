/**
 * 厨房合集：食谱手风琴 + 点击装备筛选食谱
 */
(function () {
  'use strict'

  function bindAccordion () {
    var root = document.getElementById('cookies-recipe-accordion')
    if (!root || root.dataset.accBound === '1') return
    root.dataset.accBound = '1'

    var items = root.querySelectorAll('details.cookies-acc-item')
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) {
          item.classList.remove('is-open')
          return
        }
        item.classList.add('is-open')
        items.forEach(function (other) {
          if (other !== item && other.open) {
            other.open = false
            other.classList.remove('is-open')
          }
        })
      })
    })
  }

  function parseEquipAttr (value) {
    if (!value) return []
    return String(value).split(',').map(function (s) { return s.trim() }).filter(Boolean)
  }

  function clearEquipFilter () {
    var page = document.querySelector('.cookies-page')
    if (!page) return

    page.querySelectorAll('.cookies-equip-card.is-active').forEach(function (el) {
      el.classList.remove('is-active')
    })

    var result = document.getElementById('cookies-equip-result')
    if (result) result.classList.add('hidden')

    page.querySelectorAll('.cookies-recipe-item').forEach(function (item) {
      item.classList.remove('is-dimmed', 'is-matched')
      item.hidden = false
    })

    page.querySelectorAll('.cookies-acc-item').forEach(function (acc) {
      acc.classList.remove('is-filtered-empty')
      acc.hidden = false
    })
  }

  function applyEquipFilter (equipName) {
    var page = document.querySelector('.cookies-page')
    if (!page || !equipName) return

    page.querySelectorAll('.cookies-equip-card').forEach(function (card) {
      card.classList.toggle('is-active', card.getAttribute('data-equip') === equipName)
    })

    var matched = []
    page.querySelectorAll('.cookies-recipe-item').forEach(function (item) {
      var list = parseEquipAttr(item.getAttribute('data-equip'))
      var hit = list.indexOf(equipName) !== -1
      item.classList.toggle('is-matched', hit)
      item.classList.toggle('is-dimmed', !hit)
      item.hidden = !hit
      if (hit) {
        matched.push({
          title: item.getAttribute('data-title') || '',
          section: item.getAttribute('data-section') || ''
        })
      }
    })

    // 展开含匹配项的分类，隐藏全空分类
    page.querySelectorAll('.cookies-acc-item').forEach(function (acc) {
      var visible = acc.querySelectorAll('.cookies-recipe-item:not([hidden])')
      if (visible.length) {
        acc.hidden = false
        acc.open = true
        acc.classList.add('is-open')
        acc.classList.remove('is-filtered-empty')
      } else {
        acc.open = false
        acc.classList.remove('is-open')
        acc.classList.add('is-filtered-empty')
        acc.hidden = true
      }
    })

    var result = document.getElementById('cookies-equip-result')
    var nameEl = document.getElementById('cookies-equip-result-name')
    var listEl = document.getElementById('cookies-equip-result-list')
    if (result && nameEl && listEl) {
      nameEl.textContent = equipName
      listEl.innerHTML = ''
      if (!matched.length) {
        var empty = document.createElement('li')
        empty.className = 'cookies-equip-result-empty'
        empty.textContent = '暂无关联该装备的食谱'
        listEl.appendChild(empty)
      } else {
        matched.forEach(function (row) {
          var li = document.createElement('li')
          li.className = 'cookies-equip-result-item'
          li.innerHTML = '<span class="sec">' + row.section + '</span><span class="title">' + row.title + '</span>'
          li.addEventListener('click', function () {
            var recipes = document.getElementById('cookies-recipes')
            if (recipes) recipes.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
          listEl.appendChild(li)
        })
      }
      result.classList.remove('hidden')
    }

    var recipesSec = document.getElementById('cookies-recipes')
    if (recipesSec) recipesSec.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function bindEquipFilter () {
    var page = document.querySelector('.cookies-page')
    if (!page || page.dataset.equipBound === '1') return
    page.dataset.equipBound = '1'

    page.querySelectorAll('.cookies-equip-card').forEach(function (card) {
      var trigger = function () {
        var name = card.getAttribute('data-equip')
        if (!name) return
        if (card.classList.contains('is-active')) {
          clearEquipFilter()
          return
        }
        applyEquipFilter(name)
      }
      card.addEventListener('click', trigger)
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          trigger()
        }
      })
    })

    var clearBtn = document.getElementById('cookies-equip-clear')
    if (clearBtn) clearBtn.addEventListener('click', clearEquipFilter)
  }

  function boot () {
    var page = document.querySelector('.cookies-page')
    if (page) {
      // pjax 重进时允许重新绑定
      page.dataset.equipBound = ''
      var root = document.getElementById('cookies-recipe-accordion')
      if (root) root.dataset.accBound = ''
    }
    bindAccordion()
    bindEquipFilter()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  if (window.btf && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('pjaxComplete', boot, 'cookiesKitchen')
  }
})()
