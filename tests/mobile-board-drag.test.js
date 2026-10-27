import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edgeScrollDelta, insertionPosition, mobileDropTarget, installMobileBoardDrag } from '../src/mobile-board-drag.js';

test('edge scrolling is bounded, stops outside the viewport and is inactive away from edges', () => {
  assert.equal(edgeScrollDelta(100, 0, 200), 0);
  assert.equal(edgeScrollDelta(-1, 0, 200), 0);
  assert.equal(edgeScrollDelta(201, 0, 200), 0);
  assert.equal(edgeScrollDelta(0, 0, 200), -12);
  assert.equal(edgeScrollDelta(200, 0, 200), 12);
  assert.equal(edgeScrollDelta(190, 0, 200, 10), 10 * (1 - 10 / 44));
  assert.equal(edgeScrollDelta(25, 0, 50), 0);
  for (const args of [[0, 10, 10], [NaN, 0, 100], [1, 0, 100, -1], [1, 0, 100, 10, 0]]) assert.equal(edgeScrollDelta(...args), 0);
});

test('insertion indices account for removal only within the source scope', () => {
  const source = { position: 1 };
  assert.equal(insertionPosition(source, 3, false, true), 2);
  assert.equal(insertionPosition(source, 3, true, true), 3);
  assert.equal(insertionPosition(source, 0, false, true), 0);
  assert.equal(insertionPosition(source, 3, false, false), 3);
  assert.equal(insertionPosition(source, 3, true, false), 4);
});

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const lists = [
  { id: 'a', position: 0, rect: rect(0, 0, 300, 600), cards: [{ id: 'one', position: 0, rect: rect(10, 50, 290, 150) }, { id: 'two', position: 1, rect: rect(10, 160, 290, 260) }, { id: 'three', position: 2, rect: rect(10, 270, 290, 370) }] },
  { id: 'b', position: 1, rect: rect(310, 0, 610, 600), cards: [] },
];
test('card targets preserve source identity, support empty lists and reject outside/no-op drops', () => {
  const item = Object.freeze({ type: 'card', id: 'one', listId: 'a', position: 0 });
  assert.deepEqual(mobileDropTarget(item, lists, { x: 20, y: 170 }, 'a', 'two'), null);
  assert.deepEqual(mobileDropTarget(item, lists, { x: 20, y: 250 }, 'a', 'two'), { listId: 'a', cardId: 'two', position: 1 });
  assert.deepEqual(mobileDropTarget(item, lists, { x: 330, y: 90 }, 'b'), { listId: 'b', cardId: null, position: 0 });
  assert.deepEqual(mobileDropTarget(item, lists, { x: 20, y: 500 }, 'a'), { listId: 'a', cardId: null, position: 2 });
  assert.equal(mobileDropTarget(item, lists, { x: 20, y: 100 }, 'a', 'one'), null);
  assert.equal(mobileDropTarget(item, lists, { x: 700, y: 100 }, 'a'), null);
  assert.equal(mobileDropTarget(item, lists, { x: 20, y: 100 }, 'missing'), null);
  const result = mobileDropTarget(item, lists, { x: 330, y: 90 }, 'b');
  assert.equal(Object.isFrozen(result), true);
});

test('list targets use horizontal boundaries without treating a list as a card destination', () => {
  const item = { type: 'list', id: 'a', listId: 'a', position: 0 };
  assert.equal(mobileDropTarget(item, lists, { x: 320, y: 50 }, 'b'), null);
  assert.deepEqual(mobileDropTarget(item, lists, { x: 600, y: 50 }, 'b'), { listId: 'b', cardId: null, position: 1 });
  assert.deepEqual(mobileDropTarget({ type: 'list', id: 'b', listId: 'b', position: 1 }, lists, { x: 10, y: 50 }, 'a'), { listId: 'a', cardId: null, position: 0 });
});

function dragHarness() {
  const surface = () => ({ handlers: new Map(), addEventListener(type, fn) { this.handlers.set(type, fn); }, removeEventListener(type) { this.handlers.delete(type); }, emit(type, values = {}) { const event = { preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...values }; this.handlers.get(type)?.(event); return event; } });
  const timers = new Map(), frames = new Map();
  let next = 0;
  const win = { ...surface(), setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); }, requestAnimationFrame(fn) { const id = ++next; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); } };
  const doc = { ...surface(), defaultView: win, elementFromPoint() { return this.hit; } };
  const container = { ...surface(), ownerDocument: doc, contains: element => [handle, card, a, b].includes(element), querySelectorAll: () => [a, b], getBoundingClientRect: () => rect(0, 0, 610, 600), scrollLeft: 0 };
  const cards = { getBoundingClientRect: () => rect(10, 30, 290, 590), scrollTop: 0 };
  const a = { dataset: { mobileListId: 'a', mobileListPosition: '0' }, getBoundingClientRect: () => rect(0, 0, 300, 600), querySelectorAll: () => [card], querySelector: () => cards, closest: () => a };
  const b = { dataset: { mobileListId: 'b', mobileListPosition: '1' }, getBoundingClientRect: () => rect(310, 0, 610, 600), querySelectorAll: () => [], querySelector: () => null, closest: selector => selector === '[data-mobile-list-id]' ? b : null };
  const card = { dataset: { mobileCardId: 'one', mobileCardPosition: '0' }, getBoundingClientRect: () => rect(10, 50, 290, 150) };
  const handle = { dataset: { mobileDragType: 'card', mobileDragId: 'one' }, closest: selector => selector === '[data-mobile-list-id]' ? a : selector === '[data-mobile-card-id]' ? card : handle, contains: value => value === handle, captured: false, setPointerCapture() { this.captured = true; }, hasPointerCapture() { return this.captured; }, releasePointerCapture() { this.captured = false; } };
  const down = (extra = {}) => container.emit('pointerdown', { target: handle, pointerType: 'touch', pointerId: 7, button: 0, isPrimary: true, clientX: 20, clientY: 70, ...extra });
  const pointer = (type, extra = {}) => doc.emit(type, { target: handle, pointerType: 'touch', pointerId: 7, clientX: 330, clientY: 90, ...extra });
  const hold = () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); } };
  return { container, doc, win, a, b, card, handle, timers, frames, down, pointer, hold };
}

test('only explicit touch holds start dragging; early movement and tap keep ordinary scrolling untouched', () => {
  const h = dragHarness(), calls = [];
  const cleanup = installMobileBoardDrag(h.container, { onStart: item => calls.push(item) });
  h.down({ pointerType: 'mouse' }); assert.equal(h.timers.size, 0);
  h.down({ target: { closest: () => null } }); assert.equal(h.timers.size, 0);
  h.down(); assert.equal([...h.timers.values()][0].delay, 350);
  const movement = h.pointer('pointermove', { clientX: 31, clientY: 70 });
  assert.equal(movement.prevented, undefined); assert.equal(h.timers.size, 0); h.hold(); assert.equal(calls.length, 0);
  h.down(); h.pointer('pointerup'); h.hold(); assert.equal(calls.length, 0);
  cleanup();
  assert.equal(h.doc.handlers.size, 0); assert.equal(h.container.handlers.size, 0); assert.equal(h.win.handlers.size, 0);
});

test('active touch drag freezes identity, commits once and releases capture, animation and synthetic click', () => {
  const h = dragHarness(), calls = [];
  h.doc.hit = h.b;
  const cleanup = installMobileBoardDrag(h.container, { onStart: item => calls.push(['start', item]), onDrop: (item, target) => calls.push(['drop', item, target]), onEnd: () => calls.push(['end']) });
  h.down(); h.hold(); assert.equal(h.handle.captured, true); assert.equal(h.frames.size, 1);
  assert.equal(h.pointer('pointermove').prevented, true);
  h.pointer('pointerup'); h.pointer('pointerup');
  assert.deepEqual(calls.map(row => row[0]), ['start', 'drop', 'end']);
  assert.equal(Object.isFrozen(calls[1][1]), true); assert.equal(Object.isFrozen(calls[1][2]), true);
  assert.deepEqual(calls[1][2], { listId: 'b', cardId: null, position: 0 });
  assert.equal(h.handle.captured, false); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
  const click = h.container.emit('click', { target: h.handle }); assert.equal(click.prevented, true); assert.equal(click.stopped, true);
  cleanup(); assert.equal(calls.length, 3);
});

test('Escape, outside drops and unmount cancel without committing a move', () => {
  for (const cancel of ['escape', 'outside', 'unmount', 'pointercancel']) {
    const h = dragHarness(), calls = [];
    h.doc.hit = h.b;
    const cleanup = installMobileBoardDrag(h.container, { onDrop: () => calls.push('drop'), onCancel: () => calls.push('cancel'), onEnd: () => calls.push('end') });
    h.down(); h.hold(); h.pointer('pointermove');
    if (cancel === 'escape') h.doc.emit('keydown', { key: 'Escape' });
    if (cancel === 'outside') { h.doc.hit = null; h.pointer('pointerup', { clientX: 700 }); }
    if (cancel === 'pointercancel') h.pointer('pointercancel');
    if (cancel === 'unmount') cleanup();
    assert.deepEqual(calls, ['cancel', 'end'], cancel);
    assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0); assert.equal(h.handle.captured, false);
    cleanup();
  }
});

test('active edge animation scrolls lists and cancels immediately when editing becomes disabled', () => {
  const h = dragHarness(), calls = [];
  let disabled = false;
  h.doc.hit = h.a;
  const cleanup = installMobileBoardDrag(h.container, { disabled: () => disabled, onCancel: () => calls.push('cancel'), onEnd: () => calls.push('end') });
  h.down(); h.hold(); h.pointer('pointermove', { clientX: 20, clientY: 588 });
  const frame = [...h.frames.entries()][0]; h.frames.delete(frame[0]); frame[1](1000);
  assert.ok(h.a.querySelector('.cards').scrollTop > 0);
  assert.ok(h.a.querySelector('.cards').scrollTop <= 10);
  assert.equal(h.frames.size, 1);
  disabled = true;
  const next = [...h.frames.entries()][0]; h.frames.delete(next[0]); next[1](1016);
  assert.deepEqual(calls, ['cancel', 'end']);
  assert.equal(h.frames.size, 0); assert.equal(h.handle.captured, false);
  cleanup();
});
