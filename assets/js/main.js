const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
if(menuToggle && menu){
  menuToggle.addEventListener('click', ()=> menu.classList.toggle('open'));
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click', ()=>menu.classList.remove('open')));
}

const observer = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

const categoryGrid = document.querySelector('.category-grid');
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
const categoryNavigation = document.querySelector('[data-category-nav]');
const categoryModal = document.querySelector('[data-category-modal]');
const categoryModalTrigger = document.querySelector('[data-category-modal-trigger]');
const categoryModalDialog = categoryModal ? categoryModal.querySelector('.catalog-category-modal__dialog') : null;

const subcategoryPanelTitle = categoryModal ? categoryModal.querySelector('[data-subcategory-title]') : null;
const subcategoryPanelList = categoryModal ? categoryModal.querySelector('[data-subcategory-list]') : null;
let activeCategoryScrollTarget = '';

const subcategoryCatalog = {
  all: {
    title: 'Весь каталог',
    items: ['Выберите конкретную категорию слева, чтобы увидеть её подкатегории.']
  },
  materials: {
    title: 'Сварочные материалы',
    items: [
      'Для легированных, высокопрочных и теплоустойчивых сталей',
      'Для сварки углеродистых и низколегированных сталей',
      'Для наплавки и ремонта деталей',
      'Для сварки сплавов цветных металлов',
      'Вольфрамовые, угольные электроды',
      'Для сварки чугуна'
    ]
  },
  chemistry: {
    title: 'Техническая химия',
    items: [
      'Средства для травления и очистки нержавейки',
      'Средства против налипания брызг',
      'Средства для дефектоскопии (пенетранты)',
      'Охлаждающий агент',
      'Средства для травления и очистки алюминия',
      'Кислотостойкие кисти'
    ]
  },
  equipment: {
    title: 'Сварочное оборудование',
    items: [
      'Сварочные инверторы MMA',
      'Установки плазменной резки',
      'Сварочные полуавтоматы MIG',
      'Сварочные генераторы и агрегаты',
      'Сварочные аргонодуговые аппараты TIG',
      'Комплектующие для электросварки',
      'Центраторы',
      'Шланг-пакеты'
    ]
  },
  protection: {
    title: 'Средства защиты',
    items: [
      'Для защиты рук',
      'Сварочные маски',
      'Для защиты органов зрения',
      'Для защиты органов слуха',
      'Защитная одежда',
      'Для защиты органов дыхания',
      'Для защиты головы'
    ]
  },
  abrasive: {
    title: 'Абразивные материалы и инструмент',
    items: [
      'Круги фибровые',
      'Круги шлифовальные (зачистные)',
      'Круги лепестковые',
      'Борфрезы (шарошки)',
      'Круги отрезные'
    ]
  },
  automation: {
    title: 'Автоматизация и роботизация',
    items: [
      'Портальные установки с ЧПУ для резки различных материалов',
      'Комплектующие автоматизации и роботизации',
      'Сварочные трактора',
      'Орбитальная сварка',
      'Лазерная сварка'
    ]
  },
  gas: {
    title: 'Газопламенное оборудование',
    items: [
      'Портативные установки резаки по металлу',
      'Комплектующие для газосварки',
      'Редукторы, регуляторы газовые, подогреватели',
      'Резаки газовые',
      'Горелки газовые'
    ]
  },
  workplace: {
    title: 'Оборудование места сварщика',
    items: [
      'Наборы для организации сварочного поста',
      'Оснастка',
      'Сварочно-монтажные столы и приспособления',
      'Защитные шторы и кабинки CEPRO',
      'Фильтровентиляционное оборудование'
    ]
  },
  torches: {
    title: 'Горелки и ЗИП',
    items: [
      'Горелки MIG сварка',
      'Горелки TIG сварка',
      'Плазмотроны CUT',
      'ЗИП MIG сварка',
      'ЗИП TIG сварка',
      'ЗИП CUT'
    ]
  },
  gouging: {
    title: 'Строгачи и угольные электроды',
    items: [
      'Строгачи',
      'Бесконечные угольные электроды (с ниппелем) омеднённые',
      'Круглые угольные электроды омеднённые',
      'Плоские угольные омеднённые',
      'Полукруглые угольные омеднённые'
    ]
  },
  lathe: {
    title: 'Токарное оборудование',
    items: [
      'На странице каталога отдельные подкатегории для этого раздела не указаны',
      'После заголовка сразу идёт список товаров'
    ]
  }
};

const renderSubcategoryPanel = (key = 'all', scrollTarget = '') => {
  if (!subcategoryPanelTitle || !subcategoryPanelList) return;

  const payload = subcategoryCatalog[key] || subcategoryCatalog.all;
  activeCategoryScrollTarget = scrollTarget || '';
  subcategoryPanelTitle.textContent = payload.title;
  subcategoryPanelList.innerHTML = '';

  payload.items.forEach((item, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-subcategory-button';
    button.textContent = item;
    button.style.animationDelay = `${index * 40}ms`;

    if (activeCategoryScrollTarget) {
      button.dataset.scrollTarget = activeCategoryScrollTarget;
    }

    button.addEventListener('click', () => {
      const destination = button.dataset.scrollTarget ? document.getElementById(button.dataset.scrollTarget) : null;
      if (destination) {
        destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      closeCategoryModal();
    });

    li.append(button);
    li.style.animationDelay = `${index * 40}ms`;
    subcategoryPanelList.append(li);
  });
};

const closeCategoryModal = () => {
  if (!categoryModal || !categoryModal.classList.contains('open')) return;
  categoryModal.classList.remove('open');
  setTimeout(() => {
    categoryModal.hidden = true;
  }, 320);
  if (categoryModalTrigger) {
    categoryModalTrigger.setAttribute('aria-expanded', 'false');
  }
};

const openCategoryModal = () => {
  if (!categoryModal || !categoryModalDialog) return;
  categoryModal.hidden = false;

  let offsetX = 0;
  let offsetY = -18;
  let originX = '50%';
  let originY = '0%';

  const modalParentRect = categoryModal.offsetParent
    ? categoryModal.offsetParent.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth };

  if (categoryModalTrigger) {
    const triggerRect = categoryModalTrigger.getBoundingClientRect();
    const parentWidth = Math.max(320, modalParentRect.width || window.innerWidth);
    const modalWidth = Math.min(920, parentWidth, Math.max(320, window.innerWidth - 40));

    const rawLeft = triggerRect.right - modalParentRect.left - modalWidth;
    const maxLeft = Math.max(0, parentWidth - modalWidth);
    const modalLeft = Math.min(Math.max(0, rawLeft), maxLeft);
    const modalTop = triggerRect.bottom - modalParentRect.top + 10;

    const triggerCenterLocalX = (triggerRect.left - modalParentRect.left - modalLeft) + (triggerRect.width / 2);

    categoryModal.style.setProperty('--modal-width', `${modalWidth}px`);
    categoryModal.style.setProperty('--modal-left', `${modalLeft}px`);
    categoryModal.style.setProperty('--modal-top', `${Math.max(0, modalTop)}px`);
    categoryModal.style.setProperty('--modal-trigger-local-x', `${triggerCenterLocalX}px`);

    offsetX = 0;
    offsetY = -20;
    originX = `${Math.max(10, Math.min(90, (triggerCenterLocalX / modalWidth) * 100)).toFixed(2)}%`;
    originY = '0%';
  }

  categoryModalDialog.style.setProperty('--modal-from-x', `${offsetX}px`);
  categoryModalDialog.style.setProperty('--modal-from-y', `${offsetY}px`);
  categoryModalDialog.style.setProperty('--modal-from-scale', '0.02');
  categoryModalDialog.style.setProperty('--modal-origin-x', originX);
  categoryModalDialog.style.setProperty('--modal-origin-y', originY);

  requestAnimationFrame(() => categoryModal.classList.add('open'));
  if (categoryModalTrigger) {
    categoryModalTrigger.setAttribute('aria-expanded', 'true');
  }
};

const syncCategoryTiles = (target = 'all', selectedTile = null) => {
  if (!categoryNavigation) return;

  const tiles = Array.from(categoryNavigation.querySelectorAll('[data-category-link]'));
  const exactMatch = tiles.find((tile)=>tile.dataset.filterTarget === target);
  const activeTile = selectedTile || exactMatch || tiles.find((tile)=>tile.dataset.filterTarget === 'all');

  tiles.forEach((tile)=>tile.classList.toggle('active', tile === activeTile));
};

const applyCatalogFilter = (target = 'all', options = {}) => {
  const { animate = false, selectedTile = null } = options;
  const nextTarget = target || 'all';

  filterButtons.forEach((item)=>{
    item.classList.toggle('active', item.dataset.filter === nextTarget);
  });
  syncCategoryTiles(nextTarget, selectedTile);

  if (categoryGrid && animate) {
    categoryGrid.classList.add('is-switching');
  }

  const applyVisibility = () => {
    document.querySelectorAll('[data-filter-item]').forEach((card)=>{
      const values = (card.dataset.filterItem || '').split(' ');
      card.style.display = (nextTarget === 'all' || values.includes(nextTarget)) ? '' : 'none';
    });

    if (categoryGrid && animate) {
      requestAnimationFrame(() => categoryGrid.classList.remove('is-switching'));
    }
  };

  if (categoryGrid && animate) {
    setTimeout(applyVisibility, 160);
  } else {
    applyVisibility();
  }
};

filterButtons.forEach((btn)=>{
  btn.addEventListener('click', ()=>{
    const target = btn.dataset.filter || 'all';
    applyCatalogFilter(target, { animate: true });
  });
});

if (categoryNavigation) {
  renderSubcategoryPanel();
  categoryNavigation.querySelectorAll('[data-category-link]').forEach((tile)=>{
    tile.addEventListener('click', ()=>{
      const target = tile.dataset.filterTarget || 'all';
      const scrollTarget = tile.dataset.scrollTarget;

      tile.classList.remove('is-pressed');
      requestAnimationFrame(() => tile.classList.add('is-pressed'));
      setTimeout(() => tile.classList.remove('is-pressed'), 420);

      applyCatalogFilter(target, { animate: true, selectedTile: tile });
      renderSubcategoryPanel(tile.dataset.subcategoryKey || target, scrollTarget);

    });
  });
}

if (categoryModalTrigger) {
  categoryModalTrigger.addEventListener('click', () => {
    if (categoryModal && categoryModal.classList.contains('open')) {
      closeCategoryModal();
      return;
    }
    openCategoryModal();
    renderSubcategoryPanel();
  });
}

if (categoryModal) {
  categoryModal.querySelectorAll('[data-category-modal-close]').forEach((node) => {
    node.addEventListener('click', closeCategoryModal);
  });
}

document.addEventListener('click', (event) => {
  if (!categoryModal || !categoryModal.classList.contains('open')) return;

  const clickedTrigger = categoryModalTrigger && categoryModalTrigger.contains(event.target);
  const clickedInsideDialog = categoryModalDialog && categoryModalDialog.contains(event.target);

  if (!clickedTrigger && !clickedInsideDialog) {
    closeCategoryModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeCategoryModal();
  }
});

const searchInput = document.querySelector('[data-search]');
if(searchInput){
  searchInput.addEventListener('input', ()=>{
    const value = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('[data-search-item]').forEach(card=>{
      const text = card.dataset.searchItem.toLowerCase();
      card.style.display = text.includes(value) ? '' : 'none';
    });
  });
}

document.querySelectorAll('.accordion').forEach(box=>{
  const button = box.querySelector('button');
  const content = box.querySelector('[data-accordion-content]');
  if(button && content){
    content.hidden = true;
    button.addEventListener('click', ()=>{
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      content.hidden = expanded;
    });
  }
});

const animatedCounters = document.querySelectorAll('.metric strong[data-counter]');
if(animatedCounters.length){
  const formatCounterValue = (value, suffix='') => `${value}${suffix}`;
  const animateCounter = (el)=>{
    if(el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';
    const target = Number(el.dataset.counter || 0);
    const suffix = el.dataset.suffix || '';
    const duration = 1300;
    const start = performance.now();

    const tick = (now)=>{
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      el.textContent = formatCounterValue(current, suffix);
      if(progress < 1){
        requestAnimationFrame(tick);
      }else{
        el.textContent = formatCounterValue(target, suffix);
        el.classList.add('counter-ready');
      }
    };

    requestAnimationFrame(tick);
  };

  const counterObserver = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting){
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, {threshold:.45});

  animatedCounters.forEach((counter)=>counterObserver.observe(counter));
}

const requestStorageKey = 'comtrade_request_items';

const normalizeProductName = (value = '') => value.trim().toLowerCase();

const getRequestItems = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(requestStorageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setRequestItems = (items) => {
  localStorage.setItem(requestStorageKey, JSON.stringify(items));
};

const getRequestQty = (name = '') => {
  const item = getRequestItems().find((entry) => normalizeProductName(entry.name) === normalizeProductName(name));
  return item ? Math.max(0, Number(item.qty) || 0) : 0;
};

const upsertRequestItem = (name, qty) => {
  const normalizedName = (name || '').trim();
  if (!normalizedName) return;

  const normalizedQty = Math.max(0, Number(qty) || 0);
  const items = getRequestItems();
  const index = items.findIndex((item) => normalizeProductName(item.name) === normalizeProductName(normalizedName));

  if (normalizedQty === 0) {
    if (index >= 0) {
      items.splice(index, 1);
    }
    setRequestItems(items);
    return;
  }

  if (index >= 0) {
    items[index].qty = normalizedQty;
  } else {
    items.push({ name: normalizedName, qty: normalizedQty });
  }

  setRequestItems(items);
};

const animateRequestStatus = (button) => {
  button.classList.remove('added-burst');
  requestAnimationFrame(() => button.classList.add('added-burst'));

  const card = button.closest('.product-card, .product-detail');
  if (card) {
    card.classList.remove('status-flash');
    requestAnimationFrame(() => card.classList.add('status-flash'));
  }
};

const ensureQtyPopover = (button, onChange) => {
  const card = button.closest('.product-card, .product-detail');
  if (!card) return null;

  let popover = card.querySelector(`[data-request-qty-popover="${button.dataset.productName}"]`);
  if (popover) return popover;

  popover = document.createElement('div');
  popover.className = 'request-qty-popover';
  popover.dataset.requestQtyPopover = button.dataset.productName;
  popover.hidden = true;

  const minusButton = document.createElement('button');
  minusButton.type = 'button';
  minusButton.className = 'qty-arrow';
  minusButton.setAttribute('aria-label', 'Уменьшить количество');
  minusButton.textContent = '−';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.step = '1';
  qtyInput.value = '1';
  qtyInput.className = 'qty-input';

  const plusButton = document.createElement('button');
  plusButton.type = 'button';
  plusButton.className = 'qty-arrow';
  plusButton.setAttribute('aria-label', 'Увеличить количество');
  plusButton.textContent = '+';

  minusButton.addEventListener('click', () => {
    const current = Math.max(0, Number(qtyInput.value) || 0);
    const next = Math.max(0, current - 1);
    qtyInput.value = String(next);
    onChange(next);
  });

  plusButton.addEventListener('click', () => {
    const current = Math.max(0, Number(qtyInput.value) || 0);
    const next = current + 1;
    qtyInput.value = String(next);
    onChange(next);
  });

  qtyInput.addEventListener('input', () => {
    const next = Math.max(0, Number(qtyInput.value) || 0);
    onChange(next);
  });

  popover.append(minusButton, qtyInput, plusButton);

  const buttonRow = button.parentElement;
  if (buttonRow && buttonRow.classList.contains('badge-line')) {
    buttonRow.after(popover);
  } else {
    button.after(popover);
  }

  return popover;
};

const getQtyPopover = (button) => {
  const card = button.closest('.product-card, .product-detail');
  if (!card) return null;
  return card.querySelector(`[data-request-qty-popover="${button.dataset.productName}"]`);
};

const setPopoverVisibility = (popover, isVisible, qty = 1, removeOnHide = false) => {
  if (!popover) return;

  const qtyInput = popover.querySelector('.qty-input');
  if (qtyInput) {
    qtyInput.value = String(Math.max(0, Number(qty) || 0));
  }

  const currentlyVisible = popover.dataset.visible === 'true';

  if (isVisible) {
    if (!currentlyVisible) {
      popover.hidden = false;
      popover.classList.remove('qty-pop-out');
      popover.classList.remove('qty-pop-in');
      requestAnimationFrame(() => popover.classList.add('qty-pop-in'));
    }
    popover.dataset.visible = 'true';
  } else {
    if (!currentlyVisible) {
      popover.hidden = true;
      if (removeOnHide) {
        popover.remove();
      }
      return;
    }
    popover.classList.remove('qty-pop-in');
    popover.classList.add('qty-pop-out');
    popover.dataset.visible = 'false';
    setTimeout(() => {
      popover.hidden = true;
      popover.classList.remove('qty-pop-out');
      if (removeOnHide) {
        popover.remove();
      }
    }, 220);
  }
};

const updateRequestVisualState = () => {
  const items = getRequestItems();
  const getQty = (name = '') => {
    const found = items.find((item) => normalizeProductName(item.name) === normalizeProductName(name));
    return found ? Math.max(0, Number(found.qty) || 0) : 0;
  };

  document.querySelectorAll('[data-add-to-request]').forEach((button) => {
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }

    const qty = getQty(button.dataset.productName);
    const added = qty > 0;

    button.classList.toggle('is-added', added);
    button.setAttribute('aria-pressed', String(added));
    button.textContent = added ? `В заявке: ${qty}` : button.dataset.defaultLabel;

    const card = button.closest('.product-card, .product-detail');
    if (card) {
      card.classList.toggle('in-request', added);
    }

    const existingPopover = getQtyPopover(button);

    if (added) {
      const popover = existingPopover || ensureQtyPopover(button, (nextQty) => {
        upsertRequestItem(button.dataset.productName, nextQty);
        updateRequestVisualState();
      });
      setPopoverVisibility(popover, true, qty);
    } else if (existingPopover) {
      setPopoverVisibility(existingPopover, false, 1, true);
    }
  });
};

const createRequestRow = (item, index, onUpdate) => {
  const row = document.createElement('div');
  row.className = 'request-item';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = item.name;
  nameInput.placeholder = 'Наименование товара';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.step = '1';
  qtyInput.value = String(item.qty || 1);
  qtyInput.placeholder = 'Кол-во';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn btn-secondary btn-sm';
  removeButton.textContent = 'Удалить';

  nameInput.addEventListener('input', () => {
    onUpdate(index, {
      ...item,
      name: nameInput.value.trim(),
      qty: Math.max(0, Number(qtyInput.value) || 0),
    });
  });

  qtyInput.addEventListener('input', () => {
    onUpdate(index, {
      ...item,
      name: nameInput.value.trim(),
      qty: Math.max(0, Number(qtyInput.value) || 0),
    });
  });

  removeButton.addEventListener('click', () => {
    onUpdate(index, null);
  });

  row.append(nameInput, qtyInput, removeButton);
  return row;
};

const initRequestBuilder = () => {
  document.querySelectorAll('[data-add-to-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const currentQty = getRequestQty(button.dataset.productName);
      if (currentQty > 0) {
        window.location.href = 'contacts.html#request';
        return;
      }

      upsertRequestItem(button.dataset.productName, 1);
      updateRequestVisualState();
      animateRequestStatus(button);
    });
  });

  updateRequestVisualState();

  const form = document.querySelector('[data-request-form]');
  if (!form) return;

  const itemsContainer = form.querySelector('[data-request-items]');
  const emptyState = form.querySelector('[data-request-empty]');
  const addEmptyButton = form.querySelector('[data-request-add-empty]');
  const summaryField = form.querySelector('[data-request-summary]');
  const messageField = form.querySelector('[data-request-message]');

  const persistAndRender = (nextItems) => {
    const filteredItems = nextItems
      .map((item) => ({
        name: (item.name || '').trim(),
        qty: Math.max(0, Number(item.qty) || 0),
      }))
      .filter((item) => item.name && item.qty > 0);

    setRequestItems(filteredItems);

    itemsContainer.innerHTML = '';
    filteredItems.forEach((item, index) => {
      const row = createRequestRow(item, index, (targetIndex, updatedItem) => {
        const draftItems = getRequestItems();
        if (updatedItem === null) {
          draftItems.splice(targetIndex, 1);
        } else {
          draftItems[targetIndex] = updatedItem;
        }
        persistAndRender(draftItems);
      });
      itemsContainer.append(row);
    });

    const hasItems = filteredItems.length > 0;
    emptyState.hidden = hasItems;
    const summaryText = hasItems
      ? filteredItems.map((item, idx) => `${idx + 1}. ${item.name} — ${item.qty} шт.`).join('\n')
      : '';

    summaryField.value = summaryText;
    if (summaryText && messageField && !messageField.value.trim()) {
      messageField.value = `Позиции в заявке:\n${summaryText}`;
    }

    updateRequestVisualState();
  };

  addEmptyButton.addEventListener('click', () => {
    const draftItems = getRequestItems();
    draftItems.push({ name: '', qty: 1 });
    persistAndRender(draftItems);
  });

  persistAndRender(getRequestItems());
};

initRequestBuilder();
