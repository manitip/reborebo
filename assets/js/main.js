const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
const setBodyLock = (locked) => {
  document.body.classList.toggle('sidebar-open', locked);
};

if(menuToggle && menu){
  const closeMenu = () => {
    menu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    setBodyLock(false);
  };

  const openMenu = () => {
    menu.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
    if (window.matchMedia('(max-width: 860px)').matches) {
      setBodyLock(true);
    }
  };

  menuToggle.addEventListener('click', ()=> {
    if (menu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click', closeMenu));

  document.addEventListener('click', (event) => {
    if (!menu.classList.contains('open')) return;
    if (menu.contains(event.target) || menuToggle.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 860px)').matches) {
      setBodyLock(false);
    }
  });
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


const brandWeld = document.querySelector('[data-brand-weld]');
if (brandWeld) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sessionKey = 'comtrade-brand-weld-played';
  const mobileView = window.matchMedia('(max-width: 900px)').matches;
  const animationDuration = mobileView ? 1900 : 2450;

  const completeBrandAnimation = () => {
    brandWeld.classList.remove('is-playing');
    brandWeld.classList.add('is-complete');
  };

  if (reduceMotion || sessionStorage.getItem(sessionKey) === '1') {
    completeBrandAnimation();
  } else {
    const startAnimation = () => {
      if (brandWeld.classList.contains('is-playing') || brandWeld.classList.contains('is-complete')) return;

      brandWeld.classList.add('is-playing');
      sessionStorage.setItem(sessionKey, '1');
      window.setTimeout(completeBrandAnimation, animationDuration);
    };

    if ('IntersectionObserver' in window) {
      const brandObserver = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startAnimation();
            observerInstance.unobserve(entry.target);
          }
        });
      }, { threshold: 0.9 });

      brandObserver.observe(brandWeld);
    } else {
      startAnimation();
    }
  }
}

const categoryGrid = document.querySelector('.category-grid');
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
const categoryNavigation = document.querySelector('[data-category-nav]');
const categoryModal = document.querySelector('[data-category-modal]');
const categoryModalTrigger = document.querySelector('[data-category-modal-trigger]');
const categoryModalDialog = categoryModal ? categoryModal.querySelector('.catalog-category-modal__dialog') : null;

const subcategoryPanelTitle = categoryModal ? categoryModal.querySelector('[data-subcategory-title]') : null;
const subcategoryPanelList = categoryModal ? categoryModal.querySelector('[data-subcategory-list]') : null;
let activeCategoryScrollTarget = '';

const subcategoryDescription = categoryModal ? categoryModal.querySelector('[data-subcategory-description]') : null;


const sidebarRoot = document.querySelector('[data-catalog-sidebar]');
const sidebarCategories = document.querySelector('[data-sidebar-categories]');
const sidebarSubcategories = document.querySelector('[data-sidebar-subcategories]');
const sidebarScenarios = document.querySelector('[data-sidebar-scenarios]');
const sidebarContextFilters = document.querySelector('[data-sidebar-context-filters]');
const sidebarReset = document.querySelector('[data-sidebar-reset]');
const sidebarOpenButton = document.querySelector('[data-sidebar-open]');
const sidebarCloseButton = document.querySelector('[data-sidebar-close]');
const sidebarBackdrop = document.querySelector('[data-sidebar-backdrop]');

const catalogSidebarConfig = {
  categories: [
    {
      id: 'materials',
      title: 'Сварочные материалы',
      filterTarget: 'materials',
      scrollTarget: 'materials',
      subcategories: ['Проволока MIG/MAG', 'Прутки TIG', 'Электроды MMA', 'Флюсы', 'Сварочные порошки']
    },
    {
      id: 'chemistry',
      title: 'Техническая химия',
      filterTarget: 'materials',
      scrollTarget: 'chemistry',
      subcategories: ['Травильные пасты', 'Антиспаттер', 'Пенетранты', 'Очистка алюминия']
    },
    {
      id: 'equipment',
      title: 'Сварочное оборудование',
      filterTarget: 'equipment',
      scrollTarget: 'equipment',
      subcategories: ['MIG/MAG полуавтоматы', 'TIG аппараты', 'Плазменная резка', 'Источники питания']
    },
    {
      id: 'automation',
      title: 'Автоматизация',
      filterTarget: 'engineering',
      scrollTarget: 'automation',
      subcategories: ['Роботизированные комплексы', 'Интеграция в линии', 'Оснастка и трекинг']
    },
    {
      id: 'workplace',
      title: 'Рабочее место сварщика',
      filterTarget: 'equipment',
      scrollTarget: 'workplace',
      subcategories: ['Столы и вытяжка', 'СИЗ', 'Горелки и комплектующие']
    }
  ],
  scenarios: [
    { id: 'production', title: 'Для производственного участка' },
    { id: 'stainless', title: 'Для нержавеющей стали' },
    { id: 'aluminum', title: 'Для алюминия' },
    { id: 'automation', title: 'Для автоматизированной сварки' },
    { id: 'post', title: 'Для комплектации поста' }
  ],
  contextFilters: {
    materials: ['Материал', 'Тип сварки', 'Форма поставки', 'Диаметр', 'Назначение'],
    equipment: ['Процесс сварки', 'Напряжение', 'Диапазон тока', 'Условия эксплуатации', 'Класс оборудования'],
    chemistry: ['Назначение', 'Вид металла', 'Объём', 'Тип применения', 'Режим применения'],
    engineering: ['Тип линии', 'Степень автоматизации', 'Нагрузка', 'Сервис']
  }
};

const sidebarState = {
  categoryId: 'materials',
  scenarioId: '',
  contextFilter: ''
};

const subcategoryCatalog = {
  all: {
    title: 'Весь каталог',
    items: [
      {
        name: 'Выберите категорию',
        description: 'Выберите конкретную категорию слева, чтобы увидеть подкатегории и описание каждого направления.'
      }
    ]
  },
  materials: {
    title: 'Сварочные материалы',
    items: [
      { name: 'Для легированных, высокопрочных и теплоустойчивых сталей', description: 'Материалы для сварки специальных сталей, где важны прочность, стойкость к нагрузкам и работе при повышенных температурах.' },
      { name: 'Для сварки углеродистых и низколегированных сталей', description: 'Расходники для самых распространённых сталей, применяемых в строительстве, производстве и ремонте.' },
      { name: 'Для наплавки и ремонта деталей', description: 'Материалы для восстановления изношенных поверхностей, усиления рабочих зон и ремонта металлических деталей.' },
      { name: 'Для сварки сплавов цветных металлов', description: 'Решения для работы с алюминием, медью и другими цветными металлами и их сплавами.' },
      { name: 'Вольфрамовые, угольные электроды', description: 'Электроды для TIG-сварки, строжки и других специальных сварочных операций.' },
      { name: 'Для сварки чугуна', description: 'Материалы для ремонта и соединения чугунных деталей с учётом особенностей этого металла.' }
    ]
  },
  chemistry: {
    title: 'Техническая химия',
    items: [
      { name: 'Средства для травления и очистки нержавейки', description: 'Химия для удаления окалины, цветов побежалости и загрязнений после сварки нержавеющей стали.' },
      { name: 'Средства против налипания брызг', description: 'Составы, которые уменьшают прилипание сварочных брызг к металлу, соплам и оснастке.' },
      { name: 'Средства для дефектоскопии (пенетранты)', description: 'Материалы для капиллярного контроля, помогающие выявлять поверхностные трещины и дефекты.' },
      { name: 'Охлаждающий агент', description: 'Средство для охлаждения узлов оборудования или инструмента в процессе работы.' },
      { name: 'Средства для травления и очистки алюминия', description: 'Химические составы для подготовки, очистки и обработки алюминиевых поверхностей.' },
      { name: 'Кислотостойкие кисти', description: 'Кисти для нанесения агрессивных химических составов, устойчивые к воздействию кислот.' }
    ]
  },
  equipment: {
    title: 'Сварочное оборудование',
    items: [
      { name: 'Сварочные инверторы MMA', description: 'Аппараты для ручной дуговой сварки штучным электродом.' },
      { name: 'Установки плазменной резки', description: 'Оборудование для быстрой и точной резки металла плазмой.' },
      { name: 'Сварочные полуавтоматы MIG', description: 'Аппараты для сварки проволокой в среде защитного газа или с порошковой проволокой.' },
      { name: 'Сварочные генераторы и агрегаты', description: 'Автономные источники питания для сварки на выезде или в полевых условиях.' },
      { name: 'Сварочные аргонодуговые аппараты TIG', description: 'Оборудование для точной сварки неплавящимся электродом в защитном газе.' },
      { name: 'Комплектующие для электросварки', description: 'Вспомогательные элементы и аксессуары для подключения, обслуживания и работы сварочного оборудования.' },
      { name: 'Центраторы', description: 'Приспособления для точного совмещения труб и деталей перед сваркой.' },
      { name: 'Шланг-пакеты', description: 'Кабельно-шланговые сборки для подачи тока, газа и проволоки к горелке.' }
    ]
  },
  protection: {
    title: 'Средства защиты',
    items: [
      { name: 'Для защиты рук', description: 'Перчатки, краги и другие изделия для защиты рук от жара, искр и механических воздействий.' },
      { name: 'Сварочные маски', description: 'Средства защиты лица и глаз сварщика от излучения, искр и брызг металла.' },
      { name: 'Для защиты органов зрения', description: 'Очки и защитные средства для работ, где требуется защита глаз вне сварочной маски.' },
      { name: 'Для защиты органов слуха', description: 'Беруши, наушники и другие решения для снижения воздействия шума.' },
      { name: 'Защитная одежда', description: 'Спецодежда для защиты тела от искр, тепла и производственных загрязнений.' },
      { name: 'Для защиты органов дыхания', description: 'Респираторы и другие средства защиты от дыма, пыли и вредных испарений.' },
      { name: 'Для защиты головы', description: 'Каски и сопутствующие изделия для защиты головы на производстве.' }
    ]
  },
  abrasive: {
    title: 'Абразивные материалы и инструмент',
    items: [
      { name: 'Круги фибровые', description: 'Абразивные круги для шлифования, зачистки и подготовки поверхности.' },
      { name: 'Круги шлифовальные (зачистные)', description: 'Круги для удаления наплывов, ржавчины, окалины и грубой обработки металла.' },
      { name: 'Круги лепестковые', description: 'Универсальные круги для шлифовки, зачистки и более аккуратной обработки поверхности.' },
      { name: 'Борфрезы (шарошки)', description: 'Насадки для точной обработки металла, снятия заусенцев и доработки сложных участков.' },
      { name: 'Круги отрезные', description: 'Диски для резки металла и других материалов.' }
    ]
  },
  automation: {
    title: 'Автоматизация и роботизация',
    items: [
      { name: 'Портальные установки с ЧПУ для резки различных материалов', description: 'Автоматизированные системы для высокоточной резки металла и других материалов по программе.' },
      { name: 'Комплектующие автоматизации и роботизации', description: 'Узлы, модули и элементы для построения или модернизации автоматизированных комплексов.' },
      { name: 'Сварочные трактора', description: 'Самоходные устройства для механизированного ведения сварочного процесса.' },
      { name: 'Орбитальная сварка', description: 'Оборудование для автоматической сварки труб и круговых соединений с высокой повторяемостью.' },
      { name: 'Лазерная сварка', description: 'Решения для точной, быстрой и малодеформирующей сварки лазером.' }
    ]
  },
  gas: {
    title: 'Газопламенное оборудование',
    items: [
      { name: 'Портативные установки резаки по металлу', description: 'Переносные решения для газовой резки металла в мастерской и на выезде.' },
      { name: 'Комплектующие для газосварки', description: 'Расходные и соединительные элементы для работы газосварочного оборудования.' },
      { name: 'Редукторы, регуляторы газовые, подогреватели', description: 'Устройства для контроля давления, подачи и стабильной работы газа.' },
      { name: 'Резаки газовые', description: 'Инструмент для газовой резки металла.' },
      { name: 'Горелки газовые', description: 'Оборудование для нагрева, пайки, сварки и других газопламенных работ.' }
    ]
  },
  workplace: {
    title: 'Оборудование места сварщика',
    items: [
      { name: 'Наборы для организации сварочного поста', description: 'Комплекты для оснащения рабочего места сварщика всем необходимым.' },
      { name: 'Оснастка', description: 'Вспомогательные элементы для фиксации, позиционирования и удобства выполнения работ.' },
      { name: 'Сварочно-монтажные столы и приспособления', description: 'Рабочие столы и системы для сборки, фиксации и точной подготовки деталей.' },
      { name: 'Защитные шторы и кабинки CEPRO', description: 'Средства ограждения рабочей зоны от излучения, искр и визуального воздействия сварки.' },
      { name: 'Фильтровентиляционное оборудование', description: 'Системы для удаления сварочного дыма и очистки воздуха в рабочей зоне.' }
    ]
  },
  torches: {
    title: 'Горелки и ЗИП',
    items: [
      { name: 'Горелки MIG сварка', description: 'Горелки для полуавтоматической сварки проволокой.' },
      { name: 'Горелки TIG сварка', description: 'Горелки для аргонодуговой сварки с точным контролем дуги.' },
      { name: 'Плазмотроны CUT', description: 'Рабочие резаки для плазменной резки.' },
      { name: 'ЗИП MIG сварка', description: 'Запасные части и расходники для MIG-горелок и полуавтоматов.' },
      { name: 'ЗИП TIG сварка', description: 'Комплектующие и расходные элементы для TIG-горелок.' },
      { name: 'ЗИП CUT', description: 'Запасные части и расходники для плазменной резки.' }
    ]
  },
  gouging: {
    title: 'Строгачи и угольные электроды',
    items: [
      { name: 'Строгачи', description: 'Инструмент или устройства для воздушно-дуговой строжки и удаления металла.' },
      { name: 'Бесконечные угольные электроды (с ниппелем) омеднённые', description: 'Электроды для продолжительной работы с возможностью наращивания длины.' },
      { name: 'Круглые угольные электроды омеднённые', description: 'Электроды круглого сечения для строжки и специальных процессов обработки металла.' },
      { name: 'Плоские угольные омеднённые', description: 'Плоские электроды для определённых видов строжки и снятия металла.' },
      { name: 'Полукруглые угольные омеднённые', description: 'Электроды специальной формы для профильной обработки и технологических задач.' }
    ]
  },
  lathe: {
    title: 'Токарное оборудование',
    items: [
      { name: 'Раздел без выделенных подкатегорий', description: 'На странице каталога отдельные подкатегории для токарного оборудования не указаны — раздел представлен сразу товарами.' }
    ]
  }
};

const renderSubcategoryPanel = (key = 'all', scrollTarget = '') => {
  if (!subcategoryPanelTitle || !subcategoryPanelList) return;

  const payload = subcategoryCatalog[key] || subcategoryCatalog.all;
  activeCategoryScrollTarget = scrollTarget || '';
  subcategoryPanelTitle.textContent = payload.title;
  subcategoryPanelList.innerHTML = '';

  const updateDescription = (description) => {
    if (!subcategoryDescription) return;
    subcategoryDescription.textContent = description || 'Выберите подкатегорию, чтобы увидеть краткое описание.';
  };

  payload.items.forEach((item, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-subcategory-button';
    button.textContent = item.name;
    button.style.animationDelay = `${index * 40}ms`;

    if (activeCategoryScrollTarget) {
      button.dataset.scrollTarget = activeCategoryScrollTarget;
    }

    button.addEventListener('mouseenter', () => updateDescription(item.description));
    button.addEventListener('focus', () => updateDescription(item.description));

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

  updateDescription(payload.items[0] ? payload.items[0].description : '');
};


const getCategoryById = (id) => catalogSidebarConfig.categories.find((item) => item.id === id) || catalogSidebarConfig.categories[0];

const updateSidebarUrl = () => {
  if (!sidebarRoot) return;
  const url = new URL(window.location.href);

  if (sidebarState.scenarioId) {
    url.searchParams.set('scenario', sidebarState.scenarioId);
  } else {
    url.searchParams.delete('scenario');
  }

  if (sidebarState.contextFilter) {
    url.searchParams.set('context', sidebarState.contextFilter);
  } else {
    url.searchParams.delete('context');
  }

  if (sidebarState.categoryId) {
    url.searchParams.set('category', sidebarState.categoryId);
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const applySidebarStateToUI = () => {
  if (!sidebarRoot) return;

  const category = getCategoryById(sidebarState.categoryId);

  if (sidebarCategories) {
    sidebarCategories.querySelectorAll('.catalog-nav-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.categoryId === sidebarState.categoryId);
    });
  }

  if (sidebarSubcategories) {
    sidebarSubcategories.hidden = !category.subcategories.length;
    sidebarSubcategories.innerHTML = category.subcategories.length
      ? `<p class="catalog-subnav-title">Подкатегории</p>${category.subcategories.map((sub)=>`<button type="button" class="catalog-subnav-btn" data-scroll-target="${category.scrollTarget}">${sub}</button>`).join('')}`
      : '';

    sidebarSubcategories.querySelectorAll('[data-scroll-target]').forEach((node) => {
      node.addEventListener('click', () => {
        const destination = document.getElementById(node.dataset.scrollTarget || '');
        if (destination) destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (shouldAutoCloseSidebar()) closeCatalogSidebar();
      });
    });
  }

  if (sidebarContextFilters) {
    const filters = catalogSidebarConfig.contextFilters[category.id] || [];
    sidebarContextFilters.innerHTML = filters.map((item) => `<button type="button" class="catalog-context-chip ${sidebarState.contextFilter === item ? 'active' : ''}" data-context-filter="${item}">${item}</button>`).join('');

    sidebarContextFilters.querySelectorAll('[data-context-filter]').forEach((node) => {
      node.addEventListener('click', () => {
        sidebarState.contextFilter = sidebarState.contextFilter === node.dataset.contextFilter ? '' : (node.dataset.contextFilter || '');
        applySidebarStateToUI();
        updateSidebarUrl();
      });
    });
  }

  if (sidebarScenarios) {
    sidebarScenarios.querySelectorAll('.catalog-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.scenario === sidebarState.scenarioId);
    });
  }

  if (sidebarReset) {
    sidebarReset.hidden = !(sidebarState.scenarioId || sidebarState.contextFilter);
  }
};

const applySidebarCategory = (categoryId, syncFilter = true) => {
  const category = getCategoryById(categoryId);
  sidebarState.categoryId = category.id;

  if (syncFilter) {
    applyCatalogFilter(category.filterTarget || 'all', { animate: true });
  }

  applySidebarStateToUI();
  updateSidebarUrl();
};

const shouldAutoCloseSidebar = () => window.matchMedia('(max-width: 860px)').matches;

const closeCatalogSidebar = () => {
  if (!sidebarRoot) return;
  sidebarRoot.classList.remove('open');
  if (!menu || !menu.classList.contains('open')) {
    setBodyLock(false);
  }
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
};

const openCatalogSidebar = () => {
  if (!sidebarRoot) return;
  sidebarRoot.classList.add('open');
  setBodyLock(true);
  if (sidebarBackdrop) sidebarBackdrop.classList.add('open');
};

if (sidebarOpenButton) {
  sidebarOpenButton.addEventListener('click', openCatalogSidebar);
}

if (sidebarCloseButton) {
  sidebarCloseButton.addEventListener('click', closeCatalogSidebar);
}

const handleCatalogSidebarDismiss = (event) => {
  if (!sidebarRoot || !sidebarRoot.classList.contains('open')) return;

  const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!eventTarget) return;

  const dismissTrigger = eventTarget.closest('[data-sidebar-close], [data-sidebar-backdrop]');
  if (!dismissTrigger) return;

  event.preventDefault();
  closeCatalogSidebar();
};

document.addEventListener('click', handleCatalogSidebarDismiss, true);
document.addEventListener('pointerup', handleCatalogSidebarDismiss, true);

const renderCatalogSidebar = () => {
  if (!sidebarRoot || !sidebarCategories || !sidebarScenarios) return;

  sidebarCategories.innerHTML = catalogSidebarConfig.categories
    .map((category) => `<button type="button" class="catalog-nav-btn" data-category-id="${category.id}">${category.title}</button>`)
    .join('');

  sidebarScenarios.innerHTML = catalogSidebarConfig.scenarios
    .map((scenario) => `<button type="button" class="catalog-chip" data-scenario="${scenario.id}">${scenario.title}</button>`)
    .join('');

  sidebarCategories.querySelectorAll('[data-category-id]').forEach((button) => {
    button.addEventListener('click', () => {
      applySidebarCategory(button.dataset.categoryId || 'materials');
      if (shouldAutoCloseSidebar()) closeCatalogSidebar();
    });
  });

  sidebarScenarios.querySelectorAll('[data-scenario]').forEach((chip) => {
    chip.addEventListener('click', () => {
      sidebarState.scenarioId = sidebarState.scenarioId === chip.dataset.scenario ? '' : (chip.dataset.scenario || '');
      applySidebarStateToUI();
      updateSidebarUrl();
      if (shouldAutoCloseSidebar()) closeCatalogSidebar();
    });
  });

  if (sidebarReset) {
    sidebarReset.addEventListener('click', () => {
      sidebarState.scenarioId = '';
      sidebarState.contextFilter = '';
      applySidebarStateToUI();
      updateSidebarUrl();
    });
  }

  const params = new URLSearchParams(window.location.search);
  sidebarState.categoryId = params.get('category') || sidebarState.categoryId;
  sidebarState.scenarioId = params.get('scenario') || '';
  sidebarState.contextFilter = params.get('context') || '';

  applySidebarCategory(sidebarState.categoryId, true);

  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 860px)').matches) {
      closeCatalogSidebar();
    }
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

renderCatalogSidebar();

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
    closeCatalogSidebar();
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
    window.location.href = 'catalog.html';
  });

  persistAndRender(getRequestItems());
};



const initFormDropdowns = () => {
  const dropdowns = Array.from(document.querySelectorAll('[data-form-dropdown]'));
  if (dropdowns.length === 0) return;

  dropdowns.forEach((root) => {
    const trigger = root.querySelector('[data-dropdown-trigger]');
    const label = root.querySelector('[data-dropdown-label]');
    const valueField = root.querySelector('[data-dropdown-value]');
    const options = Array.from(root.querySelectorAll('[data-dropdown-option]'));

    if (!trigger || !label || !valueField || options.length === 0) return;

    const syncValue = (value) => {
      const selectedOption = options.find((option) => option.dataset.dropdownOption === value) || options[0];
      const nextValue = selectedOption.dataset.dropdownOption || '';
      valueField.value = nextValue;
      label.textContent = selectedOption.textContent;
      options.forEach((option) => option.classList.toggle('is-active', option === selectedOption));
    };

    const closeDropdown = () => {
      root.classList.remove('is-open');
      root.style.transform = '';
      trigger.setAttribute('aria-expanded', 'false');
    };

    const fitDropdownToViewport = () => {
      const rect = root.getBoundingClientRect();
      const overflowRight = rect.right - window.innerWidth + 12;
      const overflowLeft = 12 - rect.left;
      if (overflowRight > 0) {
        root.style.transform = `translateX(${-overflowRight}px)`;
      } else if (overflowLeft > 0) {
        root.style.transform = `translateX(${overflowLeft}px)`;
      } else {
        root.style.transform = '';
      }
    };

    trigger.addEventListener('click', () => {
      const nextOpen = !root.classList.contains('is-open');
      dropdowns.forEach((item) => {
        item.classList.remove('is-open');
        const itemTrigger = item.querySelector('[data-dropdown-trigger]');
        if (itemTrigger) {
          itemTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      root.classList.toggle('is-open', nextOpen);
      trigger.setAttribute('aria-expanded', String(nextOpen));
      if (nextOpen) fitDropdownToViewport();
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        syncValue(option.dataset.dropdownOption || '');
        closeDropdown();
      });
    });

    document.addEventListener('click', (event) => {
      if (!root.contains(event.target)) {
        closeDropdown();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    });

    syncValue(valueField.value || options[0].dataset.dropdownOption || '');
  });
};

const initDeliveryDropdown = () => {
  const root = document.querySelector('[data-delivery-dropdown]');
  if (!root) return;

  const trigger = root.querySelector('[data-delivery-trigger]');
  const label = root.querySelector('[data-delivery-label]');
  const valueField = root.querySelector('[data-delivery-value]');
  const note = root.querySelector('[data-delivery-note]');
  const options = Array.from(root.querySelectorAll('[data-delivery-option]'));

  if (!trigger || !label || !valueField || options.length === 0) return;

  const optionTitles = {
    pickup: 'Самовывоз',
    tk: 'Доставка через ТК'
  };

  const setValue = (value) => {
    valueField.value = value;
    label.textContent = optionTitles[value] || optionTitles.pickup;
    options.forEach((option) => option.classList.toggle('is-active', option.dataset.deliveryOption === value));

    if (note) {
      const showNote = value === 'tk';
      note.hidden = !showNote;
      if (showNote) {
        note.style.animation = 'none';
        requestAnimationFrame(() => {
          note.style.animation = '';
        });
      }
    }
  };

  const closeDropdown = () => {
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', () => {
    const nextOpen = !root.classList.contains('is-open');
    root.classList.toggle('is-open', nextOpen);
    trigger.setAttribute('aria-expanded', String(nextOpen));
  });

  options.forEach((option) => {
    option.addEventListener('click', () => {
      setValue(option.dataset.deliveryOption || 'pickup');
      closeDropdown();
    });
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  });

  setValue(valueField.value || 'pickup');
};


const initInnAndPhoneInputs = () => {
  const innInputs = Array.from(document.querySelectorAll('[data-inn-input]'));
  innInputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 12);
    });
  });

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    let local = digits;
    if (local.startsWith('8')) local = `7${local.slice(1)}`;
    if (!local.startsWith('7')) local = `7${local}`;
    local = local.slice(0, 11);
    const tail = local.slice(1);

    let formatted = '+7';
    if (tail.length > 0) formatted += ` ${tail.slice(0, 3)}`;
    if (tail.length > 3) formatted += ` ${tail.slice(3, 6)}`;
    if (tail.length > 6) formatted += `-${tail.slice(6, 8)}`;
    if (tail.length > 8) formatted += `-${tail.slice(8, 10)}`;

    return formatted;
  };

  const phoneInputs = Array.from(document.querySelectorAll('[data-phone-mask]'));
  phoneInputs.forEach((input) => {
    input.addEventListener('focus', () => {
      if (!input.value) input.value = '+7';
    });

    input.addEventListener('input', () => {
      input.value = formatPhone(input.value);
    });

    input.addEventListener('blur', () => {
      if (input.value === '+7') input.value = '';
    });
  });
};

initRequestBuilder();
initFormDropdowns();
initDeliveryDropdown();
initInnAndPhoneInputs();
