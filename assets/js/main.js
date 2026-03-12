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
