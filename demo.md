# Demo — Norba Travels Agent

Vídeo de lanzamiento de **3:00** para la Meta Global AI Developer Hackathon (entrega: miércoles 4 de noviembre, 21:00 ET
(Eastern Time, hora del Este de EE. UU.)). Estilo *launch video* en After Effects: tipografía cinética, ilustración
isométrica de línea, capturas reales del producto con movimiento de cámara. El vídeo es una de las piezas principales
con las que juzgan, junto con el código y el producto en vivo.

> **Idea que el vídeo tiene que dejar clara:** no es un chat para reservar vuelos. Es un agente de viajes que trabaja
> antes, durante y después del viaje — y **Norba es la capa de reservas para cualquier asistente de IA**.

---

## 1. Reglas que el vídeo debe cumplir (si no, descalificación)

1. **Solo se enseña lo construido durante la hackathon.** Cada escena de producto es una **captura real** de algo que
   funciona. Nada de maquetas que finjan funcionar. Lo que no esté construido a tiempo, se corta (ver §8).
2. **Se distingue lo nuevo de lo que ya existía.** Rótulo en el segundo 0:14 y en el cierre: *"Built during the
   hackathon: the agent, its apps and the MCP layer. Pre-existing: the Norba API — our startup."* Cuando se vea la API
   de Norba en un diagrama, etiqueta pequeña **"Norba API · pre-existing"**.
3. **Derechos de todo lo que sale:** música con licencia, nada de vídeo de archivo sin licencia, nada de logos de
   aerolíneas ni de pantallas reales de aeropuertos. El panel de salidas es nuestro (ver §6.2).
4. **Datos ficticios:** viajeros inventados, tarjeta de pruebas `4242 4242 4242 4242`, entorno sandbox (pruebas) o
   mock. Rótulo discreto "Sandbox · test data" en cada captura de pago.
5. **Los aviones dibujados no llevan letras ni códigos de aerolínea.** Los códigos van en carteles de puerta, en la
   pista o en el panel.
6. **Subtítulos quemados en inglés** (muchos jueces lo verán sin sonido).

---

## 2. Ficha técnica

| | |
|---|---|
| Duración | 3:00 exactos (master) + corte de 45 s en 9:16 para X (premio Most Viral) |
| Formato | 1920×1080, 30 fps; capturas grabadas a 4K para poder hacer zoom |
| Idioma | Voz en off y textos en **inglés**; subtítulos en inglés |
| Paleta | Midnight `#18191a` (fondo), Cloud `#fafafa` (texto), Stone `#949596`, Slate `#48494c`, Mist `#eeeeee`, **Vermilion `#ef0302` solo para acción y momentos clave** |
| Tipografía | Geist (títulos y cuerpo), Geist Mono en mayúsculas para etiquetas, contadores y chips de modelo |
| Logo | Marca de Norba en SVG (`src/components/brand.tsx`): cuadrado Vermilion con la flecha blanca |
| Ritmo | ~140 palabras/minuto de voz; música electrónica limpia 118–124 BPM, un *drop* en la escena 5 (foto del panel) |
| Voz | Una sola voz, cercana y segura; sin tono de anuncio |

### Lenguaje visual (el "look")

- **Hilo conductor:** la **línea de ruta discontinua en Vermilion** del dibujo de inicio (hero) une todas las escenas: sale
  de una escena y entra en la siguiente como transición.
- **Ilustración isométrica de línea blanca** sobre Midnight, con rejilla sutil (como `hero-airport.tsx`): los trazos
  se dibujan solos (*stroke draw-on*, 12–18 frames), los rellenos entran con *fade*.
- **Cuadrados de 6 px** como marcadores: aparecen con *pop* al marcar un paso; un cuadrado Vermilion hace de cursor.
- **Capturas del producto** dentro de un marco de navegador sin barra, con *push-in* de cámara lento (100 % → 112 %),
  desenfoque de profundidad en lo que no importa y resaltados con un rectángulo de borde fino.
- **Chips de modelo** en esquina inferior izquierda, Geist Mono, cada vez que actúa un modelo de Meta:
  `MUSE SPARK 1.3 · VISION`, `MUSE SPARK · REASONING HIGH`, `MUSE VOICE TRANSCRIBE`, `MUSE SPARK OPEN · BASETEN`.
- **El panel de 12 pasos** del producto aparece en varias escenas como "reloj" del viaje: sus pasos se marcan con ✓.
- Nada de *glitch*, partículas ni 3D brillante: limpio, de líneas, tipo lanzamiento de producto.

---

## 3. La historia en una línea

**Ana recibe la invitación de boda de unos amigos en Atenas. Sus amigos viven en cuatro ciudades. El agente lo organiza
todo, los cuida cuando algo cambia, y al final se ve que lo mismo sirve a agencias y a cualquier asistente de IA.**

Personajes (ficticios):

| Viajero | Ciudad | Aeropuerto |
|---|---|---|
| Ana | Madrid | Madrid Barajas (MAD) |
| Léa | París | Paris Charles de Gaulle (CDG) |
| Marco | Milán | Milan Malpensa (MXP) |
| Tom | Londres | London Heathrow (LHR) |

Boda: **María y Nikos, sábado 12 de diciembre de 2026, Atenas (ATH).** Atenas porque las aerolíneas conectadas a Norba
la vuelan desde las cuatro ciudades, y así las capturas salen con ofertas reales del sandbox.

---

## 4. Guion escena a escena

Formato de cada escena: **tiempo · qué se ve · animación · texto en pantalla · voz en off · sonido · modelo de Meta ·
estado (¿existe ya?)**.

### Escena 0 — Gancho · 0:00–0:14

- **Se ve:** pantalla negra. Una burbuja de chat genérica aparece: *"Find me a flight to Athens for the wedding"*.
  Respuesta de un asistente genérico: *"Here are some websites where you can book…"* — la respuesta se tacha con una
  línea Vermilion.
- **Animación:** tipografía cinética; la línea que tacha se convierte en la ruta discontinua que cruza la pantalla y
  dibuja la marca de Norba.
- **Texto:** "AI can talk about travel." → "It still can't book it." → **"NORBA TRAVELS AGENT"** → "From any message to
  a booked seat."
- **Voz:** *"Every assistant can talk about a trip. Almost none can actually book one."*
- **Sonido:** silencio, un *tick* por palabra, entra la música en el logo.
- **Rótulo (0:12–0:14, pequeño, abajo):** "Built during the Meta Global AI Developer Hackathon · on the Norba API (our
  startup, pre-existing)".
- **Estado:** solo motion graphics.

### Escena 1 — De cualquier documento a un viaje · 0:14–0:40

- **Se ve:**
  1. Ilustración isométrica: un móvil sobre una mesa; llega la invitación de boda (tarjeta elegante: "María & Nikos ·
     Athens · Saturday 12 December 2026").
  2. Ana la **arrastra** al chat del agente (captura real), con el texto "Can you sort this out?".
  3. Muse Spark "lee" la imagen: sobre la invitación aparecen recuadros finos que señalan **lugar, fecha y nombres**, y
     cada dato vuela al panel de pasos como una etiqueta.
  4. El agente responde: "Athens, Saturday 12 December. Out Friday 11, back Sunday 13? Who's coming?".
- **Animación:** zoom desde el móvil ilustrado hasta la captura real (*match cut* del marco del móvil al marco del
  navegador). Recuadros de detección dibujándose.
- **Texto:** "Any message. Any document." · chip `MUSE SPARK 1.3 · VISION`.
- **Voz:** *"Trips start with a message. Ana gets a wedding invitation and forwards it — that's all. Muse Spark reads
  it: Athens, Saturday the twelfth, out Friday, back Sunday."*
- **Sonido:** notificación del móvil, *whoosh* corto al soltar la imagen.
- **Estado:** **A CONSTRUIR** — subida de imagen/PDF al compositor + mensaje con imagen a Muse Spark + extracción a
  búsqueda (§7, tarea A).

### Escena 2 — Viaje de grupo desde cuatro ciudades · 0:40–1:15

- **Se ve:**
  1. Ana escribe: "Léa flies from Paris, Marco from Milan, Tom from London. Land close together, under €250 each."
  2. **Mapa isométrico de Europa** en línea blanca: cuatro puntos (MAD, CDG, MXP, LHR) y Atenas. De cada ciudad sale un
     **agente** (cuadrado blanco con su nombre) y dibuja su ruta discontinua hacia Atenas.
  3. Cada agente muestra en una mini tarjeta su mejor opción y su restricción ("Tom: after 10:00", "Marco: non-stop").
  4. El **coordinador** (cuadrado Vermilion en Atenas) junta las cuatro: aparece una línea de tiempo con las cuatro
     llegadas encajando **en una ventana de 55 minutos**.
  5. Captura real: el resultado de grupo en el chat (cuatro itinerarios, total por persona) y el botón **"Hold all 4"**.
  6. Cada amigo recibe un **enlace de pago** en su móvil (cuatro móviles ilustrados en fila); cada uno paga el suyo; los
     cuatro pasos de pago se marcan ✓ en cascada.
- **Animación:** las cuatro rutas se dibujan a la vez con ligeros desfases; la ventana de llegadas se "cierra" como un
  obturador.
- **Texto:** "4 travellers · 4 cities · 1 plan" · "Arrivals within 55 min" · chip `MUSE SPARK · REASONING HIGH · 5
  AGENTS`.
- **Voz:** *"Her friends live in four cities. So the agent splits into four — one per traveller, each with their own
  budget and timing — and a coordinator finds flights that land within the same hour. Real offers from real airlines,
  through Norba. The seats are held; everyone pays their own."*
- **Sonido:** cuatro notas ascendentes, una por ruta; acorde al cerrarse la ventana.
- **Estado:** **A CONSTRUIR** — búsqueda multi-origen con agentes por viajero + coordinador, reserva retenida sin pago
  (*hold*) y enlace de pago por viajero (§7, tareas B y C). Confirmar en sandbox qué aerolínea permite *hold*.

### Escena 3 — Guardián del viaje · 1:15–1:45

- **Se ve:**
  1. Calendario ilustrado que pasa páginas: "3 weeks later".
  2. Llega un **aviso de cambio de la aerolínea** (OCN, Order Change Notification): el vuelo de Ana sale 4 h más tarde.
     En pantalla, el aviso en crudo (XML desenfocado) se transforma en una frase: "Your Friday flight now leaves at
     19:40 instead of 15:40."
  3. El agente ya ha trabajado: tarjeta real con **"What changed · Your options"**: cambio gratis según su tarifa, dos
     alternativas reales, y la llegada del grupo recalculada ("you'd still land with Léa").
  4. Ana pulsa **"Switch to 14:50"** → ✓ "Rebooked · same price".
- **Animación:** el XML se "despliega" en texto legible letra a letra; las alternativas entran deslizando.
- **Texto:** "It watches your trip so you don't have to." · etiqueta "Simulated airline notice" (pequeña, si se usa el
  mock).
- **Voz:** *"Three weeks later the airline moves Ana's flight. She doesn't find out at midnight from an email. The agent
  already read the change, checked her fare rules, and found a better flight. One tap."*
- **Sonido:** zumbido suave de alerta, *click* al confirmar.
- **Estado:** **A CONSTRUIR** — recepción del aviso (en demo, simulado con el cliente mock), explicación con Muse Spark,
  búsqueda de alternativas y cambio (§7, tarea D).

### Escena 4 — La foto del panel del aeropuerto · 1:45–2:12 (el clímax)

- **Se ve:**
  1. **Grabación real** (ver §6.2): aeropuerto de noche, panel de salidas. Una fila parpadea **CANCELLED** en Vermilion.
  2. Plano por encima del hombro: Tom **saca el móvil y hace una foto** al panel. *Flash* blanco de 2 frames.
  3. *Freeze frame* de la foto → se convierte en captura real del agente en el móvil: la foto en el chat.
  4. Muse Spark marca **su fila** en la foto con un recuadro, la cruza con su reserva y responde: "That's your flight.
     Next one leaves 21:05 — seat 14C held. Switch?".
  5. Tom pulsa ✓. El panel ilustrado se actualiza: su fila pasa de CANCELLED a "REBOOKED · 21:05".
- **Animación:** *drop* de la música en el *flash*; *speed ramp* (cámara lenta → normal) al pulsar.
- **Texto:** "Snap the board. Get rebooked." · chip `MUSE SPARK 1.3 · VISION`.
- **Voz:** *"Travel day. Tom's flight is cancelled. He takes a photo of the board. Muse Spark finds his flight in the
  picture, matches it to his booking, and moves him to the next one — before the queue even forms."*
- **Sonido:** ambiente de aeropuerto, obturador de cámara, *drop*.
- **Estado:** **A CONSTRUIR** — foto al chat → visión → identificar vuelo y reserva → alternativa y cambio (§7, tarea E).

### Escena 5 — El mismo agente para agencias de viaje (B2B) · 2:12–2:34

- **Se ve:**
  1. Ilustración: mostrador de una agencia con una pila de emails y mensajes.
  2. Captura real de la **bandeja de la agencia**: entran peticiones ("Client needs Paris→Athens Tue, business,
     company policy applies"). Para cada una, el agente ya ha preparado opciones.
  3. Se sube la **política de viajes** de una empresa (PDF ficticio): el agente marca una opción "Out of policy:
     business class over 3 h only" y la sustituye por una que cumple.
  4. La persona de la agencia pulsa **Approve** → la reserva queda retenida a nombre del cliente.
- **Animación:** la pila de emails se "ordena" sola en tarjetas; el sello "Out of policy" cae con un rebote seco.
- **Texto:** "For travel agencies: the agent drafts, the policy is applied, the human approves." · chip
  `MUSE SPARK OPEN · BASETEN` (solo si esta escena corre de verdad en el modelo abierto).
- **Voz:** *"Travel agencies handle thousands of these requests by hand. Here the same agent drafts the options, applies
  the company's travel policy and holds the seats. The person at the desk just approves."*
- **Sonido:** papel que se ordena, sello.
- **Estado:** **A CONSTRUIR** — vista de bandeja + política en PDF leída por el modelo + aprobación (§7, tarea F).

### Escena 6 — Norba, la capa de reservas para cualquier asistente de IA · 2:34–2:52 (**el mensaje principal**)

- **Se ve:**
  1. Fondo Midnight. En el centro, la marca de Norba. Alrededor aparecen **iconos genéricos de asistentes**: una burbuja
     de chat, un altavoz, unas gafas, un coche, un terminal. **Sin logos de terceros.**
  2. Cada icono traza una línea hacia Norba; de Norba salen líneas hacia **"Airlines · NDC"** (bloque a la derecha).
     Etiqueta pequeña sobre Norba: "Norba API · pre-existing".
  3. Captura real: **otro asistente** (un terminal o una app mínima distinta de la nuestra) recibe "Book me MAD→ATH on
     the 11th, window seat" y, a través del **servidor MCP de Norba** (MCP, Model Context Protocol: el estándar para que
     una IA use herramientas), busca, retiene y devuelve el enlace de pago. Se ve la lista de herramientas MCP:
     `search_flights`, `hold_order`, `payment_link`, `order_status`, `change_order`.
  4. Las líneas de todos los asistentes se iluminan a la vez en Vermilion.
- **Animación:** red que crece desde el centro; *pulse* en Norba cuando pasa una reserva.
- **Texto (grande, en dos golpes):** **"Norba is the booking layer for any AI assistant."** → "One connection. Real
  airlines. Search, hold, book."
- **Voz:** *"And this is the part that matters most. Norba is the booking layer for any AI assistant. One connection,
  and any assistant — in a chat, an app, a car, a pair of glasses — can search, hold and book real flights with real
  airlines."*
- **Sonido:** la música baja a un pulso; un golpe por cada línea que se enciende.
- **Estado:** **A CONSTRUIR** — servidor MCP sobre las herramientas del agente + un segundo asistente que lo use (§7,
  tarea G). **Esta escena no se corta nunca.**

### Escena 7 — Cierre · 2:52–3:00

- **Se ve:** la ruta discontinua vuelve y dibuja la marca de Norba. Debajo, en columnas:
  - "Built during the hackathon: the agent · group trips · trip guardian · board-photo rebooking · agency inbox · Norba
    MCP"
  - "Meta models: Muse Spark 1.3 · Muse Spark Open · (Muse Voice Transcribe)"
  - "Pre-existing: the Norba API — our startup"
  - `github.com/Neufal777/norba-travels-agent` · `norba.io`
  - Logos de Meta y Cerebral Valley pequeños ("Meta Global AI Developer Hackathon").
- **Voz:** *"Norba Travels Agent. Built on Meta's models, during this hackathon, on top of Norba — our startup."*
- **Sonido:** acorde final, corte seco a negro.

**Total voz en off:** ~300 palabras (≈ 2:10 de voz sobre 3:00 de vídeo; el resto respira con música y efectos).

---

## 5. Voz en off completa (para grabar de una vez)

> Every assistant can talk about a trip. Almost none can actually book one.
>
> Trips start with a message. Ana gets a wedding invitation and forwards it — that's all. Muse Spark reads it: Athens,
> Saturday the twelfth, out Friday, back Sunday.
>
> Her friends live in four cities. So the agent splits into four — one per traveller, each with their own budget and
> timing — and a coordinator finds flights that land within the same hour. Real offers from real airlines, through
> Norba. The seats are held; everyone pays their own.
>
> Three weeks later the airline moves Ana's flight. She doesn't find out at midnight from an email. The agent already
> read the change, checked her fare rules, and found a better flight. One tap.
>
> Travel day. Tom's flight is cancelled. He takes a photo of the board. Muse Spark finds his flight in the picture,
> matches it to his booking, and moves him to the next one — before the queue even forms.
>
> Travel agencies handle thousands of these requests by hand. Here the same agent drafts the options, applies the
> company's travel policy and holds the seats. The person at the desk just approves.
>
> And this is the part that matters most. Norba is the booking layer for any AI assistant. One connection, and any
> assistant — in a chat, an app, a car, a pair of glasses — can search, hold and book real flights with real airlines.
>
> Norba Travels Agent. Built on Meta's models, during this hackathon, on top of Norba — our startup.

---

## 6. Material que hay que producir

### 6.1 Ilustraciones (After Effects, estilo `iso.tsx`)

Todas en línea blanca 1.25–1.5 px sobre Midnight con rejilla, Vermilion solo en el elemento clave de cada plano.

| # | Ilustración | Escena |
|---|---|---|
| I1 | Móvil sobre mesa recibiendo la invitación | 1 |
| I2 | Invitación de boda (diseño propio: "María & Nikos · Athens · 12 December 2026") | 1 |
| I3 | Mapa isométrico de Europa con MAD, CDG, MXP, LHR y ATH; cuatro rutas y cinco agentes | 2 |
| I4 | Línea de tiempo de llegadas con la ventana de 55 min | 2 |
| I5 | Cuatro móviles en fila con el enlace de pago y ✓ | 2 |
| I6 | Calendario que pasa páginas "3 weeks later" | 3 |
| I7 | Panel de salidas ilustrado (versión final con "REBOOKED · 21:05") | 4 |
| I8 | Mostrador de agencia con pila de mensajes | 5 |
| I9 | Red de asistentes genéricos (chat, altavoz, gafas, coche, terminal) → Norba → aerolíneas | 6 |
| I10 | Marca de Norba dibujándose con la ruta discontinua (apertura y cierre) | 0, 7 |

Aviones dibujados: **sin letras ni códigos de aerolínea** en el fuselaje.

### 6.2 Grabación real: la foto al panel (escena 4)

No se graba un panel real de aeropuerto (derechos y vuelos que no son los nuestros). En su lugar:

1. **Construimos el panel de salidas** como página web a pantalla completa (estilo FIDS, Flight Information Display
   System: fondo negro, letras ámbar/blancas, columnas Time · Flight · To · Gate · Remarks), con los vuelos del guion y
   el de Tom en **CANCELLED** parpadeando. (Tarea H.)
2. Se proyecta en una **tele o monitor grande** en un sitio con poca luz (o un pasillo que parezca terminal).
3. Se graba a Tom (una persona del equipo o un amigo, con su permiso) haciendo la foto con su móvil: plano por encima
   del hombro, plano detalle de la pantalla del móvil.
4. **Esa misma foto** se sube de verdad al agente: así la lectura de Muse Spark es real.

### 6.3 Capturas del producto

- Grabar sobre **build de producción** (`npm run build && npm start`), no en desarrollo: en desarrollo aparece la
  insignia de Next.js abajo a la izquierda.
- Tema oscuro, ventana 1440×900 escalada a 4K, zoom del navegador 110 %.
- Mejor con **Playwright** (grabación automática de vídeo del navegador): el mismo guion de clics cada vez, sin
  titubeos, con tiempos repetibles. Las escenas se pueden regrabar en minutos si algo cambia.
- Datos: los de §3; tarjeta `4242 4242 4242 4242`, caducidad futura, CVC `123`.

| Captura | Escena | Qué debe verse |
|---|---|---|
| C1 | 1 | Arrastrar la invitación al chat → respuesta con lugar y fechas → panel de pasos avanzando |
| C2 | 2 | Petición de grupo → cuatro itinerarios → "Hold all 4" → retenciones confirmadas |
| C3 | 2 | Enlace de pago abierto en móvil → pago → ✓ |
| C4 | 3 | Aviso de cambio → explicación → opciones → "Switch" → ✓ |
| C5 | 4 | Foto en el chat (móvil) → recuadro en su fila → alternativa → ✓ |
| C6 | 5 | Bandeja de agencia → política → "Out of policy" → Approve |
| C7 | 6 | Otro asistente usando el MCP de Norba: lista de herramientas → búsqueda → retención → enlace |

### 6.4 Sonido y música

- Música con licencia para uso comercial (Artlist, Musicbed o similar), 118–124 BPM, con *drop* claro.
- Efectos: *tick* de tipografía, notificación, *whoosh*, obturador de cámara, sello, ambiente de aeropuerto (con
  licencia).
- Voz: grabada en sitio silencioso, normalizada a −16 LUFS (unidad de sonoridad).

---

## 7. Lo que hay que construir antes de grabar

Hoy el producto hace: búsqueda en lenguaje natural, resultados en vivo, filtros, confirmación de precio, asientos,
extras, viajeros, revisión, pago con tarjeta y reserva, con el panel de 12 pasos. **Todo lo de este vídeo es nuevo y
está por construir.**

| Tarea | Para | Qué es | Modelo de Meta | Prioridad |
|---|---|---|---|---|
| **0** | todas | Conectar el modelo real (créditos de Meta o Baseten) | Muse Spark 1.3 / Open | **Bloqueante** |
| **G** | escena 6 | Servidor MCP de Norba (`search_flights`, `hold_order`, `payment_link`, `order_status`, `change_order`) + un asistente mínimo que lo use | Muse Spark (el otro asistente) | **Imprescindible** |
| **A** | escena 1 | Adjuntar imagen o PDF en el chat; Muse Spark extrae lugar, fechas y personas y lanza la búsqueda | Muse Spark · visión | **Imprescindible** |
| **E** | escena 4 | Foto del panel → visión identifica el vuelo → cruza con la reserva → alternativa y cambio | Muse Spark · visión | **Imprescindible** |
| **H** | escena 4 | Página del panel de salidas para grabar | — | **Imprescindible** (pequeña) |
| **B** | escena 2 | Viaje de grupo: un agente por viajero + coordinador; ventana de llegadas | Muse Spark · razonamiento alto | Alta |
| **C** | escena 2 | Retener sin pagar (*hold*) + enlace de pago por viajero | — | Alta |
| **D** | escena 3 | Aviso de cambio (simulado en mock) → explicación → alternativas → cambio | Muse Spark | Media |
| **F** | escena 5 | Bandeja de agencia + política de viajes en PDF + aprobar | Muse Spark Open (Baseten) | Media |
| **V** | opcional | Dictar por voz en el compositor | Muse Voice Transcribe | Baja |

Calendario propuesto (hoy es sábado 31 de octubre):

| Día | Trabajo |
|---|---|
| Sáb 31 – Dom 1 | Tarea 0 · A · E · H · G |
| Lun 2 | B · C · D |
| Mar 3 | F · capturas C1–C7 con Playwright · grabación del panel (6.2) · voz en off |
| Mié 4 | Montaje en After Effects, corte 9:16, subida, **entrega antes de las 18:00 ET** (margen de 3 h), post en X |

---

## 8. Si no da tiempo: qué se corta y cómo se redistribuye

Nunca se enseña algo que no funcione. Orden de corte, de primero a último:

1. **Escena 5 (agencias)** → sus 22 s pasan a la escena 6, que se queda con más captura del MCP. La idea de agencias
   se menciona solo en la voz de la escena 6: *"…the same layer travel agencies already use."*
2. **Escena 3 (guardián)** → sus 30 s pasan a la escena 2 (grupo con más detalle).
3. La **escena 6 (capa de reservas)** y la **escena 4 (foto del panel)** no se cortan.

---

## 9. Corte de 45 s para X (premio Most Viral)

9:16, 1080×1920, subtítulos grandes:

| Tiempo | Contenido |
|---|---|
| 0–3 s | "It still can't book it." → logo |
| 3–15 s | Escena 4 entera (foto al panel → recolocado). Es el momento más compartible. |
| 15–28 s | Escena 1 rápida (invitación → búsqueda) |
| 28–40 s | Escena 6: "Norba is the booking layer for any AI assistant." |
| 40–45 s | Repo + "Built with Meta's Muse Spark at #MetaHackathon" |

Publicar en X con el vídeo nativo (no enlace), mencionar a los organizadores y enviar el enlace del post en la
plataforma de la hackathon. El premio cuenta la interacción hasta el 8 de noviembre.

---

## 10. Lista de comprobación antes de entregar

- [ ] El vídeo dura ≤ 3:00 y el enlace es **público** (YouTube oculto o Vimeo, comprobado en una ventana privada).
- [ ] El rótulo "built during the hackathon / pre-existing" sale al principio y al final.
- [ ] Cada escena de producto es una captura real de algo que está en el repo.
- [ ] Los chips de modelo dicen la verdad (si la escena 5 no corre en Muse Spark Open, se quita su chip).
- [ ] Ningún logo de aerolínea, ningún dato personal real, ninguna tarjeta real.
- [ ] El repo público tiene el README con la sección de lo nuevo y lo previo, y los commits fechados del 30 oct al 4 nov.
- [ ] Producto en vivo desplegado con **clave sandbox** de Norba y límite de peticiones.
- [ ] Todas las personas del equipo listadas en la entrega; créditos de Meta pedidos por cada una.
- [ ] Post en X publicado y enlazado en la plataforma.
