import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  update,
} from "firebase/database";
import {
  Plus,
  X,
  Clock,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Check,
  AlertCircle,
  Phone,
  Upload,
  CarFront,
  FileSpreadsheet,
  MapPin,
  Pencil,
  WifiOff,
  Wifi,
  BarChart3,
  UserCog,
  UserPlus,
  Download,
  Settings,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// =====================================================================
// CONFIGURACIÓN DE FIREBASE (Realtime Database)
// Sustituye estos valores por los de tu propio proyecto de Firebase.
// Instrucciones completas: ver guía aparte "Cómo alojar tu agenda".
// El campo "databaseURL" es imprescindible para Realtime Database
// (no aparece en el bloque de configuración por defecto que copia Firebase
// para apps web — cópialo desde la URL que ves arriba de tu Realtime Database,
// algo como https://TU_PROYECTO-default-rtdb.europe-west1.firebasedatabase.app).
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC9WndH7H0c5NRGSQzMrBYquF2sq-vPJVo",
  authDomain: "agenda-vendedores-40cc8.firebaseapp.com",
  databaseURL: "https://agenda-vendedores-40cc8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "agenda-vendedores-40cc8",
  storageBucket: "agenda-vendedores-40cc8.firebasestorage.app",
  messagingSenderId: "220024137396",
  appId: "1:220024137396:web:e4529ac83e5526af4219e1",
};

let app, db, firebaseDisponible = false;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY") {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    firebaseDisponible = true;
  }
} catch (e) {
  console.error("Error inicializando Firebase", e);
}

// ---------- Constantes ----------
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTO = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const HORA_INICIO = 9;
const HORA_FIN = 20;
const SLOT_MIN = 60;

// Cada isla tiene su propia familia de color; todas las sedes de esa isla
// comparten el mismo tono (varían ligeramente en intensidad para diferenciarlas).
const PALETA_ISLAS = {
  "Tenerife": { hue: "#3F6FB0", family: [
    { bg: "#E7EEF8", border: "#3F6FB0", text: "#1E3A60" },
    { bg: "#DCE7F5", border: "#33619F", text: "#1A3454" },
    { bg: "#D1E0F2", border: "#27538D", text: "#162D49" },
  ]},
  "Gran Canaria": { hue: "#3F9999", family: [
    { bg: "#E3F1F1", border: "#3F9999", text: "#1F4D4D" },
    { bg: "#D8ECEC", border: "#358888", text: "#1A4343" },
    { bg: "#CDE6E6", border: "#2B7777", text: "#163939" },
  ]},
  "Lanzarote": { hue: "#C97C4A", family: [
    { bg: "#FBEFE6", border: "#C97C4A", text: "#7A4426" },
  ]},
  "Fuerteventura": { hue: "#A88B4A", family: [
    { bg: "#F3EFE3", border: "#A88B4A", text: "#5E4A1F" },
  ]},
  "La Palma": { hue: "#7AAE4A", family: [
    { bg: "#EAF5E3", border: "#7AAE4A", text: "#3D5E22" },
  ]},
};

const ISLAS_SEDES = {
  "Tenerife": ["Mayorazgo", "La Orotava", "Chafiras"],
  "Gran Canaria": ["Miller Bajo", "Sebadal", "Arinaga"],
  "Lanzarote": ["Lanzarote"],
  "Fuerteventura": ["Fuerteventura"],
  "La Palma": ["La Palma"],
};
const ISLAS = Object.keys(ISLAS_SEDES);

// Marcas que se venden en el concesionario. Un vendedor puede vender varias marcas a la vez
// (por eso vendedor.marcas es un array), pero cada cita/lead concreto es de UNA marca en
// particular, ya que una visita o presupuesto es siempre sobre un modelo de una marca dada.
const MARCAS = ["Peugeot", "DS", "Opel", "Fiat", "Jeep", "Alfa Romeo", "Abarth", "Orvecame ocasión", "Ebro", "Leapmotor"];
const MARCA_COLORES = {
  Peugeot: { bg: "#EDE7F3", border: "#7A5C9E", text: "#4A3A63" },
  DS: { bg: "#E8E6EA", border: "#4A4550", text: "#2B2830" },
  Opel: { bg: "#F7E7E3", border: "#B0473F", text: "#6B2C26" },
  Fiat: { bg: "#E3EEF7", border: "#3D7EB0", text: "#1F4560" },
  Jeep: { bg: "#EAF0E3", border: "#5E7A3D", text: "#374A24" },
  "Alfa Romeo": { bg: "#FBE7E3", border: "#B03D2E", text: "#6B241A" },
  Abarth: { bg: "#FCEFE0", border: "#C97F2E", text: "#734A1A" },
  "Orvecame ocasión": { bg: "#EFEAE0", border: "#8A7550", text: "#4F4330" },
  Ebro: { bg: "#E3F0EC", border: "#3D9184", text: "#20544D" },
  Leapmotor: { bg: "#E9F0FA", border: "#4472B0", text: "#274267" },
};
function colorParaMarca(marca) {
  return MARCA_COLORES[marca] || { bg: "#F1EAD9", border: "#8A7B5C", text: "#5C5240" };
}

// Vistas de gestión puntual (no son del día a día), agrupadas bajo el menú "Gestión"
// para no competir visualmente con Agenda y Sin cita, que son las de uso diario.
const VISTAS_GESTION = ["turnos", "vendedores", "gestores", "ventas", "informe"];

// Asigna un color a cada sede dentro de su isla, ciclando si hay más sedes que tonos.
function colorParaSede(isla, sede) {
  const paleta = PALETA_ISLAS[isla] || PALETA_ISLAS["Tenerife"];
  const sedesIsla = ISLAS_SEDES[isla] || [];
  const idx = Math.max(0, sedesIsla.indexOf(sede));
  return paleta.family[idx % paleta.family.length];
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizePhone(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.startsWith("0034")) digits = digits.slice(4);
  else if (digits.startsWith("34") && digits.length > 9) digits = digits.slice(2);
  if (digits.length > 9) digits = digits.slice(-9);
  return digits;
}

// ---------- Emparejamiento robusto de nombres de personas ----------
// Algunos listados de origen (CRM, exportaciones antiguas) usan formatos de nombre distintos
// a los que se usan al crear vendedores/gestores en la app: mayúsculas, apellidos con guión
// bajo tipo "usuario" ("GUTIERREZ_PEREZ JONAY"), orden nombre/apellidos invertido, o solo un
// apellido en vez de dos. Estas funciones intentan reconocer que es la misma persona aunque el
// texto no coincida exactamente, para que el informe agrupe bien en vez de crear una categoría
// nueva por cada variante de formato.
// Resuelve si un cliente sin cita está vendido, no vendido, o sin decidir, dando prioridad a
// una marca manual (puesta por el gestor) sobre el cotejo automático por teléfono con los
// listados de ventas. true = vendido, false = no vendido, null = sin decidir/sin datos.
function resolverVendidoManualOAuto(estadoManual, matches, columnaEstadoExiste) {
  if (estadoManual === true || estadoManual === false) return estadoManual;
  if (!matches || matches.length === 0) return null;
  if (!columnaEstadoExiste) return true;
  if (matches.some((m) => m.vendido === true)) return true;
  if (matches.some((m) => m.vendido === false)) return false;
  return null;
}

function normalizarNombrePersona(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[_,.]/g, " ") // guiones bajos y puntuación como separadores de palabra
    .replace(/\s+/g, " ")
    .trim();
}

function tokensNombrePersona(s) {
  return normalizarNombrePersona(s).split(" ").filter(Boolean);
}

// Busca en `lista` (de objetos con un campo de nombre, p.ej. vendedores o gestores) una persona
// que coincida con `texto`, admitiendo formato distinto. Primero intenta coincidencia exacta
// normalizada; si no la hay, busca por solapamiento de palabras (nombre + al menos un apellido
// en común, en cualquier orden), exigiendo al menos 2 palabras compartidas para evitar
// confundir a dos personas que solo comparten el nombre de pila. Devuelve el nombre "canónico"
// tal como está en la lista si encuentra una coincidencia razonable, o null si no la encuentra.
function emparejarNombrePersona(texto, lista, campoNombre = "nombre") {
  const tokensTexto = new Set(tokensNombrePersona(texto));
  if (tokensTexto.size === 0 || !lista || lista.length === 0) return null;

  const textoNorm = normalizarNombrePersona(texto);
  const exacta = lista.find((item) => normalizarNombrePersona(item[campoNombre]) === textoNorm);
  if (exacta) return exacta[campoNombre];

  let mejor = null;
  let mejorPuntuacion = 0;
  lista.forEach((item) => {
    const tokensItem = new Set(tokensNombrePersona(item[campoNombre]));
    if (tokensItem.size === 0) return;
    const [menor, mayor] = tokensItem.size <= tokensTexto.size ? [tokensItem, tokensTexto] : [tokensTexto, tokensItem];
    const interseccion = [...menor].filter((t) => mayor.has(t));
    const esSubconjunto = interseccion.length === menor.size;
    if (esSubconjunto && interseccion.length >= 2 && interseccion.length > mejorPuntuacion) {
      mejor = item[campoNombre];
      mejorPuntuacion = interseccion.length;
    }
  });
  return mejor;
}

function parseAnyDate(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date && !isNaN(val)) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  const d2 = new Date(s);
  return isNaN(d2) ? null : d2;
}

function fmtDateShort(d) {
  if (!d) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// Mes/año en formato "YYYY-MM", para guardar y filtrar a qué mes corresponde un lead sin cita
// (independiente de la fecha en la que se haya dado de alta el registro en la app).
function mesAnioActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesAnioLabel(mesAnio) {
  if (!mesAnio) return "Sin mes";
  const [anio, mes] = mesAnio.split("-");
  const idx = Number(mes) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return mesAnio;
  return `${MESES_LABEL[idx]} ${anio}`;
}

// Convierte el nombre de mes en español (tal como aparece en muchos Excel: "JUNIO", "Junio"...)
// y el año, a formato "YYYY-MM". Devuelve "" si no se puede interpretar.
function mesAnioDesdeExcel(anioVal, mesVal) {
  const anio = String(anioVal || "").trim();
  const mesTexto = String(mesVal || "").trim().toLowerCase();
  if (!anio || !mesTexto) return "";
  const idx = MESES_LABEL.findIndex((m) => m.toLowerCase() === mesTexto);
  if (idx === -1) return "";
  return `${anio}-${String(idx + 1).padStart(2, "0")}`;
}

function horaLabel(h) {
  return `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 === 0 ? "00" : "30"}`;
}

function slotsDia() {
  const slots = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h += SLOT_MIN / 60) slots.push(h);
  return slots;
}

// Convierte un texto de horario tipo "9:00-13:30, 16:30-20:00" en un array de horas de
// inicio de slot (cada slot dura 30 min), igual que usa internamente la rejilla de turnos.
// Acepta separar varios tramos por coma, espacios opcionales, y horas como "9" o "9:00" o "9.5".
// Lanza un Error con un mensaje legible si el texto no se puede interpretar.
function parseHorarioTexto(texto) {
  const limpio = (texto || "").trim();
  if (!limpio) return [];

  const aDecimal = (str) => {
    const s = str.trim();
    const conColon = s.match(/^(\d{1,2}):(\d{2})$/);
    if (conColon) {
      const h = Number(conColon[1]);
      const m = Number(conColon[2]);
      return h + m / 60;
    }
    const soloNumero = s.match(/^(\d{1,2})([.,](\d+))?$/);
    if (soloNumero) {
      const h = Number(soloNumero[1]);
      const frac = soloNumero[3] ? Number("0." + soloNumero[3]) : 0;
      return h + frac;
    }
    throw new Error(`No entiendo la hora "${str}". Usa un formato como 9:00 o 13:30.`);
  };

  const tramos = limpio.split(",").map((t) => t.trim()).filter(Boolean);
  const horas = new Set();

  tramos.forEach((tramo) => {
    const partes = tramo.split(/-|–/).map((p) => p.trim());
    if (partes.length !== 2) {
      throw new Error(`No entiendo el tramo "${tramo}". Usa el formato 9:00-13:30.`);
    }
    let desde = aDecimal(partes[0]);
    let hasta = aDecimal(partes[1]);
    // Redondea al slot de 30 min más cercano, dentro del horario de la agenda.
    desde = Math.max(HORA_INICIO, Math.round(desde * 2) / 2);
    hasta = Math.min(HORA_FIN, Math.round(hasta * 2) / 2);
    if (hasta <= desde) {
      throw new Error(`El tramo "${tramo}" no es válido: la hora final debe ser posterior a la inicial.`);
    }
    for (let h = desde; h < hasta; h += 0.5) horas.add(h);
  });

  return Array.from(horas).sort((a, b) => a - b);
}

// Convierte un array de horas de inicio de slot (las que usa la rejilla internamente) en un
// texto legible con tramos agrupados, ej. [9, 9.5, 10, 16.5, 17] -> "9:00-10:30, 16:30-17:30".
// Es la función inversa de parseHorarioTexto, para poder mostrar y editar el horario actual.
function horasATexto(horas) {
  if (!horas || horas.length === 0) return "";
  const ordenadas = [...horas].sort((a, b) => a - b);
  const tramos = [];
  let inicio = ordenadas[0];
  let anterior = ordenadas[0];
  for (let i = 1; i <= ordenadas.length; i++) {
    const actual = ordenadas[i];
    if (actual === undefined || actual - anterior > 0.5) {
      tramos.push(`${horaLabel(inicio)}-${horaLabel(anterior + 0.5)}`);
      inicio = actual;
    }
    anterior = actual;
  }
  return tramos.join(", ");
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtWeekKey(monday) {
  return monday.toISOString().slice(0, 10);
}

function fmtDateLabel(date) {
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Deriva la fecha real (Date) de una cita a partir de su weekKey (lunes de esa semana, en
// formato "YYYY-MM-DD") y su índice de día (0=Lunes...5=Sábado). Devuelve null si el weekKey
// no es válido. Se usa tanto para el informe como para el reparto equitativo de citas.
function fechaDeCitaSemana(weekKey, day) {
  const monday = new Date(weekKey);
  if (isNaN(monday)) return null;
  return addDays(monday, day);
}

// =====================================================================
// CAPA DE DATOS — Firebase Firestore (compartido, tiempo real)
// Con fallback automático a localStorage-en-memoria si Firebase no está
// configurado, para que la app siga siendo usable en modo demo/individual.
// Estructura de colecciones:
//   vendedores/{id}            -> {nombre, isla, sede}
//   gestores/{id}               -> {nombre}  (gestor lead: crea la cita, distinto del vendedor)
//   leadsSinCita/{id}            -> {cliente, telefono, gestorId, vendorId, isla, sede, creadoEn}
//   vacaciones/{id}               -> {vendorId, desde, hasta, origen}  (desde/hasta en formato YYYY-MM-DD)
//   turnos/{weekKey}_{vendorId} -> {weekKey, vendorId, dias: {0:[...],...}}
//   citas/{id}                  -> {weekKey, vendorId, gestorId, day, hour, cliente, telefono}
//   ventas/historico             -> {fileName, uploadedAt, records}  (se sube una vez, KPIs anuales)
//   ventas/cotejo                 -> {fileName, uploadedAt, records}  (se sube a menudo, cotejo en vivo)
// =====================================================================

function useVendedoresSync() {
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoading(false);
      return;
    }
    const vendedoresRef = ref(db, "vendedores");
    const unsub = onValue(vendedoresRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      setVendedores(list);
      setLoading(false);
    }, (err) => {
      console.error("Error sincronizando vendedores", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const addVendedor = useCallback(async (vendedor) => {
    if (!firebaseDisponible) {
      setVendedores((prev) => [...prev, vendedor]);
      return;
    }
    await set(ref(db, `vendedores/${vendedor.id}`), {
      nombre: vendedor.nombre,
      isla: vendedor.isla,
      sede: vendedor.sede,
    });
  }, []);

  const removeVendedor = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setVendedores((prev) => prev.filter((v) => v.id !== id));
      return;
    }
    await remove(ref(db, `vendedores/${id}`));
  }, []);

  const updateVendedor = useCallback(async (id, fields) => {
    if (!firebaseDisponible) {
      setVendedores((prev) => prev.map((v) => (v.id === id ? { ...v, ...fields } : v)));
      return;
    }
    await update(ref(db, `vendedores/${id}`), fields);
  }, []);

  return { vendedores, loading, addVendedor, removeVendedor, updateVendedor };
}

// Gestores lead: personas que generan/crean la cita, distintas del vendedor que la atiende.
// Solo tienen nombre, sin isla/sede ni turnos asociados.
function useGestoresSync() {
  const [gestores, setGestores] = useState([]);
  const [loadingGestores, setLoadingGestores] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoadingGestores(false);
      return;
    }
    const gestoresRef = ref(db, "gestores");
    const unsub = onValue(gestoresRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, g]) => ({ id, ...g }));
      setGestores(list);
      setLoadingGestores(false);
    }, (err) => {
      console.error("Error sincronizando gestores", err);
      setLoadingGestores(false);
    });
    return () => unsub();
  }, []);

  const addGestor = useCallback(async (gestor) => {
    if (!firebaseDisponible) {
      setGestores((prev) => [...prev, gestor]);
      return;
    }
    await set(ref(db, `gestores/${gestor.id}`), { nombre: gestor.nombre });
  }, []);

  const removeGestor = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setGestores((prev) => prev.filter((g) => g.id !== id));
      return;
    }
    await remove(ref(db, `gestores/${id}`));
  }, []);

  return { gestores, loadingGestores, addGestor, removeGestor };
}

// Vacaciones: rangos de fechas en los que un vendedor no está disponible. Se guardan de forma
// permanente (no por semana), y se usan para excluir automáticamente al vendedor de la agenda
// durante esos días, tanto si se añaden a mano como si vienen importadas de un Excel.
function useVacacionesSync() {
  const [vacaciones, setVacaciones] = useState([]);
  const [loadingVacaciones, setLoadingVacaciones] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoadingVacaciones(false);
      return;
    }
    const vacacionesRef = ref(db, "vacaciones");
    const unsub = onValue(vacacionesRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      setVacaciones(list);
      setLoadingVacaciones(false);
    }, (err) => {
      console.error("Error sincronizando vacaciones", err);
      setLoadingVacaciones(false);
    });
    return () => unsub();
  }, []);

  const addVacacion = useCallback(async (vacacion) => {
    if (!firebaseDisponible) {
      setVacaciones((prev) => [...prev, vacacion]);
      return;
    }
    const { id, ...resto } = vacacion;
    await set(ref(db, `vacaciones/${id}`), resto);
  }, []);

  const addVacacionesEnLote = useCallback(async (lista) => {
    if (!firebaseDisponible) {
      setVacaciones((prev) => [...prev, ...lista]);
      return;
    }
    const updates = {};
    lista.forEach((vac) => {
      const { id, ...resto } = vac;
      updates[`vacaciones/${id}`] = resto;
    });
    await update(ref(db), updates);
  }, []);

  const removeVacacion = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setVacaciones((prev) => prev.filter((v) => v.id !== id));
      return;
    }
    await remove(ref(db, `vacaciones/${id}`));
  }, []);

  return { vacaciones, loadingVacaciones, addVacacion, addVacacionesEnLote, removeVacacion };
}

// Leads sin cita: clientes que reciben presupuesto o se derivan directamente a un vendedor
// (p.ej. empresas), sin pasar por una cita en la agenda. Se guardan de forma permanente
// (no por semana) para poder cotejarlos igual que una cita cuando se sube un listado de ventas.
function useLeadsSinCitaSync() {
  const [leadsSinCita, setLeadsSinCita] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  useEffect(() => {
    if (!firebaseDisponible) {
      setLoadingLeads(false);
      return;
    }
    const leadsRef = ref(db, "leadsSinCita");
    const unsub = onValue(leadsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, l]) => ({ id, ...l }));
      setLeadsSinCita(list);
      setLoadingLeads(false);
    }, (err) => {
      console.error("Error sincronizando leads sin cita", err);
      setLoadingLeads(false);
    });
    return () => unsub();
  }, []);

  const addLeadSinCita = useCallback(async (lead) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => [...prev, lead]);
      return;
    }
    const { id, ...resto } = lead;
    await set(ref(db, `leadsSinCita/${id}`), resto);
  }, []);

  const addLeadsSinCitaEnLote = useCallback(async (leads) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => [...prev, ...leads]);
      return;
    }
    const updates = {};
    leads.forEach((lead) => {
      const { id, ...resto } = lead;
      updates[`leadsSinCita/${id}`] = resto;
    });
    await update(ref(db), updates);
  }, []);

  const updateLeadSinCita = useCallback(async (id, fields) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)));
      return;
    }
    await update(ref(db, `leadsSinCita/${id}`), fields);
  }, []);

  const removeLeadSinCita = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setLeadsSinCita((prev) => prev.filter((l) => l.id !== id));
      return;
    }
    await remove(ref(db, `leadsSinCita/${id}`));
  }, []);

  return { leadsSinCita, loadingLeads, addLeadSinCita, addLeadsSinCitaEnLote, updateLeadSinCita, removeLeadSinCita };
}

function useTurnosSync(weekKey) {
  const [turnos, setTurnos] = useState({}); // { vendorId: { day: [hours] } }

  useEffect(() => {
    if (!firebaseDisponible) {
      setTurnos({});
      return;
    }
    const turnosRef = ref(db, `turnos/${weekKey}`);
    const unsub = onValue(turnosRef, (snap) => {
      setTurnos(snap.val() || {});
    }, (err) => console.error("Error sincronizando turnos", err));
    return () => unsub();
  }, [weekKey]);

  const setTurnoVendorDia = useCallback(
    async (vendorId, dias) => {
      if (!firebaseDisponible) {
        setTurnos((prev) => ({ ...prev, [vendorId]: dias }));
        return;
      }
      await set(ref(db, `turnos/${weekKey}/${vendorId}`), dias);
    },
    [weekKey]
  );

  return { turnos, setTurnoVendorDia };
}

function useCitasSync(weekKey) {
  const [citas, setCitas] = useState([]);

  useEffect(() => {
    if (!firebaseDisponible) {
      setCitas([]);
      return;
    }
    const citasRef = ref(db, `citas/${weekKey}`);
    const unsub = onValue(citasRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, c]) => ({ id, ...c }));
      setCitas(list);
    }, (err) => console.error("Error sincronizando citas", err));
    return () => unsub();
  }, [weekKey]);

  const addCita = useCallback(
    async (cita) => {
      if (!firebaseDisponible) {
        setCitas((prev) => [...prev, cita]);
        return;
      }
      const { id, ...resto } = cita;
      await set(ref(db, `citas/${weekKey}/${id}`), resto);
    },
    [weekKey]
  );

  const updateCita = useCallback(
    async (id, fields) => {
      if (!firebaseDisponible) {
        setCitas((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
        return;
      }
      await update(ref(db, `citas/${weekKey}/${id}`), fields);
    },
    [weekKey]
  );

  const removeCita = useCallback(async (id) => {
    if (!firebaseDisponible) {
      setCitas((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    await remove(ref(db, `citas/${weekKey}/${id}`));
  }, [weekKey]);

  return { citas, addCita, updateCita, removeCita };
}

// Lee TODAS las citas de TODAS las semanas (no solo la semana que se está viendo), solo para
// alimentar el informe de KPIs. Cada cita ya trae su weekKey, así que se puede saber a qué
// semana/mes pertenece sin tener que navegar la agenda semana por semana.
function useTodasLasCitasSync() {
  const [todasLasCitas, setTodasLasCitas] = useState([]);

  useEffect(() => {
    if (!firebaseDisponible) {
      setTodasLasCitas([]);
      return;
    }
    const citasRef = ref(db, "citas");
    const unsub = onValue(citasRef, (snap) => {
      const data = snap.val() || {};
      const list = [];
      Object.entries(data).forEach(([weekKey, citasSemana]) => {
        Object.entries(citasSemana || {}).forEach(([id, c]) => {
          list.push({ id, weekKey, ...c });
        });
      });
      setTodasLasCitas(list);
    }, (err) => console.error("Error sincronizando todas las citas", err));
    return () => unsub();
  }, []);

  return { todasLasCitas };
}

// tipo: "historico" (se sube una vez, alimenta los KPIs del informe anual) o
// "cotejo" (se sube/reemplaza con frecuencia, alimenta el cotejo en vivo de la agenda).
// Cada tipo vive en su propia ruta de Firebase, independiente del otro.
function useVentasSync(tipo) {
  const [ventas, setVentas] = useState(null);
  const path = `ventas/${tipo}`;

  useEffect(() => {
    if (!firebaseDisponible) return;
    const ventasRef = ref(db, path);
    const unsub = onValue(ventasRef, (snap) => {
      setVentas(snap.exists() ? snap.val() : null);
    }, (err) => console.error(`Error sincronizando ventas (${tipo})`, err));
    return () => unsub();
  }, [path, tipo]);

  const guardarVentas = useCallback(
    async (data) => {
      if (!firebaseDisponible) {
        setVentas(data);
        return;
      }
      if (data === null) {
        await remove(ref(db, path));
      } else {
        await set(ref(db, path), data);
      }
    },
    [path]
  );

  return { ventas, guardarVentas };
}

// ---------- Componente principal ----------
export default function AgendaVendedores() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekKey = useMemo(() => fmtWeekKey(weekStart), [weekStart]);
  const weekDates = useMemo(() => DIAS.map((_, i) => addDays(weekStart, i)), [weekStart]);

  const { vendedores, loading, addVendedor, removeVendedor, updateVendedor } = useVendedoresSync();
  const { gestores, loadingGestores, addGestor, removeGestor } = useGestoresSync();
  const { vacaciones, addVacacion, addVacacionesEnLote, removeVacacion } = useVacacionesSync();
  const { leadsSinCita, addLeadSinCita, addLeadsSinCitaEnLote, updateLeadSinCita, removeLeadSinCita } = useLeadsSinCitaSync();
  const { turnos, setTurnoVendorDia } = useTurnosSync(weekKey);
  const { citas, addCita, updateCita, removeCita } = useCitasSync(weekKey);
  const { todasLasCitas } = useTodasLasCitasSync();
  const { ventas: ventasHistorico, guardarVentas: guardarVentasHistorico } = useVentasSync("historico");
  const { ventas: ventasCotejo, guardarVentas: guardarVentasCotejo } = useVentasSync("cotejo");

  const [vista, setVista] = useState("agenda");
  const [gestionMenuAbierto, setGestionMenuAbierto] = useState(false);
  const gestionMenuRef = useRef(null);
  useEffect(() => {
    if (!gestionMenuAbierto) return;
    const cerrarSiFuera = (e) => {
      if (gestionMenuRef.current && !gestionMenuRef.current.contains(e.target)) {
        setGestionMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", cerrarSiFuera);
    return () => document.removeEventListener("mousedown", cerrarSiFuera);
  }, [gestionMenuAbierto]);
  const [modalCita, setModalCita] = useState(null);
  const [nuevoVendedorNombre, setNuevoVendedorNombre] = useState("");
  const [nuevoVendedorIsla, setNuevoVendedorIsla] = useState(ISLAS[0]);
  const [nuevoVendedorSede, setNuevoVendedorSede] = useState((ISLAS_SEDES[ISLAS[0]] || [])[0] || "");
  const [nuevoVendedorMarcas, setNuevoVendedorMarcas] = useState([]);
  const [nuevoGestorNombre, setNuevoGestorNombre] = useState("");
  const [nuevaVacacionVendorId, setNuevaVacacionVendorId] = useState("");
  const [nuevaVacacionDesde, setNuevaVacacionDesde] = useState("");
  const [nuevaVacacionHasta, setNuevaVacacionHasta] = useState("");
  const [errorVacaciones, setErrorVacaciones] = useState(null);
  const [subiendoVacaciones, setSubiendoVacaciones] = useState(false);
  const fileInputVacacionesRef = useRef(null);
  const [nuevoLeadCliente, setNuevoLeadCliente] = useState("");
  const [nuevoLeadTelefono, setNuevoLeadTelefono] = useState("");
  const [nuevoLeadGestorId, setNuevoLeadGestorId] = useState("");
  const [nuevoLeadVendorId, setNuevoLeadVendorId] = useState("");
  const [nuevoLeadIsla, setNuevoLeadIsla] = useState("");
  const [nuevoLeadSede, setNuevoLeadSede] = useState("");
  const [nuevoLeadMarca, setNuevoLeadMarca] = useState("");
  const [nuevoLeadMesAnio, setNuevoLeadMesAnio] = useState(mesAnioActual());
  const [toast, setToast] = useState(null);
  const [subiendoHistorico, setSubiendoHistorico] = useState(false);
  const [errorHistorico, setErrorHistorico] = useState(null);
  const fileInputHistoricoRef = useRef(null);
  const [subiendoCotejo, setSubiendoCotejo] = useState(false);
  const [errorCotejo, setErrorCotejo] = useState(null);
  const fileInputCotejoRef = useRef(null);
  const [filtroIslas, setFiltroIslas] = useState([]);
  const [filtroSedes, setFiltroSedes] = useState([]);
  const [filtroMarcas, setFiltroMarcas] = useState([]);
  const [leadBusqueda, setLeadBusqueda] = useState("");
  const [leadFiltroEstado, setLeadFiltroEstado] = useState("todos");
  const [leadFiltroGestorId, setLeadFiltroGestorId] = useState("");
  const [leadFiltroIsla, setLeadFiltroIsla] = useState("");
  const [leadFiltroMesAnio, setLeadFiltroMesAnio] = useState("");
  const [leadAgruparPor, setLeadAgruparPor] = useState("mes");
  const [gruposLeadToggled, setGruposLeadToggled] = useState(() => new Set());
  const [formLeadAbierto, setFormLeadAbierto] = useState(false);

  // Al cambiar el criterio de agrupación, se olvidan los plegados/desplegados manuales, para
  // que el estado por defecto (primer grupo abierto, resto plegado) vuelva a aplicarse limpio.
  useEffect(() => {
    setGruposLeadToggled(new Set());
  }, [leadAgruparPor]);

  const toggleGrupoLead = useCallback((clave) => {
    setGruposLeadToggled((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // ---------- Vendedores ----------
  const handleAddVendedor = useCallback(async () => {
    const nombre = nuevoVendedorNombre.trim();
    if (!nombre) return;
    const sede = nuevoVendedorSede || nuevoVendedorIsla;
    const nuevo = { id: genId(), nombre, isla: nuevoVendedorIsla, sede, marcas: nuevoVendedorMarcas };
    await addVendedor(nuevo);
    setNuevoVendedorNombre("");
    setNuevoVendedorMarcas([]);
    showToast(`${nombre} añadido`);
  }, [nuevoVendedorNombre, nuevoVendedorIsla, nuevoVendedorSede, nuevoVendedorMarcas, addVendedor, showToast]);

  const handleRemoveVendedor = useCallback(
    async (id) => {
      const v = vendedores.find((x) => x.id === id);
      await removeVendedor(id);
      // limpiar también sus citas de esta semana
      const citasDelVendedor = citas.filter((c) => c.vendorId === id);
      await Promise.all(citasDelVendedor.map((c) => removeCita(c.id)));
      showToast(v ? `${v.nombre} eliminado` : "Vendedor eliminado");
    },
    [vendedores, citas, removeVendedor, removeCita, showToast]
  );

  // ---------- Gestores lead ----------
  const handleAddGestor = useCallback(async () => {
    const nombre = nuevoGestorNombre.trim();
    if (!nombre) return;
    const nuevo = { id: genId(), nombre };
    await addGestor(nuevo);
    setNuevoGestorNombre("");
    showToast(`${nombre} añadido como gestor lead`);
  }, [nuevoGestorNombre, addGestor, showToast]);

  const handleRemoveGestor = useCallback(
    async (id) => {
      const g = gestores.find((x) => x.id === id);
      await removeGestor(id);
      showToast(g ? `${g.nombre} eliminado` : "Gestor eliminado");
      // No borramos las citas que ya tuviera asignado este gestor: simplemente quedan
      // sin gestor asociado (gestorId apunta a un id que ya no existe en la lista).
    },
    [gestores, removeGestor, showToast]
  );

  // ---------- Vacaciones ----------
  const handleAddVacacion = useCallback(async () => {
    setErrorVacaciones(null);
    if (!nuevaVacacionVendorId) {
      setErrorVacaciones("Elige un vendedor.");
      return;
    }
    if (!nuevaVacacionDesde || !nuevaVacacionHasta) {
      setErrorVacaciones("Indica la fecha de inicio y la de fin.");
      return;
    }
    if (nuevaVacacionHasta < nuevaVacacionDesde) {
      setErrorVacaciones("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }
    const v = vendedores.find((vv) => vv.id === nuevaVacacionVendorId);
    await addVacacion({
      id: genId(),
      vendorId: nuevaVacacionVendorId,
      desde: nuevaVacacionDesde,
      hasta: nuevaVacacionHasta,
      origen: "manual",
    });
    setNuevaVacacionVendorId("");
    setNuevaVacacionDesde("");
    setNuevaVacacionHasta("");
    showToast(`Vacaciones añadidas${v ? ` para ${v.nombre}` : ""}`);
  }, [nuevaVacacionVendorId, nuevaVacacionDesde, nuevaVacacionHasta, vendedores, addVacacion, showToast]);

  const handleRemoveVacacion = useCallback(
    async (id) => {
      await removeVacacion(id);
      showToast("Vacaciones eliminadas");
    },
    [removeVacacion, showToast]
  );

  // Importa vacaciones desde un Excel/CSV con columnas de vendedor, fecha de inicio y fecha de
  // fin. Empareja el vendedor por nombre exacto (sin distinguir mayúsculas/tildes con espacios);
  // las filas cuyo vendedor no se reconozca se omiten y se avisa cuántas fueron.
  const handleImportarVacacionesExcel = useCallback(
    async (file) => {
      if (!file) return;
      setSubiendoVacaciones(true);
      setErrorVacaciones(null);
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) {
          setErrorVacaciones("El archivo no tiene filas con datos.");
          setSubiendoVacaciones(false);
          return;
        }

        const keys = Object.keys(rows[0]);
        const findKey = (...patterns) =>
          keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p)));

        const kVendedor = findKey("vendedor", "comercial", "asesor", "nombre");
        const kDesde = findKey("desde", "inicio", "fechainicio", "fechadesde", "start");
        const kHasta = findKey("hasta", "fin", "fechafin", "fechahasta");

        if (!kVendedor || !kDesde || !kHasta) {
          setErrorVacaciones('No he encontrado columnas de vendedor, fecha de inicio y fecha de fin. Revisa que el Excel tenga cabeceras como "Vendedor", "Desde" y "Hasta".');
          setSubiendoVacaciones(false);
          return;
        }

        const normalizaNombre = (s) => String(s || "").trim().toLowerCase();
        const aFechaISO = (val) => {
          const d = parseAnyDate(val);
          return d ? d.toISOString().slice(0, 10) : "";
        };

        let sinReconocer = 0;
        const nuevasVacaciones = [];
        rows.forEach((r) => {
          const nombreVendedor = String(r[kVendedor] || "").trim();
          const desde = aFechaISO(r[kDesde]);
          const hasta = aFechaISO(r[kHasta]);
          if (!nombreVendedor || !desde || !hasta) return;
          const v = vendedores.find((vv) => normalizaNombre(vv.nombre) === normalizaNombre(nombreVendedor));
          if (!v) {
            sinReconocer += 1;
            return;
          }
          nuevasVacaciones.push({
            id: genId(),
            vendorId: v.id,
            desde: desde <= hasta ? desde : hasta,
            hasta: desde <= hasta ? hasta : desde,
            origen: "excel",
          });
        });

        if (nuevasVacaciones.length > 0) {
          await addVacacionesEnLote(nuevasVacaciones);
        }
        showToast(
          sinReconocer > 0
            ? `${nuevasVacaciones.length} vacaciones importadas · ${sinReconocer} filas con vendedor no reconocido`
            : `${nuevasVacaciones.length} vacaciones importadas`
        );
      } catch (e) {
        console.error(e);
        setErrorVacaciones("No he podido leer el archivo. Comprueba que sea un .xlsx o .csv válido.");
      } finally {
        setSubiendoVacaciones(false);
      }
    },
    [vendedores, addVacacionesEnLote, showToast]
  );

  // ---------- Leads sin cita (presupuesto / derivados directamente a vendedor) ----------
  const handleRemoveLeadSinCita = useCallback(
    async (id) => {
      await removeLeadSinCita(id);
      showToast("Lead eliminado");
    },
    [removeLeadSinCita, showToast]
  );

  // Marca manualmente el estado de venta de un cliente sin cita (Vendido / No vendido /
  // Pendiente). Esta marca manual tiene prioridad sobre el cotejo automático por teléfono con
  // los listados de ventas: si el gestor ya sabe el resultado, no hace falta esperar a que
  // aparezca en un Excel. valor: true (vendido), false (no vendido), null (sin marcar, vuelve
  // a depender del cotejo automático).
  const handleSetEstadoManualLead = useCallback(
    async (id, valor) => {
      await updateLeadSinCita(id, { estadoManual: valor });
      showToast(valor === true ? "Marcado: vendido" : valor === false ? "Marcado: no vendido" : "Marca manual eliminada");
    },
    [updateLeadSinCita, showToast]
  );

  // Nombres de archivo Excel presentes entre los leads importados automáticamente, para poder
  // borrar por archivo concreto o "todos los importados" de golpe.
  const archivosImportadosLeads = useMemo(() => {
    const set = new Set(
      leadsSinCita.filter((l) => l.origen === "excel" && l.origenArchivo).map((l) => l.origenArchivo)
    );
    return Array.from(set);
  }, [leadsSinCita]);

  // Borra en bloque los clientes sin cita que se crearon automáticamente desde Excel. Si se
  // pasa un nombre de archivo concreto, solo borra los de ese archivo; si no, borra todos los
  // que vinieron de cualquier Excel (deja intactos los añadidos a mano).
  const handleEliminarLeadsImportados = useCallback(
    async (nombreArchivo) => {
      const aBorrar = leadsSinCita.filter(
        (l) => l.origen === "excel" && (!nombreArchivo || l.origenArchivo === nombreArchivo)
      );
      if (aBorrar.length === 0) return;
      const confirma = window.confirm(
        `Vas a eliminar ${aBorrar.length} cliente(s) sin cita importado(s)${nombreArchivo ? ` desde "${nombreArchivo}"` : ""}. Esta acción no se puede deshacer. ¿Continuar?`
      );
      if (!confirma) return;
      await Promise.all(aBorrar.map((l) => removeLeadSinCita(l.id)));
      showToast(`${aBorrar.length} cliente(s) importado(s) eliminados`);
    },
    [leadsSinCita, removeLeadSinCita, showToast]
  );

  const vendedoresFiltrados = useMemo(() => {
    return vendedores.filter((v) => {
      const okIsla = filtroIslas.length === 0 || filtroIslas.includes(v.isla);
      const okSede = filtroSedes.length === 0 || filtroSedes.includes(v.sede);
      const okMarca = filtroMarcas.length === 0 || (v.marcas || []).some((m) => filtroMarcas.includes(m));
      return okIsla && okSede && okMarca;
    });
  }, [vendedores, filtroIslas, filtroSedes, filtroMarcas]);

  const toggleFiltroIsla = useCallback((isla) => {
    setFiltroIslas((prev) => {
      const next = prev.includes(isla) ? prev.filter((i) => i !== isla) : [...prev, isla];
      if (prev.includes(isla)) {
        setFiltroSedes((s) => s.filter((sede) => !(ISLAS_SEDES[isla] || []).includes(sede)));
      }
      return next;
    });
  }, []);

  const toggleFiltroSede = useCallback((sede) => {
    setFiltroSedes((prev) => (prev.includes(sede) ? prev.filter((s) => s !== sede) : [...prev, sede]));
  }, []);

  const toggleFiltroMarca = useCallback((marca) => {
    setFiltroMarcas((prev) => (prev.includes(marca) ? prev.filter((m) => m !== marca) : [...prev, marca]));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFiltroIslas([]);
    setFiltroSedes([]);
    setFiltroMarcas([]);
  }, []);

  const sedesFiltrablesDisponibles = useMemo(() => {
    const islasAUsar = filtroIslas.length > 0 ? filtroIslas : ISLAS;
    const set = new Set();
    islasAUsar.forEach((isla) => (ISLAS_SEDES[isla] || []).forEach((s) => set.add(s)));
    return Array.from(set);
  }, [filtroIslas]);

  // ---------- Turnos ----------
  const toggleTurno = useCallback(
    async (vendorId, dayIdx, hour) => {
      const actual = { ...(turnos[vendorId] || {}) };
      const dayList = new Set(actual[dayIdx] || []);
      if (dayList.has(hour)) dayList.delete(hour);
      else dayList.add(hour);
      actual[dayIdx] = Array.from(dayList);
      await setTurnoVendorDia(vendorId, actual);
    },
    [turnos, setTurnoVendorDia]
  );

  const isWorking = useCallback(
    (vendorId, dayIdx, hour) => (turnos[vendorId]?.[dayIdx] || []).includes(hour),
    [turnos]
  );

  // Comprueba si un vendedor está de vacaciones en una fecha concreta (comparando por día,
  // ignorando la hora). Las fechas de vacaciones se guardan como "YYYY-MM-DD".
  const estaDeVacaciones = useCallback(
    (vendorId, fecha) => {
      if (!fecha) return false;
      const fechaStr = fecha.toISOString().slice(0, 10);
      return vacaciones.some(
        (v) => v.vendorId === vendorId && v.desde <= fechaStr && fechaStr <= v.hasta
      );
    },
    [vacaciones]
  );

  const setBulkTurno = useCallback(
    async (vendorId, dayIdx, tramo) => {
      const actual = { ...(turnos[vendorId] || {}) };
      const slots = slotsDia();
      const mid = HORA_INICIO + (HORA_FIN - HORA_INICIO) / 2;
      let hours;
      if (tramo === "manana") hours = slots.filter((h) => h < mid);
      else if (tramo === "tarde") hours = slots.filter((h) => h >= mid);
      else if (tramo === "completo") hours = slots;
      else hours = [];
      actual[dayIdx] = hours;
      await setTurnoVendorDia(vendorId, actual);
    },
    [turnos, setTurnoVendorDia]
  );

  // Aplica un texto de horario (ej. "9:00-13:30, 16:30-20:00") a una lista de días de golpe.
  // diasIdx es un array de índices de día (0=Lunes...5=Sábado). Lanza el error de parseo hacia
  // arriba para que el formulario lo muestre, sin guardar nada si el texto no es válido.
  const aplicarHorarioTexto = useCallback(
    async (vendorId, diasIdx, texto) => {
      const horas = parseHorarioTexto(texto); // puede lanzar Error, se propaga al caller
      const actual = { ...(turnos[vendorId] || {}) };
      diasIdx.forEach((dayIdx) => {
        actual[dayIdx] = horas;
      });
      await setTurnoVendorDia(vendorId, actual);
    },
    [turnos, setTurnoVendorDia]
  );

  // ---------- Citas ----------
  const vendoresDisponibles = useCallback(
    (dayIdx, hour) => {
      const fecha = weekDates[dayIdx];
      return vendedoresFiltrados.filter((v) => isWorking(v.id, dayIdx, hour) && !estaDeVacaciones(v.id, fecha));
    },
    [vendedoresFiltrados, isWorking, estaDeVacaciones, weekDates]
  );

  // Cuenta las citas activas de un vendedor dentro del mismo mes/año que `fechaRef`, usando
  // TODAS las citas (de cualquier semana), no solo la que se esté viendo. Así, alguien que
  // llevó varias semanas flojas dentro del mes sigue teniendo prioridad de reparto, en vez de
  // que el contador se reinicie cada semana.
  const citasDeVendorEnMes = useCallback(
    (vendorId, fechaRef) => {
      if (!fechaRef) return 0;
      const anio = fechaRef.getFullYear();
      const mes = fechaRef.getMonth();
      return todasLasCitas.filter((c) => {
        if (c.vendorId !== vendorId || c.estado === "cancelada") return false;
        const fecha = fechaDeCitaSemana(c.weekKey, c.day);
        return fecha && fecha.getFullYear() === anio && fecha.getMonth() === mes;
      }).length;
    },
    [todasLasCitas]
  );

  // Fecha de la cita más reciente asignada a un vendedor (de cualquier semana), para desempatar
  // entre vendedores con la misma carga: prioriza a quien lleva más tiempo sin recibir una cita.
  const ultimaFechaCitaVendedor = useCallback(
    (vendorId) => {
      let ultima = null;
      todasLasCitas.forEach((c) => {
        if (c.vendorId !== vendorId || c.estado === "cancelada") return;
        const fecha = fechaDeCitaSemana(c.weekKey, c.day);
        if (fecha && (!ultima || fecha > ultima)) ultima = fecha;
      });
      return ultima;
    },
    [todasLasCitas]
  );

  const sugerirVendedor = useCallback(
    (dayIdx, hour) => {
      const disponibles = vendoresDisponibles(dayIdx, hour);
      if (disponibles.length === 0) return null;
      const ocupadosEnSlot = new Set(
        citas
          .filter((c) => c.day === dayIdx && c.hour === hour && c.estado !== "cancelada")
          .map((c) => c.vendorId)
      );
      const libres = disponibles.filter((v) => !ocupadosEnSlot.has(v.id));
      const pool = libres.length > 0 ? libres : disponibles;
      const fechaRef = weekDates[dayIdx];
      const conDatos = pool.map((v) => ({
        v,
        cargaMes: citasDeVendorEnMes(v.id, fechaRef),
        ultima: ultimaFechaCitaVendedor(v.id),
      }));
      conDatos.sort((a, b) => {
        if (a.cargaMes !== b.cargaMes) return a.cargaMes - b.cargaMes;
        // Desempate: quien lleva más tiempo sin recibir una cita va primero. Si nunca ha
        // tenido ninguna, tiene prioridad máxima.
        const ta = a.ultima ? a.ultima.getTime() : -Infinity;
        const tb = b.ultima ? b.ultima.getTime() : -Infinity;
        return ta - tb;
      });
      return conDatos[0]?.v || null;
    },
    [vendoresDisponibles, citas, weekDates, citasDeVendorEnMes, ultimaFechaCitaVendedor]
  );

  const handleSaveCita = useCallback(
    async (vendorId, dayIdx, hour, cliente, telefono, idExistente, gestorId, marca) => {
      if (idExistente) {
        await updateCita(idExistente, { vendorId, day: dayIdx, hour, cliente: cliente || "", telefono: telefono || "", gestorId: gestorId || "", marca: marca || "" });
        showToast("Cita actualizada");
      } else {
        await addCita({
          id: genId(),
          vendorId,
          day: dayIdx,
          hour,
          cliente: cliente || "",
          telefono: telefono || "",
          gestorId: gestorId || "",
          marca: marca || "",
          estado: "activa",
        });
        showToast("Cita asignada");
      }
      setModalCita(null);
    },
    [addCita, updateCita, showToast]
  );

  const handleCancelCita = useCallback(
    async (id) => {
      await updateCita(id, { estado: "cancelada" });
      setModalCita(null);
      showToast("Cita cancelada");
    },
    [updateCita, showToast]
  );

  const handleDeleteCita = useCallback(
    async (id) => {
      await removeCita(id);
      setModalCita(null);
      showToast("Cita eliminada");
    },
    [removeCita, showToast]
  );

  // Marca si el cliente asistió o no a la cita. Es una acción directa e inmediata (no espera
  // a "Guardar cambios"), para poder marcarla en cualquier momento sin tocar el resto de datos
  // de la cita. valor: true (asistió), false (no asistió), null (sin marcar).
  const handleSetAsistencia = useCallback(
    async (id, valor) => {
      await updateCita(id, { asistio: valor });
      showToast(valor === true ? "Marcado: asistió" : valor === false ? "Marcado: no asistió" : "Marca de asistencia eliminada");
    },
    [updateCita, showToast]
  );

  // ---------- Listado de ventas (histórico anual + cotejo en vivo, independientes) ----------
  // Construye el manejador de subida para un slot concreto ("historico" o "cotejo"),
  // reutilizando la misma lógica de lectura y detección de columnas para ambos.
  // Si crearLeadsAutomaticos es true (solo se usa para el histórico), las filas sin fecha de
  // cita se interpretan como "leads sin cita" (presupuesto / derivado directo a vendedor) y se
  // crean automáticamente en esa lista, emparejando vendedor y gestor lead por nombre si existen.
  const crearHandleFileUpload = useCallback(
    (guardarFn, setSubiendo, setError, crearLeadsAutomaticos) =>
      async (file) => {
        if (!file) return;
        setSubiendo(true);
        setError(null);
        try {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array", cellDates: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          if (rows.length === 0) {
            setError("El archivo no tiene filas con datos.");
            setSubiendo(false);
            return;
          }

          const keys = Object.keys(rows[0]);
          const findKey = (...patterns) =>
            keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p)));

          const kPhone = findKey("telefono", "tel", "movil", "phone");
          const kDate = findKey("fecha");
          const kVendedor = findKey("vendedor", "comercial", "asesor");
          const kGestorLead = findKey("gestor", "lead", "captador");
          const kCoche = findKey("matricula", "coche", "vehiculo", "car");
          const kModelo = findKey("modelo", "model");
          const kIsla = findKey("isla", "island", "provincia");
          const kSede = findKey("sede", "oficina", "delegacion", "branch");
          const kCliente = findKey("cliente", "nombre", "customer", "client");
          const kVendido = findKey("vendido", "venta", "sold", "estado", "cierre");
          const kAnio = findKey("ao", "anyo", "year");
          const kMes = findKey("mes", "month");
          const kMarca = findKey("marca", "brand");

          if (!kPhone) {
            setError("No he encontrado una columna de teléfono en el archivo.");
            setSubiendo(false);
            return;
          }

          // Algunos listados usan siglas de provincia en vez del nombre completo de la isla.
          const SIGLAS_ISLA = {
            tf: "Tenerife",
            gc: "Gran Canaria",
            lz: "Lanzarote",
            fv: "Fuerteventura",
            lp: "La Palma",
          };
          const normalizarIsla = (val) => {
            const s = String(val ?? "").trim();
            if (!s) return "";
            const sigla = SIGLAS_ISLA[s.toLowerCase()];
            return sigla || s;
          };

          // Estados que cuentan como venta confirmada (p.ej. "Vendido", "Pedido" = reserva en curso).
          // Vacío o estados intermedios (p.ej. "Presupuesto") se consideran "sin decidir todavía".
          const esVendidoTexto = (val) => {
            if (val === true || val === 1) return true;
            const s = String(val ?? "").trim().toLowerCase();
            if (!s) return null; // sin dato: no afirmamos nada
            if (["si", "sí", "vendido", "vendida", "pedido", "yes", "true", "1", "x"].includes(s)) return true;
            if (["no", "perdido", "perdida", "cancelado", "cancelada", "no interesa", "pendiente", "false", "0"].includes(s)) return false;
            return null; // estados intermedios desconocidos (ej. "Presupuesto"): no afirmamos nada
          };

          const filasLeidas = rows.map((r) => {
            const fecha = kDate ? parseAnyDate(r[kDate]) : null;
            let mesAnio = kAnio && kMes ? mesAnioDesdeExcel(r[kAnio], r[kMes]) : "";
            if (!mesAnio && fecha) {
              mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
            }
            const vendedorTexto = kVendedor ? String(r[kVendedor] || "").trim() : "";
            const gestorTexto = kGestorLead ? String(r[kGestorLead] || "").trim() : "";
            // Si el nombre del Excel coincide (aunque sea con formato distinto) con un vendedor
            // o gestor ya creado en la app, se usa el nombre "canónico" tal como está en la app,
            // para que el informe agrupe correctamente en vez de crear una categoría nueva por
            // cada variante de formato del listado de origen.
            const vendedorCanonico = vendedorTexto ? emparejarNombrePersona(vendedorTexto, vendedores, "nombre") : null;
            const gestorCanonico = gestorTexto ? emparejarNombrePersona(gestorTexto, gestores, "nombre") : null;
            const marcaTexto = kMarca ? String(r[kMarca] || "").trim() : "";
            const marcaCanonica = MARCAS.find((m) => normalizarNombrePersona(m) === normalizarNombrePersona(marcaTexto));
            return {
              phone: normalizePhone(r[kPhone]),
              date: fecha,
              vendedor: vendedorCanonico || vendedorTexto,
              gestorLead: gestorCanonico || gestorTexto,
              coche: kCoche ? String(r[kCoche] || "").trim() : "",
              modelo: kModelo ? String(r[kModelo] || "").trim() : "",
              isla: kIsla ? normalizarIsla(r[kIsla]) : "",
              sede: kSede ? String(r[kSede] || "").trim() : "",
              cliente: kCliente ? String(r[kCliente] || "").trim() : "",
              vendido: kVendido ? esVendidoTexto(r[kVendido]) : null,
              marca: marcaCanonica || marcaTexto,
              mesAnio,
            };
          });

          const records = filasLeidas.filter((r) => r.phone);

          let leadsCreados = 0;
          if (crearLeadsAutomaticos) {
            // Filas sin fecha de cita = lead sin cita (presupuesto / derivado directo).
            // Se ignoran las que ya existan (mismo teléfono) para no duplicar al reemplazar el archivo.
            const sinFecha = records.filter((r) => !r.date);
            const telefonosExistentes = new Set(
              leadsSinCita.map((l) => normalizePhone(l.telefono)).filter(Boolean)
            );
            const normalizaNombre = (s) => String(s || "").trim().toLowerCase();
            const nuevosLeads = sinFecha
              .filter((r) => !telefonosExistentes.has(r.phone))
              .map((r) => {
                const vendedorMatch = vendedores.find((v) => normalizaNombre(v.nombre) === normalizaNombre(r.vendedor));
                const gestorMatch = gestores.find((g) => normalizaNombre(g.nombre) === normalizaNombre(r.gestorLead));
                return {
                  id: genId(),
                  cliente: r.cliente || "",
                  telefono: r.phone || "",
                  gestorId: gestorMatch?.id || "",
                  vendorId: vendedorMatch?.id || "",
                  isla: r.isla || "",
                  sede: r.sede || "",
                  marca: r.marca || "",
                  mesAnio: r.mesAnio || "",
                  creadoEn: new Date().toISOString(),
                  origen: "excel",
                  origenArchivo: file.name,
                };
              });
            // Evita duplicados también dentro del propio archivo si el mismo teléfono se repite.
            const vistos = new Set();
            const nuevosLeadsUnicos = nuevosLeads.filter((l) => {
              if (!l.telefono || vistos.has(l.telefono)) return !l.telefono;
              vistos.add(l.telefono);
              return true;
            });
            if (nuevosLeadsUnicos.length > 0) {
              await addLeadsSinCitaEnLote(nuevosLeadsUnicos);
              leadsCreados = nuevosLeadsUnicos.length;
            }
          }

          const data = {
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            totalFilas: rows.length,
            records,
          };
          await guardarFn(data);
          showToast(
            leadsCreados > 0
              ? `Listado cargado: ${records.length} filas · ${leadsCreados} clientes sin cita añadidos`
              : `Listado cargado: ${records.length} ventas con teléfono válido`
          );
        } catch (e) {
          console.error(e);
          setError("No he podido leer el archivo. Comprueba que sea un .xlsx o .csv válido.");
        } finally {
          setSubiendo(false);
        }
      },
    [showToast, leadsSinCita, vendedores, gestores, addLeadsSinCitaEnLote]
  );

  const handleFileUploadHistorico = useCallback(
    (file) => crearHandleFileUpload(guardarVentasHistorico, setSubiendoHistorico, setErrorHistorico, true)(file),
    [crearHandleFileUpload, guardarVentasHistorico]
  );
  const handleFileUploadCotejo = useCallback(
    (file) => crearHandleFileUpload(guardarVentasCotejo, setSubiendoCotejo, setErrorCotejo, false)(file),
    [crearHandleFileUpload, guardarVentasCotejo]
  );

  const removeVentasHistorico = useCallback(async () => {
    await guardarVentasHistorico(null);
    showToast("Listado histórico eliminado");
  }, [guardarVentasHistorico, showToast]);

  const removeVentasCotejo = useCallback(async () => {
    await guardarVentasCotejo(null);
    showToast("Listado de cotejo eliminado");
  }, [guardarVentasCotejo, showToast]);

  // Combina los registros de ambos listados (histórico anual + cotejo en vivo) en uno solo,
  // para que el cotejo de teléfonos y los KPIs del informe tengan en cuenta toda la información
  // disponible, sin importar en qué pestaña se cargó cada listado.
  const todosLosRegistros = useMemo(() => {
    const a = ventasHistorico?.records || [];
    const b = ventasCotejo?.records || [];
    return [...a, ...b];
  }, [ventasHistorico, ventasCotejo]);

  const hayVentasCargadas = (ventasHistorico?.records?.length || 0) > 0 || (ventasCotejo?.records?.length || 0) > 0;

  const ventasParaTelefono = useCallback(
    (phone) => {
      if (!phone || todosLosRegistros.length === 0) return [];
      const norm = normalizePhone(phone);
      if (!norm) return [];
      return todosLosRegistros.filter((r) => r.phone === norm);
    },
    [todosLosRegistros]
  );

  // Determina si un conjunto de coincidencias de ventas representa una venta confirmada.
  // Si el conjunto combinado de listados trae una columna de estado (CIERRE/vendido) con
  // al menos un valor explícito en alguna fila, se asume que esa columna existe de verdad:
  // una coincidencia sin ese dato entonces cuenta como "sin decidir todavía", no como venta.
  // Solo si ningún listado tiene esa columna (listados antiguos) se usa el respaldo de
  // "aparecer en el listado = venta".
  const esVendida = useCallback(
    (matches) => {
      if (!matches || matches.length === 0) return false;
      const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
      if (!columnaEstadoExiste) return true;
      return matches.some((m) => m.vendido === true);
    },
    [todosLosRegistros]
  );

  // ---------- Navegación semana ----------
  const goWeek = useCallback((delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }, []);

  const slots = useMemo(() => slotsDia(), []);

  const citasActivas = useMemo(() => citas.filter((c) => c.estado !== "cancelada"), [citas]);
  const totalCitasSemana = citasActivas.length;

  const citasConVenta = useMemo(() => {
    if (!hayVentasCargadas) return new Set();
    const ids = new Set();
    citasActivas.forEach((c) => {
      if (c.telefono && esVendida(ventasParaTelefono(c.telefono))) ids.add(c.id);
    });
    return ids;
  }, [citasActivas, hayVentasCargadas, ventasParaTelefono, esVendida]);

  const leadsSinCitaConVenta = useMemo(() => {
    const ids = new Set();
    const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
    leadsSinCita.forEach((l) => {
      const matches = l.telefono ? ventasParaTelefono(l.telefono) : [];
      if (resolverVendidoManualOAuto(l.estadoManual, matches, columnaEstadoExiste) === true) ids.add(l.id);
    });
    return ids;
  }, [leadsSinCita, ventasParaTelefono, todosLosRegistros]);

  // Meses/años presentes en los leads sin cita, ordenados del más reciente al más antiguo,
  // para rellenar el desplegable de filtro sin tener que escribirlos a mano.
  const mesesDisponiblesLeads = useMemo(() => {
    const set = new Set(leadsSinCita.map((l) => l.mesAnio).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [leadsSinCita]);

  const leadsSinCitaFiltrados = useMemo(() => {
    const busqueda = leadBusqueda.trim().toLowerCase();
    const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
    return leadsSinCita.filter((l) => {
      if (busqueda) {
        const nombre = (l.cliente || "").toLowerCase();
        const tel = (l.telefono || "").toLowerCase();
        if (!nombre.includes(busqueda) && !tel.includes(busqueda)) return false;
      }
      if (leadFiltroGestorId && l.gestorId !== leadFiltroGestorId) return false;
      if (leadFiltroIsla && l.isla !== leadFiltroIsla) return false;
      if (leadFiltroMesAnio && l.mesAnio !== leadFiltroMesAnio) return false;
      if (leadFiltroEstado !== "todos") {
        const matches = ventasParaTelefono(l.telefono);
        const vendido = resolverVendidoManualOAuto(l.estadoManual, matches, columnaEstadoExiste);
        const estado = vendido === true ? "vendido" : vendido === false ? "novendido" : "sinregistro";
        if (estado !== leadFiltroEstado) return false;
      }
      return true;
    });
  }, [leadsSinCita, leadBusqueda, leadFiltroGestorId, leadFiltroIsla, leadFiltroMesAnio, leadFiltroEstado, ventasParaTelefono, todosLosRegistros]);

  // Agrupa los leads ya filtrados por mes o por gestor lead, para que la lista no se muestre
  // como un bloque interminable. Cada grupo se puede plegar/desplegar; por defecto solo el
  // primero (el mes más reciente, o el gestor con más leads) aparece desplegado.
  const leadsAgrupados = useMemo(() => {
    const map = new Map();
    leadsSinCitaFiltrados.forEach((l) => {
      let clave, etiqueta;
      if (leadAgruparPor === "gestor") {
        const g = gestores.find((gg) => gg.id === l.gestorId);
        clave = l.gestorId || "sin-gestor";
        etiqueta = g?.nombre || "Sin gestor";
      } else {
        clave = l.mesAnio || "sin-mes";
        etiqueta = l.mesAnio ? mesAnioLabel(l.mesAnio) : "Sin mes";
      }
      if (!map.has(clave)) map.set(clave, { clave, etiqueta, leads: [] });
      map.get(clave).leads.push(l);
    });
    const grupos = Array.from(map.values());
    if (leadAgruparPor === "mes") {
      grupos.sort((a, b) => {
        if (a.clave === "sin-mes") return 1;
        if (b.clave === "sin-mes") return -1;
        return b.clave.localeCompare(a.clave);
      });
    } else {
      grupos.sort((a, b) => b.leads.length - a.leads.length || a.etiqueta.localeCompare(b.etiqueta));
    }
    return grupos;
  }, [leadsSinCitaFiltrados, leadAgruparPor, gestores]);

  const limpiarFiltrosLeads = useCallback(() => {
    setLeadBusqueda("");
    setLeadFiltroEstado("todos");
    setLeadFiltroGestorId("");
    setLeadFiltroIsla("");
    setLeadFiltroMesAnio("");
  }, []);

  const hayFiltrosLeadsActivos =
    leadBusqueda || leadFiltroEstado !== "todos" || leadFiltroGestorId || leadFiltroIsla || leadFiltroMesAnio;

  // Carga mensual por vendedor (no solo de la semana que se está viendo), para que la leyenda
  // de la agenda refleje el mismo criterio de equidad que usa la sugerencia de vendedor al
  // crear una cita. Se usa el mes de la semana actualmente visible como referencia.
  const cargaPorVendedor = useMemo(() => {
    const map = {};
    vendedores.forEach((v) => (map[v.id] = 0));
    const fechaRef = weekDates[0];
    const anio = fechaRef.getFullYear();
    const mes = fechaRef.getMonth();
    todasLasCitas.forEach((c) => {
      if (c.estado === "cancelada") return;
      const fecha = fechaDeCitaSemana(c.weekKey, c.day);
      if (fecha && fecha.getFullYear() === anio && fecha.getMonth() === mes) {
        map[c.vendorId] = (map[c.vendorId] || 0) + 1;
      }
    });
    return map;
  }, [vendedores, todasLasCitas, weekDates]);
  const maxCarga = Math.max(1, ...Object.values(cargaPorVendedor));
  const minCarga = vendedores.length ? Math.min(...Object.values(cargaPorVendedor)) : 0;
  const desbalanceado = vendedores.length > 1 && maxCarga - minCarga >= 2;

  // Vendedores con algún día de vacaciones dentro de la semana que se está viendo, para
  // avisar visualmente en la leyenda de la agenda aunque no ocupen ningún slot concreto.
  const vendedoresDeVacacionesEstaSemana = useMemo(() => {
    const set = new Set();
    weekDates.forEach((fecha) => {
      vendedores.forEach((v) => {
        if (estaDeVacaciones(v.id, fecha)) set.add(v.id);
      });
    });
    return set;
  }, [weekDates, vendedores, estaDeVacaciones]);

  // Vacaciones a mostrar en la pestaña Turnos, respetando el filtro global de Isla/Sede/Marca.
  const vacacionesFiltradas = useMemo(() => {
    return [...vacaciones]
      .filter((vac) => vendedoresFiltrados.some((v) => v.id === vac.vendorId))
      .sort((a, b) => (b.hasta || "").localeCompare(a.hasta || ""));
  }, [vacaciones, vendedoresFiltrados]);

  const citasPorGestor = useMemo(() => {
    const map = {};
    gestores.forEach((g) => (map[g.id] = 0));
    citasActivas.forEach((c) => {
      if (c.gestorId) map[c.gestorId] = (map[c.gestorId] || 0) + 1;
    });
    return map;
  }, [gestores, citasActivas]);

  // Convierte cada lead sin cita en un registro con la misma forma que los del Excel,
  // para que entre igual en los KPIs (citas generadas por gestor lead, con o sin vendedor).
  // El estado de venta se resuelve en vivo cruzando su teléfono con los listados cargados.
  const registrosDeLeadsSinCita = useMemo(() => {
    return leadsSinCita.map((l) => {
      const v = vendedores.find((vv) => vv.id === l.vendorId);
      const g = gestores.find((gg) => gg.id === l.gestorId);
      const matches = ventasParaTelefono(l.telefono);
      const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
      const vendido = resolverVendidoManualOAuto(l.estadoManual, matches, columnaEstadoExiste);
      return {
        phone: normalizePhone(l.telefono),
        date: l.creadoEn ? new Date(l.creadoEn) : null,
        mesAnio: l.mesAnio || "",
        vendedor: v?.nombre || "",
        gestorLead: g?.nombre || "",
        coche: "",
        modelo: matches[0]?.modelo || matches[0]?.coche || "",
        isla: l.isla || matches[0]?.isla || "",
        sede: l.sede || matches[0]?.sede || "",
        marca: l.marca || matches[0]?.marca || "",
        cliente: l.cliente || matches[0]?.cliente || "",
        vendido,
      };
    });
  }, [leadsSinCita, vendedores, gestores, ventasParaTelefono, todosLosRegistros]);

  // Convierte cada cita real de la agenda (de cualquier semana, no solo la que se está viendo)
  // en un registro con la misma forma que los del Excel y los leads sin cita, para que el
  // informe de KPIs refleje también el trabajo del día a día, no solo lo que se sube por Excel.
  // Las citas canceladas no se cuentan: nunca llegaron a ser una venta potencial real.
  const registrosDeCitasAgenda = useMemo(() => {
    return todasLasCitas
      .filter((c) => c.estado !== "cancelada" && c.telefono)
      .map((c) => {
        const v = vendedores.find((vv) => vv.id === c.vendorId);
        const g = gestores.find((gg) => gg.id === c.gestorId);
        const matches = ventasParaTelefono(c.telefono);
        const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
        const vendido = matches.length === 0
          ? null
          : columnaEstadoExiste
            ? (matches.some((m) => m.vendido === true) ? true : matches.some((m) => m.vendido === false) ? false : null)
            : true;
        const fecha = fechaDeCitaSemana(c.weekKey, c.day);
        const mesAnio = fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}` : "";
        return {
          phone: normalizePhone(c.telefono),
          date: fecha,
          mesAnio,
          vendedor: v?.nombre || "",
          gestorLead: g?.nombre || "",
          coche: "",
          modelo: matches[0]?.modelo || matches[0]?.coche || "",
          isla: v?.isla || matches[0]?.isla || "",
          sede: v?.sede || matches[0]?.sede || "",
          marca: c.marca || matches[0]?.marca || "",
          cliente: c.cliente || matches[0]?.cliente || "",
          vendido,
        };
      });
  }, [todasLasCitas, vendedores, gestores, ventasParaTelefono, todosLosRegistros]);

  // ---------- Datos combinados y deduplicados (histórico + cotejo + leads sin cita) ----------
  // Esto se calcula una sola vez, independientemente de los filtros del informe.
  const registrosUnicosCombinados = useMemo(() => {
    const registrosCombinados = [...todosLosRegistros, ...registrosDeLeadsSinCita, ...registrosDeCitasAgenda];
    if (registrosCombinados.length === 0) return [];

    // Si el mismo teléfono aparece en varios orígenes (p.ej. una cita real de la agenda que
    // luego también aparece en el Excel de cotejo, o un lead sin cita que coincide con una fila
    // del Excel), evitamos contarla dos veces en los KPIs. Nos quedamos con un registro por
    // teléfono, priorizando el que confirme una venta.
    const porTelefono = new Map();
    registrosCombinados.forEach((r) => {
      if (!r.phone) return;
      const previo = porTelefono.get(r.phone);
      if (!previo) {
        porTelefono.set(r.phone, r);
      } else if (previo.vendido !== true && r.vendido === true) {
        porTelefono.set(r.phone, r);
      }
    });
    // Los leads sin cita sin teléfono (puede pasar, ya que solo el nombre es obligatorio)
    // no se pueden cotejar por teléfono, pero igualmente deben contar en el informe.
    const sinTelefono = registrosCombinados.filter((r) => !r.phone);
    return [...Array.from(porTelefono.values()), ...sinTelefono];
  }, [todosLosRegistros, registrosDeLeadsSinCita, registrosDeCitasAgenda]);

  const handleAddLeadSinCita = useCallback(async () => {
    const cliente = nuevoLeadCliente.trim();
    const telefono = nuevoLeadTelefono.trim();
    if (!cliente && !telefono) return;

    const telNormalizado = normalizePhone(telefono);
    if (telNormalizado) {
      const yaExiste = registrosUnicosCombinados.find((r) => r.phone === telNormalizado);
      if (yaExiste) {
        const confirma = window.confirm(
          `Este teléfono ya existe registrado para "${yaExiste.cliente || "sin nombre"}"${yaExiste.vendedor ? ` (vendedor: ${yaExiste.vendedor})` : ""}.\n\n¿Quieres añadirlo igualmente? (por ejemplo, si es una visita o gestión distinta del mismo cliente)`
        );
        if (!confirma) return;
      }
    }

    const nuevo = {
      id: genId(),
      cliente,
      telefono,
      gestorId: nuevoLeadGestorId || "",
      vendorId: nuevoLeadVendorId || "",
      isla: nuevoLeadIsla || "",
      sede: nuevoLeadSede || "",
      marca: nuevoLeadMarca || "",
      mesAnio: nuevoLeadMesAnio || "",
      creadoEn: new Date().toISOString(),
      origen: "manual",
    };
    await addLeadSinCita(nuevo);
    setNuevoLeadCliente("");
    setNuevoLeadTelefono("");
    setNuevoLeadGestorId("");
    setNuevoLeadVendorId("");
    setNuevoLeadIsla("");
    setNuevoLeadSede("");
    setNuevoLeadMarca("");
    // El mes/año NO se resetea: si está añadiendo varios leads del mismo mes seguidos,
    // no tiene que volver a seleccionarlo cada vez.
    showToast(`${cliente || "Lead"} añadido`);
  }, [nuevoLeadCliente, nuevoLeadTelefono, nuevoLeadGestorId, nuevoLeadVendorId, nuevoLeadIsla, nuevoLeadSede, nuevoLeadMarca, nuevoLeadMesAnio, addLeadSinCita, showToast, registrosUnicosCombinados]);

  // Si el conjunto combinado trae la columna de estado (CIERRE/vendido) con al menos un valor
  // explícito, asumimos que esa columna existe de verdad: una fila vacía entonces significa
  // "aún sin decidir", no "vendido". Solo si NINGUNA fila trae ese dato (listados antiguos sin
  // columna de estado) usamos el respaldo de "aparecer en el listado = vendido".
  const columnaEstadoExisteGlobal = useMemo(
    () => registrosUnicosCombinados.some((r) => r.vendido !== null && r.vendido !== undefined),
    [registrosUnicosCombinados]
  );
  const esVendidaRecordGlobal = useCallback(
    (r) => (columnaEstadoExisteGlobal ? r.vendido === true : true),
    [columnaEstadoExisteGlobal]
  );

  // Leads sin cita con el mismo teléfono exacto repetidos entre sí (no contra el Excel ni
  // contra citas reales, que tienen su propio ciclo de vida): probablemente la misma persona
  // dada de alta dos veces por error, y candidatos a fusionar en uno solo.
  const leadsDuplicados = useMemo(() => {
    const porTelefono = new Map();
    leadsSinCita.forEach((l) => {
      const tel = normalizePhone(l.telefono);
      if (!tel) return;
      if (!porTelefono.has(tel)) porTelefono.set(tel, []);
      porTelefono.get(tel).push(l);
    });
    return Array.from(porTelefono.values()).filter((grupo) => grupo.length > 1);
  }, [leadsSinCita]);

  // Fusiona un grupo de leads duplicados en uno solo: conserva el primero (el más antiguo) y
  // completa los campos que tuviera vacíos con los datos de los demás, luego elimina el resto.
  const fusionarLeadsDuplicados = useCallback(
    async (grupo) => {
      const ordenado = [...grupo].sort((a, b) => new Date(a.creadoEn || 0) - new Date(b.creadoEn || 0));
      const principal = ordenado[0];
      const resto = ordenado.slice(1);
      const camposCompletados = {};
      ["cliente", "gestorId", "vendorId", "isla", "sede", "mesAnio"].forEach((campo) => {
        if (!principal[campo]) {
          const conValor = resto.find((l) => l[campo]);
          if (conValor) camposCompletados[campo] = conValor[campo];
        }
      });
      if (Object.keys(camposCompletados).length > 0) {
        await updateLeadSinCita(principal.id, camposCompletados);
      }
      await Promise.all(resto.map((l) => removeLeadSinCita(l.id)));
      showToast(`Fusionados ${grupo.length} registros en uno solo`);
    },
    [updateLeadSinCita, removeLeadSinCita, showToast]
  );

  // Meses/años disponibles en todo el conjunto, para rellenar el filtro de mes del informe.
  const mesesDisponiblesInforme = useMemo(() => {
    const set = new Set(registrosUnicosCombinados.map((r) => r.mesAnio).filter(Boolean));
    set.add(mesAnioActual()); // siempre visible en el desplegable, aunque aún no tenga datos
    return Array.from(set).sort().reverse();
  }, [registrosUnicosCombinados]);

  // Nombres de gestor y vendedor presentes en los datos combinados (no solo en las listas
  // actuales de Gestores/Vendedores, por si el Excel trae nombres que aún no se han creado).
  const gestoresDisponiblesInforme = useMemo(() => {
    const set = new Set(registrosUnicosCombinados.map((r) => r.gestorLead).filter(Boolean));
    return Array.from(set).sort();
  }, [registrosUnicosCombinados]);
  const vendedoresDisponiblesInforme = useMemo(() => {
    const set = new Set(registrosUnicosCombinados.map((r) => r.vendedor).filter(Boolean));
    return Array.from(set).sort();
  }, [registrosUnicosCombinados]);

  // ---------- Filtros del informe ----------
  // Por defecto se muestra el mes en curso (dato más útil de un vistazo), pero se puede
  // cambiar a cualquier otro periodo o quitar el filtro de mes en cualquier momento.
  const [informeFiltroMesAnio, setInformeFiltroMesAnio] = useState(() => mesAnioActual());
  const [informeFiltroDesde, setInformeFiltroDesde] = useState("");
  const [informeFiltroHasta, setInformeFiltroHasta] = useState("");
  const [informeFiltroMarca, setInformeFiltroMarca] = useState("");
  const [informeFiltroGestor, setInformeFiltroGestor] = useState("");
  const [informeFiltroVendedor, setInformeFiltroVendedor] = useState("");
  const [vistaGraficoMensual, setVistaGraficoMensual] = useState("total");

  const hayFiltrosInformeActivos =
    informeFiltroMesAnio || informeFiltroDesde || informeFiltroHasta || informeFiltroMarca || informeFiltroGestor || informeFiltroVendedor;

  // "Limpiar" quita todos los filtros, incluido el mes por defecto, para ver el histórico
  // completo sin restricciones.
  const limpiarFiltrosInforme = useCallback(() => {
    setInformeFiltroMesAnio("");
    setInformeFiltroDesde("");
    setInformeFiltroHasta("");
    setInformeFiltroMarca("");
    setInformeFiltroGestor("");
    setInformeFiltroVendedor("");
  }, []);

  const registrosFiltradosInforme = useMemo(() => {
    return registrosUnicosCombinados.filter((r) => {
      if (informeFiltroMesAnio && r.mesAnio !== informeFiltroMesAnio) return false;
      if (informeFiltroDesde && (!r.date || r.date < new Date(informeFiltroDesde))) return false;
      if (informeFiltroHasta) {
        const hasta = new Date(informeFiltroHasta);
        hasta.setHours(23, 59, 59, 999);
        if (!r.date || r.date > hasta) return false;
      }
      if (informeFiltroMarca && r.marca !== informeFiltroMarca) return false;
      if (informeFiltroGestor && r.gestorLead !== informeFiltroGestor) return false;
      if (informeFiltroVendedor && r.vendedor !== informeFiltroVendedor) return false;
      return true;
    });
  }, [registrosUnicosCombinados, informeFiltroMesAnio, informeFiltroDesde, informeFiltroHasta, informeFiltroMarca, informeFiltroGestor, informeFiltroVendedor]);

  // ---------- Resumen del informe (sobre los registros ya filtrados) ----------
  const resumenVentas = useMemo(() => {
    const registrosUnicos = registrosFiltradosInforme;
    if (registrosUnicos.length === 0) return null;

    const esVendidaRecord = esVendidaRecordGlobal;
    const totalRegistros = registrosUnicos.length;
    const vendidos = registrosUnicos.filter(esVendidaRecord);
    const noVendidos = columnaEstadoExisteGlobal
      ? registrosUnicos.filter((r) => r.vendido === false)
      : [];
    const totalVendidos = vendidos.length;
    const totalNoVendidos = noVendidos.length;
    const totalSinDecidir = totalRegistros - totalVendidos - totalNoVendidos;
    const tasaConversion = totalRegistros > 0 ? Math.round((totalVendidos / totalRegistros) * 100) : 0;

    // Datos listos para el gráfico donut de estado general (solo se incluyen los que tengan
    // algún registro, para no mostrar segmentos vacíos en la leyenda).
    const datosDonut = [
      { nombre: "Vendido", valor: totalVendidos, color: "#4F9B72" },
      { nombre: "No vendido", valor: totalNoVendidos, color: "#C45A2E" },
      { nombre: "Sin decidir", valor: totalSinDecidir, color: "#D8CFB8" },
    ].filter((d) => d.valor > 0);

    const agrupar = (campo) => {
      const map = {};
      registrosUnicos.forEach((r) => {
        const clave = (r[campo] || "Sin especificar").trim() || "Sin especificar";
        if (!map[clave]) map[clave] = { total: 0, vendidos: 0, registros: [] };
        map[clave].total += 1;
        if (esVendidaRecord(r)) map[clave].vendidos += 1;
        map[clave].registros.push(r);
      });
      return Object.entries(map)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.vendidos - a.vendidos || b.total - a.total);
    };

    const porVendedor = agrupar("vendedor");
    const porGestorLead = agrupar("gestorLead");
    const porIsla = agrupar("isla");
    const porModelo = agrupar("modelo");
    const porMarca = agrupar("marca");

    // Calidad de los datos: cuántos registros no tienen gestor o vendedor asignado,
    // para detectar huecos de información de un vistazo.
    const sinGestor = registrosUnicos.filter((r) => !r.gestorLead || !r.gestorLead.trim()).length;
    const sinVendedor = registrosUnicos.filter((r) => !r.vendedor || !r.vendedor.trim()).length;

    // Islas presentes en el conjunto filtrado, para las series del gráfico mensual por isla.
    const islasPresentes = Array.from(new Set(registrosUnicos.map((r) => (r.isla || "").trim()).filter(Boolean))).sort();

    // Serie mensual: ventas y total de leads/citas por mes, ordenada cronológicamente,
    // para alimentar el gráfico de tendencia. Incluye también el desglose "vendidos por isla"
    // de cada mes, para el gráfico comparativo por isla.
    const porMesMap = {};
    registrosUnicos.forEach((r) => {
      const clave = r.mesAnio || "Sin mes";
      if (!porMesMap[clave]) {
        porMesMap[clave] = { total: 0, vendidos: 0, porIsla: {} };
      }
      porMesMap[clave].total += 1;
      if (esVendidaRecord(r)) {
        porMesMap[clave].vendidos += 1;
        const isla = (r.isla || "Sin especificar").trim() || "Sin especificar";
        porMesMap[clave].porIsla[isla] = (porMesMap[clave].porIsla[isla] || 0) + 1;
      }
    });
    const porMes = Object.entries(porMesMap)
      .map(([mesAnio, datos]) => ({
        mesAnio,
        label: mesAnioLabel(mesAnio),
        ...datos,
        ...datos.porIsla,
        tasaConversion: datos.total > 0 ? Math.round((datos.vendidos / datos.total) * 100) : 0,
      }))
      .sort((a, b) => (a.mesAnio === "Sin mes" ? 1 : b.mesAnio === "Sin mes" ? -1 : a.mesAnio.localeCompare(b.mesAnio)));

    const fechasValidas = registrosUnicos.map((r) => r.date).filter(Boolean);
    const fechaMin = fechasValidas.length ? new Date(Math.min(...fechasValidas)) : null;
    const fechaMax = fechasValidas.length ? new Date(Math.max(...fechasValidas)) : null;

    return {
      totalRegistros,
      totalVendidos,
      totalNoVendidos,
      totalSinDecidir,
      datosDonut,
      tasaConversion,
      sinGestor,
      sinVendedor,
      porVendedor,
      porGestorLead,
      porIsla,
      porModelo,
      porMarca,
      porMes,
      islasPresentes,
      fechaMin,
      fechaMax,
    };
  }, [registrosFiltradosInforme, esVendidaRecordGlobal, columnaEstadoExisteGlobal]);

  // ---------- Asistencia a citas (independiente del pipeline de ventas) ----------
  // Se calcula directamente sobre las citas reales de la agenda (no sobre el conjunto
  // deduplicado de ventas), aplicando los mismos filtros de mes/rango/gestor/vendedor que el
  // resto del informe, para no perder el dato "asistio" si esa cita quedó descartada en la
  // deduplicación por teléfono al combinar con Excel o leads sin cita.
  const resumenAsistencia = useMemo(() => {
    const citasMarcadas = todasLasCitas.filter((c) => {
      if (c.estado === "cancelada") return false;
      if (c.asistio !== true && c.asistio !== false) return false;
      const v = vendedores.find((vv) => vv.id === c.vendorId);
      const g = gestores.find((gg) => gg.id === c.gestorId);
      const vendedorNombre = v?.nombre || "";
      const gestorNombre = g?.nombre || "";
      const fecha = fechaDeCitaSemana(c.weekKey, c.day);
      const mesAnio = fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}` : "";
      if (informeFiltroMesAnio && mesAnio !== informeFiltroMesAnio) return false;
      if (informeFiltroDesde && (!fecha || fecha < new Date(informeFiltroDesde))) return false;
      if (informeFiltroHasta) {
        const hasta = new Date(informeFiltroHasta);
        hasta.setHours(23, 59, 59, 999);
        if (!fecha || fecha > hasta) return false;
      }
      if (informeFiltroMarca && c.marca !== informeFiltroMarca) return false;
      if (informeFiltroGestor && gestorNombre !== informeFiltroGestor) return false;
      if (informeFiltroVendedor && vendedorNombre !== informeFiltroVendedor) return false;
      return true;
    });

    if (citasMarcadas.length === 0) return null;

    const asistieron = citasMarcadas.filter((c) => c.asistio === true).length;
    const noAsistieron = citasMarcadas.length - asistieron;
    const tasa = Math.round((asistieron / citasMarcadas.length) * 100);

    const map = {};
    citasMarcadas.forEach((c) => {
      const v = vendedores.find((vv) => vv.id === c.vendorId);
      const nombre = v?.nombre || "Sin especificar";
      if (!map[nombre]) map[nombre] = { total: 0, asistio: 0 };
      map[nombre].total += 1;
      if (c.asistio === true) map[nombre].asistio += 1;
    });
    const porVendedor = Object.entries(map)
      .map(([nombre, d]) => ({ nombre, asistio: d.asistio, total: d.total }))
      .sort((a, b) => a.asistio / a.total - b.asistio / b.total || b.total - a.total);

    return { total: citasMarcadas.length, asistieron, noAsistieron, tasa, porVendedor };
  }, [todasLasCitas, vendedores, gestores, informeFiltroMesAnio, informeFiltroDesde, informeFiltroHasta, informeFiltroMarca, informeFiltroGestor, informeFiltroVendedor]);

  // Exporta el informe (ya filtrado) a un Excel con varias hojas: resumen, desgloses y detalle.
  const handleExportarInforme = useCallback(() => {
    if (!resumenVentas) return;
    const wb = XLSX.utils.book_new();

    const hojaResumen = XLSX.utils.aoa_to_sheet([
      ["Informe anual de ventas"],
      [],
      ["Registros totales", resumenVentas.totalRegistros],
      ["Vendidos", resumenVentas.totalVendidos],
      ["No vendidos", resumenVentas.totalNoVendidos],
      ["Tasa de conversión", `${resumenVentas.tasaConversion}%`],
      ["Sin gestor asignado", resumenVentas.sinGestor],
      ["Sin vendedor asignado", resumenVentas.sinVendedor],
    ]);
    XLSX.utils.book_append_sheet(wb, hojaResumen, "Resumen");

    const aHoja = (filas) =>
      XLSX.utils.aoa_to_sheet([
        ["Nombre", "Vendidos", "Total", "Tasa de conversión"],
        ...filas.map((f) => [f.nombre, f.vendidos, f.total, `${f.total > 0 ? Math.round((f.vendidos / f.total) * 100) : 0}%`]),
      ]);
    XLSX.utils.book_append_sheet(wb, aHoja(resumenVentas.porVendedor), "Por vendedor");
    XLSX.utils.book_append_sheet(wb, aHoja(resumenVentas.porGestorLead), "Por gestor lead");
    XLSX.utils.book_append_sheet(wb, aHoja(resumenVentas.porIsla), "Por isla");
    XLSX.utils.book_append_sheet(wb, aHoja(resumenVentas.porModelo), "Por modelo");
    XLSX.utils.book_append_sheet(wb, aHoja(resumenVentas.porMarca), "Por marca");

    const hojaMes = XLSX.utils.aoa_to_sheet([
      ["Mes", "Total", "Vendidos"],
      ...resumenVentas.porMes.map((m) => [m.label, m.total, m.vendidos]),
    ]);
    XLSX.utils.book_append_sheet(wb, hojaMes, "Por mes");

    const hojaDetalle = XLSX.utils.aoa_to_sheet([
      ["Cliente", "Teléfono", "Mes", "Vendedor", "Gestor lead", "Isla", "Sede", "Marca", "Modelo", "Estado"],
      ...registrosFiltradosInforme.map((r) => [
        r.cliente || "",
        r.phone || "",
        r.mesAnio ? mesAnioLabel(r.mesAnio) : "",
        r.vendedor || "",
        r.gestorLead || "",
        r.isla || "",
        r.sede || "",
        r.marca || "",
        r.modelo || r.coche || "",
        r.vendido === true ? "Vendido" : r.vendido === false ? "No vendido" : "Sin decidir",
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, hojaDetalle, "Detalle");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `informe-ventas-${fecha}.xlsx`);
    showToast("Informe exportado");
  }, [resumenVentas, registrosFiltradosInforme, showToast]);

  if (loading) {
    return (
      <div style={{ ...styles.root, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ color: "#8A7B5C", fontFamily: "var(--font-body)" }}>Cargando agenda…</div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{globalCss}</style>

      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.brand}>
            <div style={styles.brandMark}>AV</div>
            <div>
              <div style={styles.brandTitle}>Agenda de vendedores</div>
              <div style={styles.brandSub}>
                {firebaseDisponible ? (
                  <span style={styles.syncOk}><Wifi size={11} /> Sincronizada en tiempo real</span>
                ) : (
                  <span style={styles.syncOff}><WifiOff size={11} /> Modo local — configura Firebase para compartirla</span>
                )}
              </div>
            </div>
          </div>
          <div style={styles.tabs}>
            <button onClick={() => setVista("agenda")} style={vista === "agenda" ? styles.tabActive : styles.tab}>
              <Calendar size={15} /> Agenda
            </button>
            <button onClick={() => setVista("sincita")} style={vista === "sincita" ? styles.tabActive : styles.tab}>
              <UserPlus size={15} /> Sin cita
            </button>
            <div style={styles.gestionMenuWrap} ref={gestionMenuRef}>
              <button
                onClick={() => setGestionMenuAbierto((v) => !v)}
                style={VISTAS_GESTION.includes(vista) ? styles.tabActive : styles.tab}
              >
                <Settings size={15} /> Gestión <ChevronDown size={13} style={{ opacity: 0.6 }} />
              </button>
              {gestionMenuAbierto && (
                <div style={styles.gestionMenuDropdown}>
                  {[
                    { key: "turnos", icon: Clock, label: "Turnos" },
                    { key: "vendedores", icon: Users, label: "Vendedores" },
                    { key: "gestores", icon: UserCog, label: "Gestores" },
                    { key: "ventas", icon: CarFront, label: "Ventas" },
                    { key: "informe", icon: BarChart3, label: "Informe" },
                  ].map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setVista(key);
                        setGestionMenuAbierto(false);
                      }}
                      style={vista === key ? styles.gestionMenuItemActive : styles.gestionMenuItem}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.weekNav}>
          <button onClick={() => goWeek(-1)} style={styles.navBtn} aria-label="Semana anterior">
            <ChevronLeft size={18} />
          </button>
          <div style={styles.weekLabel}>
            Semana del {fmtDateLabel(weekDates[0])} al {fmtDateLabel(weekDates[5])}
          </div>
          <button onClick={() => goWeek(1)} style={styles.navBtn} aria-label="Semana siguiente">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setWeekStart(getMonday(new Date()))} style={styles.todayBtn}>
            Hoy
          </button>

          <div style={{ flex: 1 }} />

          {vendedores.length > 0 && (
            <div style={styles.balanceWrap}>
              {desbalanceado && (
                <span style={styles.balanceWarn}>
                  <AlertCircle size={13} /> Carga desigual
                </span>
              )}
              <span style={styles.balanceCount}>{totalCitasSemana} citas esta semana</span>
              {hayVentasCargadas && (
                <span style={styles.balanceSold}>
                  <CarFront size={12} /> {citasConVenta.size} vendidas
                </span>
              )}
            </div>
          )}
        </div>

        {vendedores.length > 0 && (
          <div style={styles.filterBar}>
            <MapPin size={13} color="#A89B7E" style={{ flexShrink: 0 }} />
            <FiltroDesplegable
              etiqueta="Isla"
              opciones={ISLAS.filter((isla) => vendedores.some((v) => v.isla === isla))}
              seleccionados={filtroIslas}
              onToggle={toggleFiltroIsla}
              colorDe={(isla) => PALETA_ISLAS[isla]?.hue || "#5C5240"}
            />
            <FiltroDesplegable
              etiqueta="Sede"
              opciones={sedesFiltrablesDisponibles.filter((sede) => vendedores.some((v) => v.sede === sede))}
              seleccionados={filtroSedes}
              onToggle={toggleFiltroSede}
              colorDe={(sede) => {
                const islaDeSede = ISLAS.find((i) => (ISLAS_SEDES[i] || []).includes(sede));
                return colorParaSede(islaDeSede, sede).border;
              }}
            />
            <FiltroDesplegable
              etiqueta="Marca"
              opciones={MARCAS.filter((marca) => vendedores.some((v) => (v.marcas || []).includes(marca)))}
              seleccionados={filtroMarcas}
              onToggle={toggleFiltroMarca}
              colorDe={(marca) => colorParaMarca(marca).border}
            />
            {(filtroIslas.length > 0 || filtroSedes.length > 0 || filtroMarcas.length > 0) && (
              <button onClick={limpiarFiltros} style={styles.filterClear}>
                <X size={11} /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {vendedores.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <div style={styles.emptyTitle}>Aún no hay vendedores</div>
          <div style={styles.emptyText}>Añade tu equipo para empezar a repartir turnos y citas.</div>
          <button onClick={() => setVista("vendedores")} style={styles.primaryBtn}>
            <Plus size={16} /> Añadir vendedores
          </button>
        </div>
      )}

      {vendedores.length >= 0 && vista === "vendedores" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Equipo de ventas</div>
          <div style={styles.panelHint}>
            Se muestran los vendedores según el filtro de Isla/Sede/Marca activo en la cabecera de arriba.
          </div>
          <div style={styles.addRow}>
            <input
              value={nuevoVendedorNombre}
              onChange={(e) => setNuevoVendedorNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddVendedor()}
              placeholder="Nombre del vendedor"
              style={styles.input}
            />
            <select
              value={nuevoVendedorIsla}
              onChange={(e) => {
                const isla = e.target.value;
                setNuevoVendedorIsla(isla);
                setNuevoVendedorSede((ISLAS_SEDES[isla] || [])[0] || isla);
              }}
              style={styles.select}
            >
              {ISLAS.map((isla) => (
                <option key={isla} value={isla}>{isla}</option>
              ))}
            </select>
            {(ISLAS_SEDES[nuevoVendedorIsla] || []).length > 0 && (
              <select
                value={nuevoVendedorSede}
                onChange={(e) => setNuevoVendedorSede(e.target.value)}
                style={styles.select}
              >
                {ISLAS_SEDES[nuevoVendedorIsla].map((sede) => (
                  <option key={sede} value={sede}>{sede}</option>
                ))}
              </select>
            )}
            <div style={styles.marcasCheckboxRow}>
              {MARCAS.map((marca) => (
                <label key={marca} style={styles.marcaCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={nuevoVendedorMarcas.includes(marca)}
                    onChange={() =>
                      setNuevoVendedorMarcas((prev) =>
                        prev.includes(marca) ? prev.filter((m) => m !== marca) : [...prev, marca]
                      )
                    }
                    style={styles.filtroDesplegableCheckbox}
                  />
                  {marca}
                </label>
              ))}
            </div>
            <button onClick={handleAddVendedor} style={styles.primaryBtn}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          <div style={styles.vendorList}>
            {vendedoresFiltrados.length === 0 && vendedores.length > 0 && (
              <div style={styles.noVendorWarn}>Ningún vendedor coincide con el filtro de isla/sede/marca seleccionado.</div>
            )}
            {vendedoresFiltrados.map((v) => (
              <VendedorRow
                key={v.id}
                vendedor={v}
                citasCount={cargaPorVendedor[v.id] || 0}
                onRemove={() => handleRemoveVendedor(v.id)}
                onUpdateUbicacion={(isla, sede) => updateVendedor(v.id, { isla, sede })}
                onUpdateMarcas={(marcas) => updateVendedor(v.id, { marcas })}
              />
            ))}
          </div>
        </div>
      )}

      {gestores.length >= 0 && vista === "gestores" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Gestores lead</div>
          <div style={styles.panelHint}>
            Quienes generan o captan la cita, antes de que la atienda un vendedor. Se usan para analizar KPIs de citas, ventas y visitas por gestor.
          </div>
          <div style={styles.addRow}>
            <input
              value={nuevoGestorNombre}
              onChange={(e) => setNuevoGestorNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGestor()}
              placeholder="Nombre del gestor lead"
              style={styles.input}
            />
            <button onClick={handleAddGestor} style={styles.primaryBtn}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          <div style={styles.vendorList}>
            {gestores.length === 0 ? (
              <div style={styles.panelHint}>Aún no hay gestores lead añadidos.</div>
            ) : (
              gestores.map((g) => (
                <div key={g.id} style={{ ...styles.vendorCard, borderLeftColor: "#A8835A" }}>
                  <div style={{ ...styles.vendorDot, background: "#A8835A" }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={styles.vendorName}>{g.nombre}</div>
                    <div style={styles.vendorMeta}>{citasPorGestor[g.id] || 0} citas esta semana</div>
                  </div>
                  <button onClick={() => handleRemoveGestor(g.id)} style={styles.iconBtn} aria-label={`Eliminar ${g.nombre}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {vista === "sincita" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Clientes sin cita</div>
          <div style={styles.panelHint}>
            Presupuestos enviados o derivaciones directas a un vendedor (p.ej. empresas), sin pasar por la agenda. Cuentan igualmente en los KPIs de gestor lead y se cotejan por teléfono como una cita más.
          </div>

          {!formLeadAbierto ? (
            <button onClick={() => setFormLeadAbierto(true)} style={{ ...styles.primaryBtn, marginBottom: 18 }}>
              <Plus size={16} /> Nuevo cliente
            </button>
          ) : (
            <div style={styles.leadFormWrap}>
              <div style={styles.leadFormGrid}>
                <input
                  value={nuevoLeadCliente}
                  onChange={(e) => setNuevoLeadCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                  style={styles.input}
                />
                <div style={styles.phoneInputWrap}>
                  <Phone size={14} color="#A89B7E" />
                  <input
                    value={nuevoLeadTelefono}
                    onChange={(e) => setNuevoLeadTelefono(e.target.value)}
                    placeholder="Teléfono"
                    style={styles.phoneInput}
                    inputMode="tel"
                  />
                </div>
                <select value={nuevoLeadGestorId} onChange={(e) => setNuevoLeadGestorId(e.target.value)} style={styles.select}>
                  <option value="">Gestor lead…</option>
                  {gestores.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
                <select value={nuevoLeadVendorId} onChange={(e) => setNuevoLeadVendorId(e.target.value)} style={styles.select}>
                  <option value="">Vendedor (opcional)…</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
                  ))}
                </select>
                <select
                  value={nuevoLeadIsla}
                  onChange={(e) => {
                    const isla = e.target.value;
                    setNuevoLeadIsla(isla);
                    setNuevoLeadSede((ISLAS_SEDES[isla] || [])[0] || "");
                  }}
                  style={styles.select}
                >
                  <option value="">Isla (opcional)…</option>
                  {ISLAS.map((isla) => (
                    <option key={isla} value={isla}>{isla}</option>
                  ))}
                </select>
                {(ISLAS_SEDES[nuevoLeadIsla] || []).length > 0 && (
                  <select value={nuevoLeadSede} onChange={(e) => setNuevoLeadSede(e.target.value)} style={styles.select}>
                    {ISLAS_SEDES[nuevoLeadIsla].map((sede) => (
                      <option key={sede} value={sede}>{sede}</option>
                    ))}
                  </select>
                )}
                <select value={nuevoLeadMarca} onChange={(e) => setNuevoLeadMarca(e.target.value)} style={styles.select}>
                  <option value="">Marca (opcional)…</option>
                  {MARCAS.map((marca) => (
                    <option key={marca} value={marca}>{marca}</option>
                  ))}
                </select>
                <input
                  type="month"
                  value={nuevoLeadMesAnio}
                  onChange={(e) => setNuevoLeadMesAnio(e.target.value)}
                  style={styles.select}
                  title="Mes al que corresponde este lead"
                />
              </div>
              <div style={styles.leadFormAcciones}>
                <button onClick={() => setFormLeadAbierto(false)} style={styles.secondaryBtnSmall}>
                  Cerrar
                </button>
                <button onClick={handleAddLeadSinCita} style={styles.primaryBtn}>
                  <Plus size={16} /> Añadir
                </button>
              </div>
            </div>
          )}

          {leadsSinCita.length > 0 && (
            <div style={styles.leadFiltrosBar}>
              <input
                value={leadBusqueda}
                onChange={(e) => setLeadBusqueda(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                style={{ ...styles.input, maxWidth: 220 }}
              />
              <select value={leadFiltroEstado} onChange={(e) => setLeadFiltroEstado(e.target.value)} style={styles.selectSmall}>
                <option value="todos">Todos los estados</option>
                <option value="vendido">Vendido</option>
                <option value="novendido">No vendido</option>
                <option value="sinregistro">Sin venta registrada</option>
              </select>
              <select value={leadFiltroGestorId} onChange={(e) => setLeadFiltroGestorId(e.target.value)} style={styles.selectSmall}>
                <option value="">Todos los gestores</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
              <select value={leadFiltroIsla} onChange={(e) => setLeadFiltroIsla(e.target.value)} style={styles.selectSmall}>
                <option value="">Todas las islas</option>
                {ISLAS.map((isla) => (
                  <option key={isla} value={isla}>{isla}</option>
                ))}
              </select>
              <select value={leadFiltroMesAnio} onChange={(e) => setLeadFiltroMesAnio(e.target.value)} style={styles.selectSmall}>
                <option value="">Todos los meses</option>
                {mesesDisponiblesLeads.map((m) => (
                  <option key={m} value={m}>{mesAnioLabel(m)}</option>
                ))}
              </select>
              {hayFiltrosLeadsActivos && (
                <button onClick={limpiarFiltrosLeads} style={styles.filterClear}>
                  <X size={11} /> Limpiar
                </button>
              )}
            </div>
          )}

          {leadsSinCita.some((l) => l.origen === "excel") && (
            <div style={styles.leadLimpiezaBar}>
              <span style={styles.informeFiltroLabel}>Borrar importados de Excel:</span>
              {archivosImportadosLeads.map((archivo) => (
                <button
                  key={archivo}
                  onClick={() => handleEliminarLeadsImportados(archivo)}
                  style={styles.secondaryBtnSmall}
                  title={`Eliminar los clientes sin cita importados desde "${archivo}"`}
                >
                  <Trash2 size={12} /> {archivo}
                </button>
              ))}
              <button
                onClick={() => handleEliminarLeadsImportados(null)}
                style={styles.dangerBtnSmall}
              >
                <Trash2 size={12} /> Todos los importados
              </button>
            </div>
          )}

          {leadsSinCita.length > 0 && (
            <div style={styles.leadAgruparBar}>
              <span style={styles.informeFiltroLabel}>Agrupar por</span>
              <div style={styles.informeOrdenToggle}>
                <button
                  onClick={() => setLeadAgruparPor("mes")}
                  style={leadAgruparPor === "mes" ? styles.informeOrdenBtnActive : styles.informeOrdenBtn}
                >
                  Mes
                </button>
                <button
                  onClick={() => setLeadAgruparPor("gestor")}
                  style={leadAgruparPor === "gestor" ? styles.informeOrdenBtnActive : styles.informeOrdenBtn}
                >
                  Gestor
                </button>
              </div>
            </div>
          )}

          <div>
            {leadsSinCita.length === 0 ? (
              <div style={styles.panelHint}>Aún no hay clientes sin cita añadidos.</div>
            ) : leadsSinCitaFiltrados.length === 0 ? (
              <div style={styles.panelHint}>Ningún cliente coincide con los filtros seleccionados.</div>
            ) : (
              <>
                <div style={styles.panelHint}>{leadsSinCitaFiltrados.length} de {leadsSinCita.length} clientes</div>
                {leadsAgrupados.map((grupo, i) => {
                  const defaultAbierto = i === 0;
                  const abierto = gruposLeadToggled.has(grupo.clave) ? !defaultAbierto : defaultAbierto;
                  return (
                    <div key={grupo.clave} style={styles.leadGrupoWrap}>
                      <button onClick={() => toggleGrupoLead(grupo.clave)} style={styles.leadGrupoHeader}>
                        <ChevronDown size={14} style={{ transform: abierto ? "none" : "rotate(-90deg)", flexShrink: 0, color: "#A89B7E" }} />
                        <span style={styles.leadGrupoTitulo}>{grupo.etiqueta}</span>
                        <span style={styles.leadGrupoCount}>{grupo.leads.length}</span>
                      </button>
                      {abierto && (
                        <div style={styles.vendorList}>
                          {grupo.leads.map((l) => {
                            const v = vendedores.find((vv) => vv.id === l.vendorId);
                            const g = gestores.find((gg) => gg.id === l.gestorId);
                            const matches = ventasParaTelefono(l.telefono);
                            const columnaEstadoExiste = todosLosRegistros.some((r) => r.vendido !== null && r.vendido !== undefined);
                            const vendido = resolverVendidoManualOAuto(l.estadoManual, matches, columnaEstadoExiste);
                            const esManual = l.estadoManual === true || l.estadoManual === false;
                            return (
                              <div key={l.id} style={{ ...styles.cotejoRow, borderLeftColor: vendido === true ? "#4F9B72" : vendido === false ? "#C45A2E" : "#E5E0D4" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={styles.cotejoName}>
                                    {l.cliente || "Cliente sin nombre"} <span style={styles.cotejoPhone}>{l.telefono}</span>
                                  </div>
                                  <div style={styles.cotejoMeta}>
                                    {g?.nombre ? `Gestor: ${g.nombre}` : "Sin gestor"}
                                    {v?.nombre ? ` · ${v.nombre}` : " · Sin vendedor"}
                                    {l.isla ? ` · ${l.isla}` : ""}
                                    {l.sede ? ` (${l.sede})` : ""}
                                    {l.marca ? ` · ${l.marca}` : ""}
                                    {leadAgruparPor === "gestor" && l.mesAnio ? ` · ${mesAnioLabel(l.mesAnio)}` : ""}
                                  </div>
                                </div>
                                {vendido === true ? (
                                  <div style={styles.vendidaTag}>
                                    <Check size={12} /> Vendido
                                    {!esManual && (matches[0]?.modelo ? ` · ${matches[0].modelo}` : matches[0]?.coche ? ` · ${matches[0].coche}` : "")}
                                  </div>
                                ) : vendido === false ? (
                                  <div style={styles.pendienteTagRojo}>No vendido</div>
                                ) : (
                                  <div style={styles.pendienteTag}>Sin venta registrada</div>
                                )}
                                <div style={styles.leadEstadoManualBotones}>
                                  <button
                                    onClick={() => handleSetEstadoManualLead(l.id, l.estadoManual === true ? null : true)}
                                    style={l.estadoManual === true ? styles.asistioBtnActive : styles.informeOrdenBtn}
                                    title="Marcar como vendido a mano"
                                  >
                                    <Check size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleSetEstadoManualLead(l.id, l.estadoManual === false ? null : false)}
                                    style={l.estadoManual === false ? styles.noAsistioBtnActive : styles.informeOrdenBtn}
                                    title="Marcar como no vendido a mano"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                                <button onClick={() => handleRemoveLeadSinCita(l.id)} style={styles.iconBtn} aria-label={`Eliminar ${l.cliente}`}>
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {vendedores.length > 0 && vista === "turnos" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Vacaciones</div>
          <div style={styles.panelHint}>
            Los días marcados aquí hacen que el vendedor no aparezca disponible en la agenda, aunque su horario habitual diga que trabaja.
          </div>

          <div style={styles.leadFormGrid}>
            <select value={nuevaVacacionVendorId} onChange={(e) => setNuevaVacacionVendorId(e.target.value)} style={styles.select}>
              <option value="">Vendedor…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
            <span style={styles.informeFiltroLabel}>Desde</span>
            <input type="date" value={nuevaVacacionDesde} onChange={(e) => setNuevaVacacionDesde(e.target.value)} style={styles.select} />
            <span style={styles.informeFiltroLabel}>Hasta</span>
            <input type="date" value={nuevaVacacionHasta} onChange={(e) => setNuevaVacacionHasta(e.target.value)} style={styles.select} />
            <button onClick={handleAddVacacion} style={styles.primaryBtn}>
              <Plus size={16} /> Añadir
            </button>
          </div>

          <input
            ref={fileInputVacacionesRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleImportarVacacionesExcel(e.target.files?.[0])}
          />
          <button onClick={() => fileInputVacacionesRef.current?.click()} disabled={subiendoVacaciones} style={styles.secondaryBtnSmall}>
            <Upload size={12} /> {subiendoVacaciones ? "Leyendo archivo…" : "Importar desde Excel (columnas: Vendedor, Desde, Hasta)"}
          </button>

          {errorVacaciones && <div style={{ ...styles.noVendorWarn, marginTop: 10 }}>{errorVacaciones}</div>}

          <div style={{ ...styles.vendorList, marginTop: 16 }}>
            {vacaciones.length === 0 ? (
              <div style={styles.panelHint}>Aún no hay vacaciones registradas.</div>
            ) : vacacionesFiltradas.length === 0 ? (
              <div style={styles.panelHint}>Ninguna vacación coincide con el filtro de isla/sede/marca seleccionado.</div>
            ) : (
              vacacionesFiltradas.map((vac) => {
                  const v = vendedores.find((vv) => vv.id === vac.vendorId);
                  const hoyStr = new Date().toISOString().slice(0, 10);
                  const enCurso = vac.desde <= hoyStr && hoyStr <= vac.hasta;
                  const pasada = vac.hasta < hoyStr;
                  return (
                    <div key={vac.id} style={{ ...styles.cotejoRow, borderLeftColor: enCurso ? "#4F9B72" : "#E5E0D4", opacity: pasada ? 0.55 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={styles.cotejoName}>{v?.nombre || "Vendedor eliminado"}</div>
                        <div style={styles.cotejoMeta}>
                          {fmtDateShort(new Date(vac.desde))} — {fmtDateShort(new Date(vac.hasta))}
                          {enCurso ? " · En curso" : pasada ? " · Finalizada" : " · Próxima"}
                        </div>
                      </div>
                      <button onClick={() => handleRemoveVacacion(vac.id)} style={styles.iconBtn} aria-label="Eliminar vacaciones">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {vendedores.length > 0 && vista === "turnos" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Turnos rotativos de la semana</div>
          <div style={styles.panelHint}>
            Escribe el horario de cada vendedor como texto, por ejemplo <strong>9:00-13:30, 16:30-20:00</strong>. El de lunes a viernes se aplica a los 5 días de golpe; el sábado es independiente. Deja el campo vacío para marcar que no trabaja ese día. Se muestran los vendedores según el filtro de Isla/Sede/Marca activo en la cabecera de arriba.
          </div>
          {vendedoresFiltrados.length === 0 && (
            <div style={styles.noVendorWarn}>Ningún vendedor coincide con el filtro de isla/sede/marca seleccionado.</div>
          )}
          {vendedoresFiltrados.map((v) => (
            <VendedorTurnoTexto
              key={v.id}
              vendedor={v}
              turnos={turnos[v.id] || {}}
              onAplicar={aplicarHorarioTexto}
              showToast={showToast}
            />
          ))}
        </div>
      )}

      {vendedores.length >= 0 && vista === "ventas" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Listado histórico (KPIs del año)</div>
          <div style={styles.panelHint}>
            Súbelo una sola vez con todas las citas del año en curso. Alimenta el informe anual de KPIs. No hace falta volver a subirlo salvo que quieras añadir más datos.
          </div>

          <input
            ref={fileInputHistoricoRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleFileUploadHistorico(e.target.files?.[0])}
          />

          {!ventasHistorico ? (
            <button onClick={() => fileInputHistoricoRef.current?.click()} disabled={subiendoHistorico} style={styles.uploadBox}>
              <Upload size={22} color="#A8835A" />
              <div style={styles.uploadTitle}>{subiendoHistorico ? "Leyendo archivo…" : "Subir listado histórico"}</div>
              <div style={styles.uploadHint}>Excel (.xlsx) o CSV</div>
            </button>
          ) : (
            <div style={styles.fileCard}>
              <FileSpreadsheet size={20} color="#4F9B72" />
              <div style={{ flex: 1 }}>
                <div style={styles.fileName}>{ventasHistorico.fileName}</div>
                <div style={styles.fileMeta}>
                  {ventasHistorico.records.length} citas con teléfono válido · subido el{" "}
                  {new Date(ventasHistorico.uploadedAt).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button onClick={() => fileInputHistoricoRef.current?.click()} style={styles.secondaryBtn}>Reemplazar</button>
              <button onClick={removeVentasHistorico} style={styles.iconBtn} aria-label="Eliminar listado histórico">
                <Trash2 size={15} />
              </button>
            </div>
          )}
          {errorHistorico && <div style={styles.noVendorWarn}>{errorHistorico}</div>}

          <div style={{ ...styles.panelTitle, marginTop: 30 }}>Listado de cotejo (ventas recientes)</div>
          <div style={styles.panelHint}>
            Súbelo cada vez que quieras comprobar si las citas de la agenda ya se han convertido en venta. Al subir uno nuevo, reemplaza solo a este listado — el histórico no se ve afectado.
          </div>

          <input
            ref={fileInputCotejoRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleFileUploadCotejo(e.target.files?.[0])}
          />

          {!ventasCotejo ? (
            <button onClick={() => fileInputCotejoRef.current?.click()} disabled={subiendoCotejo} style={styles.uploadBox}>
              <Upload size={22} color="#A8835A" />
              <div style={styles.uploadTitle}>{subiendoCotejo ? "Leyendo archivo…" : "Subir listado de cotejo"}</div>
              <div style={styles.uploadHint}>Excel (.xlsx) o CSV</div>
            </button>
          ) : (
            <div style={styles.fileCard}>
              <FileSpreadsheet size={20} color="#4F9B72" />
              <div style={{ flex: 1 }}>
                <div style={styles.fileName}>{ventasCotejo.fileName}</div>
                <div style={styles.fileMeta}>
                  {ventasCotejo.records.length} ventas con teléfono válido · subido el{" "}
                  {new Date(ventasCotejo.uploadedAt).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button onClick={() => fileInputCotejoRef.current?.click()} style={styles.secondaryBtn}>Reemplazar</button>
              <button onClick={removeVentasCotejo} style={styles.iconBtn} aria-label="Eliminar listado de cotejo">
                <Trash2 size={15} />
              </button>
            </div>
          )}
          {errorCotejo && <div style={styles.noVendorWarn}>{errorCotejo}</div>}

          {hayVentasCargadas && (
            <>
              <div style={{ ...styles.panelTitle, marginTop: 30, fontSize: 15 }}>
                Cotejo de citas con teléfono — semana actual
              </div>
              {citasActivas.filter((c) => c.telefono).length === 0 ? (
                <div style={styles.panelHint}>Ninguna cita de esta semana tiene teléfono registrado todavía.</div>
              ) : (
                <div style={styles.cotejoList}>
                  {citasActivas
                    .filter((c) => c.telefono)
                    .map((c) => {
                      const v = vendedores.find((vv) => vv.id === c.vendorId);
                      const g = gestores.find((gg) => gg.id === c.gestorId);
                      const matches = ventasParaTelefono(c.telefono);
                      const vendida = esVendida(matches);
                      const mejor = matches[0];
                      const colorV = v ? colorParaSede(v.isla, v.sede) : null;
                      return (
                        <div key={c.id} style={{ ...styles.cotejoRow, borderLeftColor: vendida ? "#4F9B72" : "#E5E0D4" }}>
                          <div style={{ ...styles.vendorDot, background: colorV?.border || "#ccc" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.cotejoName}>
                              {c.cliente || mejor?.cliente || "Cliente sin nombre"} <span style={styles.cotejoPhone}>{c.telefono}</span>
                            </div>
                            <div style={styles.cotejoMeta}>
                              {DIAS[c.day]} {horaLabel(c.hour)} · {v?.nombre || "—"}
                              {(g?.nombre || mejor?.gestorLead) ? ` · Gestor: ${g?.nombre || mejor.gestorLead}` : ""}
                              {mejor?.isla ? ` · ${mejor.isla}` : ""}
                              {mejor?.sede ? ` (${mejor.sede})` : ""}
                            </div>
                          </div>
                          {matches.length > 0 ? (
                            vendida ? (
                              <div style={styles.vendidaTag}>
                                <Check size={12} /> Vendido
                                {mejor?.modelo ? ` · ${mejor.modelo}` : mejor?.coche ? ` · ${mejor.coche}` : ""}
                                {mejor?.date ? ` · ${fmtDateShort(mejor.date)}` : ""}
                              </div>
                            ) : (
                              <div style={styles.pendienteTag}>No vendido{mejor?.date ? ` · ${fmtDateShort(mejor.date)}` : ""}</div>
                            )
                          ) : (
                            <div style={styles.pendienteTag}>Sin venta registrada</div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {vista === "informe" && (
        <div style={styles.panel}>
          <div style={styles.informeTablaHeaderRow}>
            <div style={styles.panelTitle}>Informe anual de ventas</div>
            {resumenVentas && (
              <button onClick={handleExportarInforme} style={styles.secondaryBtn}>
                <Download size={14} /> Exportar a Excel
              </button>
            )}
          </div>
          <div style={styles.panelHint}>
            Resumen calculado a partir del listado histórico, del listado de cotejo y de los clientes sin cita.
          </div>

          {registrosUnicosCombinados.length === 0 ? (
            <div style={styles.noVendorWarn}>
              Aún no hay ningún listado cargado. Ve a la pestaña "Ventas" y sube tu Excel o CSV para ver aquí el informe.
            </div>
          ) : (
            <>
              <div style={styles.informeFiltrosPrincipales}>
                <span style={styles.informeFiltroLabel}>Filtrar por</span>
                <select value={informeFiltroMarca} onChange={(e) => setInformeFiltroMarca(e.target.value)} style={styles.selectDestacado}>
                  <option value="">Todas las marcas</option>
                  {MARCAS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={informeFiltroGestor} onChange={(e) => setInformeFiltroGestor(e.target.value)} style={styles.selectDestacado}>
                  <option value="">Todos los gestores</option>
                  {gestoresDisponiblesInforme.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select value={informeFiltroVendedor} onChange={(e) => setInformeFiltroVendedor(e.target.value)} style={styles.selectDestacado}>
                  <option value="">Todos los vendedores</option>
                  {vendedoresDisponiblesInforme.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div style={styles.leadFiltrosBar}>
                <span style={styles.informeFiltroLabel}>Periodo</span>
                <select value={informeFiltroMesAnio} onChange={(e) => setInformeFiltroMesAnio(e.target.value)} style={styles.selectSmall}>
                  <option value="">Todos los meses</option>
                  {mesesDisponiblesInforme.map((m) => (
                    <option key={m} value={m}>{mesAnioLabel(m)}{m === mesAnioActual() ? " (actual)" : ""}</option>
                  ))}
                </select>
                <span style={styles.informeFiltroLabel}>o rango: desde</span>
                <input
                  type="date"
                  value={informeFiltroDesde}
                  onChange={(e) => setInformeFiltroDesde(e.target.value)}
                  style={styles.selectSmall}
                />
                <span style={styles.informeFiltroLabel}>hasta</span>
                <input
                  type="date"
                  value={informeFiltroHasta}
                  onChange={(e) => setInformeFiltroHasta(e.target.value)}
                  style={styles.selectSmall}
                />
                {hayFiltrosInformeActivos && (
                  <button onClick={limpiarFiltrosInforme} style={styles.filterClear}>
                    <X size={11} /> Limpiar todo
                  </button>
                )}
              </div>

              {!resumenVentas ? (
                <div style={styles.noVendorWarn}>Ningún registro coincide con los filtros seleccionados.</div>
              ) : (
                <>
                  {(resumenVentas.fechaMin || resumenVentas.fechaMax) && (
                    <div style={{ ...styles.panelHint, marginBottom: 18 }}>
                      Periodo cubierto: {resumenVentas.fechaMin ? fmtDateShort(resumenVentas.fechaMin) : "?"} — {resumenVentas.fechaMax ? fmtDateShort(resumenVentas.fechaMax) : "?"}
                    </div>
                  )}

                  <div style={styles.informeResumenGrid}>
                    <div style={styles.informeStatsCol}>
                      <div style={styles.informeStatsRow}>
                        <div style={styles.informeStatCard}>
                          <div style={styles.informeStatNumber}>{resumenVentas.totalRegistros}</div>
                          <div style={styles.informeStatLabel}>Registros totales</div>
                        </div>
                        <div style={{ ...styles.informeStatCard, borderColor: "#4F9B72" }}>
                          <div style={{ ...styles.informeStatNumber, color: "#2F5E3F" }}>{resumenVentas.totalVendidos}</div>
                          <div style={styles.informeStatLabel}>Vendidos</div>
                        </div>
                        {resumenVentas.totalNoVendidos > 0 && (
                          <div style={styles.informeStatCard}>
                            <div style={styles.informeStatNumber}>{resumenVentas.totalNoVendidos}</div>
                            <div style={styles.informeStatLabel}>No vendidos</div>
                          </div>
                        )}
                        <div style={styles.informeStatCard}>
                          <div style={styles.informeStatNumber}>{resumenVentas.tasaConversion}%</div>
                          <div style={styles.informeStatLabel}>Tasa de conversión</div>
                        </div>
                      </div>
                    </div>

                    {resumenVentas.datosDonut.length > 0 && (
                      <div style={styles.informeDonutWrap}>
                        <div style={styles.informeTablaTitulo}>Distribución de estados</div>
                        <PieChart width={200} height={170}>
                          <Pie
                            data={resumenVentas.datosDonut}
                            dataKey="valor"
                            nameKey="nombre"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={2}
                          >
                            {resumenVentas.datosDonut.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EBE4D3" }}
                            formatter={(value, name) => [value, name]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={9}
                            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                          />
                        </PieChart>
                      </div>
                    )}
                  </div>

                  {(resumenVentas.sinGestor > 0 || resumenVentas.sinVendedor > 0) && (
                    <div style={styles.informeAvisoDatos}>
                      <AlertCircle size={13} />
                      {resumenVentas.sinGestor > 0 && <span>{resumenVentas.sinGestor} sin gestor lead asignado</span>}
                      {resumenVentas.sinGestor > 0 && resumenVentas.sinVendedor > 0 && <span> · </span>}
                      {resumenVentas.sinVendedor > 0 && <span>{resumenVentas.sinVendedor} sin vendedor asignado</span>}
                    </div>
                  )}

                  {resumenAsistencia && (
                    <div style={styles.informeChartWrap}>
                      <div style={styles.informeTablaTitulo}>Asistencia a citas</div>
                      <div style={styles.panelHint}>
                        Solo cuenta las citas marcadas manualmente como "Asistió" o "No asistió" desde el modal de cada cita en la agenda.
                      </div>
                      <div style={styles.informeStatsRow}>
                        <div style={styles.informeStatCard}>
                          <div style={styles.informeStatNumber}>{resumenAsistencia.total}</div>
                          <div style={styles.informeStatLabel}>Citas marcadas</div>
                        </div>
                        <div style={{ ...styles.informeStatCard, borderColor: "#4F9B72" }}>
                          <div style={{ ...styles.informeStatNumber, color: "#2F5E3F" }}>{resumenAsistencia.asistieron}</div>
                          <div style={styles.informeStatLabel}>Asistieron</div>
                        </div>
                        <div style={{ ...styles.informeStatCard, borderColor: resumenAsistencia.noAsistieron > 0 ? "#C45A2E" : undefined }}>
                          <div style={{ ...styles.informeStatNumber, color: resumenAsistencia.noAsistieron > 0 ? "#A14B2C" : undefined }}>{resumenAsistencia.noAsistieron}</div>
                          <div style={styles.informeStatLabel}>No asistieron</div>
                        </div>
                        <div style={styles.informeStatCard}>
                          <div style={styles.informeStatNumber}>{resumenAsistencia.tasa}%</div>
                          <div style={styles.informeStatLabel}>Tasa de asistencia</div>
                        </div>
                      </div>
                      {resumenAsistencia.porVendedor.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div style={styles.informeTablaRows}>
                            {resumenAsistencia.porVendedor.map((f) => {
                              const tasaV = f.total > 0 ? Math.round((f.asistio / f.total) * 100) : 0;
                              return (
                                <div key={f.nombre} style={styles.informeTablaRow}>
                                  <span style={styles.informeTablaNombre}>{f.nombre}</span>
                                  <span style={styles.legendBarWrap}>
                                    <span
                                      style={{
                                        ...styles.legendBar,
                                        width: `${Math.max(6, tasaV)}%`,
                                        background: tasaV < 70 ? "#C45A2E" : "#4F9B72",
                                      }}
                                    />
                                  </span>
                                  <span style={styles.informeTablaCifras}>{f.asistio}/{f.total}</span>
                                  <span style={styles.informeTablaTasa}>{tasaV}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {leadsDuplicados.length > 0 && (
                    <div style={styles.informeDuplicadosWrap}>
                      <div style={styles.informeTablaTitulo}>
                        <AlertCircle size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                        Posibles duplicados en "Sin cita" ({leadsDuplicados.length})
                      </div>
                      <div style={styles.panelHint}>
                        Mismo teléfono dado de alta más de una vez. Revisa si es la misma persona antes de fusionar — al fusionar se conserva el registro más antiguo y se completan los datos que le falten con los de los demás.
                      </div>
                      {leadsDuplicados.map((grupo) => (
                        <div key={grupo[0].id} style={styles.informeDuplicadoGrupo}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.cotejoPhone}>{grupo[0].telefono}</div>
                            {grupo.map((l) => (
                              <div key={l.id} style={styles.informeDuplicadoItem}>
                                {l.cliente || "Sin nombre"}
                                {l.mesAnio ? ` · ${mesAnioLabel(l.mesAnio)}` : ""}
                              </div>
                            ))}
                          </div>
                          <button onClick={() => fusionarLeadsDuplicados(grupo)} style={styles.secondaryBtnSmall}>
                            Fusionar en uno
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {resumenVentas.porMes.length > 1 && (
                    <div style={styles.informeChartWrap}>
                      <div style={styles.informeTablaHeaderRow}>
                        <div style={styles.informeTablaTitulo}>Ventas por mes</div>
                        {resumenVentas.islasPresentes.length > 1 && (
                          <div style={styles.informeOrdenToggle}>
                            <button
                              onClick={() => setVistaGraficoMensual("total")}
                              style={vistaGraficoMensual === "total" ? styles.informeOrdenBtnActive : styles.informeOrdenBtn}
                            >
                              Total
                            </button>
                            <button
                              onClick={() => setVistaGraficoMensual("isla")}
                              style={vistaGraficoMensual === "isla" ? styles.informeOrdenBtnActive : styles.informeOrdenBtn}
                            >
                              Por isla
                            </button>
                          </div>
                        )}
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        {vistaGraficoMensual === "isla" && resumenVentas.islasPresentes.length > 1 ? (
                          <BarChart data={resumenVentas.porMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DA" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A7B5C" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#8A7B5C" }} allowDecimals={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EBE4D3" }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {resumenVentas.islasPresentes.map((isla) => (
                              <Bar key={isla} dataKey={isla} name={isla} stackId="islas" fill={(PALETA_ISLAS[isla] || PALETA_ISLAS["Tenerife"]).hue} radius={[2, 2, 0, 0]} />
                            ))}
                          </BarChart>
                        ) : (
                          <BarChart data={resumenVentas.porMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DA" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A7B5C" }} />
                            <YAxis tick={{ fontSize: 11, fill: "#8A7B5C" }} allowDecimals={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EBE4D3" }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="total" name="Registros" fill="#D8CFB8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="vendidos" name="Vendidos" fill="#4F9B72" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}

                  {resumenVentas.porMes.length > 1 && (
                    <div style={styles.informeChartWrap}>
                      <div style={styles.informeTablaTitulo}>Evolución de conversión mensual</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={resumenVentas.porMes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DA" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A7B5C" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#8A7B5C" }} unit="%" domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EBE4D3" }}
                            formatter={(v) => [`${v}%`, "Conversión"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="tasaConversion"
                            name="Conversión"
                            stroke="#C45A2E"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#C45A2E" }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <InformeTabla titulo="Por vendedor" filas={resumenVentas.porVendedor} usarGrafico />
                  <InformeTabla titulo="Por gestor lead" filas={resumenVentas.porGestorLead} usarGrafico />
                  <InformeTabla titulo="Por isla" filas={resumenVentas.porIsla} />
                  <InformeTabla titulo="Por modelo" filas={resumenVentas.porModelo} />
                  <InformeTabla titulo="Por marca" filas={resumenVentas.porMarca} />
                </>
              )}
            </>
          )}
        </div>
      )}

      {vendedores.length > 0 && vista === "agenda" && (
        <div style={styles.panel}>
          <div style={styles.agendaGrid}>
            <div style={styles.agendaCorner}>Hora</div>
            {weekDates.map((d, i) => (
              <div key={i} style={styles.agendaDayHeader}>
                <div style={styles.agendaDayName}>{DIAS_CORTO[i]}</div>
                <div style={styles.agendaDayDate}>{fmtDateLabel(d)}</div>
              </div>
            ))}

            {slots.map((h) => (
              <FragmentRow key={h}>
                <div style={styles.agendaHourLabel}>{horaLabel(h)}</div>
                {DIAS.map((_, dayIdx) => {
                  const disponibles = vendoresDisponibles(dayIdx, h);
                  const citasSlot = citasActivas.filter((c) => c.day === dayIdx && c.hour === h);
                  return (
                    <div key={dayIdx} style={styles.agendaCell}>
                      {citasSlot.map((c) => {
                        const v = vendedores.find((vv) => vv.id === c.vendorId);
                        if (!v) return null;
                        const g = gestores.find((gg) => gg.id === c.gestorId);
                        const colorV = colorParaSede(v.isla, v.sede);
                        const vendida = citasConVenta.has(c.id);
                        const noAsistio = c.asistio === false;
                        const fueraDeFiltro = !vendedoresFiltrados.some((vf) => vf.id === v.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => setModalCita({ existing: c })}
                            style={{
                              ...styles.citaChip,
                              background: colorV.bg,
                              borderColor: colorV.border,
                              color: colorV.text,
                              opacity: fueraDeFiltro ? 0.4 : noAsistio ? 0.6 : 1,
                            }}
                            title={`${v.nombre}${c.cliente ? " · " + c.cliente : ""}${c.telefono ? " · " + c.telefono : ""}${g ? " · Gestor: " + g.nombre : ""}${c.marca ? " · " + c.marca : ""}${noAsistio ? " · No asistió" : c.asistio === true ? " · Asistió" : ""}`}
                          >
                            <span style={{ ...styles.citaDot, background: colorV.border }} />
                            {c.marca && <span style={{ ...styles.citaDot, background: colorParaMarca(c.marca).border }} />}
                            <span style={styles.citaChipTextWrap}>
                              <span style={styles.citaChipText}>{v.nombre.split(" ")[0]}{c.cliente ? ` · ${c.cliente}` : ""}</span>
                              {g && <span style={styles.citaChipGestor}>Gestor: {g.nombre}</span>}
                              {noAsistio && <span style={styles.citaChipNoAsistio}>No asistió</span>}
                            </span>
                            {vendida && <Check size={11} color="#4F9B72" style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                      {disponibles.length > 0 && (
                        <button
                          onClick={() => setModalCita({ day: dayIdx, hour: h })}
                          style={styles.addCitaBtn}
                          aria-label={`Añadir cita ${DIAS[dayIdx]} ${horaLabel(h)}`}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                      {disponibles.length === 0 && citasSlot.length === 0 && <div style={styles.noOneCell} />}
                    </div>
                  );
                })}
              </FragmentRow>
            ))}
          </div>

          <div style={styles.legendTitulo}>Carga de citas este mes (por vendedor)</div>
          <div style={styles.legend}>
            {vendedoresFiltrados.length === 0 ? (
              <div style={styles.panelHint}>Ningún vendedor coincide con el filtro de isla/sede seleccionado.</div>
            ) : (
              vendedoresFiltrados.map((v) => {
                const c = colorParaSede(v.isla, v.sede);
                const deVacaciones = vendedoresDeVacacionesEstaSemana.has(v.id);
                return (
                  <div key={v.id} style={{ ...styles.legendItem, opacity: deVacaciones ? 0.55 : 1 }}>
                    <span style={{ ...styles.vendorDot, background: c.border }} />
                    <span style={styles.legendName}>{v.nombre}</span>
                    <span style={styles.legendLocation}>{v.sede}</span>
                    {deVacaciones && <span style={styles.legendVacacionesTag}>De vacaciones</span>}
                    <span style={styles.legendBarWrap}>
                      <span
                        style={{
                          ...styles.legendBar,
                          width: `${Math.max(6, ((cargaPorVendedor[v.id] || 0) / maxCarga) * 100)}%`,
                          background: c.border,
                        }}
                      />
                    </span>
                    <span style={styles.legendCount}>{cargaPorVendedor[v.id] || 0}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {modalCita && (
        <CitaModal
          modalCita={modalCita}
          vendedores={vendedores}
          gestores={gestores}
          vendoresDisponibles={vendoresDisponibles}
          sugerirVendedor={sugerirVendedor}
          citasDeVendorEnMes={citasDeVendorEnMes}
          weekDates={weekDates}
          dias={DIAS}
          ventasParaTelefono={ventasParaTelefono}
          esVendida={esVendida}
          onClose={() => setModalCita(null)}
          onSave={handleSaveCita}
          onCancel={handleCancelCita}
          onDelete={handleDeleteCita}
          onSetAsistencia={handleSetAsistencia}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

// ---------- Botón con desplegable de opciones marcables (multi-selección) ----------
// Sustituye a las hileras de chips: un botón muestra el nombre del filtro (y cuántas opciones
// hay activas), y al pulsarlo despliega un panel con checkboxes para cada opción. Se cierra
// solo al hacer clic fuera.
function FiltroDesplegable({ etiqueta, icono: Icono, opciones, seleccionados, onToggle, colorDe }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarSiFuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarSiFuera);
    return () => document.removeEventListener("mousedown", cerrarSiFuera);
  }, [abierto]);

  if (opciones.length === 0) return null;
  const hayActivos = seleccionados.length > 0;

  return (
    <div style={styles.filtroDesplegableWrap} ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={hayActivos ? styles.filtroDesplegableBtnActivo : styles.filtroDesplegableBtn}
      >
        {Icono && <Icono size={13} />}
        {etiqueta}
        {hayActivos && <span style={styles.filtroDesplegableBadge}>{seleccionados.length}</span>}
        <ChevronDown size={13} style={{ opacity: 0.6, transform: abierto ? "rotate(180deg)" : "none" }} />
      </button>
      {abierto && (
        <div style={styles.filtroDesplegableMenu}>
          {opciones.map((op) => {
            const activo = seleccionados.includes(op);
            const color = colorDe ? colorDe(op) : "#5C5240";
            return (
              <label key={op} style={styles.filtroDesplegableOpcion}>
                <input type="checkbox" checked={activo} onChange={() => onToggle(op)} style={styles.filtroDesplegableCheckbox} />
                <span style={{ ...styles.filterDot, background: color }} />
                <span>{op}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Tabla de desglose para el informe anual ----------
// Permite alternar el orden entre volumen (vendidos) y tasa de conversión (%), y expandir
// cada fila para ver el detalle de los registros concretos que la componen.
function InformeTabla({ titulo, filas, usarGrafico }) {
  const [orden, setOrden] = useState("volumen");
  const [expandida, setExpandida] = useState(null);

  if (!filas || filas.length === 0) return null;

  const filasOrdenadas = useMemo(() => {
    const copia = [...filas];
    if (orden === "conversion") {
      copia.sort((a, b) => {
        const tasaA = a.total > 0 ? a.vendidos / a.total : 0;
        const tasaB = b.total > 0 ? b.vendidos / b.total : 0;
        return tasaB - tasaA || b.total - a.total;
      });
    } else {
      copia.sort((a, b) => b.vendidos - a.vendidos || b.total - a.total);
    }
    return copia;
  }, [filas, orden]);

  const maxVendidos = Math.max(1, ...filas.map((f) => f.vendidos));

  // Datos para el gráfico de barras horizontal, con la tasa de conversión ya calculada
  // (recharts necesita los valores numéricos listos, no calculados al vuelo en el render).
  const datosGrafico = useMemo(
    () =>
      filasOrdenadas.map((f) => ({
        ...f,
        tasa: f.total > 0 ? Math.round((f.vendidos / f.total) * 100) : 0,
      })),
    [filasOrdenadas]
  );

  return (
    <div style={styles.informeTablaWrap}>
      <div style={styles.informeTablaHeaderRow}>
        <div style={styles.informeTablaTitulo}>{titulo}</div>
        <div style={styles.informeOrdenToggle}>
          <button
            onClick={() => setOrden("volumen")}
            style={orden === "volumen" ? styles.informeOrdenBtnActive : styles.informeOrdenBtn}
          >
            Volumen
          </button>
          <button
            onClick={() => setOrden("conversion")}
            style={orden === "conversion" ? styles.informeOrdenBtnActive : styles.informeOrdenBtn}
          >
            Conversión
          </button>
        </div>
      </div>

      {usarGrafico && (
        <div style={styles.informeBarrasHorizWrap}>
          <ResponsiveContainer width="100%" height={Math.max(120, datosGrafico.length * 32)}>
            <BarChart
              data={datosGrafico}
              layout="vertical"
              margin={{ top: 4, right: 30, left: 10, bottom: 4 }}
              barCategoryGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DA" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8A7B5C" }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="nombre"
                width={120}
                tick={{ fontSize: 11, fill: "#5C5240" }}
                interval={0}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EBE4D3" }}
                formatter={(value, name, props) =>
                  orden === "conversion" ? [`${value}%`, "Conversión"] : [`${value} / ${props.payload.total}`, "Vendidos"]
                }
              />
              <Bar
                dataKey={orden === "conversion" ? "tasa" : "vendidos"}
                radius={[0, 4, 4, 0]}
                onClick={(data) => setExpandida(expandida === data.nombre ? null : data.nombre)}
                cursor="pointer"
              >
                {datosGrafico.map((f, i) => (
                  <Cell key={i} fill={expandida === f.nombre ? "#C45A2E" : "#4F9B72"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.informeTablaRows}>
        {filasOrdenadas.map((f) => {
          const tasa = f.total > 0 ? Math.round((f.vendidos / f.total) * 100) : 0;
          const isExpanded = expandida === f.nombre;
          return (
            <div key={f.nombre}>
              {!usarGrafico && (
                <button
                  onClick={() => setExpandida(isExpanded ? null : f.nombre)}
                  style={styles.informeTablaRowBtn}
                >
                  <span style={styles.informeTablaNombre}>{f.nombre}</span>
                  <span style={styles.legendBarWrap}>
                    <span
                      style={{
                        ...styles.legendBar,
                        width: `${Math.max(6, (orden === "conversion" ? tasa : (f.vendidos / maxVendidos) * 100))}%`,
                        background: "#4F9B72",
                      }}
                    />
                  </span>
                  <span style={styles.informeTablaCifras}>{f.vendidos}/{f.total}</span>
                  <span style={styles.informeTablaTasa}>{tasa}%</span>
                  <ChevronDown size={13} style={{ transform: isExpanded ? "rotate(180deg)" : "none", flexShrink: 0, color: "#A89B7E" }} />
                </button>
              )}
              {usarGrafico && isExpanded && (
                <div style={styles.informeTablaExpandidaLabel}>
                  <span style={styles.informeTablaNombre}>{f.nombre}</span>
                  <span style={styles.informeTablaCifras}>{f.vendidos}/{f.total}</span>
                  <span style={styles.informeTablaTasa}>{tasa}%</span>
                </div>
              )}
              {isExpanded && (
                <div style={styles.informeDetalleWrap}>
                  {(f.registros || []).map((r, i) => (
                    <div key={i} style={styles.informeDetalleRow}>
                      <span style={styles.informeDetalleNombre}>{r.cliente || "Sin nombre"}</span>
                      <span style={styles.informeDetallePhone}>{r.phone || "—"}</span>
                      <span style={styles.informeDetalleMes}>{r.mesAnio ? mesAnioLabel(r.mesAnio) : "—"}</span>
                      {r.vendido === true ? (
                        <span style={styles.vendidaTag}><Check size={11} /> Vendido</span>
                      ) : r.vendido === false ? (
                        <span style={styles.pendienteTag}>No vendido</span>
                      ) : (
                        <span style={styles.pendienteTag}>Sin decidir</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Turno por vendedor, editado como texto (L-V y Sábado por separado) ----------
function VendedorTurnoTexto({ vendedor, turnos, onAplicar, showToast }) {
  const c = colorParaSede(vendedor.isla, vendedor.sede);

  // Días de lunes a viernes son los índices 0-4; sábado es el índice 5.
  const diasLV = [0, 1, 2, 3, 4];
  const diaSabado = 5;

  // Si los 5 días de lunes a viernes ya tienen exactamente el mismo horario guardado, lo
  // mostramos como punto de partida. Si hay alguna diferencia entre ellos (por ejemplo datos
  // antiguos con horarios distintos por día), dejamos el campo vacío en vez de mostrar uno
  // cualquiera, para no dar una falsa sensación de que todos coinciden.
  const horariosLV = diasLV.map((d) => JSON.stringify((turnos[d] || []).slice().sort((a, b) => a - b)));
  const todosIguales = horariosLV.every((h) => h === horariosLV[0]);
  const textoInicialLV = todosIguales ? horasATexto(turnos[diasLV[0]] || []) : "";
  const textoInicialSabado = horasATexto(turnos[diaSabado] || []);

  const [textoLV, setTextoLV] = useState(textoInicialLV);
  const [textoSabado, setTextoSabado] = useState(textoInicialSabado);
  const [errorLV, setErrorLV] = useState(null);
  const [errorSabado, setErrorSabado] = useState(null);

  // Si los turnos cambian desde fuera (otro dispositivo editando a la vez), refrescamos el
  // valor mostrado, pero solo si el usuario no está con cambios sin guardar en ese campo.
  const [tocadoLV, setTocadoLV] = useState(false);
  const [tocadoSabado, setTocadoSabado] = useState(false);
  useEffect(() => {
    if (!tocadoLV) setTextoLV(textoInicialLV);
  }, [textoInicialLV, tocadoLV]);
  useEffect(() => {
    if (!tocadoSabado) setTextoSabado(textoInicialSabado);
  }, [textoInicialSabado, tocadoSabado]);

  const guardarLV = useCallback(async () => {
    try {
      await onAplicar(vendedor.id, diasLV, textoLV);
      setErrorLV(null);
      setTocadoLV(false);
      showToast(`Horario de lunes a viernes guardado para ${vendedor.nombre}`);
    } catch (e) {
      setErrorLV(e.message);
    }
  }, [onAplicar, vendedor.id, vendedor.nombre, textoLV, showToast]);

  const guardarSabado = useCallback(async () => {
    try {
      await onAplicar(vendedor.id, [diaSabado], textoSabado);
      setErrorSabado(null);
      setTocadoSabado(false);
      showToast(`Horario del sábado guardado para ${vendedor.nombre}`);
    } catch (e) {
      setErrorSabado(e.message);
    }
  }, [onAplicar, vendedor.id, vendedor.nombre, textoSabado, showToast]);

  return (
    <div style={styles.turnoTextoBlock}>
      <div style={styles.turnoVendorHeader}>
        <div style={{ ...styles.vendorDot, background: c.border }} />
        <span style={styles.turnoVendorName}>{vendedor.nombre}</span>
        <span style={styles.turnoVendorLoc}>{vendedor.sede}, {vendedor.isla}</span>
      </div>
      <div style={styles.turnoTextoRow}>
        <label style={styles.turnoTextoLabel}>Lunes a viernes</label>
        <input
          value={textoLV}
          onChange={(e) => {
            setTextoLV(e.target.value);
            setTocadoLV(true);
            setErrorLV(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && guardarLV()}
          placeholder="ej. 9:00-13:30, 16:30-20:00"
          style={{ ...styles.input, ...(errorLV ? styles.inputError : {}) }}
        />
        <button onClick={guardarLV} style={styles.secondaryBtnSmall}>
          <Check size={12} /> Aplicar
        </button>
      </div>
      {errorLV && <div style={styles.turnoTextoError}>{errorLV}</div>}
      {!todosIguales && !tocadoLV && (
        <div style={styles.turnoTextoAviso}>Los días de esta semana tienen horarios distintos entre sí. Escribe uno para igualarlos todos.</div>
      )}

      <div style={styles.turnoTextoRow}>
        <label style={styles.turnoTextoLabel}>Sábado</label>
        <input
          value={textoSabado}
          onChange={(e) => {
            setTextoSabado(e.target.value);
            setTocadoSabado(true);
            setErrorSabado(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && guardarSabado()}
          placeholder="ej. 10:00-13:00 (vacío si no trabaja)"
          style={{ ...styles.input, ...(errorSabado ? styles.inputError : {}) }}
        />
        <button onClick={guardarSabado} style={styles.secondaryBtnSmall}>
          <Check size={12} /> Aplicar
        </button>
      </div>
      {errorSabado && <div style={styles.turnoTextoError}>{errorSabado}</div>}
    </div>
  );
}

// ---------- Fila de vendedor (con edición de isla/sede) ----------
function VendedorRow({ vendedor, citasCount, onRemove, onUpdateUbicacion, onUpdateMarcas }) {
  const [editando, setEditando] = useState(false);
  const [isla, setIsla] = useState(vendedor.isla || ISLAS[0]);
  const [sede, setSede] = useState(vendedor.sede || (ISLAS_SEDES[vendedor.isla] || [])[0] || vendedor.isla);
  const [marcasEditadas, setMarcasEditadas] = useState(vendedor.marcas || []);
  const c = colorParaSede(vendedor.isla, vendedor.sede);

  const guardar = () => {
    onUpdateUbicacion(isla, sede);
    onUpdateMarcas(marcasEditadas);
    setEditando(false);
  };

  return (
    <div style={{ ...styles.vendorCard, borderLeftColor: c.border, flexWrap: "wrap" }}>
      <div style={{ ...styles.vendorDot, background: c.border }} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={styles.vendorName}>{vendedor.nombre}</div>
        {!editando && (
          <div style={styles.vendorMeta}>
            {citasCount} citas este mes
            {vendedor.isla && ` · ${vendedor.sede}, ${vendedor.isla}`}
          </div>
        )}
        {!editando && (vendedor.marcas || []).length > 0 && (
          <div style={styles.vendorMarcasRow}>
            {vendedor.marcas.map((marca) => {
              const mc = colorParaMarca(marca);
              return (
                <span key={marca} style={{ ...styles.vendorMarcaTag, background: mc.bg, color: mc.text, borderColor: mc.border }}>
                  {marca}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {editando ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={isla}
            onChange={(e) => {
              const nuevaIsla = e.target.value;
              setIsla(nuevaIsla);
              setSede((ISLAS_SEDES[nuevaIsla] || [])[0] || nuevaIsla);
            }}
            style={styles.selectSmall}
          >
            {ISLAS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {(ISLAS_SEDES[isla] || []).length > 0 && (
            <select value={sede} onChange={(e) => setSede(e.target.value)} style={styles.selectSmall}>
              {ISLAS_SEDES[isla].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <div style={styles.marcasCheckboxRow}>
            {MARCAS.map((marca) => (
              <label key={marca} style={styles.marcaCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={marcasEditadas.includes(marca)}
                  onChange={() =>
                    setMarcasEditadas((prev) =>
                      prev.includes(marca) ? prev.filter((m) => m !== marca) : [...prev, marca]
                    )
                  }
                  style={styles.filtroDesplegableCheckbox}
                />
                {marca}
              </label>
            ))}
          </div>
          <button onClick={guardar} style={styles.iconBtnConfirm} aria-label="Guardar ubicación">
            <Check size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditando(true)} style={styles.secondaryBtnSmall}>
          <Pencil size={12} /> Editar
        </button>
      )}
      <button onClick={onRemove} style={styles.iconBtn} aria-label={`Eliminar ${vendedor.nombre}`}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ---------- Modal de cita (crear / editar / cancelar / eliminar) ----------
function CitaModal({ modalCita, vendedores, gestores, vendoresDisponibles, sugerirVendedor, citasDeVendorEnMes, weekDates, dias, ventasParaTelefono, esVendida, onClose, onSave, onCancel, onDelete, onSetAsistencia }) {
  const isEdit = !!modalCita.existing;
  const existing = modalCita.existing;
  const day = isEdit ? existing.day : modalCita.day;
  const hour = isEdit ? existing.hour : modalCita.hour;
  const cancelada = isEdit && existing.estado === "cancelada";

  const disponibles = vendoresDisponibles(day, hour);
  const sugerido = !isEdit ? sugerirVendedor(day, hour) : null;

  const [vendorId, setVendorId] = useState(isEdit ? existing.vendorId : sugerido?.id || disponibles[0]?.id || "");
  const [gestorId, setGestorId] = useState(isEdit ? existing.gestorId || "" : "");
  const [cliente, setCliente] = useState(isEdit ? existing.cliente : "");
  const [telefono, setTelefono] = useState(isEdit ? existing.telefono || "" : "");
  const [marca, setMarca] = useState(isEdit ? existing.marca || "" : "");

  const vendorActual = vendedores.find((v) => v.id === vendorId);
  const matches = telefono ? ventasParaTelefono(telefono) : [];

  // Las marcas que se pueden elegir dependen del vendedor: solo tiene sentido asignar una
  // cita de una marca que ese vendedor realmente vende. Si el vendedor solo vende una marca,
  // se autocompleta sola. Solo se "corrige" o limpia la marca cuando el usuario CAMBIA de
  // vendedor a mano (no en el primer render), para no borrar por error una marca ya guardada
  // en citas antiguas de vendedores que aún no tienen sus marcas configuradas.
  const marcasDelVendedor = vendorActual?.marcas || [];
  const esPrimerRenderRef = useRef(true);
  useEffect(() => {
    if (esPrimerRenderRef.current) {
      esPrimerRenderRef.current = false;
      if (!marca && marcasDelVendedor.length === 1) setMarca(marcasDelVendedor[0]);
      return;
    }
    if (marcasDelVendedor.length === 1) {
      setMarca(marcasDelVendedor[0]);
    } else if (marca && !marcasDelVendedor.includes(marca)) {
      setMarca("");
    }
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si se ha elegido un vendedor distinto al sugerido y ya tiene claramente más citas este mes
  // que el sugerido (misma diferencia que dispara el aviso de "Carga desigual"), se muestra un
  // aviso suave, no bloqueante: el gestor puede seguir adelante con un clic si tiene una razón
  // legítima (p.ej. el cliente pide a esa persona en concreto).
  const avisoSobrecarga = useMemo(() => {
    if (isEdit || !sugerido || !vendorId || vendorId === sugerido.id) return null;
    const fechaRef = weekDates[day];
    const cargaElegido = citasDeVendorEnMes(vendorId, fechaRef);
    const cargaSugerido = citasDeVendorEnMes(sugerido.id, fechaRef);
    if (cargaElegido - cargaSugerido >= 2) {
      return { cargaElegido, cargaSugerido };
    }
    return null;
  }, [isEdit, sugerido, vendorId, day, weekDates, citasDeVendorEnMes]);

  // Para editar, ofrecemos también al vendedor actual aunque ya no tenga turno disponible,
  // para no "perder" la asignación si los turnos cambiaron después de crear la cita.
  const opcionesVendedor = useMemo(() => {
    if (!isEdit) return disponibles;
    const yaIncluido = disponibles.some((v) => v.id === existing.vendorId);
    if (yaIncluido) return disponibles;
    const actual = vendedores.find((v) => v.id === existing.vendorId);
    return actual ? [actual, ...disponibles] : disponibles;
  }, [isEdit, disponibles, vendedores, existing]);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>
              {isEdit ? (cancelada ? "Cita cancelada" : "Editar cita") : "Nueva cita"}
            </div>
            <div style={styles.modalSub}>{dias[day]} · {horaLabel(hour)}</div>
          </div>
          <button onClick={onClose} style={styles.iconBtn} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {cancelada && (
          <div style={styles.cancelBanner}>
            <AlertCircle size={13} /> Esta cita está cancelada. Puedes reactivarla guardando cambios o eliminarla.
          </div>
        )}

        {isEdit && !cancelada && (
          <div style={styles.asistenciaWrap}>
            <span style={styles.modalLabel}>¿Asistió el cliente?</span>
            <div style={styles.informeOrdenToggle}>
              <button
                onClick={() => onSetAsistencia(existing.id, existing.asistio === true ? null : true)}
                style={existing.asistio === true ? styles.asistioBtnActive : styles.informeOrdenBtn}
              >
                <Check size={12} /> Asistió
              </button>
              <button
                onClick={() => onSetAsistencia(existing.id, existing.asistio === false ? null : false)}
                style={existing.asistio === false ? styles.noAsistioBtnActive : styles.informeOrdenBtn}
              >
                <X size={12} /> No asistió
              </button>
            </div>
          </div>
        )}

        {sugerido && !isEdit && (
          <div style={styles.suggestBox}>
            <span style={{ ...styles.vendorDot, background: colorParaSede(sugerido.isla, sugerido.sede).border }} />
            Sugerencia: <strong>{sugerido.nombre}</strong> es quien menos citas tiene este mes.
          </div>
        )}

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Vendedor</label>
          {opcionesVendedor.length === 0 ? (
            <div style={styles.noVendorWarn}>Nadie tiene turno en este horario.</div>
          ) : (
            <div style={styles.vendorPicker}>
              {opcionesVendedor.map((v) => {
                const c = colorParaSede(v.isla, v.sede);
                return (
                  <button
                    key={v.id}
                    onClick={() => setVendorId(v.id)}
                    style={{
                      ...styles.vendorOption,
                      background: vendorId === v.id ? c.bg : "#fff",
                      borderColor: vendorId === v.id ? c.border : "#E5E0D4",
                    }}
                  >
                    <span style={{ ...styles.vendorDot, background: c.border }} />
                    {v.nombre} <span style={styles.vendorOptionSede}>{v.sede}</span>
                  </button>
                );
              })}
            </div>
          )}
          {avisoSobrecarga && (
            <div style={styles.avisoSobrecargaBox}>
              <AlertCircle size={13} />
              {vendorActual?.nombre} ya tiene {avisoSobrecarga.cargaElegido} citas este mes, frente a {avisoSobrecarga.cargaSugerido} de {sugerido.nombre}. Puedes continuar igualmente si hay un motivo (p. ej. el cliente pide a esta persona).
            </div>
          )}
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Marca</label>
          {!vendorActual ? (
            <div style={styles.panelHint}>Elige primero un vendedor.</div>
          ) : marcasDelVendedor.length === 0 ? (
            <div style={styles.noVendorWarn}>{vendorActual.nombre} no tiene marcas configuradas. Puedes añadirlas en la pestaña "Vendedores".</div>
          ) : (
            <div style={styles.vendorPicker}>
              {marcasDelVendedor.map((m) => {
                const mc = colorParaMarca(m);
                return (
                  <button
                    key={m}
                    onClick={() => setMarca(m)}
                    style={{
                      ...styles.vendorOption,
                      background: marca === m ? mc.bg : "#fff",
                      borderColor: marca === m ? mc.border : "#E5E0D4",
                    }}
                  >
                    <span style={{ ...styles.vendorDot, background: mc.border }} />
                    {m}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Gestor lead (quién generó la cita)</label>
          {gestores.length === 0 ? (
            <div style={styles.panelHint}>Aún no hay gestores lead creados. Puedes añadirlos en la pestaña "Gestores".</div>
          ) : (
            <select value={gestorId} onChange={(e) => setGestorId(e.target.value)} style={{ ...styles.select, width: "100%" }}>
              <option value="">Sin gestor asignado</option>
              {gestores.map((g) => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          )}
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Cliente (opcional)</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" style={styles.input} />
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Teléfono</label>
          <div style={styles.phoneInputWrap}>
            <Phone size={14} color="#A89B7E" />
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="600 123 456"
              style={styles.phoneInput}
              inputMode="tel"
            />
          </div>
          {matches.length > 0 && (() => {
            const mejor = matches[0];
            const vendida = esVendida(matches);
            return (
              <div style={{ ...styles.vendidaInline, ...(vendida ? {} : { background: "#FBF1DE", color: "#8A5E10" }) }}>
                <Check size={13} /> {vendida ? "Vendido" : "Registrado, sin venta"} según el listado
                {mejor.modelo ? ` · ${mejor.modelo}` : mejor.coche ? ` · ${mejor.coche}` : ""}
                {mejor.isla ? ` · ${mejor.isla}` : ""}
                {mejor.sede ? ` (${mejor.sede})` : ""}
                {mejor.date ? ` · ${fmtDateShort(mejor.date)}` : ""}
              </div>
            );
          })()}
        </div>

        <div style={styles.modalActions}>
          {isEdit && !cancelada && (
            <button onClick={() => onCancel(existing.id)} style={styles.warnBtn}>
              <X size={15} /> Cancelar cita
            </button>
          )}
          {isEdit && (
            <button onClick={() => onDelete(existing.id)} style={styles.dangerBtn}>
              <Trash2 size={15} /> Eliminar
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.secondaryBtn}>Cerrar</button>
          <button
            disabled={!vendorActual}
            onClick={() => onSave(vendorId, day, hour, cliente, telefono, isEdit ? existing.id : null, gestorId, marca)}
            style={{ ...styles.primaryBtn, opacity: vendorActual ? 1 : 0.5 }}
          >
            <Check size={15} /> {isEdit ? (cancelada ? "Reactivar y guardar" : "Guardar cambios") : "Asignar cita"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Estilos ----------
const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
  :root {
    --font-display: 'Fraunces', serif;
    --font-body: 'Inter', sans-serif;
  }
  * { box-sizing: border-box; }
  button { cursor: pointer; font-family: var(--font-body); }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #C45A2E; outline-offset: 2px; }
  input, select { font-family: var(--font-body); }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`;

const styles = {
  root: { fontFamily: "var(--font-body)", background: "#FBF8F2", color: "#2B2620", minHeight: 500, borderRadius: 16, overflow: "hidden", border: "1px solid #EBE4D3" },
  header: { background: "#FBF8F2", borderBottom: "1px solid #EBE4D3", padding: "18px 22px 14px" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: { width: 38, height: 38, borderRadius: 10, background: "#C45A2E", color: "#FFF8EE", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, flexShrink: 0 },
  brandTitle: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, lineHeight: 1.1 },
  brandSub: { fontSize: 12, marginTop: 2 },
  syncOk: { display: "inline-flex", alignItems: "center", gap: 4, color: "#2F5E3F" },
  syncOff: { display: "inline-flex", alignItems: "center", gap: 4, color: "#A14B2C" },
  tabs: { display: "flex", gap: 4, background: "#F1EAD9", padding: 4, borderRadius: 10 },
  tab: { display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "#7A6B4C", fontSize: 13, fontWeight: 500, padding: "7px 12px", borderRadius: 8 },
  tabActive: { display: "flex", alignItems: "center", gap: 6, border: "none", background: "#FFFFFF", color: "#C45A2E", fontSize: 13, fontWeight: 600, padding: "7px 12px", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  gestionMenuWrap: { position: "relative" },
  gestionMenuDropdown: { position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, minWidth: 170, zIndex: 40, display: "flex", flexDirection: "column", gap: 2 },
  gestionMenuItem: { display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#5C5240", fontSize: 13, fontWeight: 500, padding: "8px 10px", borderRadius: 7, textAlign: "left", width: "100%" },
  gestionMenuItemActive: { display: "flex", alignItems: "center", gap: 8, border: "none", background: "#F1EAD9", color: "#C45A2E", fontSize: 13, fontWeight: 600, padding: "8px 10px", borderRadius: 7, textAlign: "left", width: "100%" },
  weekNav: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  navBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E0D4", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#5C5240" },
  weekLabel: { fontSize: 13.5, fontWeight: 600, color: "#3D362A", minWidth: 190 },
  todayBtn: { border: "1px solid #E5E0D4", background: "#fff", borderRadius: 8, fontSize: 12.5, padding: "6px 10px", color: "#5C5240", fontWeight: 500 },
  balanceWrap: { display: "flex", alignItems: "center", gap: 10 },
  balanceWarn: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#A14B2C", background: "#FBE9DF", padding: "5px 9px", borderRadius: 7, fontWeight: 600 },
  balanceCount: { fontSize: 12.5, color: "#8A7B5C", fontWeight: 500 },
  balanceSold: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#2F5E3F", background: "#EAF2EC", padding: "5px 9px", borderRadius: 7, fontWeight: 600 },

  filterBar: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #EFE9DA", flexWrap: "wrap" },
  filterDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },
  filterClear: { display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "#A14B2C", fontSize: 12, fontWeight: 600, padding: "4px 6px", marginLeft: "auto" },
  filtroDesplegableWrap: { position: "relative" },
  filtroDesplegableBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E5E0D4", background: "#fff", color: "#5C5240", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 500 },
  filtroDesplegableBtnActivo: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #C45A2E", background: "#FBEFE6", color: "#A14B2C", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600 },
  filtroDesplegableBadge: { background: "#C45A2E", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "1px 6px", minWidth: 16, textAlign: "center" },
  filtroDesplegableMenu: { position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 8, minWidth: 190, maxHeight: 280, overflowY: "auto", zIndex: 40, display: "flex", flexDirection: "column", gap: 2 },
  filtroDesplegableOpcion: { display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, fontSize: 13, color: "#5C5240", cursor: "pointer" },
  filtroDesplegableCheckbox: { width: 14, height: 14, flexShrink: 0, accentColor: "#C45A2E" },

  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px", gap: 8, textAlign: "center" },
  emptyIcon: { fontSize: 34, marginBottom: 4 },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600 },
  emptyText: { fontSize: 13.5, color: "#8A7B5C", marginBottom: 10 },

  panel: { padding: "20px 22px 26px" },
  panelTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, marginBottom: 4 },
  panelHint: { fontSize: 12.5, color: "#8A7B5C", marginBottom: 16 },

  addRow: { display: "flex", gap: 8, marginBottom: 18, maxWidth: 560, flexWrap: "wrap" },
  marcasCheckboxRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid #E5E0D4", borderRadius: 9, padding: "8px 12px", background: "#fff", maxWidth: 480 },
  marcaCheckboxLabel: { display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#5C5240", cursor: "pointer", whiteSpace: "nowrap" },
  leadFormWrap: { background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, padding: "14px 16px", marginBottom: 18, maxWidth: 780 },
  leadFormGrid: { display: "flex", gap: 8, marginBottom: 0, flexWrap: "wrap", alignItems: "center" },
  leadFormAcciones: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 },
  leadAgruparBar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  leadGrupoWrap: { marginBottom: 10 },
  leadGrupoHeader: { display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "#F1EAD9", padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 6 },
  leadGrupoTitulo: { fontSize: 13, fontWeight: 600, color: "#5C5240", flex: 1, textAlign: "left" },
  leadGrupoCount: { fontSize: 11.5, fontWeight: 600, color: "#8A7B5C", background: "#fff", padding: "2px 8px", borderRadius: 999 },
  leadFiltrosBar: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center", paddingTop: 14, borderTop: "1px solid #EFE9DA" },
  informeFiltrosPrincipales: { display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap", alignItems: "center" },
  selectDestacado: { border: "1.5px solid #C45A2E", background: "#fff", color: "#3D362A", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, minWidth: 150 },
  input: { flex: 1, border: "1px solid #E5E0D4", borderRadius: 9, padding: "9px 12px", fontSize: 13.5, background: "#fff", color: "#2B2620", minWidth: 140 },
  select: { border: "1px solid #E5E0D4", borderRadius: 9, padding: "9px 10px", fontSize: 13, background: "#fff", color: "#2B2620", minWidth: 120 },
  selectSmall: { border: "1px solid #E5E0D4", borderRadius: 7, padding: "5px 7px", fontSize: 12, background: "#fff", color: "#2B2620" },
  primaryBtn: { display: "flex", alignItems: "center", gap: 6, border: "none", background: "#C45A2E", color: "#FFF8EE", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" },
  secondaryBtn: { border: "1px solid #E5E0D4", background: "#fff", color: "#5C5240", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 500 },
  secondaryBtnSmall: { display: "flex", alignItems: "center", gap: 5, border: "1px solid #E5E0D4", background: "#fff", color: "#5C5240", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" },
  warnBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E8D2A8", background: "#FBF1DE", color: "#8A5E10", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600 },
  dangerBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E8BBAB", background: "#FBEDE6", color: "#A14B2C", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600 },
  dangerBtnSmall: { display: "flex", alignItems: "center", gap: 4, border: "1px solid #E8BBAB", background: "#FBEDE6", color: "#A14B2C", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600 },
  leadLimpiezaBar: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16, padding: "8px 10px", background: "#FBF1DE", borderRadius: 8 },
  iconBtn: { border: "none", background: "transparent", color: "#A89B7E", padding: 6, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },
  iconBtnConfirm: { border: "none", background: "#EAF2EC", color: "#2F5E3F", padding: 6, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" },

  vendorList: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 },
  vendorCard: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EBE4D3", borderLeft: "4px solid", borderRadius: 10, padding: "10px 12px" },
  vendorDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  vendorName: { fontSize: 14, fontWeight: 600 },
  vendorMeta: { fontSize: 12, color: "#8A7B5C", marginTop: 1 },
  vendorMarcasRow: { display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" },
  vendorMarcaTag: { fontSize: 10.5, fontWeight: 600, border: "1px solid", borderRadius: 999, padding: "1px 8px" },

  turnoBlock: { marginBottom: 26 },
  turnoTextoBlock: { marginBottom: 22, background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, padding: "14px 16px", maxWidth: 620 },
  turnoTextoRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 },
  turnoTextoLabel: { fontSize: 12, fontWeight: 600, color: "#7A6B4C", width: 95, flexShrink: 0 },
  turnoTextoError: { fontSize: 11.5, color: "#A14B2C", marginTop: 4, marginLeft: 103 },
  turnoTextoAviso: { fontSize: 11.5, color: "#8A5E10", marginTop: 4, marginLeft: 103 },
  inputError: { borderColor: "#D98A6F" },
  turnoVendorHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  turnoVendorName: { fontSize: 13.5, fontWeight: 600 },
  turnoVendorLoc: { fontSize: 11.5, color: "#A89B7E" },
  turnoGrid: { display: "grid", gridTemplateColumns: "56px repeat(6, 1fr)", gap: 3 },
  turnoGridCorner: {},
  turnoDayHeader: { fontSize: 11, fontWeight: 700, color: "#7A6B4C", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingBottom: 4 },
  turnoQuickRow: { display: "flex", gap: 2 },
  quickBtn: { border: "1px solid #E5E0D4", background: "#fff", color: "#7A6B4C", fontSize: 9.5, fontWeight: 700, width: 16, height: 16, borderRadius: 4, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  quickBtnClear: { border: "1px solid #E5E0D4", background: "#fff", color: "#B0654A", fontSize: 11, fontWeight: 700, width: 16, height: 16, borderRadius: 4, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  turnoHourLabel: { fontSize: 10.5, color: "#A89B7E", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 },
  turnoCell: { height: 18, border: "1px solid #E5E0D4", borderRadius: 4, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },

  agendaGrid: { display: "grid", gridTemplateColumns: "58px repeat(6, 1fr)", gap: 3 },
  agendaCorner: { fontSize: 10.5, color: "#A89B7E", paddingBottom: 6 },
  agendaDayHeader: { textAlign: "center", paddingBottom: 8 },
  agendaDayName: { fontSize: 11, fontWeight: 700, color: "#7A6B4C" },
  agendaDayDate: { fontSize: 10.5, color: "#A89B7E" },
  agendaHourLabel: { fontSize: 10.5, color: "#A89B7E", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 6, paddingTop: 5 },
  agendaCell: { minHeight: 38, border: "1px solid #EFE9DA", borderRadius: 6, background: "#FFFEFB", display: "flex", flexDirection: "column", gap: 2, padding: 3, position: "relative" },
  noOneCell: { width: "100%", height: "100%", minHeight: 28 },
  addCitaBtn: { border: "1px dashed #D8CFB8", background: "transparent", color: "#C2B796", borderRadius: 5, height: 22, display: "flex", alignItems: "center", justifyContent: "center" },
  citaChip: { display: "flex", alignItems: "center", gap: 5, border: "1px solid", borderRadius: 6, padding: "3px 6px", fontSize: 10.5, fontWeight: 600, textAlign: "left", overflow: "hidden" },
  citaDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  citaChipText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  citaChipTextWrap: { display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minWidth: 0 },
  citaChipGestor: { fontSize: 9, fontWeight: 500, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  citaChipNoAsistio: { fontSize: 9, fontWeight: 700, color: "#A14B2C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  legendTitulo: { marginTop: 20, fontSize: 12, fontWeight: 600, color: "#7A6B4C" },
  legend: { marginTop: 8, display: "flex", flexDirection: "column", gap: 7, maxWidth: 500 },
  legendItem: { display: "flex", alignItems: "center", gap: 8 },
  legendName: { fontSize: 12, width: 100, flexShrink: 0, color: "#5C5240", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendLocation: { fontSize: 11, color: "#A89B7E", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendVacacionesTag: { fontSize: 10, fontWeight: 600, color: "#8A5E10", background: "#FBF1DE", padding: "2px 7px", borderRadius: 999, flexShrink: 0 },
  legendBarWrap: { flex: 1, height: 7, background: "#F1EAD9", borderRadius: 4, overflow: "hidden" },
  legendBar: { display: "block", height: "100%", borderRadius: 4 },
  legendCount: { fontSize: 12, fontWeight: 600, width: 20, textAlign: "right", color: "#5C5240" },

  informeResumenGrid: { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 26 },
  informeStatsCol: { flex: 1, minWidth: 240 },
  informeStatsRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 0 },
  informeStatCard: { border: "1px solid #EBE4D3", borderRadius: 10, padding: "14px 18px", background: "#fff", minWidth: 110 },
  informeStatNumber: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "#3D362A" },
  informeStatLabel: { fontSize: 11.5, color: "#8A7B5C", marginTop: 2 },
  informeDonutWrap: { background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, padding: "14px 18px", flexShrink: 0 },
  informeBarrasHorizWrap: { marginBottom: 12 },
  informeTablaExpandidaLabel: { display: "flex", alignItems: "center", gap: 8, padding: "3px 0 6px", marginLeft: 4 },

  informeTablaWrap: { marginBottom: 24, maxWidth: 620 },
  informeTablaTitulo: { fontSize: 13.5, fontWeight: 600, marginBottom: 10, color: "#3D362A" },
  informeFiltroLabel: { fontSize: 12, color: "#8A7B5C", fontWeight: 500 },
  informeChartWrap: { background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, padding: "16px 18px", marginBottom: 26, maxWidth: 700 },
  informeAvisoDatos: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#A14B2C", background: "#FBEDE6", padding: "7px 11px", borderRadius: 8, marginBottom: 18, maxWidth: 600 },
  informeDuplicadosWrap: { marginBottom: 26, maxWidth: 600, background: "#FBF1DE", border: "1px solid #E8D2A8", borderRadius: 10, padding: "14px 16px" },
  informeDuplicadoGrupo: { display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 8, padding: "9px 12px", marginTop: 8 },
  informeDuplicadoItem: { fontSize: 12, color: "#5C5240" },
  informeTablaHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  informeOrdenToggle: { display: "flex", gap: 4, background: "#F1EAD9", padding: 3, borderRadius: 7 },
  informeOrdenBtn: { border: "none", background: "transparent", color: "#7A6B4C", fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 5 },
  informeOrdenBtnActive: { border: "none", background: "#FFFFFF", color: "#C45A2E", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 5, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" },
  informeTablaRows: { display: "flex", flexDirection: "column", gap: 7 },
  informeTablaRow: { display: "flex", alignItems: "center", gap: 8 },
  informeTablaRowBtn: { display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "transparent", padding: "3px 0", cursor: "pointer", textAlign: "left" },
  informeTablaNombre: { fontSize: 12, width: 130, flexShrink: 0, color: "#5C5240", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  informeTablaCifras: { fontSize: 12, fontWeight: 600, width: 48, textAlign: "right", color: "#5C5240", flexShrink: 0 },
  informeTablaTasa: { fontSize: 11.5, width: 38, textAlign: "right", color: "#8A7B5C", flexShrink: 0 },
  informeDetalleWrap: { display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px 8px 22px", background: "#FFFEFB", borderRadius: 7, marginTop: 4, marginBottom: 4, border: "1px solid #EFE9DA" },
  informeDetalleRow: { display: "flex", alignItems: "center", gap: 8 },
  informeDetalleNombre: { fontSize: 11.5, flex: 1, minWidth: 0, color: "#5C5240", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  informeDetallePhone: { fontSize: 11, color: "#A89B7E", width: 90, flexShrink: 0 },
  informeDetalleMes: { fontSize: 11, color: "#A89B7E", width: 80, flexShrink: 0 },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(43,38,32,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalCard: { background: "#FBF8F2", borderRadius: 14, padding: 22, width: 380, maxWidth: "100%", boxShadow: "0 12px 32px rgba(0,0,0,0.18)", border: "1px solid #EBE4D3" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 },
  modalSub: { fontSize: 12.5, color: "#8A7B5C", marginTop: 2 },
  cancelBanner: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, background: "#FBF1DE", color: "#8A5E10", padding: "8px 10px", borderRadius: 8, marginBottom: 14, fontWeight: 600 },
  asistenciaWrap: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  asistioBtnActive: { display: "flex", alignItems: "center", gap: 4, border: "none", background: "#4F9B72", color: "#fff", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 5 },
  noAsistioBtnActive: { display: "flex", alignItems: "center", gap: 4, border: "none", background: "#C45A2E", color: "#fff", fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 5 },
  suggestBox: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, background: "#EAF2EC", color: "#2F5E3F", padding: "8px 10px", borderRadius: 8, marginBottom: 14 },
  avisoSobrecargaBox: { display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5, background: "#FBF1DE", color: "#8A5E10", padding: "8px 10px", borderRadius: 8, marginTop: 8, lineHeight: 1.4 },
  modalField: { marginBottom: 14 },
  modalLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#7A6B4C", marginBottom: 6 },
  noVendorWarn: { fontSize: 12.5, color: "#A14B2C", background: "#FBEDE6", padding: "8px 10px", borderRadius: 8 },
  vendorPicker: { display: "flex", flexWrap: "wrap", gap: 6 },
  vendorOption: { display: "flex", alignItems: "center", gap: 6, border: "1px solid", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 500 },
  vendorOptionSede: { fontSize: 10.5, opacity: 0.7, fontWeight: 400 },
  modalActions: { display: "flex", alignItems: "center", gap: 8, marginTop: 18, flexWrap: "wrap" },

  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#2B2620", color: "#FBF8F2", padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500, boxShadow: "0 6px 18px rgba(0,0,0,0.25)", zIndex: 60 },

  uploadBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%", maxWidth: 420, border: "1.5px dashed #D8CFB8", background: "#FFFEFB", borderRadius: 12, padding: "26px 20px" },
  uploadTitle: { fontSize: 13.5, fontWeight: 600, color: "#5C5240", marginTop: 4 },
  uploadHint: { fontSize: 12, color: "#A89B7E" },

  fileCard: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EBE4D3", borderRadius: 10, padding: "12px 14px", maxWidth: 560 },
  fileName: { fontSize: 13.5, fontWeight: 600 },
  fileMeta: { fontSize: 11.5, color: "#8A7B5C", marginTop: 1 },

  cotejoList: { display: "flex", flexDirection: "column", gap: 7, maxWidth: 640 },
  cotejoRow: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EBE4D3", borderLeft: "3px solid", borderRadius: 9, padding: "9px 12px" },
  cotejoName: { fontSize: 13, fontWeight: 600 },
  cotejoPhone: { fontSize: 11.5, color: "#A89B7E", fontWeight: 400 },
  cotejoMeta: { fontSize: 11.5, color: "#8A7B5C", marginTop: 1 },
  vendidaTag: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#2F5E3F", background: "#EAF2EC", padding: "4px 8px", borderRadius: 7, whiteSpace: "nowrap" },
  pendienteTag: { fontSize: 11, color: "#A89B7E", whiteSpace: "nowrap" },
  pendienteTagRojo: { fontSize: 11, fontWeight: 600, color: "#A14B2C", whiteSpace: "nowrap" },
  leadEstadoManualBotones: { display: "flex", gap: 3, flexShrink: 0 },

  phoneInputWrap: { display: "flex", alignItems: "center", gap: 7, border: "1px solid #E5E0D4", borderRadius: 9, padding: "9px 12px", background: "#fff" },
  phoneInput: { flex: 1, border: "none", outline: "none", fontSize: 13.5, background: "transparent", color: "#2B2620" },
  vendidaInline: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2F5E3F", background: "#EAF2EC", padding: "7px 10px", borderRadius: 8, marginTop: 8, fontWeight: 600 },
};
