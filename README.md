# Rosco en tiempo real

Overlay de un rosco (estilo Pasapalabra) para usar en stream, con un panel de
control separado del overlay que se muestra en OBS. Ambos se sincronizan en
tiempo real usando Firebase Firestore, así que pueden estar en pestañas o
incluso PCs distintas.

## Estructura

- `control.html` / `js/control.js`: panel de control. Ahí armás las 25
  preguntas del rosco, creás la partida y vas marcando cada letra como
  correcta, incorrecta o pasapalabra. Maneja también el cronómetro.
- `overlay.html` / `js/overlay.js`: la vista que agregás como **Browser
  Source** en OBS. Fondo transparente, sin controles visibles una vez
  conectada.
- `js/rosco-data.js`: las 25 letras del rosco clásico (sin K ni W) y la
  plantilla de preguntas.
- `js/state.js`: toda la lógica de sincronización con Firestore y del
  cronómetro compartido.
- `js/firebase-config.js`: acá van las credenciales de tu proyecto de
  Firebase (ver configuración abajo).
- `firestore.rules`: reglas de seguridad de ejemplo.

## Configuración (una sola vez)

1. Creá un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Activá **Firestore Database** (modo producción o de prueba, es indistinto
   porque vamos a usar las reglas de este repo).
3. Andá a **Configuración del proyecto → Tus apps** y agregá una app Web.
   Copiá el objeto de configuración que te da Firebase.
4. Pegalo en `js/firebase-config.js`, reemplazando los valores de ejemplo.
5. En Firestore → Reglas, pegá el contenido de `firestore.rules` y publicá.

No hace falta backend propio ni build: es HTML/JS estático que importa el SDK
de Firebase directo desde su CDN.

## Cómo correrlo

Como usa módulos ES (`type="module"`), no podés abrir los archivos con
`file://` directo — necesitás servirlos por http. Alguna opción simple:

```bash
npx serve .
# o
python3 -m http.server 8080
```

Después abrí:

- Panel de control: `http://localhost:8080/control.html`
- Overlay (para probar en el navegador): `http://localhost:8080/overlay.html?room=TUCODIGO`

Para producción, lo más simple es desplegarlo con **Firebase Hosting**
(`firebase deploy`) o subirlo a GitHub Pages / Netlify, ya que es todo
estático.

## Uso en vivo

1. Abrí `control.html`, completá las preguntas de cada letra (o cargá un
   JSON exportado de una partida anterior) y elegí la duración del reloj.
2. Tocá **"Crear partida y empezar a jugar"**. Se genera un código de sala
   (o usás el que hayas escrito).
3. Tocá **"Copiar enlace del overlay"** y pegalo como URL de un **Browser
   Source** en OBS (marcá "Refresh browser when scene becomes active" si
   querés que arranque limpio cada vez).
4. Jugá desde el panel: clic en una letra para activarla, y los botones
   ✅ ❌ ⏭️ para resolverla (o los atajos `C` / `X` / `P`, con `↑`/`↓` para
   moverte y `Espacio` para iniciar/pausar el reloj).

El overlay se actualiza solo, en tiempo real, sin que tengas que tocar nada
en OBS durante la partida.

## Formato del JSON de preguntas

Para importar/exportar tandas de preguntas:

```json
[
  { "id": "A", "type": "starts", "clue": "Animal doméstico muy fiel", "answer": "Perro" },
  { "id": "B", "type": "contains", "clue": "Fruta con B en el medio", "answer": "Banana" }
]
```

`type` puede ser `"starts"` (Empieza por) o `"contains"` (Contiene la).
