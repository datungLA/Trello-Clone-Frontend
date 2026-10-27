export function edgeScrollDelta(point, start, end, maxSpeed = 12, threshold = 44) {
  if (![point, start, end, maxSpeed, threshold].every(Number.isFinite) || end <= start || threshold <= 0 || maxSpeed <= 0 || point < start || point > end) return 0;
  const zone = Math.min(threshold, (end - start) / 2);
  if (point < start + zone) return -maxSpeed * (1 - (point - start) / zone);
  if (point > end - zone) return maxSpeed * (1 - (end - point) / zone);
  return 0;
}

export function insertionPosition(source, targetPosition, after, sameScope) {
  const insertion = targetPosition + (after ? 1 : 0);
  return Math.max(0, insertion - (sameScope && source.position < insertion ? 1 : 0));
}

export function mobileDropTarget(item, lists, point, hitListId, hitCardId = null) {
  const list = lists.find(candidate => candidate.id === hitListId);
  if (!list || point.x < list.rect.left || point.x > list.rect.right || point.y < list.rect.top || point.y > list.rect.bottom) return null;
  if (item.type === 'list') {
    const position = insertionPosition(item, list.position, point.x > (list.rect.left + list.rect.right) / 2, true);
    return position === item.position ? null : Object.freeze({ listId: list.id, cardId: null, position });
  }
  if (item.type !== 'card') return null;
  const cards = list.cards || [];
  if (hitCardId === item.id) return null;
  const card = cards.find(candidate => candidate.id === hitCardId) || cards.find(candidate => candidate.id !== item.id && point.y < candidate.rect.bottom);
  const position = card
    ? insertionPosition(item, card.position, point.y > (card.rect.top + card.rect.bottom) / 2, item.listId === list.id)
    : insertionPosition(item, cards.length ? Math.max(...cards.map(candidate => candidate.position)) + 1 : 0, false, item.listId === list.id);
  if (item.listId === list.id && position === item.position) return null;
  return Object.freeze({ listId: list.id, cardId: card?.id || null, position });
}

export function installMobileBoardDrag(container, hooks = {}) {
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  let state = null, holdTimer = null, frame = null, lastFrame = 0, suppressedClick = null;
  const disabled = () => hooks.disabled?.() === true;
  const inside = node => node && container.contains(node);
  const position = (value, fallback = 0) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

  function readLists(targetElement) {
    return [...container.querySelectorAll('[data-mobile-list-id]')].map((list, index) => ({
      id: list.dataset.mobileListId,
      position: position(list.dataset.mobileListPosition, index),
      rect: list.getBoundingClientRect(),
      element: list,
      cards: state.item.type === 'card' && list === targetElement ? [...list.querySelectorAll('[data-mobile-card-id]')].map((card, cardIndex) => ({ id: card.dataset.mobileCardId, position: position(card.dataset.mobileCardPosition, cardIndex), rect: card.getBoundingClientRect() })) : [],
    }));
  }
  function targetAt(point) {
    const hit = doc.elementFromPoint(point.x, point.y);
    if (!inside(hit)) return { target: null, list: null };
    const element = hit.closest('[data-mobile-list-id]');
    if (!inside(element)) return { target: null, list: null };
    const lists = readLists(element), list = lists.find(candidate => candidate.id === element.dataset.mobileListId);
    return { target: mobileDropTarget(state.item, lists, point, list?.id, hit.closest('[data-mobile-card-id]')?.dataset.mobileCardId), list };
  }
  function updateTarget() {
    if (!state?.active) return null;
    const { target, list } = targetAt(state.point);
    if (JSON.stringify(target) !== JSON.stringify(state.target)) {
      state.target = target;
      hooks.onTarget?.(target);
    }
    return list;
  }
  function stopTimers() {
    if (holdTimer !== null) win.clearTimeout(holdTimer);
    if (frame !== null) win.cancelAnimationFrame(frame);
    holdTimer = null; frame = null; lastFrame = 0;
  }
  function finish(drop = false) {
    if (!state) return;
    const previous = state;
    stopTimers(); state = null;
    try { if (previous.handle.hasPointerCapture?.(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId); } catch {}
    if (!previous.active) return;
    suppressedClick = { handle: previous.handle, item: previous.item, until: Date.now() + 600 };
    const target = previous.target && Object.freeze({ ...previous.target });
    try {
      if (drop && target && !disabled()) hooks.onDrop?.(previous.item, target);
      else hooks.onCancel?.();
    } finally { hooks.onEnd?.(); }
  }
  function animate(timestamp) {
    frame = null;
    if (!state?.active) return;
    if (disabled() || !inside(state.handle)) { finish(); return; }
    const scale = lastFrame ? Math.min(2, Math.max(0, (timestamp - lastFrame) / (1000 / 60))) : 1;
    lastFrame = timestamp;
    const rect = container.getBoundingClientRect();
    if (state.point.y >= rect.top && state.point.y <= rect.bottom) container.scrollLeft += edgeScrollDelta(state.point.x, rect.left, rect.right) * scale;
    const list = updateTarget();
    if (list && state.item.type === 'card') {
      const cards = list.element.querySelector('.cards');
      if (cards) {
        const box = cards.getBoundingClientRect();
        if (state.point.x >= box.left && state.point.x <= box.right) cards.scrollTop += edgeScrollDelta(state.point.y, box.top, box.bottom, 10) * scale;
      }
    }
    if (state?.active) frame = win.requestAnimationFrame(animate);
  }
  function pointerDown(event) {
    if (state || disabled() || !['touch', 'pen'].includes(event.pointerType) || event.isPrimary === false || event.button !== 0) return;
    const handle = event.target.closest?.('[data-mobile-drag-type][data-mobile-drag-id]');
    if (!inside(handle) || !['card', 'list'].includes(handle.dataset.mobileDragType)) return;
    const list = handle.closest('[data-mobile-list-id]');
    if (!inside(list)) return;
    const card = handle.closest('[data-mobile-card-id]');
    const item = Object.freeze({ type: handle.dataset.mobileDragType, id: handle.dataset.mobileDragId, listId: list.dataset.mobileListId, position: position(handle.dataset.mobileDragType === 'card' ? card?.dataset.mobileCardPosition : list.dataset.mobileListPosition) });
    state = { handle, item, pointerId: event.pointerId, point: { x: event.clientX, y: event.clientY }, origin: { x: event.clientX, y: event.clientY }, target: null, active: false };
    holdTimer = win.setTimeout(() => {
      holdTimer = null;
      if (!state || disabled() || !inside(state.handle)) { finish(); return; }
      state.active = true;
      try { handle.setPointerCapture?.(state.pointerId); } catch {}
      hooks.onStart?.(item);
      if (state?.active) { updateTarget(); frame = win.requestAnimationFrame(animate); }
    }, 350);
  }
  function pointerMove(event) {
    if (!state || event.pointerId !== state.pointerId) return;
    state.point = { x: event.clientX, y: event.clientY };
    if (!state.active) {
      if (Math.hypot(event.clientX - state.origin.x, event.clientY - state.origin.y) > 10) finish();
      return;
    }
    event.preventDefault(); updateTarget();
  }
  function pointerUp(event) {
    if (!state || event.pointerId !== state.pointerId) return;
    if (state.active) { event.preventDefault(); state.point = { x: event.clientX, y: event.clientY }; updateTarget(); }
    finish(true);
  }
  const pointerCancel = event => { if (state?.pointerId === event.pointerId) finish(); };
  const keyDown = event => { if (state && event.key === 'Escape') { event.preventDefault(); finish(); } };
  const blur = () => finish();
  const visibility = () => { if (doc.hidden) finish(); };
  const preventNative = event => { if (state?.active) event.preventDefault(); };
  const preventClick = event => {
    if (!suppressedClick) return;
    if (Date.now() > suppressedClick.until) { suppressedClick = null; return; }
    const card = event.target.closest?.('[data-mobile-card-id]');
    if (suppressedClick.handle.contains(event.target) || (suppressedClick.item.type === 'card' && card?.dataset.mobileCardId === suppressedClick.item.id)) { event.preventDefault(); event.stopPropagation(); }
  };
  container.addEventListener('pointerdown', pointerDown);
  doc.addEventListener('pointermove', pointerMove, { passive: false });
  doc.addEventListener('pointerup', pointerUp, { passive: false });
  doc.addEventListener('pointercancel', pointerCancel);
  doc.addEventListener('lostpointercapture', pointerCancel);
  doc.addEventListener('keydown', keyDown);
  doc.addEventListener('visibilitychange', visibility);
  container.addEventListener('contextmenu', preventNative);
  container.addEventListener('click', preventClick, true);
  win.addEventListener('blur', blur);
  return () => {
    finish();
    container.removeEventListener('pointerdown', pointerDown);
    doc.removeEventListener('pointermove', pointerMove);
    doc.removeEventListener('pointerup', pointerUp);
    doc.removeEventListener('pointercancel', pointerCancel);
    doc.removeEventListener('lostpointercapture', pointerCancel);
    doc.removeEventListener('keydown', keyDown);
    doc.removeEventListener('visibilitychange', visibility);
    container.removeEventListener('contextmenu', preventNative);
    container.removeEventListener('click', preventClick, true);
    win.removeEventListener('blur', blur);
  };
}
