import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";

const palette = ["#216e4e", "#9f6b00", "#ae2e24", "#5e4db2", "#0055cc", "#206a83"];
const toggle = (values = [], id) => values.includes(id) ? values.filter(v => v !== id) : [...values, id];
const dayInput = value => value ? new Date(value).toISOString().slice(0, 10) : "";
const timestamp = value => value ? `${value}T12:00:00.000Z` : null;
export function dueState(card) {
  if (card.completed) return "completed";
  if (!card.dueDate) return "none";
  return new Date(card.dueDate) < new Date() ? "overdue" : "upcoming";
}
export function matchesFilters(card, filters) {
  const query = (filters.query || "").toLowerCase().trim();
  return (!query || `${card.title} ${card.description || ""}`.toLowerCase().includes(query)) &&
    (!filters.labelIds?.length || filters.labelIds.every(id => card.labelIds?.includes(id))) &&
    (!filters.assigneeIds?.length || filters.assigneeIds.every(id => card.assigneeIds?.includes(id))) &&
    (!filters.due || (filters.due === "upcoming" ? !card.completed && !!card.dueDate && new Date(card.dueDate) >= new Date() && new Date(card.dueDate) <= new Date(Date.now() + 7 * 86400000) : dueState(card) === filters.due));
}
function Entry({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function InlineForm({ label, onSubmit, busy, multiline = false }) {
  const [text, setText] = useState("");
  return <form className="inline-entry" onSubmit={async e => { e.preventDefault(); if (await onSubmit(text)) setText(""); }}>
    {multiline ? <textarea aria-label={label} placeholder={label} required value={text} maxLength={5000} onChange={e => setText(e.target.value)} rows={3} /> :
      <input aria-label={label} placeholder={label} required value={text} maxLength={200} onChange={e => setText(e.target.value)} />}
    <button disabled={busy || !text.trim()}>Add</button>
  </form>;
}
export function CardBadges({ card, labels, members }) {
  const state = dueState(card);
  return <>
    {card.coverColor && <span className="card-cover" style={{background: card.coverColor}} />}
    {card.labelIds?.length > 0 && <span className="card-labels">{labels.filter(l => card.labelIds.includes(l.id)).map(l => <span className="label-chip" key={l.id} style={{background:l.color}}>{l.name}</span>)}</span>}
    <span className={card.completed ? "card-title completed-title" : "card-title"}>{card.title}</span>
    {(card.dueDate || card.completed || card.assigneeIds?.length > 0) && <span className="card-footer">
      {(card.dueDate || card.completed) && <span className={`date-badge ${state}`}>{card.completed ? "Done" : `${state === "overdue" ? "Overdue · " : "Due "}${new Date(card.dueDate).toLocaleDateString(undefined,{month:"short",day:"numeric"})}`}</span>}
      <span className="card-assignees">{members.filter(m => card.assigneeIds?.includes(m.id)).map(m => <span key={m.id} className="avatar tiny" title={m.displayName} aria-label={`Assigned to ${m.displayName}`}>{m.displayName.slice(0,2).toUpperCase()}</span>)}</span>
    </span>}
  </>;
}
export function BoardFilters({ board, members, filters, onChange, onError }) {
  const [views, setViews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  useEffect(() => { let live = true; api(`/boards/${board.id}/views`).then(v => { if(live) setViews(v); }).catch(e => onError(e.message)); return () => {live = false;}; }, [board.id]);
  async function save(e) {
    e.preventDefault(); setBusy(true);
    try { const result = await api(`/boards/${board.id}/views`,{method:"POST",body:{name,filters}}); setViews([...views,result]);setSelected(result.id);setName(""); }
    catch(e) { onError(e.message); } finally {setBusy(false);}
  }
  const change = patch => { onChange({...filters,...patch}); setSelected(""); };
  return <details className="filter-panel"><summary>Filters & saved views <span>{[filters.labelIds?.length,filters.assigneeIds?.length,filters.due ? 1 : 0].reduce((a,b)=>a+(b||0),0) || ""}</span></summary>
    <div className="filter-controls">
      <Entry label="Label"><select value={filters.labelIds?.[0] || ""} onChange={e=>change({labelIds:e.target.value?[e.target.value]:[]})}><option value="">All labels</option>{(board.labels||[]).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Entry>
      <Entry label="Assignee"><select value={filters.assigneeIds?.[0]||""} onChange={e=>change({assigneeIds:e.target.value?[e.target.value]:[]})}><option value="">Anyone</option>{members.map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></Entry>
      <Entry label="Due state"><select value={filters.due||""} onChange={e=>change({due:e.target.value})}><option value="">Any date</option><option value="overdue">Overdue</option><option value="upcoming">Due in next 7 days</option><option value="completed">Completed</option><option value="none">No due date</option></select></Entry>
      <button onClick={()=>{onChange({query:"",labelIds:[],assigneeIds:[],due:""});setSelected("");}}>Clear filters</button>
    </div>
    <div className="saved-view-row"><Entry label="Saved view"><select value={selected} onChange={e=>{setSelected(e.target.value);const v=views.find(v=>v.id===e.target.value);if(v)onChange(v.filters);}}><option value="">Choose a view</option>{views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></Entry>
      {selected && <button disabled={busy} onClick={async()=>{setBusy(true);try{await api(`/views/${selected}`,{method:"DELETE"});setViews(views.filter(v=>v.id!==selected));setSelected("");}catch(e){onError(e.message);}finally{setBusy(false);}}}>Delete view</button>}
      <form className="inline-entry" onSubmit={save}><input aria-label="New view name" placeholder="Name this view" value={name} maxLength={80} required onChange={e=>setName(e.target.value)}/><button disabled={busy||!name.trim()}>Save view</button></form>
    </div>
    <small>Search, label, assignee, and date filters combine. Saved views belong to your account.</small>
  </details>;
}
export function CardEditor({ card, board, boards, members, user, onClose, onRefresh }) {
  const [draft,setDraft] = useState({...card,labelIds:card.labelIds||[],assigneeIds:card.assigneeIds||[]});
  const [detail,setDetail] = useState(null);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [labels,setLabels] = useState(board.labels||[]);
  const [destination,setDestination] = useState(board);
  const [destinationList,setDestinationList] = useState(card.listId);
  const [destinationLoading,setDestinationLoading] = useState(false);
  const [position,setPosition] = useState((board.lists.find(l=>l.id===card.listId)?.cards.filter(c=>!c.archived).sort((a,b)=>a.position-b.position).findIndex(c=>c.id===card.id) ?? 0)+1);
  const [confirm,setConfirm] = useState(false);
  const live = useRef(true);
  useEffect(()=>{live.current=true;api(`/cards/${card.id}`).then(data=>{if(live.current){setDetail(data);setDraft({...data,labelIds:data.labelIds||[],assigneeIds:data.assigneeIds||[]});}}).catch(e=>{if(live.current)setError(e.message);}).finally(()=>{if(live.current)setLoading(false);});return()=>{live.current=false;};},[card.id]);
  const disabled = busy || board.closed || loading;
  async function act(action,{reload=true}={}) {
    if(busy)return false;
    setBusy(true);setError("");setNotice("");
    try { await action(); if(reload) { const data=await api(`/cards/${card.id}`);if(live.current)setDetail(data);await onRefresh(); } return true; }
    catch(e){setError(`${e.message} Your input is preserved. Retry when ready.`);return false;}
    finally{if(live.current)setBusy(false);}
  }
  const change = patch => setDraft(v=>({...v,...patch}));
  async function save(e){e.preventDefault();await act(async()=>{await api(`/cards/${card.id}`,{method:"PATCH",body:{title:draft.title,description:draft.description||"",labelIds:draft.labelIds,assigneeIds:draft.assigneeIds,coverColor:draft.coverColor||null,startDate:draft.startDate||null,dueDate:draft.dueDate||null,completed:!!draft.completed}});setNotice("Card saved.");});}
  async function chooseBoard(id){setDestinationLoading(true);setError("");try{const data=id===board.id?board:await api(`/boards/${id}`);setDestination(data);setDestinationList(data.lists.find(l=>!l.archived)?.id||"");setPosition(1);}catch(e){setError(e.message);}finally{setDestinationLoading(false);}}
  return <div className="card-editor">
    {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
    {loading&&<p role="status">Loading card details...</p>}
    <p className="muted">{board.title} / {board.lists.find(l=>l.id===card.listId)?.title}{card.archived?" / Archived":""}</p>
    {draft.coverColor&&<div className="detail-cover" style={{background:draft.coverColor}} aria-hidden="true"/>}
    <form onSubmit={save}>
      <fieldset disabled={disabled || card.archived} className="editor-fieldset">
        <Entry label="Title"><input required maxLength={200} value={draft.title} onChange={e=>change({title:e.target.value})}/></Entry>
        <Entry label="Description"><textarea rows={4} maxLength={10000} placeholder="Context, ideas, and next steps..." value={draft.description||""} onChange={e=>change({description:e.target.value})}/></Entry>
        <div className="detail-grid">
          <Entry label="Start date (UTC)"><input type="date" value={dayInput(draft.startDate)} onChange={e=>change({startDate:timestamp(e.target.value)})}/></Entry>
          <Entry label="Due date (UTC)"><input type="date" value={dayInput(draft.dueDate)} min={dayInput(draft.startDate)} onChange={e=>change({dueDate:timestamp(e.target.value)})}/></Entry>
        </div>
        <label className="check-option"><input type="checkbox" checked={!!draft.completed} onChange={e=>change({completed:e.target.checked})}/>Mark complete <span className="muted">Completed cards have no overdue warning.</span></label>
        <div className="detail-grid">
          <fieldset className="selection-fieldset"><legend>Labels</legend>{labels.length===0&&<p className="muted">Create your first label below.</p>}{labels.map(l=><label key={l.id} className="check-option"><input type="checkbox" checked={draft.labelIds.includes(l.id)} onChange={()=>change({labelIds:toggle(draft.labelIds,l.id)})}/><span className="label-chip" style={{background:l.color}}>{l.name}</span></label>)}</fieldset>
          <fieldset className="selection-fieldset"><legend>Assignees</legend>{members.map(m=><label key={m.id} className="check-option"><input type="checkbox" checked={draft.assigneeIds.includes(m.id)} onChange={()=>change({assigneeIds:toggle(draft.assigneeIds,m.id)})}/><span className="avatar tiny">{m.displayName.slice(0,2).toUpperCase()}</span>{m.displayName}</label>)}</fieldset>
        </div>
        <Entry label="Card cover"><select value={draft.coverColor||""} onChange={e=>change({coverColor:e.target.value||null})}><option value="">No cover</option>{palette.map(c=><option value={c} key={c}>{({"#216e4e":"Forest","#9f6b00":"Amber","#ae2e24":"Coral","#5e4db2":"Violet","#0055cc":"Ocean","#206a83":"Teal"})[c]}</option>)}</select></Entry>
        <button className="primary">{busy?"Saving...":"Save card"}</button>
      </fieldset>
    </form>
    <details className="detail-section"><summary>Manage board labels</summary><p className="muted">Changes apply to this board. Select labels above, then save the card.</p><form className="label-create" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const form=e.currentTarget;act(async()=>{const label=await api(`/boards/${board.id}/labels`,{method:"POST",body:{name:f.get("name"),color:f.get("color")}});setLabels([...labels,label]);form.reset();});}}><input aria-label="Label name" name="name" placeholder="Label name" required maxLength={80}/><select name="color" aria-label="Label color">{palette.map((c,i)=><option key={c} value={c}>{["Forest","Amber","Coral","Violet","Ocean","Teal"][i]}</option>)}</select><button disabled={disabled}>Create label</button></form>
      {labels.map(l=><LabelEditor key={l.id} label={l} disabled={disabled} onSave={(name,color)=>act(async()=>{const result=await api(`/labels/${l.id}`,{method:"PATCH",body:{name,color}});setLabels(labels.map(v=>v.id===l.id?result:v));})} onDelete={()=>act(async()=>{await api(`/labels/${l.id}`,{method:"DELETE"});setLabels(labels.filter(v=>v.id!==l.id));change({labelIds:draft.labelIds.filter(id=>id!==l.id)});})}/>)}
    </details>
    <section className="detail-section"><h3>Checklists</h3>{detail?.checklists?.map(list=><Checklist key={list.id} list={list} disabled={disabled || card.archived} act={act}/>)}<InlineForm label="New checklist title" busy={disabled || card.archived} onSubmit={title=>act(()=>api(`/cards/${card.id}/checklists`,{method:"POST",body:{title}}))}/></section>
    <section className="detail-section"><h3>Comments</h3><p className="muted">Share context with teammates. Mention notifications are planned separately.</p>{detail?.comments?.length===0&&<p className="muted">Start a conversation. Share context with your team.</p>}{detail?.comments?.map(c=><Comment key={c.id} comment={c} user={user} disabled={disabled || card.archived} act={act}/>)}<InlineForm label="Write a comment" multiline busy={disabled || card.archived} onSubmit={body=>act(()=>api(`/cards/${card.id}/comments`,{method:"POST",body:{body}}))}/></section>
    <details className="detail-section"><summary>Activity history</summary><ol className="activity-list">{detail?.activity?.map(a=><li key={a.id}><strong>{a.displayName||"A teammate"}</strong> {a.action.replaceAll("_"," ")}<time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString()}</time></li>)}</ol>{detail?.activity?.length===0&&<p className="muted">No activity recorded yet.</p>}</details>
    <section className="detail-section"><h3>Move or copy card</h3><div className="detail-grid"><Entry label="Board"><select value={destination.id} disabled={disabled||destinationLoading} onChange={e=>chooseBoard(e.target.value)}>{boards.filter(b=>!b.closed).map(b=><option value={b.id} key={b.id}>{b.title}</option>)}</select></Entry><Entry label="List"><select value={destinationList} disabled={disabled||destinationLoading} onChange={e=>{setDestinationList(e.target.value);setPosition(1);}}>{destination.lists.filter(l=>!l.archived).map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select></Entry></div>
      {destination.id!==board.id&&<p className="muted">Moving to another board clears this board's labels. Only permitted assignees remain.</p>}
      <Entry label="Position in list"><input type="number" min="1" max={(destination.lists.find(l=>l.id===destinationList)?.cards.filter(c=>!c.archived).length||0)+1} value={position} onChange={e=>setPosition(e.target.value)} disabled={disabled}/></Entry><p className="muted">Choose a position to move without dragging. Copies are placed at the end.</p><div className="form-actions"><button disabled={disabled||destinationLoading||!destinationList||card.archived} onClick={()=>act(async()=>{await api(`/cards/${card.id}/move`,{method:"POST",body:{listId:destinationList,position:Math.max(0,Number(position)-1)}});await onRefresh();onClose();},{reload:false})}>Move card</button><button disabled={disabled||destinationLoading||!destinationList||card.archived} onClick={()=>act(async()=>{await api(`/cards/${card.id}/copy`,{method:"POST",body:{listId:destinationList}});await onRefresh();setNotice("Independent card copy created.");},{reload:false})}>Copy card</button><button onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/cards/${card.id}`);setNotice("Card link copied.");}catch{setError("Copy the card link from your browser address bar.");}}}>Copy link</button></div>
    </section>
    <section className="detail-section"><h3>Archive</h3><p className="muted">Archived cards remain available in the board archive.</p><button disabled={disabled} onClick={()=>act(async()=>{await api(`/cards/${card.id}`,{method:"PATCH",body:{archived:!card.archived}});await onRefresh();onClose();},{reload:false})}>{card.archived?"Restore card":"Archive card"}</button>{card.archived&&<button className="danger" disabled={disabled} onClick={()=>setConfirm(true)}>Delete permanently</button>}
      {confirm&&<div className="confirm-box" role="alert"><p>Permanently delete this card and its comments and checklists? This cannot be undone.</p><button className="danger" disabled={disabled} onClick={()=>act(async()=>{await api(`/cards/${card.id}`,{method:"DELETE",body:{confirm:true}});await onRefresh();onClose();},{reload:false})}>Yes, delete card</button><button onClick={()=>setConfirm(false)}>Keep card</button></div>}
    </section>
  </div>;
}
function LabelEditor({label,disabled,onSave,onDelete}) {
  const [name,setName]=useState(label.name);const [color,setColor]=useState(label.color);const [confirm,setConfirm]=useState(false);
  return <div className="label-edit-row"><form className="inline-entry" onSubmit={e=>{e.preventDefault();onSave(name,color);}}><input aria-label={`Rename label ${label.name}`} required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/><select aria-label={`Color for ${label.name}`} value={color} onChange={e=>setColor(e.target.value)}>{palette.map((c,i)=><option key={c} value={c}>{["Forest","Amber","Coral","Violet","Ocean","Teal"][i]}</option>)}</select><button disabled={disabled}>Save</button></form><button className="text-button" disabled={disabled} onClick={()=>setConfirm(!confirm)}>{confirm?"Cancel":"Delete"}</button>{confirm&&<button className="danger" disabled={disabled} onClick={onDelete}>Remove from all cards</button>}</div>;
}
function Checklist({list,disabled,act}) {
  const done=list.items.filter(i=>i.completed).length;
  return <div className="checklist"><header><h4>{list.title}</h4><span>{done}/{list.items.length}</span><button className="text-button" disabled={disabled} onClick={()=>act(()=>api(`/checklists/${list.id}`,{method:"DELETE"}))}>Remove checklist</button></header><progress max={list.items.length||1} value={done} aria-label={`${list.title}: ${done} of ${list.items.length} completed`}/>{list.items.map((item,index)=><div className="checklist-item" key={item.id}><label className="check-option"><input type="checkbox" disabled={disabled} checked={item.completed} onChange={e=>act(()=>api(`/checklist-items/${item.id}`,{method:"PATCH",body:{completed:e.target.checked}}))}/><span className={item.completed?"completed-title":""}>{item.title}</span></label><button aria-label={`Move ${item.title} up`} disabled={disabled||index===0} onClick={()=>act(()=>api(`/checklist-items/${item.id}`,{method:"PATCH",body:{position:index-1}}))}>↑</button><button aria-label={`Move ${item.title} down`} disabled={disabled||index===list.items.length-1} onClick={()=>act(()=>api(`/checklist-items/${item.id}`,{method:"PATCH",body:{position:index+1}}))}>↓</button><button aria-label={`Remove ${item.title}`} disabled={disabled} onClick={()=>act(()=>api(`/checklist-items/${item.id}`,{method:"DELETE"}))}>×</button></div>)}<InlineForm label={`Add item to ${list.title}`} busy={disabled} onSubmit={title=>act(()=>api(`/checklists/${list.id}/items`,{method:"POST",body:{title}}))}/></div>;
}
function Comment({comment,user,disabled,act}) {
  const [editing,setEditing]=useState(false);const [text,setText]=useState(comment.body);
  return <article className="comment"><header><span className="avatar tiny">{comment.displayName?.slice(0,2).toUpperCase()}</span><strong>{comment.displayName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}{comment.updatedAt!==comment.createdAt?" (edited)":""}</time></header>{editing?<form onSubmit={async e=>{e.preventDefault();if(await act(()=>api(`/comments/${comment.id}`,{method:"PATCH",body:{body:text}})))setEditing(false);}}><textarea aria-label="Edit comment" required maxLength={5000} rows={3} value={text} onChange={e=>setText(e.target.value)}/><div className="form-actions"><button disabled={disabled}>Save comment</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button></div></form>:<p>{comment.body}</p>}{comment.userId===user.id&&!editing&&<div className="comment-actions"><button className="text-button" disabled={disabled} onClick={()=>setEditing(true)}>Edit</button><button className="text-button" disabled={disabled} onClick={()=>act(()=>api(`/comments/${comment.id}`,{method:"DELETE"}))}>Delete</button></div>}</article>;
}
export function OwnershipTransfer({workspace,members,onTransferred,busy,onTransfer}) {
  const [target,setTarget]=useState("");const [confirm,setConfirm]=useState(false);
  if(workspace?.role!=="owner")return null;
  return <section className="ownership-panel"><h3>Workspace ownership</h3><p className="muted">Transfer ownership to an existing member. You will remain a member.</p><Entry label="New owner"><select value={target} onChange={e=>{setTarget(e.target.value);setConfirm(false);}}><option value="">Choose a member</option>{members.filter(m=>m.role!=="owner").map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></Entry>{!confirm?<button disabled={busy||!target} onClick={()=>setConfirm(true)}>Review transfer</button>:<div className="confirm-box"><p>Transfer ownership to {members.find(m=>m.id===target)?.displayName}?</p><button disabled={busy} onClick={()=>onTransfer(async()=>{await api(`/workspaces/${workspace.id}/transfer`,{method:"POST",body:{userId:target}});await onTransferred();setConfirm(false);})}>Confirm transfer</button><button onClick={()=>setConfirm(false)}>Cancel</button></div>}</section>;
}
