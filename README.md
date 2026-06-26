# Agenda de vendedores

Aplicación web para repartir turnos y citas entre un equipo de comerciales,
con sincronización en tiempo real vía Firebase Realtime Database, filtros
por isla/sede, y cotejo automático de citas con un listado de ventas en
Excel/CSV.

## 1. Requisitos

- Node.js 18 o superior (https://nodejs.org)
- Una cuenta de Firebase (gratuita): https://console.firebase.google.com

## 2. Instalación local

```bash
npm install
```

## 3. Configurar Firebase (sincronización en tiempo real)

Sin este paso la app funciona igualmente, pero **en modo local**: cada
dispositivo tendrá su propia copia de los datos y no se compartirá nada.

1. Ve a https://console.firebase.google.com y crea un proyecto nuevo
   (o usa uno existente).
2. En el menú lateral, entra en **Build → Realtime Database** y pulsa
   "Crear base de datos". Elige una región (por ejemplo
   `europe-west1`) y empieza en modo de prueba (luego puedes ajustar
   las reglas de seguridad).
3. Copia la URL que aparece arriba de la base de datos, algo como:
   `https://TU_PROYECTO-default-rtdb.europe-west1.firebasedatabase.app`
4. En el menú lateral, entra en **Project settings** (el icono de
   engranaje) → pestaña **General** → sección "Tus apps" → pulsa el
   icono `</>` (Web) para registrar una app web. No necesitas Firebase
   Hosting para este paso.
5. Copia el objeto `firebaseConfig` que te da Firebase.
6. Abre `src/AgendaVendedores.jsx` y sustituye el bloque
   `firebaseConfig` (cerca de la línea 42) por el tuyo. Asegúrate de
   añadir manualmente el campo `databaseURL` del paso 3 — Firebase no
   lo incluye en el bloque que copias por defecto.

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://TU_PROYECTO-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

### Reglas de seguridad (recomendado antes de compartir la app)

Por defecto, el modo de prueba de Firebase deja la base de datos
abierta a cualquiera durante 30 días. Si vas a compartir la app con tu
equipo, en **Realtime Database → Reglas**, pon algo como:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

(Esto sigue siendo público sin contraseña — cualquiera con la URL de
tu app puede leer y escribir. Para un equipo interno pequeño suele ser
suficiente, pero si quieres restringirlo más, Firebase permite añadir
autenticación por email/contraseña o reglas basadas en un token
compartido.)

## 4. Ejecutar en local

```bash
npm run dev
```

Abre la URL que te indique la terminal (normalmente
`http://localhost:5173`).

## 5. Desplegar para que todo el equipo lo use

### Opción A: Vercel (recomendada, gratis)

1. Sube este proyecto a un repositorio de GitHub.
2. Ve a https://vercel.com, conecta tu cuenta de GitHub, importa el
   repositorio.
3. Vercel detecta Vite automáticamente. Pulsa "Deploy".
4. En unos segundos tendrás una URL pública (algo como
   `https://agenda-vendedores.vercel.app`) que puedes compartir con tu
   equipo.

### Opción B: Netlify (también gratis)

1. Ve a https://app.netlify.com, conecta tu repositorio de GitHub.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Deploy.

### Opción C: Firebase Hosting

Si ya tienes el proyecto de Firebase creado:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## Estructura del proyecto

```
src/
  AgendaVendedores.jsx   ← Toda la lógica y UI de la app
  App.jsx                ← Monta el componente
  main.jsx               ← Punto de entrada de React
  index.css              ← Estilos globales mínimos
```

## Notas

- La librería `xlsx` (SheetJS) usada para leer los archivos de ventas
  tiene una vulnerabilidad conocida sin parche oficial en npm. Como
  solo se usa para leer archivos que tú mismo subes, el riesgo
  práctico es bajo, pero tenlo en cuenta si en el futuro permites que
  terceros suban archivos directamente.
- Si no configuras Firebase, la app sigue funcionando en modo local
  (verás el aviso "Modo local" en la cabecera), pero los datos no se
  compartirán entre dispositivos ni persistirán al recargar en otro
  navegador.
