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
  done:       { label: "Concluído",  color: