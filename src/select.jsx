import React, { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./select.css";

function optionText(node) {
  return Children.toArray(node).map(child => isValidElement(child) ? optionText(child.props.children) : String(child)).join("");
}
function readOptions(children, inheritedDisabled = false, group = "") {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) return readOptions(child.props.children, inheritedDisabled, group);
    if (child.type === "optgroup") return readOptions(child.props.children, inheritedDisabled || child.props.disabled, child.props.label);
    if (child.type !== "option") return [];
    const label = child.props.label ?? optionText(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: inheritedDisabled || !!child.props.disabled, group }];
  });
}

export function Select({ children, value, defaultValue, onChange, id, name, disabled = false, required = false, form, autoFocus, className = "", onInvalid, onFocus, onBlur, onKeyDown, ...props }) {
  const generatedId = useId();
  const triggerId = id || `select-${generatedId}`;
  const listId = `${triggerId}-listbox`;
  const options = readOptions(children);
  const first = options.find(option => !option.disabled)?.value ?? "";
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? first));
  const chosenValue = value === undefined ? internalValue : String(value ?? "");
  const selected = options.findIndex(option => option.value === chosenValue);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const native = useRef(null);
  const popup = useRef(null);
  const typeahead = useRef({ text: "", at: 0 });
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index !== -1);
  function close() { setOpen(false); typeahead.current.text = ""; }
  function reveal(index = selected) {
    if (disabled || !enabled.length) return;
    setActive(enabled.includes(index) ? index : enabled[0]); setPosition(null); setOpen(true);
  }
  function choose(index) {
    const option = options[index];
    if (!option || option.disabled || disabled) return;
    if (option.value !== chosenValue) {
      native.current.value = option.value;
      native.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close(); trigger.current?.focus();
  }
  function keydown(event) {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    const key = event.key;
    if (key === "Tab") { close(); return; }
    if (key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (!enabled.length) return;
      if (!open) { reveal(key === "Home" ? enabled[0] : key === "End" ? enabled.at(-1) : selected); return; }
      const current = enabled.indexOf(active);
      const next = key === "Home" ? 0 : key === "End" ? enabled.length - 1 : Math.min(enabled.length - 1, Math.max(0, current + (key === "ArrowDown" ? 1 : -1)));
      setActive(enabled[next]); return;
    }
    if (key === "Enter" || key === " ") { event.preventDefault(); if (open) choose(active); else reveal(); return; }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = now - typeahead.current.at < 700 ? typeahead.current.text + key : key;
      typeahead.current = { text, at: now };
      const repeated = [...text].every(letter => letter.toLocaleLowerCase() === key.toLocaleLowerCase());
      const needle = (repeated ? key : text).toLocaleLowerCase();
      const start = repeated ? (open ? active : selected) + 1 : 0;
      const indices = [...enabled.filter(index => index >= start), ...enabled.filter(index => index < start)];
      const match = indices.find(index => options[index].label.toLocaleLowerCase().startsWith(needle));
      if (match !== undefined) { if (open) setActive(match); else { choose(match); typeahead.current = { text, at: now }; } }
    }
  }
  useEffect(() => { if (disabled) close(); }, [disabled]);
  useEffect(() => { if (native.current?.validity.valid) setInvalid(false); }, [chosenValue]);
  useEffect(() => {
    if (value === undefined && selected === -1 && options.length) setInternalValue(first);
  }, [value, chosenValue, first, options.length, selected]);
  useEffect(() => {
    const element = native.current;
    const owner = element?.form;
    if (!owner) return;
    function reset() { queueMicrotask(() => { const resetValue = value === undefined ? String(defaultValue ?? first) : String(value ?? ""); if (native.current) native.current.value = resetValue; if (value === undefined) setInternalValue(resetValue); setInvalid(false); close(); }); }
    owner.addEventListener("reset", reset);
    return () => owner.removeEventListener("reset", reset);
  }, [value, defaultValue, first, form]);
  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) close(); }
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("blur", close);
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("blur", close); };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    let frame;
    function measure() {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const topEdge = (viewport?.offsetTop || 0) + 8;
      const leftEdge = (viewport?.offsetLeft || 0) + 8;
      const rightEdge = leftEdge + (viewport?.width || innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height || innerHeight) - 16;
      const below = Math.max(0, bottomEdge - rect.bottom - 6);
      const above = Math.max(0, rect.top - topEdge - 6);
      const desired = Math.min(320, options.length * 44 + 16 + (options.length > 8 ? 30 : 0));
      const flip = below < Math.min(desired, 160) && above > below;
      const maxHeight = Math.max(44, Math.min(desired, flip ? above : below));
      const width = Math.min(Math.max(rect.width, 180), rightEdge - leftEdge);
      const next = { left: Math.max(leftEdge, Math.min(rect.left, rightEdge - width)), top: flip ? Math.max(topEdge, rect.top - maxHeight - 6) : Math.min(rect.bottom + 6, bottomEdge - maxHeight), width, maxHeight };
      setPosition(previous => previous && Object.keys(next).every(key => previous[key] === next[key]) ? previous : next);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); }
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule); };
  }, [open, options.length]);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId, position?.maxHeight]);
  const activeId = open && options[active] ? `${listId}-option-${active}` : undefined;
  return <span className={`select-control ${className}`}>
    <button {...props} ref={trigger} id={triggerId} type="button" className="select-trigger" role="combobox" aria-haspopup="listbox" aria-controls={listId} aria-expanded={open} aria-activedescendant={activeId} aria-required={required || undefined} aria-invalid={invalid || props["aria-invalid"] || undefined} disabled={disabled} autoFocus={autoFocus} onClick={() => open ? close() : reveal()} onKeyDown={keydown} onFocus={onFocus} onBlur={event => { onBlur?.(event); if (!popup.current?.contains(event.relatedTarget)) close(); }}>
      <span className="select-value">{options[selected]?.label || "Select an option"}</span><ChevronDown className="select-chevron" size={16} strokeWidth={1.8} aria-hidden="true"/>
    </button>
    <select ref={native} className="select-native" tabIndex={-1} aria-hidden="true" id={`${triggerId}-native`} name={name} value={chosenValue} disabled={disabled} required={required} form={form} onChange={event => { setInvalid(!event.target.validity.valid); if (value === undefined) setInternalValue(event.target.value); onChange?.(event); }} onInvalid={event => { event.preventDefault(); setInvalid(true); onInvalid?.(event); trigger.current?.focus(); reveal(); }}>{children}</select>
    {open && createPortal(<div ref={popup} className="select-popup" style={{ position: "fixed", ...position, visibility: position ? "visible" : "hidden" }} onMouseDown={event => event.preventDefault()}>
      {invalid && <div className="select-validation-hint" role="alert">Choose an option to continue.</div>}
      {options.length > 8 && <div className="select-typeahead-hint" aria-hidden="true">Type to find an option</div>}
      <div role="listbox" id={listId} aria-labelledby={triggerId} className="select-options">{options.map((option, index) => <Fragment key={`${option.value}-${index}`}>
        {option.group && (index === 0 || options[index - 1].group !== option.group) && <div className="select-option-group" aria-hidden="true">{option.group}</div>}
        <div id={`${listId}-option-${index}`} className={`select-option ${active === index ? "is-active" : ""}`} role="option" aria-selected={option.value === chosenValue} aria-disabled={option.disabled || undefined} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}><span>{option.label}</span>{option.value === chosenValue && <Check size={16} strokeWidth={2} aria-hidden="true"/>}</div>
      </Fragment>)}</div>
    </div>, trigger.current?.closest("dialog") || document.body)}
  </span>;
}
