(() => {
  'use strict';
  const arcade = window.streetVoteArcade;
  const $ = id => document.getElementById(id);
  const menu = $('arcadeMenu'), arena = $('arcadeArena'), transition = $('roundTransition');
  const options = [...menu.querySelectorAll('[data-menu-action]')];
  const screens = [...menu.querySelectorAll('[data-menu-screen]')];
  const back = $('menuBack'), opener = $('openArcadeMenu');
  const background = [...document.querySelectorAll('main > :not(#arcadeArena), #arcadeArena > :not(#arcadeMenu):not(#roundTransition):not(#openArcadeMenu)')];
  let currentScreen = 'home', selected = 0, hasPlayed = false, entering = false;
  let debateFinale = false;
  function lockBackground(locked) {
    background.forEach(element => { element.inert = locked; });
    opener.inert = locked;
  }
  function select(index, focus = false, sound = false) {
    const changed = selected !== index;
    selected = index;
    options.forEach((button, i) => button.classList.toggle('is-selected', i === index));
    if (focus) options[index].focus({ preventScroll: true });
    if (changed && sound) arcade.tone();
  }
  function renderStats() {
    const stats = arcade.stats;
    for (const key of ['attacks', 'attacksL', 'attacksB', 'debates', 'winsL', 'winsB'])
      $('stat-' + key).textContent = stats[key].toLocaleString('pt-BR');
    const seconds = Math.floor(stats.playMs / 1000);
    $('stat-playMs').textContent = Math.floor(seconds / 3600).toString().padStart(2, '0') + ':' +
      Math.floor(seconds / 60 % 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');
  }
  function renderSettings() {
    const settings = arcade.settings;
    for (const key of ['master', 'voices', 'effects']) {
      $('setting-' + key).value = Math.round(settings[key] * 100);
      $('value-' + key).value = Math.round(settings[key] * 100) + '%';
    }
    for (const key of ['animations', 'particles']) $('setting-' + key).checked = settings[key];
    $('settingsSaved').textContent = arcade.storageAvailable ? 'PREFERÊNCIAS SALVAS NESTE DISPOSITIVO' : 'Armazenamento indisponível. Preferências válidas nesta sessão.';
    const full = !!document.fullscreenElement || arena.classList.contains('arcade-fallback-fullscreen');
    $('menuFullscreen').textContent = full ? 'SAIR DA TELA CHEIA' : 'ATIVAR TELA CHEIA';
    $('menuFullscreen').setAttribute('aria-pressed', String(full));
  }
  function screen(name, focus = true) {
    currentScreen = name;
    screens.forEach(element => { element.hidden = element.dataset.menuScreen !== name; });
    menu.dataset.screen = name;
    back.hidden = name === 'home';
    menu.scrollTop = 0;
    if (name === 'stats') renderStats();
    if (name === 'settings') renderSettings();
    if (focus) {
      if (name === 'home') select(selected, true);
      else menu.querySelector('[data-menu-screen="' + name + '"] h2').focus({ preventScroll: true });
    }
  }
  function showMenu() {
    if (arcade.mode === 'debate' || entering || debateFinale) return;
    arcade.setMode('menu');
    document.body.classList.add('svf-menu-open');
    menu.hidden = false;
    $('menuPlayLabel').textContent = hasPlayed ? 'CONTINUAR' : 'JOGAR';
    lockBackground(true);
    screen('home');
  }
  function revealArena() {
    menu.hidden = true;
    document.body.classList.remove('svf-menu-open');
    lockBackground(false);
    // Keep native fullscreen and the existing mobile layout in charge.
    if (!document.fullscreenElement && !arena.classList.contains('arcade-fallback-fullscreen'))
      arena.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  async function play() {
    if (entering) return;
    if (!arcade.ready) {
      $('menuStatus').textContent = arcade.loadError || 'CARREGANDO A ARENA… AGUARDE UM INSTANTE.';
      return;
    }
    entering = true;
    arcade.tone('confirm');
    arcade.setMode('transition');
    revealArena();
    lockBackground(true);
    $('roundTransitionLabel').textContent = hasPlayed ? 'DE VOLTA À ARENA' : 'ROUND 1';
    transition.hidden = false;
    await new Promise(resolve => setTimeout(resolve, arcade.reducedMotion ? 1000 : 1500));
    transition.hidden = true;
    entering = false; hasPlayed = true;
    lockBackground(false);
    arcade.setMode('arena');
    opener.focus({ preventScroll: true });
  }
  function debate() {
    if (!arcade.ready || entering) {
      $('menuStatus').textContent = arcade.loadError || 'CARREGANDO A ARENA… AGUARDE UM INSTANTE.';
      return;
    }
    arcade.tone('confirm');
    revealArena();
    window.streetVoteDebate();
  }
  options.forEach((button, index) => {
    button.addEventListener('pointerenter', event => select(index, false, event.pointerType === 'mouse'));
    button.addEventListener('focus', () => select(index, false, true));
    button.addEventListener('click', () => {
      const action = button.dataset.menuAction;
      if (action === 'play') play();
      else if (action === 'debate') debate();
      else { arcade.tone('confirm'); screen(action); }
    });
  });
  back.addEventListener('click', () => { arcade.tone(); screen('home'); });
  opener.addEventListener('click', showMenu);
  for (const key of ['master', 'voices', 'effects'])
    $('setting-' + key).addEventListener('input', event => arcade.setSettings({ [key]: Number(event.target.value) / 100 }));
  for (const key of ['animations', 'particles'])
    $('setting-' + key).addEventListener('change', event => arcade.setSettings({ [key]: event.target.checked }));
  $('restoreSettings').addEventListener('click', () => { arcade.restoreSettings(); arcade.tone('confirm'); });
  $('menuFullscreen').addEventListener('click', () => {
    $('arcadeFullscreen').click();
    // The fallback path may not emit fullscreenchange.
    setTimeout(renderSettings, 400);
  });
  document.addEventListener('fullscreenchange', renderSettings);
  arcade.subscribe(() => { renderSettings(); if (currentScreen === 'stats') renderStats(); });
  window.addEventListener('streetvote:ready', () => { $('menuStatus').textContent = 'ARENA PRONTA • ESCOLHA SEU PRÓXIMO ROUND'; });
  window.addEventListener('streetvote:loaderror', () => { $('menuStatus').textContent = arcade.loadError; });
  window.addEventListener('streetvote:debate-start', () => {
    revealArena(); hasPlayed = true; arcade.debate(); arcade.setMode('debate');
    opener.hidden = true;
  });
  window.addEventListener('streetvote:debate-end', event => {
    // Reserve the original lightning finale so reopening the menu cannot hide its KO.
    debateFinale = event.detail?.completed === true;
    arcade.setMode('arena'); opener.hidden = debateFinale;
    setTimeout(() => { debateFinale = false; opener.hidden = false; }, debateFinale ? 2700 : 0);
  });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (arcade.mode === 'debate') return;
    if (event.key === 'Escape') {
      if (entering || debateFinale) return;
      event.preventDefault();
      if (arcade.mode === 'menu' && currentScreen !== 'home') screen('home');
      else if (arcade.mode === 'arena') showMenu();
      return;
    }
    if (arcade.mode !== 'menu') return;
    if (currentScreen === 'home' && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
        (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      select(index, true, true);
    }
    if (event.key === 'Tab') {
      const controls = [...menu.querySelectorAll('button,input,[tabindex="0"]')]
        .filter(element => !element.disabled && element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }
  });
  renderSettings(); lockBackground(true); screen('home', false); select(0, true);
})();

