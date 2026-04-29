import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, set, off } from "firebase/database";

const CLOUDINARY_CLOUD = "dixjslg0s";
const CLOUDINARY_PRESET = "obracontrol";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;

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
  }, [path]);
  const save = useCallback((nd) => { setData(nd); set(ref(db, path), nd).catch(console.error); }, [path]);
  return [data ?? fallback, save, loading];
}

function ConfirmDeleteBtn({ label = "🗑", message = "Tens a certeza?", onConfirm, style: extraStyle }) {
  const [pending, setPending] = useState(false);
  if (pending) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button onClick={() => { setPending(false); onConfirm(); }} style={{ padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700 }}>Sim</button>
      <button onClick={() => setPending(false)} style={{ padding: "3px 8px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700 }}>Não</button>
    </span>
  );
  return <button onClick={() => setPending(true)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fca5a5", fontSize: 14, padding: "0 2px", lineHeight: 1, ...extraStyle }} title={message}>{label}</button>;
}

async function uploadToCloudinary(file, folder) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  fd.append("folder", folder);
  const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: fd });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { url: data.secure_url, publicId: data.public_id };
}

function PhotoUploader({ photos = [], onUpdate, folder, label = "Adicionar foto" }) {
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  async function handleFiles(files) {
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const result = await uploadToCloudinary(file, folder);
        uploaded.push({ id: genId(), url: result.url, publicId: result.publicId, caption: "", uploadedAt: new Date().toISOString() });
      }
      onUpdate([...photos, ...uploaded]);
    } catch (e) { alert("Erro ao fazer upload: " + e.message); }
    finally { setUploading(false); }
  }
  function removePhoto(id) { onUpdate(photos.filter(p => p.id !== id)); }
  function updateCaption(id, caption) { onUpdate(photos.map(p => p.id === id ? { ...p, caption } : p)); }
  return (
    <div style={{ padding: "0 16px 14px" }}>
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1.5px solid #e2e8f0" }}>
              <img src={photo.url} alt={photo.caption || "foto"} onClick={() => setLightbox(photo)} style={{ width: "100%", height: 80, objectFit: "cover", cursor: "pointer", display: "block" }} />
              <div style={{ padding: "4px 6px", background: "#fff" }}>
                <input value={photo.caption || ""} onChange={e => updateCaption(photo.id, e.target.value)} placeholder="Legenda…" style={{ width: "100%", border: "none", outline: "none", fontSize: 10, fontFamily: "'Sora',sans-serif", color: "#64748b", background: "transparent", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => removePhoto(photo.id)} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: uploading ? "#f1f5f9" : "transparent", border: `1.5px ${uploading ? "solid #e2e8f0" : "dashed #a5b4fc"}`, borderRadius: 9, cursor: uploading ? "default" : "pointer", color: uploading ? "#94a3b8" : "#6366f1", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600 }}>
        <input type="file" accept="image/*" multiple disabled={uploading} onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
        {uploading ? "⏳ A carregar…" : `📷 ${label}`}
      </label>
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.caption || "foto"} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
          {lightbox.caption && <div style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, marginTop: 12 }}>{lightbox.caption}</div>}
          <button onClick={() => setLightbox(null)} style={{ marginTop: 16, padding: "8px 20px", background: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>Fechar</button>
        </div>
      )}
    </div>
  );
}

const INITIAL_TEMPLATE = [
  { id: "t1", text: "Quadro elétrico instalado" }, { id: "t2", text: "Tubagem embutida" },
  { id: "t3", text: "Fiação passada" }, { id: "t4", text: "Tomadas instaladas" },
  { id: "t5", text: "Interruptores instalados" }, { id: "t6", text: "Iluminação instalada" },
  { id: "t7", text: "Teste de continuidade" }, { id: "t8", text: "Inspeção final" },
];
const INITIAL_CATALOG = [
  { id: "m1", code: "CAB-1.5", name: "Cabo 1.5mm", unit: "m" }, { id: "m2", code: "CAB-2.5", name: "Cabo 2.5mm", unit: "m" },
  { id: "m3", code: "CAB-4", name: "Cabo 4mm", unit: "m" }, { id: "m4", code: "CAB-6", name: "Cabo 6mm", unit: "m" },
  { id: "m5", code: "TUB-16", name: "Tubo corrugado 16mm", unit: "m" }, { id: "m6", code: "TUB-20", name: "Tubo corrugado 20mm", unit: "m" },
  { id: "m7", code: "TUB-25", name: "Tubo corrugado 25mm", unit: "m" }, { id: "m8", code: "CX-ENK", name: "Caixa de encastrar", unit: "un" },
  { id: "m9", code: "TOM-16", name: "Tomada 16A", unit: "un" }, { id: "m10", code: "INT-S", name: "Interruptor simples", unit: "un" },
  { id: "m11", code: "DIS-10", name: "Disjuntor 10A", unit: "un" }, { id: "m12", code: "DIS-16", name: "Disjuntor 16A", unit: "un" },
  { id: "m13", code: "DIS-20", name: "Disjuntor 20A", unit: "un" }, { id: "m14", code: "DIF-25", name: "Diferencial 25A", unit: "un" },
  { id: "m15", code: "FIT-ISO", name: "Fita isoladora", unit: "rolo" },
];
const INITIAL_WORKERS = [{ id: "w1", name: "Funcionário 1" }, { id: "w2", name: "Funcionário 2" }];
const ELEMENT_ICONS = ["⚡","🔌","💡","🔲","🔀","📦","🔧","⬛","⭕","📍","🔶","🔷"];
function makeChecklist(tpl) { return tpl.map(t => ({ id: genId(), text: t.text, status: "pending", obs: "" })); }
const DEF_ROOMS = []; const DEF_TASKS = []; const DEF_STOCK = []; const DEF_ATTENDANCE = []; const DEF_INVENTORY = [];
const PRIORITIES = [{ label: "Alta", value: "alta", color: "#ef4444" }, { label: "Média", value: "media", color: "#f59e0b" }, { label: "Baixa", value: "baixa", color: "#22c55e" }];
const TAGS = [{ label: "🚨 Urgente", value: "urgente", color: "#ef4444" }, { label: "📦 Aguarda Material", value: "material", color: "#f59e0b" }, { label: "🔍 Aguarda Inspeção", value: "inspecao", color: "#6366f1" }, { label: "⚙️ Em Curso", value: "curso", color: "#0ea5e9" }, { label: "🚫 Bloqueado", value: "bloqueado", color: "#94a3b8" }];
const STATUS = { pending: { label: "Pendente", color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", icon: null }, done: { label: "Concluído", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "✓" }, incomplete: { label: "Incompleto", color: "#dc2626", bg: "#fff1f2", border: "#fecaca", icon: "!" } };
const UNITS = ["un", "m", "m²", "m³", "kg", "L", "rolo", "cx", "saco"];
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function waLink(t) { return `https://wa.me/?text=${encodeURIComponent(t)}`; }
function fmtQty(q) { return q % 1 === 0 ? q : parseFloat(q).toFixed(2); }
function exportToCSV(rows, filename) { const csv = "sep=;\n" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"); const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

function ChecklistItem({ item, onChange, onRemove }) {
  const [showObs, setShowObs] = useState(item.status === "incomplete");
  const st = STATUS[item.status] || STATUS.pending;
  function cycleStatus() { const next = item.status === "pending" ? "done" : item.status === "done" ? "incomplete" : "pending"; onChange({ ...item, status: next, obs: next !== "incomplete" ? "" : item.obs }); setShowObs(next === "incomplete"); }
  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${st.border}`, background: st.bg, overflow: "hidden", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
        <button onClick={cycleStatus} style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, padding: 0, border: `2px solid ${st.color}`, background: item.status === "pending" ? "#fff" : st.color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff" }}>{item.status !== "pending" && st.icon}</button>
        <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 500, color: item.status === "done" ? "#16a34a" : item.status === "incomplete" ? "#dc2626" : "#475569", textDecoration: item.status === "done" ? "line-through" : "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{item.text}</span>
        <span style={{ padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, fontFamily: "'Sora',sans-serif", color: st.color, background: st.color + "18", flexShrink: 0 }}>{st.label}</span>
        {item.status !== "incomplete" && (<button onClick={() => { onChange({ ...item, status: "incomplete" }); setShowObs(true); }} style={{ padding: "2px 7px", border: "1.5px solid #fecaca", borderRadius: 7, background: "transparent", cursor: "pointer", fontSize: 11, color: "#dc2626", fontFamily: "'Sora',sans-serif", fontWeight: 700, flexShrink: 0 }}>!</button>)}
        {item.status === "incomplete" && (<button onClick={() => setShowObs(v => !v)} style={{ padding: "2px 7px", border: "1.5px solid #fecaca", borderRadius: 7, background: showObs ? "#fecaca" : "transparent", cursor: "pointer", fontSize: 11, color: "#dc2626", fontFamily: "'Sora',sans-serif", fontWeight: 700, flexShrink: 0 }}>💬</button>)}
        <ConfirmDeleteBtn onConfirm={onRemove} message="Apagar este ponto?" />
      </div>
      {item.status === "incomplete" && showObs && (
        <div style={{ padding: "0 12px 10px", borderTop: "1px solid #fecaca" }}>
          <input placeholder="Motivo…" value={item.obs || ""} onChange={e => onChange({ ...item, obs: e.target.value })} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "7px 12px", border: "1.5px solid #fecaca", borderRadius: 8, fontFamily: "'Sora',sans-serif", fontSize: 13, background: "#fff7f7", color: "#7f1d1d", outline: "none" }} />
          {item.obs && <div style={{ marginTop: 5, fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#dc2626", fontStyle: "italic" }}>⚠️ {item.obs}</div>}
        </div>
      )}
    </div>
  );
}

function Checklist({ checklist, onUpdate }) {
  const [newText, setNewText] = useState(""); const [adding, setAdding] = useState(false);
  function updateItem(id, u) { onUpdate(checklist.map(c => c.id === id ? u : c)); }
  function removeItem(id) { onUpdate(checklist.filter(c => c.id !== id)); }
  function addItem() { if (!newText.trim()) return; onUpdate([...checklist, { id: genId(), text: newText.trim(), status: "pending", obs: "" }]); setNewText(""); setAdding(false); }
  const done = checklist.filter(c => c.status === "done").length;
  const incomplete = checklist.filter(c => c.status === "incomplete").length;
  const total = checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allGood = total > 0 && done === total;
  return (
    <div style={{ padding: "0 16px 6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: allGood ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#6366f1,#4f46e5)", borderRadius: 99 }} />
          {incomplete > 0 && <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${Math.round((incomplete / total) * 100)}%`, background: "#ef4444", opacity: 0.7 }} />}
        </div>
        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, minWidth: 55, textAlign: "right", color: allGood ? "#22c55e" : incomplete > 0 ? "#dc2626" : "#6366f1" }}>{done}/{total}{allGood ? " ✓" : ""}</span>
      </div>
      {checklist.map(item => (<ChecklistItem key={item.id} item={item} onChange={u => updateItem(item.id, u)} onRemove={() => removeItem(item.id)} />))}
      {adding ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input autoFocus value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAdding(false); }} placeholder="Novo ponto…" style={{ ...S.input, flex: 1, fontSize: 13 }} />
          <button onClick={addItem} style={{ ...S.btnPrimary, padding: "7px 12px", fontSize: 12 }}>+</button>
          <button onClick={() => setAdding(false)} style={{ ...S.btnGhost, padding: "7px 10px", fontSize: 12 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 6, background: "transparent", border: "1.5px dashed #cbd5e1", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600, width: "100%", textAlign: "left" }}>+ Adicionar ponto</button>
      )}
    </div>
  );
}

function SettingsModal({ template, onSave, onClose }) {
  const [items, setItems] = useState(template.map(t => ({ ...t }))); const [newText, setNewText] = useState(""); const [adding, setAdding] = useState(false);
  function toggleItem(id) { setItems(items.map(i => i.id === id ? { ...i, disabled: !i.disabled } : i)); }
  function addItem() { if (!newText.trim()) return; setItems([...items, { id: genId(), text: newText.trim() }]); setNewText(""); setAdding(false); }
  function moveUp(idx) { if (idx === 0) return; const a = [...items]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; setItems(a); }
  function moveDown(idx) { if (idx === items.length-1) return; const a = [...items]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; setItems(a); }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#1e293b", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 20 }}>⚙️</span><div><div style={{ color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "'Sora',sans-serif" }}>Configurações da Checklist</div></div></div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
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
                <ConfirmDeleteBtn onConfirm={() => setItems(items.filter(i => i.id !== item.id))} />
              </div>
            ))}
          </div>
          {adding ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input autoFocus value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAdding(false); }} placeholder="Novo ponto…" style={{ ...S.input, flex: 1, fontSize: 13 }} />
              <button onClick={addItem} style={{ ...S.btnPrimary, padding: "8px 14px", fontSize: 13 }}>+</button>
              <button onClick={() => setAdding(false)} style={{ ...S.btnGhost, padding: "8px 10px", fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ marginTop: 12, background: "transparent", border: "1.5px dashed #a5b4fc", borderRadius: 9, padding: "8px 14px", cursor: "pointer", color: "#6366f1", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, width: "100%", textAlign: "left" }}>+ Novo ponto</button>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1.5px solid #e2e8f0", display: "flex", gap: 10, background: "#f8fafc" }}>
          <button onClick={() => onSave(items.filter(i => !i.disabled))} style={S.btnPrimary}>✓ Guardar</button>
          <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function CatalogModal({ catalog, onSave, onClose }) {
  const [items, setItems] = useState(catalog.map(c => ({ ...c }))); const [newName, setNewName] = useState(""); const [newCode, setNewCode] = useState(""); const [newUnit, setNewUnit] = useState("un"); const [adding, setAdding] = useState(false);
  function updateItem(id, f, v) { setItems(items.map(i => i.id === id ? { ...i, [f]: v } : i)); }
  function addItem() { if (!newName.trim()) return; setItems([...items, { id: genId(), code: newCode.trim(), name: newName.trim(), unit: newUnit }]); setNewName(""); setNewCode(""); setNewUnit("un"); setAdding(false); }
  function doExport() { exportToCSV([["Código", "Nome", "Unidade"], ...items.map(i => [i.code || "", i.name, i.unit])], "catalogo_materiais.csv"); }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 580, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#1e293b", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 20 }}>📦</span><div><div style={{ color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "'Sora',sans-serif" }}>Catálogo de Materiais</div></div></div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px 36px", gap: 8, marginBottom: 8 }}>
            <span style={S.label}>Código</span><span style={S.label}>Nome</span><span style={S.label}>Unid.</span><span></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px 36px", gap: 8, alignItems: "center" }}>
                <input value={item.code || ""} onChange={e => updateItem(item.id, "code", e.target.value)} style={{ ...S.input, fontSize: 12, padding: "6px 8px", fontFamily: "monospace", color: "#6366f1" }} placeholder="COD-001" />
                <input value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} style={{ ...S.input, fontSize: 13, padding: "6px 10px" }} />
                <select value={item.unit} onChange={e => updateItem(item.id, "unit", e.target.value)} style={{ ...S.input, fontSize: 12, padding: "6px 6px" }}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                <ConfirmDeleteBtn onConfirm={() => setItems(items.filter(i => i.id !== item.id))} />
              </div>
            ))}
          </div>
          {adding ? (
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px auto auto", gap: 8, marginTop: 12, alignItems: "center" }}>
              <input autoFocus value={newCode} onChange={e => setNewCode(e.target.value)} style={{ ...S.input, fontSize: 12, padding: "7px 8px", fontFamily: "monospace", color: "#6366f1" }} placeholder="COD-001" />
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAdding(false); }} style={{ ...S.input, fontSize: 13 }} placeholder="Nome…" />
              <select value={newUnit} onChange={e => setNewUnit(e.target.value)} style={{ ...S.input, fontSize: 12 }}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
              <button onClick={addItem} style={{ ...S.btnPrimary, padding: "8px 12px", fontSize: 13 }}>+</button>
              <button onClick={() => setAdding(false)} style={{ ...S.btnGhost, padding: "8px 10px", fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ marginTop: 12, background: "transparent", border: "1.5px dashed #a5b4fc", borderRadius: 9, padding: "8px 14px", cursor: "pointer", color: "#6366f1", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, width: "100%", textAlign: "left" }}>+ Novo material</button>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1.5px solid #e2e8f0", display: "flex", gap: 10, background: "#f8fafc" }}>
          <button onClick={() => onSave(items)} style={S.btnPrimary}>✓ Guardar</button>
          <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
          <button onClick={doExport} style={{ ...S.btnGhost, marginLeft: "auto", border: "1.5px solid #22c55e", color: "#16a34a" }}>📥 CSV</button>
        </div>
      </div>
    </div>
  );
}
// ─── ATTENDANCE TAB ───────────────────────────────────────────
function AttendanceTab() {
  const [attendance, setAttendance, loading] = useFirebase("attendance", DEF_ATTENDANCE);
  const [workers, setWorkers, wLoading] = useFirebase("workers", INITIAL_WORKERS);
  const [selDate, setSelDate] = useState(todayStr());
  const [showManageWorkers, setShowManageWorkers] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [filterFrom, setFilterFrom] = useState(""); const [filterTo, setFilterTo] = useState("");
  const allWorkers = workers || []; const allAttendance = attendance || [];
  const dayRecord = allAttendance.find(a => a.date === selDate) || { date: selDate, present: [], works: "" };
  const present = dayRecord.present || []; const works = dayRecord.works || "";
  function updateDayRecord(updates) { const newRecord = { ...dayRecord, date: selDate, ...updates }; const exists = allAttendance.find(a => a.date === selDate); setAttendance(exists ? allAttendance.map(a => a.date === selDate ? newRecord : a) : [...allAttendance, newRecord]); }
  function toggleWorker(wid) { const isPresent = present.includes(wid); updateDayRecord({ present: isPresent ? present.filter(id => id !== wid) : [...present, wid] }); }
  function updateWorks(val) { updateDayRecord({ works: val }); }
  function addWorker() { if (!newWorkerName.trim()) return; setWorkers([...allWorkers, { id: genId(), name: newWorkerName.trim() }]); setNewWorkerName(""); }
  function deleteWorker(id) { setWorkers(allWorkers.filter(w => w.id !== id)); }
  const histFiltered = allAttendance.filter(a => { const mf = filterFrom ? a.date >= filterFrom : true; const mt = filterTo ? a.date <= filterTo : true; return mf && mt && (a.present || []).length > 0; }).sort((a, b) => b.date.localeCompare(a.date));
  function doExport() { const rows = [["Data", "Funcionário", "Trabalhos Realizados"]]; histFiltered.forEach(a => { allWorkers.filter(w => (a.present || []).includes(w.id)).forEach(w => rows.push([a.date, w.name, a.works || ""])); }); exportToCSV(rows, `folha_ponto.csv`); }
  if (loading || wLoading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showManageWorkers && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowManageWorkers(false)}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 460, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ background: "#1e293b", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}>👷</span><div style={{ color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "'Sora',sans-serif" }}>Gerir Funcionários</div></div><button onClick={() => setShowManageWorkers(false)} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}>✕</button></div>
            <div style={{ overflowY: "auto", flex: 1, padding: "16px 22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{allWorkers.map(w => (<div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc" }}><span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</span><ConfirmDeleteBtn onConfirm={() => deleteWorker(w.id)} message={`Remover "${w.name}"?`} /></div>))}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}><input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} onKeyDown={e => e.key === "Enter" && addWorker()} placeholder="Nome do funcionário…" style={{ ...S.input, flex: 1, fontSize: 13 }} /><button onClick={addWorker} style={{ ...S.btnPrimary, padding: "8px 14px", fontSize: 13 }}>+ Adicionar</button></div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1.5px solid #e2e8f0", background: "#f8fafc" }}><button onClick={() => setShowManageWorkers(false)} style={S.btnPrimary}>✓ Fechar</button></div>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{ ...S.cardHeader, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>👷 Folha de Ponto</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ ...S.input, width: "auto", fontSize: 13, padding: "5px 10px" }} />
            <button onClick={() => setShowManageWorkers(true)} style={{ ...S.btnGhost, fontSize: 12, padding: "5px 12px", border: "1.5px solid #c7d2fe", color: "#6366f1" }}>⚙️ Funcionários</button>
          </div>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <div style={{ marginBottom: 12, fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#64748b" }}>{new Date(selDate + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} — <strong style={{ color: "#22c55e" }}>{present.length} presente(s)</strong> / {allWorkers.length}</div>
          {allWorkers.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13 }}>Nenhum funcionário.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allWorkers.map(w => { const isPresent = present.includes(w.id); return (<button key={w.id} onClick={() => toggleWorker(w.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12, border: `2px solid ${isPresent ? "#22c55e" : "#e2e8f0"}`, background: isPresent ? "#f0fdf4" : "#f8fafc", cursor: "pointer", textAlign: "left" }}><div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${isPresent ? "#22c55e" : "#cbd5e1"}`, background: isPresent ? "#22c55e" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isPresent && <svg width="14" height="14" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 15, color: isPresent ? "#16a34a" : "#475569" }}>{w.name}</span><span style={{ padding: "3px 12px", borderRadius: 99, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, background: isPresent ? "#dcfce7" : "#f1f5f9", color: isPresent ? "#16a34a" : "#94a3b8" }}>{isPresent ? "✓ Presente" : "Ausente"}</span></button>); })}
          </div>
          <div style={{ marginTop: 18, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            <label style={S.label}>🔧 Trabalhos Realizados no Dia</label>
            <textarea value={works} onChange={e => updateWorks(e.target.value)} placeholder="Descreve os trabalhos realizados hoje…" rows={3} style={{ ...S.input, resize: "vertical", lineHeight: 1.5, fontSize: 13 }} />
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ ...S.cardHeader, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>📋 Histórico</span>
          {histFiltered.length > 0 && <button onClick={doExport} style={{ ...S.btnGhost, fontSize: 12, padding: "5px 12px", border: "1.5px solid #22c55e", color: "#16a34a" }}>📥 CSV</button>}
        </div>
        <div style={{ padding: "12px 18px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div><label style={S.label}>De</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={S.input} /></div>
          <div><label style={S.label}>Até</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={S.input} /></div>
          {(filterFrom || filterTo) && <button onClick={() => { setFilterFrom(""); setFilterTo(""); }} style={{ ...S.btnGhost, alignSelf: "flex-end" }}>✕</button>}
        </div>
        {histFiltered.length === 0 ? <div style={{ textAlign: "center", padding: 30, color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13 }}>Nenhum registo.</div>
          : histFiltered.map(a => { const presentNames = allWorkers.filter(w => (a.present || []).includes(w.id)); return (<div key={a.date} style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9" }}><div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#1e293b", marginBottom: 8 }}>📅 {new Date(a.date + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}<span style={{ marginLeft: 10, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{presentNames.length} presente(s)</span></div><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: a.works ? 8 : 0 }}>{presentNames.map(n => <span key={n.id} style={{ padding: "3px 10px", borderRadius: 99, background: "#dcfce7", color: "#16a34a", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600 }}>✓ {n.name}</span>)}</div>{a.works && <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#475569" }}>🔧 <em>{a.works}</em></div>}</div>); })}
      </div>
    </div>
  );
}

// ─── ESQUEMAS TAB ─────────────────────────────────────────────
const ELEMENT_ICONS = ["⚡","🔌","💡","🔲","🔀","📦","🔧","⬛","⭕","📍","🔶","🔷"];

function SchemaCanvas({ schema, onUpdate }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [selected, setSelected] = useState(null);
  const [addingEl, setAddingEl] = useState(false);
  const [newEl, setNewEl] = useState({ label: "", icon: "🔌", color: "#6366f1" });
  const [editEl, setEditEl] = useState(null);
  const elements = schema.elements || [];
  const connections = schema.connections || [];
  function addElement() { if (!newEl.label.trim()) return; const el = { id: genId(), label: newEl.label.trim(), icon: newEl.icon, color: newEl.color, x: 80 + Math.random() * 200, y: 60 + Math.random() * 120 }; onUpdate({ ...schema, elements: [...elements, el] }); setNewEl({ label: "", icon: "🔌", color: "#6366f1" }); setAddingEl(false); }
  function deleteElement(id) { onUpdate({ ...schema, elements: elements.filter(e => e.id !== id), connections: connections.filter(c => c.from !== id && c.to !== id) }); setSelected(null); }
  function deleteConnection(idx) { const c = [...connections]; c.splice(idx, 1); onUpdate({ ...schema, connections: c }); }
  function connectElements(fromId, toId) { if (fromId === toId) return; const already = connections.find(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)); if (!already) onUpdate({ ...schema, connections: [...connections, { id: genId(), from: fromId, to: toId }] }); }
  function getClientXY(e) { if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY }; if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; return { x: e.clientX, y: e.clientY }; }
  function handleElPointerDown(e, id) { e.stopPropagation(); if (connecting === "pick") { setConnecting(id); return; } if (connecting && connecting !== "pick") { connectElements(connecting, id); setConnecting(null); return; } const rect = canvasRef.current.getBoundingClientRect(); const { x: clientX, y: clientY } = getClientXY(e); const el = elements.find(el => el.id === id); setDragging({ id, offsetX: clientX - rect.left - el.x, offsetY: clientY - rect.top - el.y }); setSelected(id); }
  function handlePointerMove(e) { if (!dragging) return; const rect = canvasRef.current.getBoundingClientRect(); const { x: clientX, y: clientY } = getClientXY(e); const x = Math.max(0, Math.min(clientX - rect.left - dragging.offsetX, rect.width - 70)); const y = Math.max(0, Math.min(clientY - rect.top - dragging.offsetY, rect.height - 60)); onUpdate({ ...schema, elements: elements.map(el => el.id === dragging.id ? { ...el, x, y } : el) }); }
  function handlePointerUp() { setDragging(null); }
  function getCenter(el) { return { x: el.x + 35, y: el.y + 28 }; }
  const selEl = elements.find(e => e.id === selected);
  const COLORS = ["#6366f1","#ef4444","#f59e0b","#22c55e","#0ea5e9","#8b5cf6","#ec4899","#1e293b"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => { setAddingEl(v => !v); setConnecting(null); }} style={{ ...S.btnPrimary, fontSize: 13, padding: "7px 14px" }}>+ Elemento</button>
        {!connecting ? (
          <button onClick={() => { setConnecting("pick"); setSelected(null); }} style={{ ...S.btnGhost, fontSize: 13, padding: "7px 14px" }}>🔗 Ligar elementos</button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 14px", background: "#eef2ff", borderRadius: 10, border: "2px solid #6366f1" }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#6366f1", fontWeight: 700 }}>{connecting === "pick" ? "1️⃣ Toca no 1º elemento" : "2️⃣ Toca no 2º elemento"}</span>
            <button onClick={() => setConnecting(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 16, fontWeight: 700 }}>✕</button>
          </div>
        )}
        {selected && !connecting && (<><button onClick={() => setEditEl(selEl)} style={{ ...S.btnGhost, fontSize: 13, padding: "7px 12px" }}>✏️</button><ConfirmDeleteBtn onConfirm={() => deleteElement(selected)} message={`Apagar "${selEl?.label}"?`} style={{ padding: "7px 12px", background: "#fff1f2", border: "1.5px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13 }} label="🗑" /></>)}
      </div>
      {addingEl && (
        <div style={{ ...S.card, padding: 0 }}>
          <div style={S.cardHeader}>Novo Elemento</div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={S.label}>Nome *</label><input value={newEl.label} onChange={e => setNewEl(n => ({ ...n, label: e.target.value }))} onKeyDown={e => e.key === "Enter" && addElement()} style={S.input} placeholder="Ex: Quadro, Tomada A3…" /></div>
            <div><label style={S.label}>Ícone</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ELEMENT_ICONS.map(ic => (<button key={ic} onClick={() => setNewEl(n => ({ ...n, icon: ic }))} style={{ width: 38, height: 38, borderRadius: 8, border: `2px solid ${newEl.icon === ic ? "#6366f1" : "#e2e8f0"}`, background: newEl.icon === ic ? "#eef2ff" : "#f8fafc", fontSize: 20, cursor: "pointer" }}>{ic}</button>))}</div></div>
            <div><label style={S.label}>Cor</label><div style={{ display: "flex", gap: 8 }}>{COLORS.map(c => (<button key={c} onClick={() => setNewEl(n => ({ ...n, color: c }))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${newEl.color === c ? "#1e293b" : "transparent"}`, cursor: "pointer" }} />))}</div></div>
            <div style={{ display: "flex", gap: 8 }}><button onClick={addElement} style={S.btnPrimary}>Adicionar</button><button onClick={() => setAddingEl(false)} style={S.btnGhost}>Cancelar</button></div>
          </div>
        </div>
      )}
      {editEl && (
        <div style={{ ...S.card, padding: 0 }}>
          <div style={S.cardHeader}>Editar Elemento</div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={S.label}>Nome</label><input value={editEl.label} onChange={e => setEditEl(el => ({ ...el, label: e.target.value }))} style={S.input} /></div>
            <div><label style={S.label}>Ícone</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ELEMENT_ICONS.map(ic => (<button key={ic} onClick={() => setEditEl(el => ({ ...el, icon: ic }))} style={{ width: 38, height: 38, borderRadius: 8, border: `2px solid ${editEl.icon === ic ? "#6366f1" : "#e2e8f0"}`, background: editEl.icon === ic ? "#eef2ff" : "#f8fafc", fontSize: 20, cursor: "pointer" }}>{ic}</button>))}</div></div>
            <div><label style={S.label}>Cor</label><div style={{ display: "flex", gap: 8 }}>{COLORS.map(c => (<button key={c} onClick={() => setEditEl(el => ({ ...el, color: c }))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${editEl.color === c ? "#1e293b" : "transparent"}`, cursor: "pointer" }} />))}</div></div>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => { onUpdate({ ...schema, elements: elements.map(e => e.id === editEl.id ? editEl : e) }); setEditEl(null); }} style={S.btnPrimary}>✓ Guardar</button><button onClick={() => setEditEl(null)} style={S.btnGhost}>Cancelar</button></div>
          </div>
        </div>
      )}
      <div ref={canvasRef} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onTouchMove={e => { e.preventDefault(); handlePointerMove(e); }} onTouchEnd={handlePointerUp} onClick={() => { if (!connecting) setSelected(null); }} style={{ position: "relative", width: "100%", height: 400, background: "#f8fafc", borderRadius: 14, border: `2px solid ${connecting ? "#6366f1" : "#e2e8f0"}`, overflow: "hidden", touchAction: "none" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#e2e8f0" /></pattern>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6366f1" opacity="0.7" /></marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {connections.map((conn, idx) => { const from = elements.find(e => e.id === conn.from); const to = elements.find(e => e.id === conn.to); if (!from || !to) return null; const f = getCenter(from); const t = getCenter(to); const mx = (f.x + t.x) / 2; const my = (f.y + t.y) / 2; return (<g key={conn.id || idx}><line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="#6366f1" strokeWidth="2.5" strokeDasharray="7 4" opacity="0.7" markerEnd="url(#arrow)" /><circle cx={mx} cy={my} r="10" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); deleteConnection(idx); }} /><text x={mx} y={my + 5} textAnchor="middle" fontSize="12" fill="#ef4444" fontWeight="bold" style={{ cursor: "pointer", userSelect: "none" }} onClick={e => { e.stopPropagation(); deleteConnection(idx); }}>✕</text></g>); })}
        </svg>
        {elements.map(el => (<div key={el.id} onMouseDown={e => handleElPointerDown(e, el.id)} onTouchStart={e => { e.preventDefault(); handleElPointerDown(e, el.id); }} style={{ position: "absolute", left: el.x, top: el.y, width: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: connecting ? "pointer" : dragging?.id === el.id ? "grabbing" : "grab", userSelect: "none", zIndex: selected === el.id ? 10 : 1 }}>
          <div style={{ width: 54, height: 54, borderRadius: 12, background: el.color + "22", border: `2.5px solid ${connecting === el.id ? "#22c55e" : selected === el.id ? el.color : el.color + "66"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: connecting === el.id ? "0 0 0 4px #22c55e44" : selected === el.id ? `0 0 0 3px ${el.color}44` : "none" }}>{el.icon}</div>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 10, fontWeight: 700, color: "#1e293b", textAlign: "center", background: "rgba(255,255,255,0.92)", padding: "2px 6px", borderRadius: 4, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{el.label}</span>
        </div>))}
        {elements.length === 0 && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13, gap: 8, pointerEvents: "none" }}><span style={{ fontSize: 36 }}>⚡</span><span>Clica "+ Elemento" para começar</span></div>}
        {connecting && <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "#6366f1", color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99, pointerEvents: "none", whiteSpace: "nowrap" }}>{connecting === "pick" ? "Toca no 1º elemento" : "Toca no 2º elemento"}</div>}
      </div>
      {connections.length > 0 && (<div style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#64748b", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}><span style={{ fontWeight: 700, color: "#94a3b8" }}>Ligações:</span>{connections.map((conn, idx) => { const from = elements.find(e => e.id === conn.from); const to = elements.find(e => e.id === conn.to); if (!from || !to) return null; return (<span key={idx} style={{ padding: "3px 10px", borderRadius: 99, background: "#eef2ff", color: "#6366f1", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{from.icon} {from.label} → {to.icon} {to.label}<button onClick={() => deleteConnection(idx)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12, padding: 0 }}>✕</button></span>); })}</div>)}
    </div>
  );
}

function SchemasTab() {
  const [schemas, setSchemas, loading] = useFirebase("schemas", []);
  const [activeId, setActiveId] = useState(null);
  const [addingSchema, setAddingSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const allSchemas = schemas || [];
  const active = allSchemas.find(s => s.id === activeId);
  function addSchema() { if (!newSchemaName.trim()) return; const s = { id: genId(), name: newSchemaName.trim(), elements: [], connections: [] }; setSchemas([...allSchemas, s]); setActiveId(s.id); setNewSchemaName(""); setAddingSchema(false); }
  function updateSchema(updated) { setSchemas(allSchemas.map(s => s.id === updated.id ? updated : s)); }
  function deleteSchema(id) { setSchemas(allSchemas.filter(s => s.id !== id)); if (activeId === id) setActiveId(null); }
  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 26 }}>📐</span>
        <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 17, fontFamily: "'Sora',sans-serif" }}>Esquemas Elétricos</div><div style={{ color: "#64748b", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>Diagrama de percurso de cabos por divisão</div></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {allSchemas.map(s => (<div key={s.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <button onClick={() => setActiveId(s.id)} style={{ padding: "8px 16px", borderRadius: activeId === s.id ? "10px 0 0 10px" : 10, border: `2px solid ${activeId === s.id ? "#6366f1" : "#e2e8f0"}`, background: activeId === s.id ? "#6366f1" : "#f8fafc", color: activeId === s.id ? "#fff" : "#475569", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📐 {s.name}</button>
          {activeId === s.id && (<ConfirmDeleteBtn onConfirm={() => deleteSchema(s.id)} message={`Apagar "${s.name}"?`} style={{ padding: "8px 10px", background: "#ef4444", border: "2px solid #ef4444", borderRadius: "0 10px 10px 0", color: "#fff", fontSize: 13 }} label="🗑" />)}
        </div>))}
        {addingSchema ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input autoFocus value={newSchemaName} onChange={e => setNewSchemaName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addSchema(); if (e.key === "Escape") setAddingSchema(false); }} placeholder="Nome da divisão…" style={{ ...S.input, width: 180, fontSize: 13 }} />
            <button onClick={addSchema} style={{ ...S.btnPrimary, padding: "7px 14px", fontSize: 13 }}>Criar</button>
            <button onClick={() => setAddingSchema(false)} style={{ ...S.btnGhost, padding: "7px 10px", fontSize: 13 }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAddingSchema(true)} style={{ ...S.btnGhost, fontSize: 13, border: "1.5px dashed #a5b4fc", color: "#6366f1" }}>+ Nova Divisão</button>
        )}
      </div>
      {active ? <SchemaCanvas key={active.id} schema={active} onUpdate={updateSchema} /> : (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Nenhuma divisão selecionada</div>
          <div style={{ fontSize: 13 }}>Clica em "+ Nova Divisão" para começar.</div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────
const PIN_MASTER = "436900";

function SettingsTab() {
  const [config, setConfig, loading] = useFirebase("config", { pin: "0000" });
  const [masterInput, setMasterInput] = useState("");
  const [masterOk, setMasterOk] = useState(false);
  const [newPin, setNewPin] = useState(""); const [confirmPin, setConfirmPin] = useState("");
  const [msg, setMsg] = useState(null);
  function verifyMaster() { if (masterInput === PIN_MASTER) { setMasterOk(true); setMasterInput(""); setMsg(null); } else { setMsg({ type: "error", text: "PIN Master incorreto." }); setMasterInput(""); } }
  function changePin() { if (!/^\d{4,6}$/.test(newPin)) { setMsg({ type: "error", text: "O novo PIN deve ter 4 a 6 dígitos." }); return; } if (newPin !== confirmPin) { setMsg({ type: "error", text: "Os PINs não coincidem." }); return; } setConfig({ ...config, pin: newPin }); setNewPin(""); setConfirmPin(""); setMasterOk(false); setMsg({ type: "success", text: "PIN alterado com sucesso! 🎉" }); setTimeout(() => setMsg(null), 3000); }
  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 28 }}>⚙️</span>
        <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 18, fontFamily: "'Sora',sans-serif" }}>Configurações</div><div style={{ color: "#64748b", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>Gerir acesso e preferências</div></div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}>🔒 Alterar PIN de Acesso</div>
        <div style={{ padding: "20px" }}>
          {msg && <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: msg.type === "error" ? "#fff1f2" : "#f0fdf4", border: `1.5px solid ${msg.type === "error" ? "#fecaca" : "#bbf7d0"}`, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: msg.type === "error" ? "#dc2626" : "#16a34a" }}>{msg.text}</div>}
          {!masterOk ? (
            <>
              <div style={{ marginBottom: 14, fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#64748b" }}>Para alterar o PIN é necessário o <strong>PIN Master</strong>.</div>
              <div><label style={S.label}>PIN Master</label><input type="password" inputMode="numeric" maxLength={6} value={masterInput} onChange={e => setMasterInput(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && verifyMaster()} style={S.input} placeholder="••••••" /></div>
              <button onClick={verifyMaster} style={{ ...S.btnPrimary, marginTop: 18 }}>Verificar PIN Master</button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1.5px solid #bbf7d0", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "#16a34a" }}>✓ PIN Master verificado.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={S.label}>Novo PIN (4 a 6 dígitos)</label><input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} style={S.input} placeholder="••••" /></div>
                <div><label style={S.label}>Confirmar Novo PIN</label><input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && changePin()} style={S.input} placeholder="••••" /></div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}><button onClick={changePin} style={S.btnPrimary}>🔒 Alterar PIN</button><button onClick={() => { setMasterOk(false); setNewPin(""); setConfirmPin(""); setMsg(null); }} style={S.btnGhost}>Cancelar</button></div>
            </>
          )}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}>ℹ️ Informação</div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[{ label: "Versão", value: "ObraControl v2.0" }, { label: "Base de dados", value: "Firebase Realtime DB" }, { label: "Fotos", value: "Cloudinary (Free)" }, { label: "Alojamento", value: "Vercel (Free)" }].map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#64748b", fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#1e293b", fontWeight: 700 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PIN LOCK ─────────────────────────────────────────────────
function PinLock({ onUnlock }) {
  const [config, , loading] = useFirebase("config", { pin: "0000" });
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  function tryPin(pin) { if (pin === (config?.pin || "0000")) { sessionStorage.setItem("obra_unlocked", "1"); onUnlock(); } else { setError(true); setShake(true); setInput(""); setTimeout(() => setShake(false), 500); setTimeout(() => setError(false), 2000); } }
  function pressDigit(d) { const next = input + d; setError(false); if (next.length <= 6) { setInput(next); if (next.length >= 4) setTimeout(() => tryPin(next), 100); } }
  function del() { setInput(i => i.slice(0, -1)); }
  if (loading) return <div style={{ minHeight: "100vh", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 28, height: 28, border: "3px solid #334155", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  const pinLen = config?.pin?.length || 4;
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e293b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}} @keyframes spin{to{transform:rotate(360deg)}} .pin-btn:active{transform:scale(0.92)}`}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, animation: shake ? "shake 0.5s" : "none" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏗️</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 24, fontFamily: "'Sora',sans-serif", letterSpacing: -0.5 }}>ObraControl</div>
          <div style={{ color: "#64748b", fontSize: 13, fontFamily: "'Sora',sans-serif", marginTop: 4 }}>Introduz o PIN para aceder</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {Array.from({ length: pinLen }).map((_, i) => (<div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: i < input.length ? (error ? "#ef4444" : "#6366f1") : "#334155", transition: "background 0.15s", border: `2px solid ${i < input.length ? (error ? "#ef4444" : "#6366f1") : "#475569"}` }} />))}
        </div>
        {error && <div style={{ color: "#ef4444", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, marginTop: -16 }}>PIN incorreto.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
            d === "" ? <div key={i} /> :
            <button key={i} className="pin-btn" onClick={() => d === "⌫" ? del() : pressDigit(d)} style={{ width: 72, height: 72, borderRadius: "50%", border: "none", background: d === "⌫" ? "#1e293b" : "#1e3a5f", color: "#fff", fontSize: d === "⌫" ? 22 : 24, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer", transition: "transform 0.1s", display: "flex", alignItems: "center", justifyContent: "center" }}>{d}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("obra_unlocked") === "1");
  const [tab, setTab] = useState("dashboard");
  const [dark, setDark] = useState(() => localStorage.getItem("obra_dark") === "1");
  function toggleDark() { const next = !dark; setDark(next); localStorage.setItem("obra_dark", next ? "1" : "0"); }
  const TABS = [
    { key: "dashboard", label: "🏠 Início" },
    { key: "checklist", label: "⚡ Checklist" },
    { key: "schemas",   label: "📐 Esquemas" },
    { key: "tasks",     label: "📔 Diário" },
    { key: "stock",     label: "📦 Material" },
    { key: "photos",    label: "📷 Fotos" },
    { key: "attendance",label: "👷 Ponto" },
    { key: "settings",  label: "⚙️ Config." },
  ];
  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;
  const bg = dark ? "#0f172a" : "linear-gradient(135deg,#f0f4ff 0%,#f8fafc 60%,#fff7ed 100%)";
  const navBg = dark ? "#0f172a" : "#fff";
  const navBorder = dark ? "#1e293b" : "#e2e8f0";
  const tabActive = "#6366f1";
  const tabInactive = dark ? "#475569" : "#94a3b8";
  return (
    <div style={{ minHeight: "100vh", background: bg }}>
      <div style={{ background: "#1e293b", padding: "0 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 24 }}>🏗️</span><div><div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: -0.5, fontFamily: "'Sora',sans-serif" }}>ObraControl</div><div style={{ color: "#64748b", fontSize: 11, fontFamily: "'Sora',sans-serif" }}>Parte Elétrica</div></div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleDark} style={{ padding: "5px 12px", background: "#334155", border: "none", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600 }}>{dark ? "☀️" : "🌙"}</button>
            <button onClick={() => { sessionStorage.removeItem("obra_unlocked"); setUnlocked(false); }} style={{ padding: "5px 12px", background: "#334155", border: "none", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 600 }}>🔒 Sair</button>
          </div>
        </div>
      </div>
      <div style={{ background: navBg, borderBottom: `1.5px solid ${navBorder}`, overflowX: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex" }}>
          {TABS.map(t => (<button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12, color: tab === t.key ? tabActive : tabInactive, borderBottom: tab === t.key ? `2.5px solid ${tabActive}` : "2.5px solid transparent", transition: "all 0.2s", marginBottom: -1, whiteSpace: "nowrap" }}>{t.label}</button>))}
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {tab === "dashboard"  && <DashboardTab dark={dark} setTab={setTab} />}
        {tab === "schemas"    && <SchemasTab dark={dark} />}
        {tab === "checklist"  && <ChecklistTab dark={dark} />}
        {tab === "tasks"      && <TasksTab dark={dark} />}
        {tab === "stock"      && <StockTab dark={dark} />}
        {tab === "photos"     && <PhotosTab dark={dark} />}
        {tab === "attendance" && <AttendanceTab dark={dark} />}
        {tab === "settings"   && <SettingsTab dark={dark} />}
      </div>
      <div style={{ textAlign: "center", padding: "16px", color: dark ? "#334155" : "#cbd5e1", fontSize: 11, fontFamily: "'Sora',sans-serif" }}>ObraControl · Firebase LIVE</div>
    </div>
  );
}

function mkS(dark) {
  const d = dark;
  return {
    input: { padding: "9px 14px", border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, borderRadius: 10, fontFamily: "'Sora',sans-serif", fontSize: 14, outline: "none", background: d ? "#1e293b" : "#f8fafc", color: d ? "#e2e8f0" : "#1e293b", width: "100%", boxSizing: "border-box" },
    btnPrimary: { padding: "9px 20px", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14 },
    btnGhost: { padding: "8px 16px", background: "transparent", color: d ? "#94a3b8" : "#64748b", border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13 },
    btnSmall: { padding: "5px 10px", background: d ? "#1e293b" : "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
    card: { background: d ? "#1e293b" : "#fff", borderRadius: 14, border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, overflow: "hidden" },
    cardHeader: { padding: "14px 20px", background: d ? "#0f172a" : "#f8fafc", borderBottom: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, fontWeight: 700, fontSize: 14, color: d ? "#e2e8f0" : "#1e293b", fontFamily: "'Sora',sans-serif" },
    label: { display: "block", marginBottom: 6, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  };
}

const S = mkS(false);