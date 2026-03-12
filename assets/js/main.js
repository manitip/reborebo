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

document.querySelectorAll('[data-filter]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const group = btn.closest('.tabs');
    if(group){
      group.querySelectorAll('[data-filter]').forEach(item=>item.classList.remove('active'));
    }
    btn.classList.add('active');
    const target = btn.dataset.filter;
    document.querySelectorAll('[data-filter-item]').forEach(card=>{
      const values = (card.dataset.filterItem || '').split(' ');
      card.style.display = (target === 'all' || values.includes(target)) ? '' : 'none';
    });
  });
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
      const nextQty = currentQty > 0 ? currentQty : 1;

      upsertRequestItem(button.dataset.productName, nextQty);
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
