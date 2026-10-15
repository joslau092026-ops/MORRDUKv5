# MORDUK V1 — Catálogo de comandos de voz

Catálogo incluido: **más de 220 ejemplos** en 26 categorías, incluyendo los comandos M.O.R.D.U.K. (principales, IA, voz estilo oscuro, Windows, programación, Obsidian), listas inteligentes y el filtro de seguridad que niega comandos peligrosos.

> Importante: los comandos `LOCAL` controlan la interfaz MORDUK. Los comandos `OPENCLAW` son instrucciones de ejemplo para el agente y necesitan las herramientas, permisos, configuración y contexto correspondientes. No todos pueden ejecutarse sin preparación adicional.

## Cómo usar la voz

1. Pulsa el botón 🎙 para dictar una sola orden.
2. Pulsa `∞` para activar la escucha continua. Di “MORDUK” antes de cada frase.
3. Vuelve a pulsar `∞` para apagar el micrófono continuo.
4. Pulsa `⌘ VOZ` para buscar y probar comandos.

## Comandos por categoría

### Control y ayuda

- **Mostrar comandos de voz** · `LOCAL`
  - Frase: “MORDUK, muestra todos los comandos de voz”
  - Abre el catálogo buscable de comandos.
- **Ayuda rápida** · `LOCAL`
  - Frase: “MORDUK, necesito ayuda”
  - Muestra ayuda y ejemplos de uso.
- **Qué puedes hacer** · `LOCAL`
  - Frase: “MORDUK, ¿qué puedes hacer?”
  - Explica las capacidades generales de MORDUK.
- **Comprobar OpenClaw** · `LOCAL`
  - Frase: “MORDUK, comprueba la conexión con OpenClaw”
  - Verifica la CLI y el Gateway configurados.
- **Abrir panel de OpenClaw** · `LOCAL`
  - Frase: “MORDUK, abre el panel de OpenClaw”
  - Solicita abrir el dashboard de OpenClaw.
- **Limpiar conversación** · `LOCAL`
  - Frase: “MORDUK, limpia la conversación”
  - Borra los mensajes visibles de la sesión actual.
- **Repetir última respuesta** · `LOCAL`
  - Frase: “MORDUK, repite tu última respuesta”
  - Vuelve a pronunciar la última respuesta disponible.
- **Decir la hora** · `LOCAL`
  - Frase: “MORDUK, dime la hora”
  - Lee la hora local del equipo.
- **Explicar un comando** · `AGENTE`
  - Frase: “MORDUK, explícame cómo debo pedirte una tarea”
  - Pide ejemplos y una explicación adaptada.
- **Planificar una tarea** · `AGENTE`
  - Frase: “MORDUK, divide esta tarea en pasos y dime el plan antes de ejecutarla”
  - Solicita planificación antes de actuar.
- **Resumir sesión** · `AGENTE`
  - Frase: “MORDUK, resume lo que hemos hecho y cuál es el siguiente paso”
  - Resume el contexto de trabajo.
- **Analizar una idea** · `AGENTE`
  - Frase: “MORDUK, analiza esta idea y dime sus ventajas, riesgos y mejoras”
  - Obtiene análisis y recomendaciones.
- **Pedir confirmación antes de actuar** · `AGENTE`
  - Frase: “MORDUK, antes de modificar nada, explícame los cambios y pídeme autorización”
  - Refuerza confirmaciones para acciones sensibles.

### Utilidades del PC

- **Calcular** · `LOCAL`
  - Frase: “MORDUK, cuánto es 45 por 78”
  - Calculadora segura: también suma, resta, división, potencias y raíz cuadrada; si no es una operación clara, lo resuelve el agente.
- **Estado del equipo** · `LOCAL`
  - Frase: “MORDUK, ¿cómo está el PC?”
  - RAM libre, núcleos y tiempo encendido.
- **Abrir una web** · `LOCAL`
  - Frase: “MORDUK, abre YouTube”
  - Sitios conocidos o cualquier dirección; si no hay destino claro, lo pregunta el agente.
- **Abrir una app** · `LOCAL`
  - Frase: “MORDUK, abre la calculadora”
  - Calculadora, bloc de notas, Paint, explorador, terminal o administrador de tareas.
- **Lanzar un dado** · `LOCAL`
  - Frase: “MORDUK, lanza un dado de 20 caras”
  - Aleatorio de 2 a 1000 caras.
- **Lanzar una moneda** · `LOCAL`
  - Frase: “MORDUK, lanza una moneda”
  - Cara o cruz.
- **Contar un chiste** · `LOCAL`
  - Frase: “MORDUK, cuéntame un chiste”
  - Repertorio de chistes de programación.
- **Temporizador** · `LOCAL`
  - Frase: “MORDUK, pon un temporizador de 10 minutos”
  - Te avisa por voz cuando termina.
- **Recordatorio** · `LOCAL`
  - Frase: “MORDUK, recuérdame en 20 minutos que apagar el horno”
  - Aviso por voz con el texto que indiques.
- **Listar temporizadores** · `LOCAL`
  - Frase: “MORDUK, cuántos temporizadores activos hay”
  - Muestra los pendientes y el tiempo restante.
- **Cancelar temporizadores** · `LOCAL`
  - Frase: “MORDUK, cancela los temporizadores”
  - Borra todos los pendientes.
- **Leer el portapapeles** · `LOCAL`
  - Frase: “MORDUK, lee el portapapeles”
  - Lee en voz alta lo que hay copiado.

### Conversación alegre

- **Pedir motivación** · `LOCAL`
  - Frase: “MORDUK, motívame”
  - Inyección de ánimo al instante; también con «estoy cansado», «dame ánimo».

### Doctor del Gateway

- **Diagnóstico del Gateway** · `LOCAL`
  - Frase: “MORDUK, ¿por qué no respondes?”
  - Revisa OpenClaw y el Gateway, y explica qué falta.
- **Iniciar el Gateway** · `LOCAL`
  - Frase: “MORDUK, inicia el gateway”
  - Pide confirmación antes de intentar arrancar el Gateway.
- **Confirmar acción pendiente** · `LOCAL`
  - Frase: “MORDUK, confirma”
  - Autoriza la acción que MORDUK dejó pendiente.
- **Cancelar acción pendiente** · `LOCAL`
  - Frase: “MORDUK, cancela”
  - Descarta la acción pendiente sin hacer nada.

### Poderes del PC

- **Subir / bajar el volumen** · `LOCAL`
  - Frase: “MORDUK, sube el volumen”
- **Silenciar el sonido** · `LOCAL`
  - Frase: “MORDUK, silencia el volumen”
- **Play / pausa de la música** · `LOCAL`
  - Frase: “MORDUK, pausa la música”
- **Siguiente / anterior pista** · `LOCAL`
  - Frase: “MORDUK, siguiente canción”
- **Captura de pantalla** · `LOCAL`
  - Frase: “MORDUK, toma una captura de pantalla”
  - Guarda PNG en «MORDUK Capturas» del escritorio.
- **Estado de la batería** · `LOCAL`
  - Frase: “MORDUK, cuánta batería queda”
- **Dirección IP** · `LOCAL`
  - Frase: “MORDUK, cuál es mi IP”
  - Local y pública.
- **Ajustar brillo** · `LOCAL`
  - Frase: “MORDUK, pon el brillo en 80”
  - Requiere portátil o monitor compatible.
- **Procesos con más CPU** · `LOCAL`
  - Frase: “MORDUK, qué programas están consumiendo”
- **Bloquear pantalla** · `LOCAL` (con confirmación)
  - Frase: “MORDUK, bloquea la pantalla” · luego “confirma”
- **Cerrar un programa** · `LOCAL` (con confirmación)
  - Frase: “MORDUK, cierra el programa Spotify” · luego “confirma”
- **Vaciar la papelera** · `LOCAL` (con confirmación)
  - Frase: “MORDUK, vacía la papelera” · luego “confirma”

### Modo conversación

- **Activar modo conversación** · `LOCAL`
  - Frase: “MORDUK, activa el modo conversación”
  - Tras cada respuesta puedes seguir hablando sin decir MORDUK.
- **Volver al modo normal** · `LOCAL`
  - Frase: “MORDUK, modo normal”
  - Vuelve a exigir la palabra de activación.

### Memoria y aprendizaje

- **Guardar un recuerdo** · `LOCAL`
  - Frase: “MORDUK, recuerda que mi proyecto principal se llama Nébula”
  - Guarda un dato permanente en la memoria de MORDUK.
- **Preguntar qué recuerda** · `LOCAL`
  - Frase: “MORDUK, ¿qué recuerdas?”
  - Lista lo que hay en la memoria persistente.
- **Borrar la memoria** · `LOCAL`
  - Frase: “MORDUK, olvida todo lo que sabes”
  - Borra los datos guardados en la memoria.
- **Enseñar un comando** · `LOCAL`
  - Frase: “MORDUK, cuando diga modo trabajo, abre el catálogo”
  - Crea un comando personalizado que queda guardado.
- **Listar comandos aprendidos** · `LOCAL`
  - Frase: “MORDUK, qué comandos personalizados conoces”
  - Muestra los comandos que le has enseñado.
- **Olvidar un comando** · `LOCAL`
  - Frase: “MORDUK, olvida el comando modo trabajo”
  - Borra uno o todos los comandos personalizados.
- **Retomar la sesión anterior** · `LOCAL`
  - Frase: “MORDUK, retoma la sesión anterior”
  - Recupera el contexto de la conversación previa.
- **Resumen de la sesión** · `LOCAL`
  - Frase: “MORDUK, resumen de esta sesión”
  - Indica cuántas órdenes ha habido y cuál fue la última.

### Respuestas largas

- **Continuar una respuesta** · `AGENTE`
  - Frase: “MORDUK, continúa donde te quedaste”
  - Pide el resto de una respuesta larga sin repetir lo anterior.
- **Ampliar una respuesta** · `AGENTE`
  - Frase: “MORDUK, dame más detalle de lo anterior”
  - Pide profundizar con ejemplos concretos, sin límite de extensión.

### Voz y conversación

- **Activar respuestas habladas** · `LOCAL`
  - Frase: “MORDUK, activa tu voz”
  - Activa la lectura de respuestas.
- **Silenciar respuestas habladas** · `LOCAL`
  - Frase: “MORDUK, silencia tu voz”
  - Desactiva la lectura de respuestas.
- **Detener voz actual** · `LOCAL`
  - Frase: “MORDUK, deja de hablar”
  - Detiene la lectura de voz actual.
- **Hablar más despacio** · `LOCAL`
  - Frase: “MORDUK, habla más despacio”
  - Reduce la velocidad de la voz.
- **Hablar más rápido** · `LOCAL`
  - Frase: “MORDUK, habla más rápido”
  - Aumenta la velocidad de la voz.
- **Velocidad normal** · `LOCAL`
  - Frase: “MORDUK, vuelve a la velocidad normal”
  - Restablece la velocidad predeterminada.
- **Activar escucha continua** · `LOCAL`
  - Frase: “MORDUK, activa la escucha continua”
  - Modo de manos libres; exige decir “MORDUK” antes de cada orden.
- **Desactivar escucha continua** · `LOCAL`
  - Frase: “MORDUK, desactiva la escucha continua”
  - Detiene el modo de escucha continua.
- **Abrir centro** · `LOCAL`
  - Frase: “MORDUK, abre el centro”
  - Selecciona el panel central de la interfaz.
- **Abrir panel de proyectos** · `LOCAL`
  - Frase: “MORDUK, abre el panel de proyectos”
  - Selecciona el panel visual de proyectos.
- **Abrir panel de memoria** · `LOCAL`
  - Frase: “MORDUK, abre el panel de memoria”
  - Selecciona el panel visual de memoria.
- **Abrir panel de skills** · `LOCAL`
  - Frase: “MORDUK, abre el panel de skills”
  - Selecciona el panel visual de skills.
- **Abrir panel de herramientas** · `LOCAL`
  - Frase: “MORDUK, abre el panel de herramientas”
  - Selecciona el panel visual de herramientas.

### PC y aplicaciones

- **Abrir VS Code** · `AGENTE`
  - Frase: “MORDUK, abre Visual Studio Code”
  - Requiere herramienta autorizada para abrir aplicaciones.
- **Abrir una carpeta en VS Code** · `AGENTE`
  - Frase: “MORDUK, abre mi proyecto actual en VS Code”
  - Requiere conocer la ruta y disponer de herramientas locales.
- **Abrir el explorador de archivos** · `AGENTE`
  - Frase: “MORDUK, abre el explorador de archivos”
  - Requiere herramienta de control del PC.
- **Abrir el navegador** · `AGENTE`
  - Frase: “MORDUK, abre el navegador y busca documentación de JavaScript”
  - Requiere navegador o herramienta de escritorio.
- **Abrir la terminal** · `AGENTE`
  - Frase: “MORDUK, abre una terminal en la carpeta del proyecto”
  - Requiere permisos para operar con la terminal.
- **Abrir Bloc de notas** · `AGENTE`
  - Frase: “MORDUK, abre el Bloc de notas”
  - Requiere herramienta local de aplicaciones.
- **Abrir calculadora** · `AGENTE`
  - Frase: “MORDUK, abre la calculadora de Windows”
  - Requiere herramienta local de aplicaciones.
- **Buscar un archivo** · `AGENTE`
  - Frase: “MORDUK, busca el archivo README dentro de mi proyecto”
  - Requiere acceso autorizado a archivos.
- **Ver especificaciones del PC** · `AGENTE`
  - Frase: “MORDUK, revisa las especificaciones de mi PC y resume CPU, RAM y sistema”
  - Requiere herramientas locales de diagnóstico.
- **Revisar espacio disponible** · `AGENTE`
  - Frase: “MORDUK, revisa cuánto espacio libre queda en mis discos”
  - Requiere acceso autorizado al sistema.
- **Organizar archivos** · `AGENTE`
  - Frase: “MORDUK, propón una forma de organizar esta carpeta sin borrar nada”
  - Primero solicita una propuesta; no borra archivos.

### Archivos y documentos

- **Crear un archivo** · `AGENTE`
  - Frase: “MORDUK, crea un archivo README con instrucciones para mi proyecto”
  - Requiere permiso de escritura en la carpeta elegida.
- **Leer un documento** · `AGENTE`
  - Frase: “MORDUK, lee este documento y resúmelo”
  - Requiere acceso al documento.
- **Resumir una carpeta** · `AGENTE`
  - Frase: “MORDUK, revisa la estructura de esta carpeta y explica para qué sirve cada archivo”
  - Requiere acceso autorizado a los archivos.
- **Buscar texto** · `AGENTE`
  - Frase: “MORDUK, busca dónde se define la función handleCommand”
  - Requiere acceso al código fuente.
- **Comparar archivos** · `AGENTE`
  - Frase: “MORDUK, compara estos dos archivos y dime qué cambió”
  - Requiere acceso a ambos archivos.
- **Renombrar un archivo** · `AGENTE`
  - Frase: “MORDUK, propón un nombre mejor para este archivo y espera mi aprobación”
  - Debe confirmar antes de renombrar.
- **Crear copia de seguridad** · `AGENTE`
  - Frase: “MORDUK, crea una copia de seguridad del proyecto antes de modificarlo”
  - Requiere acceso de escritura y espacio disponible.
- **Ordenar fotos** · `AGENTE`
  - Frase: “MORDUK, diseña un plan para clasificar estas imágenes por fecha y tipo”
  - Requiere acceso a la carpeta; pedir confirmación antes de mover.
- **Generar informe** · `AGENTE`
  - Frase: “MORDUK, genera un informe Markdown de los cambios realizados”
  - Requiere acceso de escritura al proyecto.
- **Convertir formato** · `AGENTE`
  - Frase: “MORDUK, dime la forma más segura de convertir este archivo a PDF”
  - Depende de las herramientas instaladas.
- **Encontrar duplicados** · `AGENTE`
  - Frase: “MORDUK, identifica posibles archivos duplicados sin eliminarlos”
  - Requiere análisis de archivos.
- **Explicar un archivo** · `AGENTE`
  - Frase: “MORDUK, explícame este archivo línea por línea”
  - Requiere acceso al archivo.

### Programación y depuración

- **Crear un proyecto** · `AGENTE`
  - Frase: “MORDUK, crea la estructura inicial de un proyecto JavaScript”
  - Requiere permiso de escritura y una ruta de destino.
- **Crear una función** · `AGENTE`
  - Frase: “MORDUK, escribe una función que valide un correo electrónico y añade pruebas”
  - Requiere acceso al código si debe editarse directamente.
- **Revisar errores** · `AGENTE`
  - Frase: “MORDUK, analiza los errores de la terminal y encuentra la causa raíz”
  - Requiere salida de terminal o logs.
- **Corregir un bug** · `AGENTE`
  - Frase: “MORDUK, encuentra y corrige el bug sin cambiar el comportamiento esperado”
  - Requiere lectura/escritura autorizada del proyecto.
- **Ejecutar pruebas** · `AGENTE`
  - Frase: “MORDUK, identifica las pruebas del proyecto y ejecútalas”
  - Requiere herramientas de terminal permitidas.
- **Crear pruebas unitarias** · `AGENTE`
  - Frase: “MORDUK, escribe pruebas unitarias para esta función”
  - Requiere inspección del código.
- **Refactorizar código** · `AGENTE`
  - Frase: “MORDUK, refactoriza este módulo manteniendo la compatibilidad”
  - Debe revisar diffs y pruebas.
- **Explicar código** · `AGENTE`
  - Frase: “MORDUK, explícame este código como si estuviera aprendiendo”
  - Requiere contexto del código.
- **Optimizar rendimiento** · `AGENTE`
  - Frase: “MORDUK, busca cuellos de botella y propón optimizaciones medibles”
  - Requiere perfiles o mediciones para confirmar mejoras.
- **Instalar dependencias** · `AGENTE`
  - Frase: “MORDUK, revisa las dependencias faltantes y explícame cómo instalarlas”
  - Solicita autorización antes de instalar o ejecutar cambios.
- **Actualizar documentación** · `AGENTE`
  - Frase: “MORDUK, actualiza el README para reflejar el código actual”
  - Requiere permiso para editar documentación.
- **Revisar seguridad** · `AGENTE`
  - Frase: “MORDUK, revisa el proyecto en busca de claves expuestas y riesgos de seguridad”
  - No debe mostrar ni copiar secretos.
- **Preparar Git** · `AGENTE`
  - Frase: “MORDUK, revisa los cambios de Git y prepara un mensaje de commit”
  - Requiere Git disponible; no publica sin confirmación.
- **Crear rama Git** · `AGENTE`
  - Frase: “MORDUK, propón un nombre para una nueva rama y explícame el comando”
  - No ejecuta hasta que lo autorices si la política lo exige.
- **Resolver conflicto Git** · `AGENTE`
  - Frase: “MORDUK, analiza este conflicto de Git y propón una resolución segura”
  - Requiere acceso al repositorio y diff.
- **Explicar dependencias** · `AGENTE`
  - Frase: “MORDUK, explica para qué sirve cada dependencia de package.json”
  - Requiere leer package.json.

### Desarrollo de videojuegos

- **Diseñar un juego** · `AGENTE`
  - Frase: “MORDUK, convierte esta idea en un documento de diseño de videojuego”
  - Genera mecánicas, bucle principal y alcance.
- **Crear personaje** · `AGENTE`
  - Frase: “MORDUK, diseña un personaje con estadísticas, habilidades y progresión”
  - Requiere contexto del motor o proyecto si debe implementarlo.
- **Crear un jefe** · `AGENTE`
  - Frase: “MORDUK, diseña un jefe con tres fases, ataques y recompensas exclusivas”
  - Propone mecánicas y especificaciones.
- **Crear un bioma** · `AGENTE`
  - Frase: “MORDUK, diseña un bioma con clima, criaturas, estructuras y recursos”
  - Genera una especificación integrable.
- **Crear armadura** · `AGENTE`
  - Frase: “MORDUK, diseña una armadura única con estadísticas, efectos y receta”
  - Adapta la propuesta al sistema de objetos existente.
- **Balancear combate** · `AGENTE`
  - Frase: “MORDUK, revisa el balance de armas, enemigos y progresión”
  - Necesita datos de juego para balance verificable.
- **Diseñar una misión** · `AGENTE`
  - Frase: “MORDUK, crea una misión con objetivos, recompensas y consecuencias”
  - Genera una misión coherente con el mundo.
- **Analizar rendimiento del juego** · `AGENTE`
  - Frase: “MORDUK, revisa el rendimiento del juego y prioriza las causas de bajo FPS”
  - Requiere logs, perfiles o métricas para comprobar.
- **Preparar versión beta** · `AGENTE`
  - Frase: “MORDUK, crea una lista de comprobación para publicar una beta cerrada”
  - Incluye pruebas, copias de seguridad y distribución.
- **Revisar arquitectura** · `AGENTE`
  - Frase: “MORDUK, revisa la arquitectura del videojuego y detecta dependencias problemáticas”
  - Requiere leer la estructura del proyecto.
- **Diseñar interfaz de juego** · `AGENTE`
  - Frase: “MORDUK, diseña un HUD legible para combate, vida, energía e inventario”
  - Puede describir o modificar archivos si hay herramientas disponibles.
- **Crear sistema de guardado** · `AGENTE`
  - Frase: “MORDUK, diseña un sistema de guardado con validación y recuperación”
  - Se adapta al motor de juego elegido.

### Minecraft y mods

- **Comprobar compatibilidad de mods** · `AGENTE`
  - Frase: “MORDUK, revisa si estos mods son compatibles con Minecraft Java 1.20.1 Forge”
  - Necesita los nombres y versiones de los mods.
- **Analizar crash report** · `AGENTE`
  - Frase: “MORDUK, analiza este crash report de Minecraft y encuentra el mod causante”
  - Requiere leer el log completo.
- **Crear lista de mods** · `AGENTE`
  - Frase: “MORDUK, organiza una lista de mods Forge por combate, jefes, biomas y optimización”
  - Debe verificar versiones si se requiere actualidad.
- **Diseñar un jefe de Minecraft** · `AGENTE`
  - Frase: “MORDUK, diseña un jefe para mi modpack con fases y botín único”
  - Genera diseño adaptable a las APIs disponibles.
- **Crear receta** · `AGENTE`
  - Frase: “MORDUK, diseña una receta equilibrada para fabricar este objeto”
  - Debe conocer el sistema de recetas del mod.
- **Optimizar modpack** · `AGENTE`
  - Frase: “MORDUK, propone pruebas para encontrar qué mod reduce los FPS”
  - Requiere logs y pruebas comparables.
- **Revisar dependencias Forge** · `AGENTE`
  - Frase: “MORDUK, busca dependencias faltantes en este registro de Forge”
  - Requiere leer el registro de arranque.
- **Preparar servidor** · `AGENTE`
  - Frase: “MORDUK, crea una lista de pasos para preparar un servidor Forge seguro”
  - Debe adaptarse al proveedor y sistema operativo.

### Web e investigación

- **Investigar en la web** · `AGENTE`
  - Frase: “MORDUK, investiga este tema con fuentes fiables y resume los hallazgos”
  - Requiere búsqueda web habilitada.
- **Buscar documentación oficial** · `AGENTE`
  - Frase: “MORDUK, busca la documentación oficial de esta biblioteca”
  - Requiere herramienta de búsqueda/navegador.
- **Comparar tecnologías** · `AGENTE`
  - Frase: “MORDUK, compara Electron, Tauri y una aplicación web para este proyecto”
  - Distingue ventajas, límites y costos.
- **Verificar información actual** · `AGENTE`
  - Frase: “MORDUK, verifica si esta información sigue vigente y cita las fuentes”
  - Requiere búsqueda web.
- **Abrir página web** · `AGENTE`
  - Frase: “MORDUK, abre la página oficial de OpenClaw”
  - Requiere navegador/herramienta autorizada.
- **Resumir una página** · `AGENTE`
  - Frase: “MORDUK, resume esta página web y extrae sus pasos importantes”
  - Requiere URL y herramienta web.
- **Comparar productos o servicios** · `AGENTE`
  - Frase: “MORDUK, compara estas opciones por precio, funciones y riesgos”
  - Requiere datos proporcionados o búsqueda web.
- **Guardar fuentes** · `AGENTE`
  - Frase: “MORDUK, registra los enlaces y las fechas de las fuentes usadas”
  - Requiere generar un archivo o nota.

### Proyectos y productividad

- **Plan diario** · `AGENTE`
  - Frase: “MORDUK, organiza mis tareas de hoy por prioridad y duración”
  - Genera plan; no crea calendario externo automáticamente.
- **Dividir tarea grande** · `AGENTE`
  - Frase: “MORDUK, divide este proyecto en fases y criterios de aceptación”
  - Produce una hoja de ruta verificable.
- **Crear checklist** · `AGENTE`
  - Frase: “MORDUK, convierte este plan en una lista de verificación”
  - Entrega tareas concretas.
- **Preparar reunión** · `AGENTE`
  - Frase: “MORDUK, prepara agenda, preguntas y resumen para esta reunión”
  - Necesita el tema/contexto.
- **Redactar correo** · `AGENTE`
  - Frase: “MORDUK, redacta un correo profesional con este objetivo”
  - No lo envía sin integración y autorización.
- **Crear informe semanal** · `AGENTE`
  - Frase: “MORDUK, resume avances, bloqueos y próximos pasos de mi proyecto”
  - Requiere historial o datos del proyecto.
- **Priorizar errores** · `AGENTE`
  - Frase: “MORDUK, ordena estos bugs por impacto y urgencia”
  - Entrega criterio de priorización.
- **Estimar alcance** · `AGENTE`
  - Frase: “MORDUK, divide esta idea en versión mínima y mejoras futuras”
  - Da una estimación relativa, no garantiza plazos.

### Memoria y personalización

- **Recordar una preferencia** · `AGENTE`
  - Frase: “MORDUK, guarda como preferencia que quiero respuestas en español”
  - Solo persiste si la memoria real está configurada.
- **Recordar proyecto actual** · `AGENTE`
  - Frase: “MORDUK, resume el estado de mi proyecto para retomarlo después”
  - Requiere contexto del proyecto; guardar depende de memoria.
- **Consultar contexto anterior** · `AGENTE`
  - Frase: “MORDUK, ¿qué decisiones tomamos sobre este proyecto?”
  - Depende de historial/sesión disponible.
- **Olvidar un dato** · `AGENTE`
  - Frase: “MORDUK, localiza la preferencia guardada sobre este tema y elimínala si existe”
  - Solo si hay una herramienta de memoria con eliminación habilitada.
- **Actualizar ficha de proyecto** · `AGENTE`
  - Frase: “MORDUK, actualiza la ficha de este proyecto con objetivos, estado y pendientes”
  - Requiere archivo de ficha y permiso de escritura.
- **Crear una skill** · `AGENTE`
  - Frase: “MORDUK, crea un borrador de skill para revisar errores de JavaScript”
  - Debe revisar el archivo antes de instalarla.
- **Explicar una skill** · `AGENTE`
  - Frase: “MORDUK, explícame qué hace esta skill y qué permisos necesita”
  - Requiere leer la definición de la skill.
- **Evaluar una nueva skill** · `AGENTE`
  - Frase: “MORDUK, evalúa esta skill por utilidad, seguridad y consumo de tokens”
  - Recomienda revisión antes de instalar.

### OpenClaw y herramientas

- **Diagnosticar OpenClaw** · `AGENTE`
  - Frase: “MORDUK, diagnostica OpenClaw y dime qué parte está desconectada”
  - Requiere comandos de diagnóstico habilitados.
- **Listar herramientas disponibles** · `AGENTE`
  - Frase: “MORDUK, dime qué herramientas tienes disponibles realmente en esta sesión”
  - Responde a partir de las herramientas expuestas.
- **Comprobar MCP** · `AGENTE`
  - Frase: “MORDUK, revisa qué servidores MCP están conectados y cuáles fallan”
  - Requiere acceso a la configuración/estado MCP.
- **Proponer una integración MCP** · `AGENTE`
  - Frase: “MORDUK, diseña la integración MCP para esta herramienta y lista sus permisos”
  - No instala servidores sin autorización.
- **Revisar el modelo** · `AGENTE`
  - Frase: “MORDUK, dime qué modelo está configurado y cómo cambiarlo de forma segura”
  - Requiere consultar configuración de OpenClaw.
- **Reducir consumo** · `AGENTE`
  - Frase: “MORDUK, sugiere cómo reducir el consumo de tokens sin perder calidad”
  - Requiere analizar tareas y configuración.
- **Revisar logs** · `AGENTE`
  - Frase: “MORDUK, revisa los logs recientes de OpenClaw y resume los errores”
  - Requiere acceso a los registros.
- **Crear tarea repetitiva** · `AGENTE`
  - Frase: “MORDUK, diseña una automatización para revisar mis pruebas cada vez que cambie el código”
  - Requiere herramientas de automatización disponibles.

### Diseño, imágenes y medios

- **Crear concepto visual** · `AGENTE`
  - Frase: “MORDUK, redacta un prompt para crear un concepto visual futurista de mi juego”
  - Genera una descripción/prompt; imagen depende de herramientas conectadas.
- **Diseñar logotipo** · `AGENTE`
  - Frase: “MORDUK, prepara tres direcciones de diseño para el logotipo de MORDUK”
  - Genera propuestas; renderizado depende de herramientas conectadas.
- **Crear guion de tráiler** · `AGENTE`
  - Frase: “MORDUK, escribe un guion de tráiler de 30 segundos para mi videojuego”
  - Incluye planos, voz y ritmo.
- **Crear historia** · `AGENTE`
  - Frase: “MORDUK, escribe una escena narrativa con diálogo y decisiones”
  - Respeta el tono y el universo definido.
- **Diseñar sonido** · `AGENTE`
  - Frase: “MORDUK, diseña una identidad sonora y efectos para activar MORDUK”
  - Entrega brief; audio real requiere herramienta compatible.
- **Mejorar una imagen** · `AGENTE`
  - Frase: “MORDUK, analiza esta imagen y propone mejoras de composición y resolución”
  - Necesita que la imagen esté adjunta o accesible.
- **Plan de contenidos** · `AGENTE`
  - Frase: “MORDUK, crea un plan de contenidos para promocionar mi videojuego”
  - Entrega calendario y formatos sugeridos.
- **Crear locución** · `AGENTE`
  - Frase: “MORDUK, prepara una locución masculina natural para este texto”
  - Genera texto/indicaciones; audio dedicado depende de herramientas.

### Aprendizaje

- **Explicar paso a paso** · `AGENTE`
  - Frase: “MORDUK, enséñame este tema desde cero con un ejemplo práctico”
  - Adapta la explicación al nivel del usuario.
- **Crear ejercicios** · `AGENTE`
  - Frase: “MORDUK, crea cinco ejercicios de programación con soluciones y pistas”
  - Entrega ejercicios graduados.
- **Revisar mi solución** · `AGENTE`
  - Frase: “MORDUK, revisa mi solución, encuentra fallos y dame pistas antes de la respuesta”
  - Prioriza aprendizaje y explicación.
- **Practicar entrevista** · `AGENTE`
  - Frase: “MORDUK, hazme una entrevista técnica y evalúa mis respuestas una por una”
  - Interactúa por turnos.
- **Aprender Git** · `AGENTE`
  - Frase: “MORDUK, enséñame Git con comandos seguros y ejemplos”
  - Distingue comandos de solo lectura y los que modifican repositorios.
- **Explicar una API** · `AGENTE`
  - Frase: “MORDUK, explícame cómo usar esta API con un ejemplo mínimo”
  - Requiere nombre/versión de API.

### Seguridad y permisos

- **Vista previa antes de cambiar** · `AGENTE`
  - Frase: “MORDUK, muestra el plan y el diff antes de escribir cambios”
  - Debe usar vista previa/diff cuando la herramienta lo permita.
- **No borrar nada** · `AGENTE`
  - Frase: “MORDUK, analiza esta carpeta, pero no borres ni muevas archivos”
  - Solicita modo de solo lectura.
- **Confirmar comando peligroso** · `AGENTE`
  - Frase: “MORDUK, explícame el riesgo de este comando antes de ejecutarlo”
  - Analiza impacto sin ejecutarlo.
- **Revisar secretos** · `AGENTE`
  - Frase: “MORDUK, busca posibles claves API expuestas sin imprimir sus valores”
  - Evita revelar secretos en pantalla o registros.
- **Preparar restauración** · `AGENTE`
  - Frase: “MORDUK, prepara un plan para restaurar el proyecto si algo falla”
  - Incluye respaldo y pasos de recuperación.

## Límites y seguridad

- No digas contraseñas, claves API ni datos privados frente al micrófono.
- Antes de borrar, sobrescribir, instalar software, publicar código o ejecutar comandos delicados, revisa el plan y confirma explícitamente.
- Para tareas de PC, archivos, terminal o navegador se requiere integración real en OpenClaw. El catálogo no habilita permisos por sí solo.
- La escucha continua requiere el micrófono abierto mientras esté activa; usa la palabra de activación y desactívala cuando termines.
