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

const addRequestItem = (name, qty = 1) => {
  const normalizedName = (name || '').trim();
  if (!normalizedName) return;

  const normalizedQty = Math.max(1, Number(qty) || 1);
  const items = getRequestItems();
  const existingItem = items.find((item) => item.name === normalizedName);

  if (existingItem) {
    existingItem.qty += normalizedQty;
  } else {
    items.push({ name: normalizedName, qty: normalizedQty });
  }

  setRequestItems(items);
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
  qtyInput.min = '1';
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
      qty: Math.max(1, Number(qtyInput.value) || 1),
    });
  });

  qtyInput.addEventListener('input', () => {
    onUpdate(index, {
      ...item,
      name: nameInput.value.trim(),
      qty: Math.max(1, Number(qtyInput.value) || 1),
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
      addRequestItem(button.dataset.productName, button.dataset.productQty);
      if (button.dataset.addMode === 'redirect') {
        window.location.href = 'contacts.html#request';
      }
    });
  });

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
        qty: Math.max(1, Number(item.qty) || 1),
      }))
      .filter((item) => item.name);

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
  };

  addEmptyButton.addEventListener('click', () => {
    const draftItems = getRequestItems();
    draftItems.push({ name: '', qty: 1 });
    persistAndRender(draftItems);
  });

  persistAndRender(getRequestItems());
};

initRequestBuilder();
