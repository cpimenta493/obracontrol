import { useState, useEffect, useCallback } from "react";
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

// ─── CLOUDINARY UPLOAD ────────────────────────────────────────
async function uploadToCloudinary(file, folder) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  fd.append("folder", folder);
  const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: fd });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { url: data.secure_url, publicId: data.public_id, width: data.width, height: data.height };
}

// ─── PHOTO UPLOAD COMPONENT ───────────────────────────────────
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
      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1.5px solid #e2e8f0", background: "#f8fafc" }}>
              <img src={photo.url} alt={photo.caption || "foto"} onClick={() => setLightbox(photo)} style={{ width: "100%", height: 80, objectFit: "cover", cursor: "pointer", display: "block" }} />
              <div style={{ padding: "4px 6px", background: "#fff" }}>
                <input value={photo.caption || ""} onChange={e => updateCaption(photo.id, e.target.value)} placeholder="Legenda…" style={{ width: "100%", border: "none", outline: "none", fontSize: 10, fontFamily: "'Sora',sans-serif", color: "#64748b", background: "transparent", boxSizing: "border-box" }} />
              </div>
              <button onClick={() => removePhoto(photo.id)} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: uploading ? "#f1f5f9" : "transparent", border: `1.5px ${uploading ? "solid #e2e8f0" : "dashed #a5b4fc"}`, borderRadius: 9, cursor: uploading ? "default" : "pointer", color: uploading ? "#94a3b8" : "#6366f1", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600 }}>
        <input type="file" accept="image/*" multiple disabled={uploading} onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />
        {uploading ? "⏳ A carregar…" : `📷 ${label}`}
      </label>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.caption || "foto"} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
          {lightbox.caption && <div style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, marginTop: 12, textAlign: "center" }}>{lightbox.caption}</div>}
          <div style={{ color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 12, marginTop: 6 }}>{new Date(lightbox.uploadedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          <button onClick={() => setLightbox(null)} style={{ marginTop: 16, padding: "8px 20px", background: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13 }}>Fechar</button>
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
function makeChecklist(tpl) { return tpl.map(t => ({ id: genId(), text: t.text, status: "pending", obs: "" })); }
const DEF_ROOMS = []; const DEF_TASKS = []; const DEF_STOCK = []; const DEF_ATTENDANCE = []; const DEF_INVENTORY = [];
const PRIORITIES = [{ label: "Alta", value: "alta", color: "#ef4444" }, { label: "Média", value: "media", color: "#f59e0b" }, { label: "Baixa", value: "baixa", color: "#22c55e" }];
const STATUS = { pending: { label: "Pendente", color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", icon: null }, done: { label: "Concluído", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "✓" }, incomplete: { label: "Incompleto", color: "#dc2626", bg: "#fff1f2", border: "#fecaca", icon: "!" } };
const UNITS = ["un", "m", "m²", "m³", "kg", "L", "rolo", "cx", "saco"];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function waLink(t) { return `https://wa.me/?text=${encodeURIComponent(t)}`; }
function fmtQty(q) { return q % 1 === 0 ? q : parseFloat(q).toFixed(2); }
function exportToCSV(rows, filename) { const csv = "sep=;\n" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"); const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

// ─── CHECKLIST ITEM ───────────────────────────────────────────
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

// ─── SETTINGS MODAL ───────────────────────────────────────────
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

// ─── CATALOG MODAL ────────────────────────────────────────────
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

// ─── SUB-ROOM with photos ─────────────────────────────────────
function SubRoom({ subroom, template, onUpdate, onDelete, roomName }) {
  const [expanded, setExpanded] = useState(subroom.expanded || false);
  const [activeTab, setActiveTab] = useState("checklist");
  const cl = subroom.checklist || [];
  const photos = subroom.photos || [];
  const done = cl.filter(c => c.status === "done").length;
  const incomplete = cl.filter(c => c.status === "incomplete").length;
  const total = cl.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  const hasIssues = incomplete > 0;
  const folder = `obracontrol/${roomName}/${subroom.name}`.replace(/\s+/g, "_");
  function toggleExp() { setExpanded(v => !v); onUpdate({ ...subroom, expanded: !expanded }); }
  return (
    <div style={{ marginLeft: 20, borderLeft: "2px solid #e2e8f0", paddingLeft: 12, marginBottom: 8 }}>
      <div onClick={toggleExp} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: hasIssues ? "#fff1f2" : allDone ? "#f0fdf4" : "#f8fafc", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${hasIssues ? "#fecaca" : allDone ? "#bbf7d0" : "#e2e8f0"}` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: hasIssues ? "#ef4444" : allDone ? "#22c55e" : pct > 0 ? "#f59e0b" : "#e2e8f0" }} />
        <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subroom.name}</span>
        {photos.length > 0 && <span style={{ padding: "2px 7px", borderRadius: 99, background: "#fef3c7", color: "#d97706", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>📷 {photos.length}</span>}
        <span style={{ padding: "2px 9px", borderRadius: 99, fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, background: hasIssues ? "#fee2e2" : allDone ? "#dcfce7" : "#f1f5f9", color: hasIssues ? "#dc2626" : allDone ? "#16a34a" : "#94a3b8", flexShrink: 0 }}>⚡ {done}/{total}</span>
        <span onClick={e => e.stopPropagation()}><ConfirmDeleteBtn onConfirm={onDelete} message={`Apagar "${subroom.name}"?`} /></span>
        <span style={{ color: "#94a3b8", fontSize: 11, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s", flexShrink: 0 }}>▼</span>
      </div>
      {expanded && (
        <div style={{ background: "#fff", borderRadius: "0 0 10px 10px", border: "1.5px solid #e2e8f0", borderTop: "none", marginTop: -2 }}>
          {/* Inner tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
            {[{ key: "checklist", label: "✅ Checklist" }, { key: "photos", label: `📷 Fotos${photos.length > 0 ? ` (${photos.length})` : ""}` }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: "8px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12, color: activeTab === t.key ? "#6366f1" : "#94a3b8", borderBottom: activeTab === t.key ? "2px solid #6366f1" : "2px solid transparent", marginBottom: -1 }}>{t.label}</button>
            ))}
          </div>
          {activeTab === "checklist" && <Checklist checklist={cl} onUpdate={cl => onUpdate({ ...subroom, checklist: cl })} />}
          {activeTab === "photos" && (
            <PhotoUploader photos={photos} onUpdate={ph => onUpdate({ ...subroom, photos: ph })} folder={folder} label="Adicionar fotos à sub-sala" />
          )}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, template, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(room.expanded || false);
  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(room.name);
  const [sortAlpha, setSortAlpha] = useState(false);
  const subrooms = room.subrooms || [];
  const sorted = sortAlpha ? [...subrooms].sort((a, b) => a.name.localeCompare(b.name)) : subrooms;
  const allCl = subrooms.flatMap(s => s.checklist || []);
  const done = allCl.filter(c => c.status === "done").length;
  const incomplete = allCl.filter(c => c.status === "incomplete").length;
  const total = allCl.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  const hasIssues = incomplete > 0;
  const totalPhotos = subrooms.reduce((a, s) => a + (s.photos?.length || 0), 0);
  function addSubRoom() { if (!newSubName.trim()) return; onUpdate({ ...room, subrooms: [...subrooms, { id: genId(), name: newSubName.trim(), checklist: makeChecklist(template), photos: [], expanded: true }] }); setNewSubName(""); setAddingSub(false); }
  function updateSub(id, u) { onUpdate({ ...room, subrooms: subrooms.map(s => s.id === id ? u : s) }); }
  function deleteSub(id) { onUpdate({ ...room, subrooms: subrooms.filter(s => s.id !== id) }); }
  function saveName() { onUpdate({ ...room, name: nameVal }); setEditingName(false); }
  return (
    <div style={{ ...S.card, border: hasIssues ? "1.5px solid #fecaca" : allDone ? "1.5px solid #bbf7d0" : "1.5px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: hasIssues ? "#fff1f2" : allDone ? "#f0fdf4" : "#f8fafc", borderBottom: expanded ? "1.5px solid #e2e8f0" : "none", cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, background: hasIssues ? "#ef4444" : allDone ? "#22c55e" : pct > 0 ? "#f59e0b" : "#e2e8f0", boxShadow: hasIssues ? "0 0 0 3px #fecaca" : allDone ? "0 0 0 3px #dcfce7" : "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (<input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === "Enter" && saveName()} onClick={e => e.stopPropagation()} style={{ ...S.input, fontWeight: 700, fontSize: 15, padding: "4px 8px" }} />) : (<div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.name}</div>)}
          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'Sora',sans-serif", marginTop: 2 }}>{subrooms.length} sub-sala(s){totalPhotos > 0 ? ` · 📷 ${totalPhotos} foto(s)` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {hasIssues && <span style={{ padding: "2px 8px", borderRadius: 99, background: "#fee2e2", color: "#dc2626", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700 }}>⚠️ {incomplete}</span>}
          <span style={{ padding: "3px 10px", borderRadius: 99, fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, background: hasIssues ? "#fee2e2" : allDone ? "#dcfce7" : pct > 0 ? "#fef3c7" : "#f1f5f9", color: hasIssues ? "#dc2626" : allDone ? "#16a34a" : pct > 0 ? "#d97706" : "#94a3b8" }}>⚡ {done}/{total}</span>
          <button onClick={e => { e.stopPropagation(); setEditingName(true); }} style={{ ...S.btnSmall, background: "transparent", border: "none", fontSize: 13 }}>✏️</button>
          <span onClick={e => e.stopPropagation()}><ConfirmDeleteBtn onConfirm={onDelete} message={`Apagar "${room.name}" e todas as sub-salas?`} /></span>
          <span style={{ color: "#94a3b8", fontSize: 12, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.25s" }}>▼</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#64748b", fontWeight: 600, alignSelf: "center" }}>Sub-salas:</span>
            <button onClick={() => setSortAlpha(v => !v)} style={{ ...S.btnSmall, fontSize: 11, padding: "3px 10px", background: sortAlpha ? "#eef2ff" : "#f1f5f9", color: sortAlpha ? "#6366f1" : "#64748b", border: sortAlpha ? "1.5px solid #c7d2fe" : "1.5px solid #e2e8f0" }}>🔡 A→Z</button>
          </div>
          {sorted.length === 0 && <div style={{ textAlign: "center", padding: "16px", color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13 }}>Sem sub-salas.</div>}
          {sorted.map(sub => (<SubRoom key={sub.id} subroom={sub} template={template} roomName={room.name} onUpdate={u => updateSub(sub.id, u)} onDelete={() => deleteSub(sub.id)} />))}
          {addingSub ? (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addSubRoom(); if (e.key === "Escape") setAddingSub(false); }} placeholder="Nome da sub-sala…" style={{ ...S.input, flex: 1, fontSize: 13 }} />
              <button onClick={addSubRoom} style={{ ...S.btnPrimary, padding: "8px 14px", fontSize: 13 }}>Adicionar</button>
              <button onClick={() => setAddingSub(false)} style={{ ...S.btnGhost, padding: "8px 10px", fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAddingSub(true)} style={{ marginTop: 8, background: "transparent", border: "1.5px dashed #a5b4fc", borderRadius: 9, padding: "7px 14px", cursor: "pointer", color: "#6366f1", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, width: "100%", textAlign: "left" }}>+ Adicionar Sub-sala</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CHECKLIST TAB ────────────────────────────────────────────
function ChecklistTab() {
  const [rooms, setRooms, roomsLoading] = useFirebase("rooms2", DEF_ROOMS);
  const [template, setTemplate, tplLoading] = useFirebase("template", INITIAL_TEMPLATE);
  const [showSettings, setShowSettings] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [search, setSearch] = useState("");
  const [sortAlpha, setSortAlpha] = useState(false);
  const loading = roomsLoading || tplLoading;
  const filtered = (rooms || []).filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const displayed = sortAlpha ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered;
  function addRoom() { if (!newRoomName.trim()) return; setRooms([...(rooms || []), { id: genId(), name: newRoomName.trim(), subrooms: [], expanded: true }]); setNewRoomName(""); setAddingRoom(false); }
  function updateRoom(id, u) { setRooms((rooms || []).map(r => r.id === id ? u : r)); }
  function deleteRoom(id) { setRooms((rooms || []).filter(r => r.id !== id)); }
  const allCl = (rooms || []).flatMap(r => (r.subrooms || []).flatMap(s => s.checklist || []));
  const doneItems = allCl.filter(c => c.status === "done").length;
  const incItems = allCl.filter(c => c.status === "incomplete").length;
  const totalItems = allCl.length;
  const globalPct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}><div style={{ width: 24, height: 24, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />A sincronizar…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showSettings && <SettingsModal template={template} onSave={t => { setTemplate(t); setShowSettings(false); }} onClose={() => setShowSettings(false)} />}
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 24 }}>⚡</span><div><div style={{ color: "#94a3b8", fontSize: 10, fontFamily: "'Sora',sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Progresso Global</div><div style={{ color: "#fff", fontSize: 20, fontWeight: 800, fontFamily: "'Sora',sans-serif" }}>{doneItems} / {totalItems}</div></div></div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ height: 8, background: "#334155", borderRadius: 99, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${globalPct}%`, background: "linear-gradient(90deg,#6366f1,#22c55e)", borderRadius: 99 }} />
              {incItems > 0 && <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${Math.round((incItems / totalItems) * 100)}%`, background: "#ef4444", opacity: 0.8 }} />}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
              <span style={{ color: "#64748b", fontSize: 11, fontFamily: "'Sora',sans-serif", fontWeight: 600 }}>{globalPct}% concluído</span>
              {incItems > 0 && <span style={{ color: "#ef4444", fontSize: 11, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>⚠️ {incItems} incompleto(s)</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} /><span style={{ color: "#22c55e", fontSize: 11, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>LIVE</span>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 Pesquisar sala…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 150 }} />
        <button onClick={() => setSortAlpha(v => !v)} style={{ ...S.btnGhost, border: sortAlpha ? "1.5px solid #6366f1" : "1.5px solid #e2e8f0", color: sortAlpha ? "#6366f1" : "#64748b", fontSize: 13 }}>🔡 A→Z</button>
        <button onClick={() => setShowSettings(true)} style={{ ...S.btnGhost, border: "1.5px solid #c7d2fe", color: "#6366f1", fontSize: 13 }}>⚙️</button>
        <button onClick={() => setAddingRoom(true)} style={S.btnPrimary}>+ Nova Sala</button>
      </div>
      {addingRoom && (
        <div style={S.card}>
          <div style={S.cardHeader}>Nova Sala Principal</div>
          <div style={{ padding: "14px 20px" }}><label style={S.label}>Nome *</label><input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} onKeyDown={e => e.key === "Enter" && addRoom()} style={S.input} placeholder="Ex: Bloco A, Piso 1…" /></div>
          <div style={{ display: "flex", gap: 10, padding: "0 20px 16px" }}><button onClick={addRoom} style={S.btnPrimary}>Criar</button><button onClick={() => setAddingRoom(false)} style={S.btnGhost}>Cancelar</button></div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayed.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Sem salas.</div>}
        {displayed.map(room => (<RoomCard key={room.id} room={room} template={template} onUpdate={u => updateRoom(room.id, u)} onDelete={() => deleteRoom(room.id)} />))}
      </div>
    </div>
  );
}

// ─── PHOTOS TAB ───────────────────────────────────────────────
function PhotosTab() {
  const [rooms, , loading] = useFirebase("rooms2", DEF_ROOMS);
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState(null);

  const allRooms = rooms || [];

  // Build flat list of all photos with room/subroom context
  const allPhotos = [];
  allRooms.forEach(room => {
    (room.subrooms || []).forEach(sub => {
      (sub.photos || []).forEach(photo => {
        allPhotos.push({ ...photo, roomName: room.name, roomId: room.id, subName: sub.name, subId: sub.id });
      });
    });
  });

  // Filter by search (room name or sub-room name)
  const filtered = allPhotos.filter(p =>
    p.roomName.toLowerCase().includes(search.toLowerCase()) ||
    p.subName.toLowerCase().includes(search.toLowerCase()) ||
    (p.caption || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by room
  const grouped = {};
  filtered.forEach(p => {
    if (!grouped[p.roomId]) grouped[p.roomId] = { roomName: p.roomName, subs: {} };
    if (!grouped[p.roomId].subs[p.subId]) grouped[p.roomId].subs[p.subId] = { subName: p.subName, photos: [] };
    grouped[p.roomId].subs[p.subId].photos.push(p);
  });

  const totalPhotos = allPhotos.length;

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header stats */}
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 24 }}>📷</span>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 10, fontFamily: "'Sora',sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Total de Fotos</div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, fontFamily: "'Sora',sans-serif" }}>{totalPhotos} foto(s)</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ color: "#22c55e", fontSize: 11, fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* Search */}
      <input placeholder="🔍 Pesquisar por sala, sub-sala ou legenda…" value={search} onChange={e => setSearch(e.target.value)} style={S.input} />

      {/* No photos */}
      {totalPhotos === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Ainda sem fotos</div>
          <div style={{ fontSize: 13 }}>Vai à aba Checklist, abre uma sub-sala e adiciona fotos.</div>
        </div>
      )}

      {filtered.length === 0 && totalPhotos > 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Nenhuma foto encontrada para "{search}".</div>
      )}

      {/* Grouped by room */}
      {Object.values(grouped).map(group => (
        <div key={group.roomName} style={S.card}>
          <div style={S.cardHeader}>🏠 {group.roomName}</div>
          {Object.values(group.subs).map(sub => (
            <div key={sub.subName} style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#6366f1", marginBottom: 10 }}>↳ {sub.subName} <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 11 }}>({sub.photos.length} foto(s))</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                {sub.photos.map(photo => (
                  <div key={photo.id} style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid #e2e8f0", cursor: "pointer" }} onClick={() => setLightbox(photo)}>
                    <img src={photo.url} alt={photo.caption || "foto"} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                    {photo.caption && <div style={{ padding: "5px 8px", fontFamily: "'Sora',sans-serif", fontSize: 11, color: "#64748b", background: "#fff" }}>{photo.caption}</div>}
                    <div style={{ padding: "3px 8px 5px", fontFamily: "'Sora',sans-serif", fontSize: 10, color: "#94a3b8", background: "#fff" }}>
                      {new Date(photo.uploadedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setLightbox(null)}>
          <div style={{ color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 12, marginBottom: 10 }}>{lightbox.roomName} → {lightbox.subName}</div>
          <img src={lightbox.url} alt={lightbox.caption || "foto"} style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 12, objectFit: "contain" }} onClick={e => e.stopPropagation()} />
          {lightbox.caption && <div style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontSize: 14, marginTop: 10, textAlign: "center" }}>{lightbox.caption}</div>}
          <div style={{ color: "#64748b", fontFamily: "'Sora',sans-serif", fontSize: 11, marginTop: 4 }}>
            {new Date(lightbox.uploadedAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
          <button onClick={() => setLightbox(null)} style={{ marginTop: 16, padding: "8px 24px", background: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13 }}>Fechar</button>
        </div>
      )}
    </div>
  );
}

// ─── DIÁRIO DE OBRA TAB ───────────────────────────────────────
function TasksTab() {
  const [subTab, setSubTab] = useState("tarefas");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Sub-menu */}
      <div style={{ display: "flex", gap: 0, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
        {[{ key: "tarefas", label: "✅ Tarefas" }, { key: "notas", label: "📝 Notas" }].map(s => (
          <button key={s.key} onClick={() => setSubTab(s.key)} style={{ flex: 1, padding: "10px 16px", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, background: subTab === s.key ? "#fff" : "transparent", color: subTab === s.key ? "#1e293b" : "#94a3b8", boxShadow: subTab === s.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.2s" }}>{s.label}</button>
        ))}
      </div>
      {subTab === "tarefas" && <TarefasSection />}
      {subTab === "notas" && <NotasSection />}
    </div>
  );
}

function TarefasSection() {
  const [tasks, setTasks, loading] = useFirebase("tasks", DEF_TASKS);
  const [newTask, setNewTask] = useState({ text: "", priority: "media", date: "", tags: [] });
  const [filter, setFilter] = useState("todas");
  const [filterTag, setFilterTag] = useState("");
  const [obsOpen, setObsOpen] = useState({});
  const [editTagsId, setEditTagsId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  function addTask() {
    if (!newTask.text.trim()) return;
    setTasks([{ ...newTask, id: genId(), done: false, doneAt: null, doneObs: "" }, ...(tasks || [])]);
    setNewTask({ text: "", priority: "media", date: "", tags: [] });
  }
  function toggleDone(id) { setTasks((tasks || []).map(t => { if (t.id !== id) return t; const nd = !t.done; return { ...t, done: nd, doneAt: nd ? new Date().toISOString() : null, doneObs: nd ? (t.doneObs || "") : "" }; })); }
  function updateDoneObs(id, val) { setTasks((tasks || []).map(t => t.id === id ? { ...t, doneObs: val } : t)); }
  function toggleNewTag(val) { setNewTask(n => ({ ...n, tags: (n.tags || []).includes(val) ? (n.tags || []).filter(t => t !== val) : [...(n.tags || []), val] })); }
  function toggleTaskTag(taskId, tagVal) { setTasks((tasks || []).map(t => { if (t.id !== taskId) return t; const tags = (t.tags || []).includes(tagVal) ? (t.tags || []).filter(v => v !== tagVal) : [...(t.tags || []), tagVal]; return { ...t, tags }; })); }

  function onDragStart(id) { setDragId(id); }
  function onDragOver(e, id) { e.preventDefault(); setDragOver(id); }
  function onDrop(id) {
    if (!dragId || dragId === id) { setDragId(null); setDragOver(null); return; }
    const arr = [...(tasks || [])];
    const fromIdx = arr.findIndex(t => t.id === dragId);
    const toIdx = arr.findIndex(t => t.id === id);
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setTasks(arr);
    setDragId(null); setDragOver(null);
  }

  const allTasks = tasks || [];
  const filtered = allTasks.filter(t => {
    const matchFilter = filter === "pendentes" ? !t.done : filter === "concluídas" ? t.done : true;
    const matchTag = filterTag ? (t.tags || []).includes(filterTag) : true;
    return matchFilter && matchTag;
  });
  const counts = { total: allTasks.length, done: allTasks.filter(t => t.done).length };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[{ label: "Total", val: counts.total, color: "#6366f1" }, { label: "Pendentes", val: counts.total - counts.done, color: "#f59e0b" }, { label: "Concluídas", val: counts.done, color: "#22c55e" }].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 20px", display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Sora',sans-serif" }}>{s.val}</span>
            <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>{s.label}</span>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 180, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%`, background: "linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: 99, transition: "width 0.5s" }} /></div>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, color: "#22c55e", fontSize: 14 }}>{counts.total ? Math.round((counts.done / counts.total) * 100) : 0}%</span>
        </div>
      </div>

      {/* Nova tarefa */}
      <div style={S.card}>
        <div style={S.cardHeader}>Nova Tarefa</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "16px 20px" }}>
          <input placeholder="Descrição da tarefa…" value={newTask.text} onChange={e => setNewTask(n => ({ ...n, text: e.target.value }))} onKeyDown={e => e.key === "Enter" && addTask()} style={S.input} />
          <select value={newTask.priority} onChange={e => setNewTask(n => ({ ...n, priority: e.target.value }))} style={S.input}>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          <input type="date" value={newTask.date} onChange={e => setNewTask(n => ({ ...n, date: e.target.value }))} style={S.input} />
        </div>
        <div style={{ padding: "0 20px 12px" }}>
          <label style={S.label}>Etiquetas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {TAGS.map(tag => { const active = (newTask.tags || []).includes(tag.value); return (<button key={tag.value} onClick={() => toggleNewTag(tag.value)} style={{ padding: "4px 12px", borderRadius: 99, border: `2px solid ${active ? tag.color : "#e2e8f0"}`, background: active ? tag.color : "transparent", color: active ? "#fff" : "#64748b", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{tag.label}</button>); })}
          </div>
        </div>
        <div style={{ padding: "0 20px 16px", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={addTask} style={S.btnPrimary}>+ Adicionar</button>
          {newTask.text.trim() && (
            <a href={waLink(`🏗️ Nova tarefa na obra:\n"${newTask.text}"\nPrioridade: ${PRIORITIES.find(p => p.value === newTask.priority)?.label}${newTask.date ? `\nData: ${newTask.date}` : ""}${(newTask.tags || []).length > 0 ? `\nEtiquetas: ${(newTask.tags || []).map(v => TAGS.find(t => t.value === v)?.label).join(", ")}` : ""}\n\nhttps://obracontrol-beta.vercel.app`)} target="_blank" rel="noreferrer" style={{ padding: "9px 14px", background: "#25d366", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>📲 WhatsApp</a>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["todas", "pendentes", "concluídas"].map(f => (<button key={f} onClick={() => setFilter(f)} style={{ ...S.btnGhost, background: filter === f ? "#1e293b" : "transparent", color: filter === f ? "#fff" : "#64748b", textTransform: "capitalize" }}>{f}</button>))}
        <div style={{ width: 1, background: "#e2e8f0", margin: "0 4px" }} />
        <button onClick={() => setFilterTag("")} style={{ ...S.btnGhost, background: !filterTag ? "#eef2ff" : "transparent", color: !filterTag ? "#6366f1" : "#94a3b8", fontSize: 12 }}>Todas</button>
        {TAGS.map(tag => (<button key={tag.value} onClick={() => setFilterTag(filterTag === tag.value ? "" : tag.value)} style={{ padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${filterTag === tag.value ? tag.color : "#e2e8f0"}`, background: filterTag === tag.value ? tag.color : "transparent", color: filterTag === tag.value ? "#fff" : "#64748b", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{tag.label}</button>))}
      </div>

      <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>↕️ Arrasta para reordenar · 🏷️ para editar etiquetas</div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Nenhuma tarefa.</div>}
        {filtered.map(task => {
          const pri = PRIORITIES.find(p => p.value === task.priority);
          const isOpen = obsOpen[task.id];
          const taskTags = TAGS.filter(t => (task.tags || []).includes(t.value));
          const isDragging = dragId === task.id;
          const isOver = dragOver === task.id;
          const isEditingTags = editTagsId === task.id;
          return (
            <div key={task.id} draggable onDragStart={() => onDragStart(task.id)} onDragOver={e => onDragOver(e, task.id)} onDrop={() => onDrop(task.id)} onDragEnd={() => { setDragId(null); setDragOver(null); }} style={{ ...S.card, padding: 0, border: isOver ? "2px dashed #6366f1" : task.done ? "1.5px solid #bbf7d0" : "1.5px solid #e2e8f0", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.2s, border 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
                <span style={{ color: "#cbd5e1", fontSize: 16, cursor: "grab", flexShrink: 0 }}>⠿</span>
                <button onClick={() => toggleDone(task.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2.5px solid ${task.done ? "#22c55e" : "#cbd5e1"}`, background: task.done ? "#22c55e" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {task.done && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 500, color: "#1e293b", textDecoration: task.done ? "line-through" : "none", fontSize: 14 }}>{task.text}</div>
                  {taskTags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                      {taskTags.map(tag => (<span key={tag.value} style={{ padding: "2px 8px", borderRadius: 99, background: tag.color + "22", color: tag.color, fontFamily: "'Sora',sans-serif", fontSize: 10, fontWeight: 700 }}>{tag.label}</span>))}
                    </div>
                  )}
                  {task.done && task.doneAt && <div style={{ fontSize: 11, color: "#22c55e", fontFamily: "'Sora',sans-serif", marginTop: 2 }}>✓ {new Date(task.doneAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
                  {task.done && task.doneObs && <div style={{ fontSize: 12, color: "#16a34a", fontFamily: "'Sora',sans-serif", fontStyle: "italic", marginTop: 2 }}>💬 {task.doneObs}</div>}
                </div>
                <span style={{ padding: "2px 9px", borderRadius: 99, background: pri?.color + "22", color: pri?.color, fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{pri?.label}</span>
                {task.date && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>📅 {task.date}</span>}
                {/* Edit tags btn */}
                <button onClick={() => setEditTagsId(isEditingTags ? null : task.id)} style={{ ...S.btnSmall, background: isEditingTags ? "#eef2ff" : "#f1f5f9", color: isEditingTags ? "#6366f1" : "#94a3b8", fontSize: 12, flexShrink: 0 }} title="Editar etiquetas">🏷️</button>
                {/* WhatsApp */}
                <a href={waLink(`🏗️ Tarefa:\n"${task.text}"\nPrioridade: ${pri?.label}${task.date ? `\nData: ${task.date}` : ""}${taskTags.length > 0 ? `\nEtiquetas: ${taskTags.map(t => t.label).join(", ")}` : ""}\n\nhttps://obracontrol-beta.vercel.app`)} target="_blank" rel="noreferrer" style={{ padding: "4px 8px", background: "#25d366", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 11, textDecoration: "none", flexShrink: 0 }}>📲</a>
                {task.done && <button onClick={() => setObsOpen(o => ({ ...o, [task.id]: !o[task.id] }))} style={{ ...S.btnSmall, background: isOpen ? "#dcfce7" : "#f1f5f9", color: "#16a34a", fontSize: 13 }}>💬</button>}
                <ConfirmDeleteBtn onConfirm={() => setTasks((tasks || []).filter(t => t.id !== task.id))} message={`Apagar "${task.text}"?`} />
              </div>
              {/* Edit tags panel */}
              {isEditingTags && (
                <div style={{ padding: "8px 16px 12px", borderTop: "1px solid #f1f5f9", background: "#fafbff" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Sora',sans-serif", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar Etiquetas</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {TAGS.map(tag => { const active = (task.tags || []).includes(tag.value); return (<button key={tag.value} onClick={() => toggleTaskTag(task.id, tag.value)} style={{ padding: "4px 10px", borderRadius: 99, border: `2px solid ${active ? tag.color : "#e2e8f0"}`, background: active ? tag.color : "transparent", color: active ? "#fff" : "#64748b", fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{tag.label}</button>); })}
                  </div>
                </div>
              )}
              {task.done && isOpen && (
                <div style={{ padding: "0 16px 12px", borderTop: "1px solid #dcfce7" }}>
                  <input placeholder="Observação sobre a conclusão…" value={task.doneObs || ""} onChange={e => updateDoneObs(task.id, e.target.value)} style={{ ...S.input, fontSize: 13, background: "#f0fdf4", border: "1.5px solid #bbf7d0", marginTop: 10 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── NOTAS SECTION ────────────────────────────────────────────
function NotasSection() {
  const [notes, setNotes, loading] = useFirebase("notes", []);
  const [newNote, setNewNote] = useState({ text: "", date: todayStr() });
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  function addNote() {
    if (!newNote.text.trim()) return;
    setNotes([{ ...newNote, id: genId(), createdAt: new Date().toISOString() }, ...(notes || [])]);
    setNewNote({ text: "", date: todayStr() });
  }
  function deleteNote(id) { setNotes((notes || []).filter(n => n.id !== id)); }
  function startEdit(note) { setEditId(note.id); setEditText(note.text); }
  function saveEdit(id) { setNotes((notes || []).map(n => n.id === id ? { ...n, text: editText } : n)); setEditId(null); }

  const allNotes = notes || [];
  const filtered = allNotes.filter(n => n.text.toLowerCase().includes(search.toLowerCase()) || (n.date || "").includes(search));

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Nova nota */}
      <div style={S.card}>
        <div style={S.cardHeader}>Nova Nota</div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={S.label}>Data</label>
            <input type="date" value={newNote.date} onChange={e => setNewNote(n => ({ ...n, date: e.target.value }))} style={{ ...S.input, maxWidth: 180 }} />
          </div>
          <div>
            <label style={S.label}>Nota *</label>
            <textarea
              value={newNote.text}
              onChange={e => setNewNote(n => ({ ...n, text: e.target.value }))}
              placeholder="Escreve aqui a situação ou ocorrência da obra… Ex: Falta de energia no bloco B, Visita do fiscal às 14h, Chuva intensa parou os trabalhos…"
              rows={3}
              style={{ ...S.input, resize: "vertical", lineHeight: 1.6, fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={addNote} style={S.btnPrimary}>+ Adicionar Nota</button>
            {newNote.text.trim() && (
              <a href={waLink(`📝 Nota de obra:\n"${newNote.text}"\nData: ${newNote.date}\n\nhttps://obracontrol-beta.vercel.app`)} target="_blank" rel="noreferrer" style={{ padding: "9px 14px", background: "#25d366", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>📲 WhatsApp</a>
            )}
          </div>
        </div>
      </div>

      {/* Pesquisa */}
      <input placeholder="🔍 Pesquisar notas…" value={search} onChange={e => setSearch(e.target.value)} style={S.input} />

      {/* Stats */}
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#94a3b8" }}>
        {filtered.length} nota(s) {search ? `para "${search}"` : "no total"}
      </div>

      {/* Lista de notas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Nenhuma nota.</div>}
        {filtered.map(note => (
          <div key={note.id} style={{ ...S.card, padding: 0, border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {editId === note.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} style={{ ...S.input, resize: "vertical", fontSize: 13, lineHeight: 1.6 }} autoFocus />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveEdit(note.id)} style={{ ...S.btnPrimary, padding: "6px 14px", fontSize: 13 }}>✓ Guardar</button>
                      <button onClick={() => setEditId(null)} style={{ ...S.btnGhost, padding: "6px 12px", fontSize: 13 }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, color: "#1e293b", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{note.text}</div>
                )}
                <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: "#94a3b8" }}>
                    📅 {new Date((note.date || note.createdAt?.slice(0,10)) + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a href={waLink(`📝 Nota de obra:\n"${note.text}"\nData: ${note.date}\n\nhttps://obracontrol-beta.vercel.app`)} target="_blank" rel="noreferrer" style={{ padding: "4px 8px", background: "#25d366", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>📲</a>
                {editId !== note.id && <button onClick={() => startEdit(note)} style={{ ...S.btnSmall, fontSize: 13 }}>✏️</button>}
                <ConfirmDeleteBtn onConfirm={() => deleteNote(note.id)} message="Apagar esta nota?" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STOCK TAB ────────────────────────────────────────────────
function StockTab() {
  const [entries, setEntries, loading] = useFirebase("stock", DEF_STOCK);
  const [inventory, setInventory, invLoading] = useFirebase("inventory", DEF_INVENTORY);
  const [catalog, setCatalog, catLoading] = useFirebase("catalog", INITIAL_CATALOG);
  const [showCatalog, setShowCatalog] = useState(false);
  const [activeSection, setActiveSection] = useState("inventory");
  const [selectedId, setSelectedId] = useState(""); const [qty, setQty] = useState(""); const [date, setDate] = useState(todayStr()); const [obs, setObs] = useState("");
  const [invSelectedId, setInvSelectedId] = useState(""); const [invQty, setInvQty] = useState(""); const [invObs, setInvObs] = useState("");
  const [filterFrom, setFilterFrom] = useState(""); const [filterTo, setFilterTo] = useState(""); const [search, setSearch] = useState("");
  const cat = catalog || []; const selected = cat.find(c => c.id === selectedId); const invSelected = cat.find(c => c.id === invSelectedId);
  const inv = inventory || []; const all = entries || [];
  const stockMap = {};
  inv.forEach(i => { stockMap[i.materialId] = (stockMap[i.materialId] || 0) + i.qty; });
  all.forEach(e => { if (e.materialId) { stockMap[e.materialId] = (stockMap[e.materialId] || 0) - e.qty; } });
  function addEntry() { if (!selected || !qty) return; setEntries([...all, { id: genId(), materialId: selected.id, code: selected.code || "", name: selected.name, unit: selected.unit, qty: parseFloat(qty), date, obs }]); setQty(""); setObs(""); }
  function addInventory() { if (!invSelected || !invQty) return; setInventory([...inv, { id: genId(), materialId: invSelected.id, code: invSelected.code || "", name: invSelected.name, unit: invSelected.unit, qty: parseFloat(invQty), date: todayStr(), obs: invObs }]); setInvQty(""); setInvObs(""); }
  function deleteEntry(id) { setEntries(all.filter(e => e.id !== id)); }
  function deleteInventory(id) { setInventory(inv.filter(i => i.id !== id)); }
  const filtered = all.filter(e => { const ms = e.name.toLowerCase().includes(search.toLowerCase()) || (e.code || "").toLowerCase().includes(search.toLowerCase()); const mf = filterFrom ? e.date >= filterFrom : true; const mt = filterTo ? e.date <= filterTo : true; return ms && mf && mt; });
  const summary = {}; filtered.forEach(e => { const k = `${e.name}__${e.unit}`; if (!summary[k]) summary[k] = { code: e.code || "", name: e.name, unit: e.unit, total: 0 }; summary[k].total += e.qty; });
  const summaryList = Object.values(summary).sort((a, b) => a.name.localeCompare(b.name));
  const byDay = {}; filtered.forEach(e => { if (!byDay[e.date]) byDay[e.date] = []; byDay[e.date].push(e); });
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  function doExportEntries() { exportToCSV([["Data", "Código", "Material", "Quantidade", "Unidade", "Observações"], ...filtered.map(e => [e.date, e.code || "", e.name, e.qty, e.unit, e.obs || ""])], `materiais_gastos.csv`); }
  if (loading || catLoading || invLoading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showCatalog && <CatalogModal catalog={cat} onSave={c => { setCatalog(c); setShowCatalog(false); }} onClose={() => setShowCatalog(false)} />}
      <div style={{ display: "flex", gap: 0, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
        {[{ key: "inventory", label: "📥 Stock na Obra" }, { key: "register", label: "📤 Registar Uso" }].map(sec => (
          <button key={sec.key} onClick={() => setActiveSection(sec.key)} style={{ flex: 1, padding: "10px 16px", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, background: activeSection === sec.key ? "#fff" : "transparent", color: activeSection === sec.key ? "#1e293b" : "#94a3b8", boxShadow: activeSection === sec.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{sec.label}</button>
        ))}
      </div>
      {activeSection === "inventory" && (
        <>
          <div style={S.card}>
            <div style={{ ...S.cardHeader, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>📥 Entrada de Material em Stock</span>
              <button onClick={() => setShowCatalog(true)} style={{ ...S.btnGhost, fontSize: 12, padding: "5px 12px", border: "1.5px solid #c7d2fe", color: "#6366f1" }}>⚙️ Catálogo</button>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <label style={S.label}>Selecionar material *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                {cat.map(item => { const sq = stockMap[item.id] || 0; const isLow = sq > 0 && sq < 5; const isEmpty = sq <= 0; return (<button key={item.id} onClick={() => setInvSelectedId(item.id)} style={{ padding: "6px 12px", borderRadius: 99, border: `2px solid ${invSelectedId === item.id ? "#6366f1" : "#e2e8f0"}`, background: invSelectedId === item.id ? "#6366f1" : "#f8fafc", color: invSelectedId === item.id ? "#fff" : "#475569", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{item.code && <span style={{ opacity: 0.7, fontSize: 10, fontFamily: "monospace" }}>{item.code}</span>}{item.name}<span style={{ padding: "1px 6px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: invSelectedId === item.id ? "rgba(255,255,255,0.25)" : isEmpty ? "#fee2e2" : isLow ? "#fef3c7" : "#dcfce7", color: invSelectedId === item.id ? "#fff" : isEmpty ? "#dc2626" : isLow ? "#d97706" : "#16a34a" }}>{fmtQty(sq)} {item.unit}</span></button>); })}
              </div>
              {invSelected && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div><label style={S.label}>Quantidade *</label><input type="number" min="0" step="0.1" value={invQty} onChange={e => setInvQty(e.target.value)} style={S.input} placeholder="0" /></div><div><label style={S.label}>Observação</label><input value={invObs} onChange={e => setInvObs(e.target.value)} style={S.input} placeholder="Fornecedor, guia…" /></div></div>)}
            </div>
            {invSelected && <div style={{ padding: "0 18px 16px" }}><button onClick={addInventory} style={S.btnPrimary}>+ Dar entrada de {invSelected.name}</button></div>}
          </div>
          <div style={S.card}>
            <div style={S.cardHeader}>📊 Stock Atual na Obra</div>
            <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              {cat.map(item => { const sq = stockMap[item.id] || 0; const entradas = inv.filter(i => i.materialId === item.id).reduce((a, i) => a + i.qty, 0); const saidas = all.filter(e => e.materialId === item.id).reduce((a, e) => a + e.qty, 0); const isLow = sq > 0 && sq < 5; const isEmpty = sq <= 0; return (<div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${isEmpty ? "#fee2e2" : isLow ? "#fef3c7" : "#e2e8f0"}`, background: isEmpty ? "#fff1f2" : isLow ? "#fffbeb" : "#f8fafc" }}>{item.code && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>{item.code}</span>}<span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{item.name}</span><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: isEmpty ? "#dc2626" : isLow ? "#d97706" : "#16a34a" }}>{fmtQty(sq)} {item.unit}</div><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 10, color: "#94a3b8" }}>↑{fmtQty(entradas)} · ↓{fmtQty(saidas)}</div></div>{isEmpty && <span>⚠️</span>}</div>); })}
            </div>
          </div>
          {inv.length > 0 && (<div style={S.card}><div style={S.cardHeader}>📋 Histórico de Entradas</div>{[...inv].reverse().map((e, idx) => (<div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: idx < inv.length - 1 ? "1px solid #f1f5f9" : "none" }}>{e.code && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>{e.code}</span>}<span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{e.name}</span><span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: "#22c55e", flexShrink: 0 }}>+{fmtQty(e.qty)} {e.unit}</span><span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>📅 {e.date}</span>{e.obs && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>💬 {e.obs}</span>}<ConfirmDeleteBtn onConfirm={() => deleteInventory(e.id)} /></div>))}</div>)}
        </>
      )}
      {activeSection === "register" && (
        <>
          <div style={S.card}>
            <div style={{ ...S.cardHeader, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>📤 Registar Material Utilizado</span>
              <button onClick={() => setShowCatalog(true)} style={{ ...S.btnGhost, fontSize: 12, padding: "5px 12px", border: "1.5px solid #c7d2fe", color: "#6366f1" }}>⚙️ Catálogo</button>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <label style={S.label}>Selecionar material *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                {cat.map(item => { const sq = stockMap[item.id] || 0; const isEmpty = sq <= 0; return (<button key={item.id} onClick={() => setSelectedId(item.id)} style={{ padding: "6px 12px", borderRadius: 99, border: `2px solid ${selectedId === item.id ? "#6366f1" : "#e2e8f0"}`, background: selectedId === item.id ? "#6366f1" : "#f8fafc", color: selectedId === item.id ? "#fff" : "#475569", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{item.code && <span style={{ opacity: 0.7, fontSize: 10, fontFamily: "monospace" }}>{item.code}</span>}{item.name}<span style={{ padding: "1px 6px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: selectedId === item.id ? "rgba(255,255,255,0.25)" : isEmpty ? "#fee2e2" : "#dcfce7", color: selectedId === item.id ? "#fff" : isEmpty ? "#dc2626" : "#16a34a" }}>{fmtQty(sq)} {item.unit}</span></button>); })}
              </div>
              {selected && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><div><label style={S.label}>Quantidade *</label><input type="number" min="0" step="0.1" value={qty} onChange={e => setQty(e.target.value)} style={{ ...S.input, borderColor: selected && qty && parseFloat(qty) > (stockMap[selected.id] || 0) ? "#ef4444" : "#e2e8f0" }} placeholder="0" />{selected && qty && parseFloat(qty) > (stockMap[selected.id] || 0) && (<div style={{ fontSize: 11, color: "#ef4444", fontFamily: "'Sora',sans-serif", marginTop: 4 }}>⚠️ Acima do stock ({fmtQty(stockMap[selected.id] || 0)} {selected.unit})</div>)}</div><div><label style={S.label}>Unidade</label><input value={selected.unit} readOnly style={{ ...S.input, background: "#f1f5f9", color: "#94a3b8" }} /></div><div><label style={S.label}>Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} /></div><div style={{ gridColumn: "1/-1" }}><label style={S.label}>Observação</label><input value={obs} onChange={e => setObs(e.target.value)} style={S.input} placeholder="Local, sala, etc…" /></div></div>)}
            </div>
            {selected && <div style={{ padding: "0 18px 16px" }}><button onClick={addEntry} style={S.btnPrimary}>+ Registar uso de {selected.name}</button></div>}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 150 }}><label style={S.label}>Pesquisar</label><input placeholder="🔍 Nome ou código…" value={search} onChange={e => setSearch(e.target.value)} style={S.input} /></div>
            <div><label style={S.label}>De</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={S.input} /></div>
            <div><label style={S.label}>Até</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={S.input} /></div>
            {(filterFrom || filterTo || search) && <button onClick={() => { setFilterFrom(""); setFilterTo(""); setSearch(""); }} style={{ ...S.btnGhost, alignSelf: "flex-end" }}>✕</button>}
            {filtered.length > 0 && <button onClick={doExportEntries} style={{ ...S.btnGhost, alignSelf: "flex-end", border: "1.5px solid #22c55e", color: "#16a34a" }}>📥 CSV</button>}
          </div>
          {summaryList.length > 0 && (<div style={S.card}><div style={S.cardHeader}>📊 Resumo{filterFrom || filterTo ? ` · ${filterFrom || "início"} → ${filterTo || "hoje"}` : " · Total"}</div><div style={{ padding: "12px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>{summaryList.map(s => (<div key={s.name + s.unit} style={{ background: "#eef2ff", border: "1.5px solid #c7d2fe", borderRadius: 10, padding: "7px 14px" }}>{s.code && <div style={{ fontFamily: "monospace", fontSize: 10, color: "#6366f1", fontWeight: 700 }}>{s.code}</div>}<div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#4338ca" }}>{s.name}</div><div style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#6366f1", fontWeight: 600 }}>{fmtQty(s.total)} {s.unit}</div></div>))}</div></div>)}
          {days.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>Nenhum registo.</div> : days.map(day => (<div key={day} style={S.card}><div style={{ ...S.cardHeader, display: "flex", alignItems: "center", gap: 8 }}><span>📅</span><span>{new Date(day + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span><span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{byDay[day].length} reg.</span></div>{byDay[day].map((e, idx) => (<div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: idx < byDay[day].length - 1 ? "1px solid #f1f5f9" : "none" }}>{e.code && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", background: "#eef2ff", padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>{e.code}</span>}<span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{e.name}</span><span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: "#6366f1", flexShrink: 0 }}>-{fmtQty(e.qty)} {e.unit}</span>{e.obs && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>💬 {e.obs}</span>}<ConfirmDeleteBtn onConfirm={() => deleteEntry(e.id)} /></div>))}</div>))}
        </>
      )}
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

  const allWorkers = workers || [];
  const allAttendance = attendance || [];
  const dayRecord = allAttendance.find(a => a.date === selDate) || { date: selDate, present: [], works: "" };
  const present = dayRecord.present || [];
  const works = dayRecord.works || "";

  function updateDayRecord(updates) {
    const newRecord = { ...dayRecord, date: selDate, ...updates };
    const exists = allAttendance.find(a => a.date === selDate);
    setAttendance(exists ? allAttendance.map(a => a.date === selDate ? newRecord : a) : [...allAttendance, newRecord]);
  }

  function toggleWorker(wid) {
    const isPresent = present.includes(wid);
    const newPresent = isPresent ? present.filter(id => id !== wid) : [...present, wid];
    updateDayRecord({ present: newPresent });
  }

  function updateWorks(val) { updateDayRecord({ works: val }); }

  function addWorker() { if (!newWorkerName.trim()) return; setWorkers([...allWorkers, { id: genId(), name: newWorkerName.trim() }]); setNewWorkerName(""); }
  function deleteWorker(id) { setWorkers(allWorkers.filter(w => w.id !== id)); }

  const histFiltered = allAttendance.filter(a => {
    const mf = filterFrom ? a.date >= filterFrom : true;
    const mt = filterTo ? a.date <= filterTo : true;
    return mf && mt && (a.present || []).length > 0;
  }).sort((a, b) => b.date.localeCompare(a.date));

  function doExport() {
    const rows = [["Data", "Funcionário", "Trabalhos Realizados"]];
    histFiltered.forEach(a => {
      const presentWorkers = allWorkers.filter(w => (a.present || []).includes(w.id));
      presentWorkers.forEach(w => rows.push([a.date, w.name, a.works || ""]));
    });
    exportToCSV(rows, `folha_ponto.csv`);
  }

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
          <div style={{ marginBottom: 12, fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#64748b" }}>
            {new Date(selDate + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} — <strong style={{ color: "#22c55e" }}>{present.length} presente(s)</strong> / {allWorkers.length}
          </div>

          {allWorkers.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13 }}>Nenhum funcionário.</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allWorkers.map(w => {
              const isPresent = present.includes(w.id);
              return (
                <button key={w.id} onClick={() => toggleWorker(w.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12, border: `2px solid ${isPresent ? "#22c55e" : "#e2e8f0"}`, background: isPresent ? "#f0fdf4" : "#f8fafc", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${isPresent ? "#22c55e" : "#cbd5e1"}`, background: isPresent ? "#22c55e" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isPresent && <svg width="14" height="14" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ flex: 1, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 15, color: isPresent ? "#16a34a" : "#475569" }}>{w.name}</span>
                  <span style={{ padding: "3px 12px", borderRadius: 99, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, background: isPresent ? "#dcfce7" : "#f1f5f9", color: isPresent ? "#16a34a" : "#94a3b8" }}>{isPresent ? "✓ Presente" : "Ausente"}</span>
                </button>
              );
            })}
          </div>

          {/* Trabalhos realizados no dia */}
          <div style={{ marginTop: 18, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            <label style={S.label}>🔧 Trabalhos Realizados no Dia</label>
            <textarea
              value={works}
              onChange={e => updateWorks(e.target.value)}
              placeholder="Descreve os trabalhos realizados hoje… Ex: Passagem de cabos no piso 2, instalação de tomadas no quarto 3…"
              rows={3}
              style={{ ...S.input, resize: "vertical", lineHeight: 1.5, fontSize: 13 }}
            />
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
        {histFiltered.length === 0
          ? <div style={{ textAlign: "center", padding: 30, color: "#94a3b8", fontFamily: "'Sora',sans-serif", fontSize: 13 }}>Nenhum registo.</div>
          : histFiltered.map(a => {
              const presentNames = allWorkers.filter(w => (a.present || []).includes(w.id));
              return (
                <div key={a.date} style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#1e293b", marginBottom: 8 }}>
                    📅 {new Date(a.date + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                    <span style={{ marginLeft: 10, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{presentNames.length} presente(s)</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: a.works ? 8 : 0 }}>
                    {presentNames.map(n => <span key={n.id} style={{ padding: "3px 10px", borderRadius: 99, background: "#dcfce7", color: "#16a34a", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600 }}>✓ {n.name}</span>)}
                  </div>
                  {a.works && (
                    <div style={{ marginTop: 6, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#475569" }}>
                      🔧 <em>{a.works}</em>
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────
const PIN_MASTER = "436900";

function SettingsTab() {
  const [config, setConfig, loading] = useFirebase("config", { pin: "0000" });
  const [masterInput, setMasterInput] = useState("");
  const [masterOk, setMasterOk] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [msg, setMsg] = useState(null);

  function verifyMaster() {
    if (masterInput === PIN_MASTER) { setMasterOk(true); setMasterInput(""); setMsg(null); }
    else { setMsg({ type: "error", text: "PIN Master incorreto." }); setMasterInput(""); }
  }

  function changePin() {
    if (!/^\d{4,6}$/.test(newPin)) { setMsg({ type: "error", text: "O novo PIN deve ter 4 a 6 dígitos." }); return; }
    if (newPin !== confirmPin) { setMsg({ type: "error", text: "Os PINs não coincidem." }); return; }
    setConfig({ ...config, pin: newPin });
    setNewPin(""); setConfirmPin(""); setMasterOk(false);
    setMsg({ type: "success", text: "PIN alterado com sucesso! 🎉" });
    setTimeout(() => setMsg(null), 3000);
  }

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
      <div style={{ background: "#1e293b", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 28 }}>⚙️</span>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, fontFamily: "'Sora',sans-serif" }}>Configurações</div>
          <div style={{ color: "#64748b", fontSize: 12, fontFamily: "'Sora',sans-serif" }}>Gerir acesso e preferências</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>🔒 Alterar PIN de Acesso</div>
        <div style={{ padding: "20px" }}>

          {msg && (
            <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: msg.type === "error" ? "#fff1f2" : "#f0fdf4", border: `1.5px solid ${msg.type === "error" ? "#fecaca" : "#bbf7d0"}`, fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: msg.type === "error" ? "#dc2626" : "#16a34a" }}>
              {msg.text}
            </div>
          )}

          {!masterOk ? (
            <>
              <div style={{ marginBottom: 14, fontFamily: "'Sora',sans-serif", fontSize: 13, color: "#64748b" }}>
                Para alterar o PIN de acesso é necessário introduzir o <strong>PIN Master</strong>.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={S.label}>PIN Master</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={masterInput} onChange={e => setMasterInput(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && verifyMaster()} style={S.input} placeholder="••••••" />
                </div>
              </div>
              <button onClick={verifyMaster} style={{ ...S.btnPrimary, marginTop: 18 }}>Verificar PIN Master</button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1.5px solid #bbf7d0", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "#16a34a" }}>
                ✓ PIN Master verificado. Podes alterar o PIN de acesso.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={S.label}>Novo PIN (4 a 6 dígitos)</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} style={S.input} placeholder="••••" />
                </div>
                <div>
                  <label style={S.label}>Confirmar Novo PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && changePin()} style={S.input} placeholder="••••" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={changePin} style={S.btnPrimary}>🔒 Alterar PIN</button>
                <button onClick={() => { setMasterOk(false); setNewPin(""); setConfirmPin(""); setMsg(null); }} style={S.btnGhost}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>ℹ️ Informação</div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Versão", value: "ObraControl v2.0" },
            { label: "Base de dados", value: "Firebase Realtime DB" },
            { label: "Armazenamento de fotos", value: "Cloudinary (Free)" },
            { label: "Alojamento", value: "Vercel (Free)" },
          ].map(item => (
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

// ─── PIN LOCK SCREEN ──────────────────────────────────────────
function PinLock({ onUnlock }) {
  const [config, , loading] = useFirebase("config", { pin: "0000" });
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function tryPin(pin) {
    if (pin === (config?.pin || "0000")) {
      sessionStorage.setItem("obra_unlocked", "1");
      onUnlock();
    } else {
      setError(true); setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setError(false), 2000);
    }
  }

  function pressDigit(d) {
    const next = input + d;
    setError(false);
    if (next.length <= 6) {
      setInput(next);
      if (next.length >= 4) setTimeout(() => tryPin(next), 100);
    }
  }

  function del() { setInput(i => i.slice(0, -1)); }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #334155", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const pinLen = config?.pin?.length || 4;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e293b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .pin-btn:active { transform: scale(0.92); }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, animation: shake ? "shake 0.5s" : "none" }}>

        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏗️</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 24, fontFamily: "'Sora',sans-serif", letterSpacing: -0.5 }}>ObraControl</div>
          <div style={{ color: "#64748b", fontSize: 13, fontFamily: "'Sora',sans-serif", marginTop: 4 }}>Introduz o PIN para aceder</div>
        </div>

        {/* PIN dots */}
        <div style={{ display: "flex", gap: 14 }}>
          {Array.from({ length: pinLen }).map((_, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: i < input.length ? (error ? "#ef4444" : "#6366f1") : "#334155", transition: "background 0.15s", border: `2px solid ${i < input.length ? (error ? "#ef4444" : "#6366f1") : "#475569"}` }} />
          ))}
        </div>

        {error && <div style={{ color: "#ef4444", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, marginTop: -16 }}>PIN incorreto. Tenta novamente.</div>}

        {/* Numpad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
            d === "" ? <div key={i} /> :
            <button key={i} className="pin-btn" onClick={() => d === "⌫" ? del() : pressDigit(d)} style={{ width: 72, height: 72, borderRadius: "50%", border: "none", background: d === "⌫" ? "#1e293b" : "#1e3a5f", color: "#fff", fontSize: d === "⌫" ? 22 : 24, fontWeight: 700, fontFamily: "'Sora',sans-serif", cursor: "pointer", transition: "transform 0.1s, background 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────
function DashboardTab({ dark, setTab }) {
  const [rooms,,rL] = useFirebase("rooms2", []);
  const [tasks,,tL] = useFirebase("tasks", []);
  const [catalog,,cL] = useFirebase("catalog", INITIAL_CATALOG);
  const [inventory,,iL] = useFirebase("inventory", []);
  const [stock,,sL] = useFirebase("stock", []);
  const [attendance,,aL] = useFirebase("attendance", []);
  const [workers,,wL] = useFirebase("workers", []);

  const loading = rL || tL || cL || iL || sL || aL || wL;

  // Checklist stats
  const allCl = (rooms || []).flatMap(r => (r.subrooms || []).flatMap(s => s.checklist || []));
  const clDone = allCl.filter(c => c.status === "done").length;
  const clInc = allCl.filter(c => c.status === "incomplete").length;
  const clTotal = allCl.length;
  const clPct = clTotal ? Math.round((clDone / clTotal) * 100) : 0;

  // Tasks stats
  const allTasks = tasks || [];
  const tasksDone = allTasks.filter(t => t.done).length;
  const tasksPending = allTasks.filter(t => !t.done).length;

  // Stock crítico
  const cat = catalog || []; const inv = inventory || []; const used = stock || [];
  const stockMap = {};
  inv.forEach(i => { stockMap[i.materialId] = (stockMap[i.materialId] || 0) + i.qty; });
  used.forEach(e => { if (e.materialId) stockMap[e.materialId] = (stockMap[e.materialId] || 0) - e.qty; });
  const stockCritical = cat.filter(item => (stockMap[item.id] || 0) <= 0);
  const stockLow = cat.filter(item => { const q = stockMap[item.id] || 0; return q > 0 && q < 5; });

  // Presenças hoje
  const today = todayStr();
  const allWorkers = workers || [];
  const todayRec = (attendance || []).find(a => a.date === today);
  const presentToday = todayRec ? (todayRec.present || []).length : 0;

  const d = dark;

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontFamily: "'Sora',sans-serif" }}>A sincronizar…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Welcome */}
      <div style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)", borderRadius: 16, padding: "20px 24px", color: "#fff" }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20 }}>Bom dia! 👷</div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, opacity: 0.9 }}>LIVE · Dados em tempo real</span>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Progresso Checklist", value: `${clPct}%`, sub: `${clDone}/${clTotal} itens`, color: "#6366f1", icon: "⚡", tab: "checklist" },
          { label: "Tarefas Pendentes", value: tasksPending, sub: `${tasksDone} concluídas`, color: "#f59e0b", icon: "✅", tab: "tasks" },
          { label: "Presentes Hoje", value: presentToday, sub: `de ${allWorkers.length} funcionários`, color: "#22c55e", icon: "👷", tab: "attendance" },
          { label: "Stock Esgotado", value: stockCritical.length, sub: `${stockLow.length} em nível baixo`, color: stockCritical.length > 0 ? "#ef4444" : "#22c55e", icon: "📦", tab: "stock" },
        ].map(stat => (
          <button key={stat.label} onClick={() => setTab(stat.tab)} style={{ background: d ? "#1e293b" : "#fff", border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: "16px", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 24, color: stat.color }}>{stat.value}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12, color: d ? "#94a3b8" : "#64748b", marginTop: 2 }}>{stat.label}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: d ? "#475569" : "#94a3b8", marginTop: 2 }}>{stat.sub}</div>
          </button>
        ))}
      </div>

      {/* Progresso barra */}
      <div style={{ background: d ? "#1e293b" : "#fff", border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: d ? "#e2e8f0" : "#1e293b" }}>⚡ Progresso Elétrico Global</span>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: "#6366f1" }}>{clPct}%</span>
        </div>
        <div style={{ height: 10, background: d ? "#334155" : "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${clPct}%`, background: clPct === 100 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#6366f1,#4f46e5)", borderRadius: 99, transition: "width 0.5s" }} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ {clDone} concluídos</span>
          {clInc > 0 && <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>⚠️ {clInc} incompletos</span>}
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, color: d ? "#475569" : "#94a3b8" }}>{clTotal - clDone - clInc} pendentes</span>
        </div>
      </div>

      {/* Stock crítico */}
      {stockCritical.length > 0 && (
        <div style={{ background: "#fff1f2", border: "1.5px solid #fecaca", borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 10 }}>⚠️ Material Esgotado</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {stockCritical.map(item => (
              <span key={item.id} style={{ padding: "4px 12px", borderRadius: 99, background: "#fee2e2", color: "#dc2626", fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600 }}>
                {item.code && <span style={{ opacity: 0.7, marginRight: 4 }}>{item.code}</span>}{item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tarefas urgentes */}
      {allTasks.filter(t => !t.done && (t.tags || []).includes("urgente")).length > 0 && (
        <div style={{ background: d ? "#1e293b" : "#fff", border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: "#ef4444", marginBottom: 10 }}>🚨 Tarefas Urgentes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {allTasks.filter(t => !t.done && (t.tags || []).includes("urgente")).slice(0, 3).map(t => (
              <div key={t.id} style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, color: d ? "#e2e8f0" : "#1e293b", padding: "6px 0", borderBottom: `1px solid ${d ? "#334155" : "#f1f5f9"}` }}>🔴 {t.text}</div>
            ))}
          </div>
        </div>
      )}

      {/* Atalhos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Nova Sala", icon: "🏠", tab: "checklist" },
          { label: "Nova Tarefa", icon: "➕", tab: "tasks" },
          { label: "Ver Fotos", icon: "📷", tab: "photos" },
        ].map(a => (
          <button key={a.label} onClick={() => setTab(a.tab)} style={{ background: d ? "#1e293b" : "#f8fafc", border: `1.5px solid ${d ? "#334155" : "#e2e8f0"}`, borderRadius: 12, padding: "14px 10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: d ? "#94a3b8" : "#64748b" }}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TAGS CONSTANTS ───────────────────────────────────────────
const TAGS = [
  { value: "urgente",          label: "🚨 Urgente",           color: "#ef4444" },
  { value: "aguarda-material", label: "📦 Aguarda Material",  color: "#f59e0b" },
  { value: "aguarda-inspecao", label: "🔍 Aguarda Inspeção",  color: "#6366f1" },
  { value: "em-curso",         label: "⚙️ Em Curso",          color: "#3b82f6" },
  { value: "bloqueado",        label: "🚫 Bloqueado",         color: "#94a3b8" },
];

// ─── MAIN ─────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("obra_unlocked") === "1");
  const [tab, setTab] = useState("dashboard");
  const [dark, setDark] = useState(() => localStorage.getItem("obra_dark") === "1");

  function toggleDark() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("obra_dark", next ? "1" : "0");
  }

  const TABS = [
    { key: "dashboard", label: "🏠 Início" },
    { key: "checklist", label: "⚡ Checklist" },
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏗️</span>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: -0.5, fontFamily: "'Sora',sans-serif" }}>ObraControl</div>
              <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'Sora',sans-serif" }}>Parte Elétrica</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleDark} style={{ padding: "5px 12px", background: "#334155", border: "none", borderRadius: 8, color: "#94a3b8", cursor: "pointer", fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600 }} title="Modo escuro">
              {dark ? "☀️" : "🌙"}
            </button>
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
    label: { display: "block", marginBottom: 6, fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: d ? "#64748b" : "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  };
}

// Keep S as light-mode default for components that don't receive dark prop
const S = mkS(false);
