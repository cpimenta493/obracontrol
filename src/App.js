import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { ref, onValue, set, off } from "firebase/database";

function genId() { return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

function useFirebase(path, fallback) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const r = ref(db, path);
    const unsub = onValue(r, snapshot => {
      const val = snapshot.val();
      setData(val !== null ? val : fallback);
      setLoading(false);
    });
    return () => off(r, "value", unsub);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  const save = useCallback((newData) => {
    setData(newData);
    set(ref(db, path), newData).catch(console.error);
  }, [path]);
  return [data ?? fallback, save, loading];
}

const INITIAL_TEMPLATE = [
  { id: "t1", text: "Quadro elétrico instalado" },
  { id: "t2", text: "Tubagem embutida" },
  { id: "t3", text: "Fiação passada" },
  { id: "t4", text: "Tomadas instaladas" },
  { id: "t5", text: "Interruptores instalados" },
  { id: "t6", text: "Iluminação instalada" },
  { id: "t7", text: "Teste de continuidade" },
  { id: "t8", text: "Inspeção final" },
];

function makeChecklist(template) {
  return template.map(t => ({ id: genId(), text: t.text, status: "pending", obs: "" }));
}

const DEFAULT_ROOMS = [{ id: "room0", name: "Sala Principal", material: "", obs: "", checklist: makeChecklist(INITIAL_TEMPLATE), expanded: false }];
const DEFAULT_TASKS = [];
const PRIORITIES = [{ label: "Alta", value: "alta", color: "#ef4444" }, { label: "Média", value: "media", color: "#f59e0b" }, { label: "Baixa", value: "baixa", color: "#22c55e" }];
const STATUS = {
  pending:    { label: "Pendente",   color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", icon: null },
  done:       { label: "Concluído",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "✓" },
  incomplete: { label: "Incompleto", color: "#dc2626", bg: "#fff1f2", border: "#fecaca", icon: "!" },
};

function ChecklistItem({ item, onChange, onRemove }) {
  const [showObs, setShowObs] = useState(item.status === "incomplete");
  const st = STATUS[item.status] || STATUS.pending;
  function cycleStatus() {
    const next = item.status === "pending" ? "done" : item.status === "done" ? "incomplete" : "pending";
    onChange({ ...item, status: next, obs: next !== "incomplete" ? "" : item.obs });
    setShowObs(next === "incomplete");
  }
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${st.border}`, background: st.bg, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
        <button onClick={cycleStatus} style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, padding: 0, border: `2px solid ${st.color}`, background: item.status === "pending" ? "#fff" : st.color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff" }}>
          {item.status !== "pending" && st.icon}
        </button>
        <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 500, color: item.status === "done" ? "#16a34a" : item.status === "incomplete" ? "#dc2626" : "#475569", textDecoration: item.status === "done" ? "line-through" : "none" }}>{item.text}</span>
        <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: st.color, background: st.color + "18", flexShrink: 0 }}>{st.label}</span>
        {item.status !== "incomplete" && (
          <button onClick={() => { onChange({ ...item, status: "incomplete" }); setShowObs(true); }} style={{ padding: "3px 8px", border: "1.5px solid #fecaca", borderRadius: 7, background: "transparent", cursor: "pointer", fontSize: 11, color: "#dc2626", fontFamily: "'Sora',sans-serif", fontWeight: 700, flexShrink: 0 }}>!</button>
        )}
        {item.status === "incomplete" && (
          <button onClick={() => setShowObs(v => !v)} style={{ padding: "3px 8px", border: "1.5px solid #fecaca", borderRadius: 7, background: showObs ? "#fecaca" : "transparent", cursor: "pointer", fontSize: 11, color: "#dc2626", fontFamily: "'Sora',sans-serif", fontWeight: 700, flexShrink: 0 }}>💬</button>
        )}
        <button onClick={onRemove} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✕</button>
      </div>
      {item.status === "incomplete" && showObs && (
        <div style={{ padding: "0 12px 10px", borderTop: "1px solid #fecaca" }}>
          <input placeholder="Motivo / observação do problema…" value={item.obs || ""} onChange={e => onChange({ ...item, obs: e.target.value })} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "7px 12px", border: "1.5px solid #fecaca", borderRadius: 8, fontFamily: "'Sora',sans-serif", fontSize: 13, background: "#fff7f7", color: "#7f1d1d", outline: "none" }} />
          {item.obs && <div style={{ marginTop: 5, fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#dc2626", fontStyle: "italic" }}>⚠️ {item.obs}</div>}
        </div>
      )}
    </div>
  );
}

function Checklist({ checklist, onUpdate }) {
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  function updateItem(id, updated) { onUpdate(checklist.map(c => c.id === id ? updated : c)); }
  function removeItem(id) { onUpdate(checklist.filter(c => c.id !== id)); }
  function addItem() {
    if (!newText.trim()) return;
    onUpdate([...checklist, { id: genId(), text: newText.trim(), status: "pending", obs: "" }]);
    setNewText(""); setAdding(false);
  }
  const done = checklist.filter(c => c.status === "done").length;
  const incomplete = checklist.filter(c => c.status === "incomplete").length;
  const total = checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allGood = total > 0 && done === total;
  return (
    <div style={{ padding: "0 20px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: allGood ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#6366f1,#4f46e5)", borderRadius: 99, transition: "width 0.4s" }} />
          {incomplete > 0 && <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${Math.round((incomplete / total) * 100)}%`, background: "#ef4444", opacity: 0.7 }} />}
        </div>
        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, minWidth: 60, textAlign: "right", color: allGood ? "#22c55e" : incomplete > 0 ? "#dc2626" : "#6366f1" }}>{done}/{total}{incomplete > 0 ? ` · ${incomplete}⚠` : allGood ? " ✓" : ""}</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {[{ color: "#6366f1", label: `${done} concluído(s)` }, { color: "#ef4444", label: `${incomplete} incompleto(s)` }, { color: "#94a3b8", label: `${total - done - incomplete} pendente(s)` }].map(l => (
          <span key={l.label} style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: l.color, fontWeight: 600 }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: l.color, marginRight: 4 }} />{l.label}</span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {checklist.map(item => (<ChecklistItem key={item.id} item={item} onChange={u => updateItem(item.id, u)} onRemove={() => removeItem(item.id)} />))}
      </div>
      {adding ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input autoFocus value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAdding(false); }} placeholder="Novo ponto de verificação…" style={{ ...S.input, flex: 1, fontSize: 13 }} />
          <button onClick={addItem} style={{ ...S.btnPrimary, padding: "8px 14px", fontSize: 13 }}>Adicionar</button>
          <button onClick={() => setAdding(false)} style={{ ...S.btnGhost, padding: "8px 12px", fontSize: 13 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 10, background: "transparent", border: "1.5px dashed #cbd5e1", borderRadius: 9, padding: "7px 14px", cursor: "pointer", color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, width: "100%", textAlign: "left" }}>+ Adicionar ponto</button>
      )}
    </div>
  );
}

function SettingsModal({ template, onSave, onClose }) {
  const [items, setItems] = useState(template.map(t => ({ ...t })));
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  function toggleItem(id) { setItems(items.map(i => i.id === id ? { ...i, disabled: !i.disabled } : i)); }
  function removeItem(id) { setItems(items.filter(i => i.id !== id)); }
  function addItem() { if (!newText.trim()) return; setItems([...items, { id: genId(), text: newText.trim() }]); setNewText(""); setAdding(false); }
  function moveUp(idx) { if (idx === 0) return; const a = [...items]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; setItems(a); }
  function moveDown(idx) { if (idx === items.length-1) return; const a = [...items]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; setItems(a); }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#1e293b", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "'Sora',sans-serif" }}>Configurações da Checklist</div>
              <div style={{ color: "#64748b", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>Define os pontos padrão para novas salas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          <div style={{ marginBottom: 12, fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#64748b" }}>Ativa/desativa e reordena os pontos que aparecerão nas novas salas.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${item.disabled ? "#f1f5f9" : "#c7d2fe"}`, background: item.disabled ? "#f8fafc" : "#eef2ff" }}>
                <button onClick={() => toggleItem(item.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, padding: 0, border: `2px solid ${item.disabled ? "#cbd5e1" : "#6366f1"}`, background: item.disabled ? "#fff" : "#6366f1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!item.disabled && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 500, color: item.disabled ? "#94a3b8" : "#1e293b", textDecoration: item.disabled ? "line-through" : "none" }}>{item.text}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ background: "transparent", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#e2e8f0" : "#94a3b8", fontSize: 11, padding: "1px 3px" }}>▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === items.length-1} style={{ background: "transparent", border: "none", cursor: idx === items.length-1 ? "default" : "pointer", color: idx === items.length-1 ? "#e2e8f0" : "#94a3b8", fontSize: 11, padding: "1px 3px" }}>▼</button>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fca5a5", fontSize: 14, padding: "0 2px" }}>🗑</button>
              </div>
            ))}
          </div>
          {adding ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input autoFocus value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAdding(false); }} placeholder="Novo ponto da checklist…" style={{ ...S.input, flex: 1, fontSize: 13 }} />
              <button onClick={addItem} style={{ ...S.btnPrimary, padding: "8px 14px", fontSize: 13 }}>Adicionar</button>
              <button onClick={() => setAdding(false)} style={{ ...S.btnGhost, padding: "8px 12px", fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ marginTop: 12, background: "transparent", border: "1.5px dashed #a5b4fc", borderRadius: 9, padding: "8px 14px", cursor: "pointer", color: "#6366f1", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, width: "100%", textAlign: "left" }}>+ Novo ponto de template</button>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1.5px solid #e2e8f0", display: "flex", gap: 10, background: "#f8fafc" }}>
          <button onClick={() => onSave(items.filter(i => !i.disabled))} style={S.btnPrimary}>✓ Guardar configuração</button>
          <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
          <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>{items.filter(i => !i.disabled).length} ponto(s) ativos</span>
        </div>
      </div>
    </div>
  );
}

function MaterialTab() {
  const [rooms, setRooms, roomsLoading] = useFirebase("rooms", DEFAULT_ROOMS);
  const [template, setTemplate, tplLoading] = useFirebase("template", INITIAL_TEMPLATE);
  const [editing, setEditing] = useState(null);
  const [newRoom, setNewRoom] = useState({ name: "", material: "", obs: "" });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const loading = roomsLoading || tplLoading;
  const filtered = (rooms || []).filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || (r.material || "").toLowerCase().includes(search.toLowerCase()));
  function saveEdit(id, field, val) { setRooms(rooms.map(r => r.id === id ? { ...r, [field]: val } : r)); }
  function deleteRoom(id) { setRooms(rooms.filter(r => r.id !== id)); }
  function addRoom() {
    if (!newRoom.name.trim()) return;
    setRooms([...rooms, { ...newRoom, id: genId(), checklist: makeChecklist(template), expanded: true }]);
    setNewRoom({ name: "", material: "", obs: "" }); setAdding(false);
  }
  function toggleExpand(id) { setRooms(rooms.map(r => r.id === id ? { ...r, expanded: !r.expanded } : r)); }
  function updateChecklist(id, cl) { setRooms(rooms.map(r => r.id === id ? { ...r, checklist: cl } : r)); }
  const totalItems = (rooms || []).reduce((a, r) => a + (r.checklist?.length || 0), 0);
  const doneItems = (rooms || []).reduce((a, r) => a + (r.checklist?.filter(c => c.status === "done").length || 0), 0);
  const incItems = (rooms || []).reduce((a, r) => a + (r.checklist?.filter(c => c.status === "incomplete").length || 0), 0);
  const globalPct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>
      <div style={{ width: 24, height: 24, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      A sincronizar com a cloud…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showSettings && <SettingsModal template={template} onSave={t => { setTemplate(t); setShowSettings(false); }} onClose={() => setShowSettings(false)} />}
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26 }}>⚡</span>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'Sora',sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Progresso Elétrico Global</div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, fontFamily: "'Sora',sans-serif" }}>{doneItems} / {totalItems} itens</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ height: 10, background: "#334155", borderRadius: 99, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${globalPct}%`, background: "linear-gradient(90deg,#6366f1,#22c55e)", borderRadius: 99, transition: "width 0.5s" }} />
              {incItems > 0 && <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${Math.round((incItems / totalItems) * 100)}%`, background: "#ef4444", opacity: 0.8 }} />}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <span style={{ color: "#64748b", fontSize: 12, fontFamily: "'Sora',sans-serif", fontWeight: 600 }}>{globalPct}% concluído</span>
              {incItems > 0 && <span style={{ color: "#ef4444", fontSize: 12, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>⚠️ {incItems} incompleto(s)</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px #14532d44", animation: "pulse 2s infinite" }} />
            <span style={{ color: "#22c55e", fontSize: 11, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>LIVE</span>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 Pesquisar sala ou material…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 180 }} />
        <button onClick={() => setShowSettings(true)} style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #c7d2fe", color: "#6366f1" }}>⚙️ Configurar checklist</button>
        <button onClick={() => setAdding(true)} style={S.btnPrimary}>+ Nova Sala</button>
      </div>
      <div style={{ background: "#eef2ff", border: "1.5px solid #c7d2fe", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: "#6366f1" }}>Template atual:</span>
        {template.length === 0 ? <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#94a3b8" }}>Nenhum ponto configurado</span> : template.map(t => <span key={t.id} style={{ padding: "2px 10px", borderRadius: 99, background: "#c7d2fe", color: "#4338ca", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600 }}>{t.text}</span>)}
      </div>
      {adding && (
        <div style={S.card}>
          <div style={S.cardHeader}>Nova Sala</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "16px 20px" }}>
            <div style={{ gridColumn: "1/-1" }}><label style={S.label}>Nome da Sala *</label><input value={newRoom.name} onChange={e => setNewRoom(n => ({ ...n, name: e.target.value }))} style={S.input} placeholder="Ex: Quarto 3" /></div>
            <div><label style={S.label}>Material Utilizado</label><input value={newRoom.material} onChange={e => setNewRoom(n => ({ ...n, material: e.target.value }))} style={S.input} placeholder="Ex: Cabo 1.5mm…" /></div>
            <div><label style={S.label}>Observações</label><input value={newRoom.obs} onChange={e => setNewRoom(n => ({ ...n, obs: e.target.value }))} style={S.input} placeholder="Notas…" /></div>
          </div>
          <div style={{ padding: "0 20px 4px", color: "#6366f1", fontSize: 12, fontFamily: "'Sora',sans-serif", fontWeight: 600 }}>✓ Serão adicionados {template.length} ponto(s) da checklist configurada.</div>
          <div style={{ display: "flex", gap: 10, padding: "12px 20px 16px" }}>
            <button onClick={addRoom} style={S.btnPrimary}>Guardar</button>
            <button onClick={() => setAdding(false)} style={S.btnGhost}>Cancelar</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Nenhuma sala encontrada.</div>}
        {filtered.map(room => {
          const cl = room.checklist || [];
          const done = cl.filter(c => c.status === "done").length;
          const incomplete = cl.filter(c => c.status === "incomplete").length;
          const total = cl.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const allDone = total > 0 && done === total;
          const hasIssues = incomplete > 0;
          return (
            <div key={room.id} style={{ ...S.card, border: hasIssues ? "1.5px solid #fecaca" : allDone ? "1.5px solid #bbf7d0" : "1.5px solid #e2e8f0" }}>
              <div onClick={() => toggleExpand(room.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: hasIssues ? "#fff1f2" : allDone ? "#f0fdf4" : "#f8fafc", borderBottom: room.expanded ? "1.5px solid #e2e8f0" : "none", cursor: "pointer", userSelect: "none" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, background: hasIssues ? "#ef4444" : allDone ? "#22c55e" : pct > 0 ? "#f59e0b" : "#e2e8f0", boxShadow: hasIssues ? "0 0 0 3px #fecaca" : allDone ? "0 0 0 3px #dcfce7" : "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{room.name}</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 3 }}>
                    {room.material && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#64748b" }}>📦 {room.material}</span>}
                    {room.obs && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#94a3b8" }}>💬 {room.obs}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {hasIssues && <span style={{ padding: "3px 10px", borderRadius: 99, background: "#fee2e2", color: "#dc2626", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700 }}>⚠️ {incomplete} incompleto(s)</span>}
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, background: hasIssues ? "#fee2e2" : allDone ? "#dcfce7" : pct > 0 ? "#fef3c7" : "#f1f5f9", color: hasIssues ? "#dc2626" : allDone ? "#16a34a" : pct > 0 ? "#d97706" : "#94a3b8" }}>⚡ {done}/{total}</span>
                  <button onClick={e => { e.stopPropagation(); setEditing(editing === room.id ? null : room.id); }} style={{ ...S.btnSmall, background: "transparent", border: "none" }}>✏️</button>
                  <button onClick={e => { e.stopPropagation(); deleteRoom(room.id); }} style={{ ...S.btnSmall, background: "transparent", border: "none", color: "#ef4444" }}>🗑</button>
                  <span style={{ color: "#94a3b8", fontSize: 12, transition: "transform 0.25s", transform: room.expanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
                </div>
              </div>
              {room.expanded && (
                <>
                  {editing === room.id && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 20px", background: "#fff", borderBottom: "1px solid #f1f5f9" }}>
                      <div><label style={S.label}>Nome da Sala</label><input defaultValue={room.name} onBlur={e => saveEdit(room.id, "name", e.target.value)} style={{ ...S.input, fontSize: 13 }} /></div>
                      <div />
                      <div><label style={S.label}>Material Utilizado</label><input defaultValue={room.material} onBlur={e => saveEdit(room.id, "material", e.target.value)} style={{ ...S.input, fontSize: 13 }} /></div>
                      <div><label style={S.label}>Observações</label><input defaultValue={room.obs} onBlur={e => saveEdit(room.id, "obs", e.target.value)} style={{ ...S.input, fontSize: 13 }} /></div>
                      <div style={{ gridColumn: "1/-1" }}><button onClick={() => setEditing(null)} style={{ ...S.btnPrimary, fontSize: 13, padding: "8px 18px" }}>✓ Guardar</button></div>
                    </div>
                  )}
                  <div style={{ padding: "16px 20px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 15 }}>⚡</span>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#1e293b" }}>Checklist Elétrica</span>
                      <span style={{ marginLeft: "auto", fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Clica no quadrado para mudar estado</span>
                    </div>
                  </div>
                  <Checklist checklist={cl} onUpdate={cl => updateChecklist(room.id, cl)} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: "'Sora',sans-serif" }}>{filtered.length} sala(s) · Dados sincronizados em tempo real</div>
    </div>
  );
}

function TasksTab() {
  const [tasks, setTasks, loading] = useFirebase("tasks", DEFAULT_TASKS);
  const [newTask, setNewTask] = useState({ text: "", priority: "media", date: "" });
  const [filter, setFilter] = useState("todas");
  function addTask() {
    if (!newTask.text.trim()) return;
    setTasks([{ ...newTask, id: genId(), done: false }, ...(tasks || [])]);
    setNewTask({ text: "", priority: "media", date: "" });
  }
  function toggleDone(id) { setTasks((tasks || []).map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function deleteTask(id) { setTasks((tasks || []).filter(t => t.id !== id)); }
  const allTasks = tasks || [];
  const filtered = allTasks.filter(t => { if (filter === "pendentes") return !t.done; if (filter === "concluídas") return t.done; return true; });
  const counts = { total: allTasks.length, done: allTasks.filter(t => t.done).length };
  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[{ label: "Total", val: counts.total, color: "#6366f1" }, { label: "Pendentes", val: counts.total - counts.done, color: "#f59e0b" }, { label: "Concluídas", val: counts.done, color: "#22c55e" }].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 20px", display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Sora',sans-serif" }}>{s.val}</span>
            <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>{s.label}</span>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 180, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%`, background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 99, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: "#22c55e", fontSize: 14 }}>{counts.total ? Math.round((counts.done / counts.total) * 100) : 0}%</span>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}>Nova Tarefa</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "16px 20px" }}>
          <input placeholder="Descrição da tarefa…" value={newTask.text} onChange={e => setNewTask(n => ({ ...n, text: e.target.value }))} onKeyDown={e => e.key === "Enter" && addTask()} style={S.input} />
          <select value={newTask.priority} onChange={e => setNewTask(n => ({ ...n, priority: e.target.value }))} style={S.input}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input type="date" value={newTask.date} onChange={e => setNewTask(n => ({ ...n, date: e.target.value }))} style={S.input} />
        </div>
        <div style={{ padding: "0 20px 16px" }}><button onClick={addTask} style={S.btnPrimary}>+ Adicionar Tarefa</button></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {["todas", "pendentes", "concluídas"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...S.btnGhost, background: filter === f ? "#1e293b" : "transparent", color: filter === f ? "#fff" : "#64748b", textTransform: "capitalize" }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Nenhuma tarefa.</div>}
        {filtered.map(task => {
          const pri = PRIORITIES.find(p => p.value === task.priority);
          return (
            <div key={task.id} style={{ ...S.card, padding: 0, opacity: task.done ? 0.65 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
                <button onClick={() => toggleDone(task.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2.5px solid ${task.done ? "#22c55e" : "#cbd5e1"}`, background: task.done ? "#22c55e" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {task.done && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 500, color: "#1e293b", textDecoration: task.done ? "line-through" : "none", fontSize: 15 }}>{task.text}</span>
                <span style={{ padding: "3px 10px", borderRadius: 99, background: pri?.color + "22", color: pri?.color, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700 }}>{pri?.label}</span>
                {task.date && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#94a3b8" }}>📅 {task.date}</span>}
                <button onClick={() => deleteTask(task.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("material");
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f0f4ff 0%,#f8fafc 60%,#fff7ed 100%)" }}>
      <div style={{ background: "#1e293b", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🏗️</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: -0.5, fontFamily: "'Sora',sans-serif" }}>ObraControl</div>
              <div style={{ color: "#64748b", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>Gestão de obra · Parte Elétrica</div>
            </div>
          </div>
          <div style={{ color: "#475569", fontSize: 13, fontFamily: "'Sora',sans-serif" }}>{new Date().toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div>
        </div>
      </div>
      <div style={{ background: "#fff", borderBottom: "1.5px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex" }}>
          {[{ key: "material", label: "⚡ Material & Checklist" }, { key: "tasks", label: "✅ Tarefas" }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "16px 28px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, color: tab === t.key ? "#6366f1" : "#94a3b8", borderBottom: tab === t.key ? "2.5px solid #6366f1" : "2.5px solid transparent", transition: "all 0.2s", marginBottom: -1 }}>{t.label}</button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
        {tab === "material" && <MaterialTab />}
        {tab === "tasks" && <TasksTab />}
      </div>
      <div style={{ textAlign: "center", padding: "20px", color: "#cbd5e1", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>ObraControl · Dados sincronizados em tempo real via Firebase</div>
    </div>
  );
}

const S = {
  input: { padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontFamily: "'Sora',sans-serif", fontSize: 14, outline: "none", background: "#f8fafc", color: "#1e293b", width: "100%", boxSizing: "border-box" },
  btnPrimary: { padding: "9px 20px", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14 },
  btnGhost: { padding: "8px 16px", background: "transparent", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13 },
  btnSmall: { padding: "5px 10px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  card: { background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", overflow: "hidden" },
  cardHeader: { padding: "14px 20px", background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", fontWeight: 700, fontSize: 14, color: "#1e293b", fontFamily: "'Sora',sans-serif" },
  label: { display: "block", marginBottom: 6, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
};