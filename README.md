# 📅 Planificador Semanal Profesional

Un planificador inteligente con repeticiones de tareas, ciclos personalizados y exportación a PDF. Completamente funcional sin necesidad de backend.

## 🎯 Características

### ✨ Tipos de Repetición
- **Sin repetición**: Tarea única
- **Cada día**: Tarea diaria
- **Cada N días**: Cada 3, 7, 30, 90 días, etc.
- **Días específicos**: Personaliza qué días de la semana
- **Ciclos personalizados**: Semanas diferentes dentro del mismo ciclo (ej: turnos rotativos)

### 📊 Vistas y Exportación
- **Vista semanal dinámica**: Visualiza todas tus tareas por semana
- **Exportar a PDF**: Genera calendarios profesionales
  - Resto del mes actual
  - N semanas personalizadas
  - Mes completo específico
  - Exportación automática en A4 horizontal

### 💾 Gestión de Datos
- **LocalStorage**: Todos tus datos se guardan automáticamente
- **Backup JSON**: Exporta e importa tus tareas
- **Sincronización**: Sin necesidad de servidor

### 📱 Responsive
- Totalmente adaptado a móviles, tablets y desktop
- Interfaz intuitiva y moderna
- Modo oscuro optimizado

## 🚀 Instalación

1. Coloca todos los archivos en tu servidor web o carpeta local:
```
index.html
index.js
index.css
baseTarea.js
nDays.js
limitedTime.js
daysOfWeek.js
main.js
```

2. Abre `index.html` en tu navegador

3. ¡Listo! No requiere instalación adicional

## 📚 Uso

### Agregar una tarea
1. Escribe el nombre de la tarea
2. Selecciona el tipo de repetición
3. Configura los parámetros (si es necesario)
4. Establece las repeticiones por día
5. Presiona "Agregar/Guardar"

### Tipos de repetición disponibles

#### Sin repetición / Diaria
- Sin opciones adicionales
- Se repite según lo configurado

#### Cada N días
- Define cada cuántos días se repite
- Establece desde qué día inicia
- Ejemplo: Cada 3 días desde el lunes

#### Días específicos
- Selecciona los días de la semana
- Se repite cada semana en esos días
- Ejemplo: Lunes, Miércoles, Viernes

#### Ciclo personalizado
- Define semanas diferentes
- Cada semana puede tener diferentes días
- Ejemplo: Semana 1 (Lun,Mié,Vie), Semana 2 (Mar,Jue)
- Perfecto para turnos rotativos

### Exportar PDF
1. Configura tu fecha de inicio
2. Agrega todas tus tareas
3. Elige el tipo de exportación:
   - **Resto del mes**: Desde hoy hasta fin de mes
   - **N semanas**: Las próximas semanas que especifiques
   - **Mes completo**: Un mes específico en PDF

### Respaldo de datos
- Los datos se guardan automáticamente en LocalStorage
- Usa "Exportar JSON" para crear un respaldo
- Usa "Importar JSON" para restaurar desde un respaldo
- Puedes compartir el JSON con otras personas

## 🏗️ Estructura de archivos

### Clases base (Sistema de tareas)
- **baseTarea.js**: Clase base para todas las tareas
- **nDays.js**: Tareas que se repiten cada N días
- **limitedTime.js**: Tareas limitadas en tiempo
- **daysOfWeek.js**: Tareas por días específicos de la semana

### Interfaz de usuario
- **index.html**: HTML con estructura y elementos
- **index.css**: Estilos modernos y responsive
- **index.js**: Lógica de la aplicación y eventos

### Funciones auxiliares
- **main.js**: Funciones de cálculo, conversión JSON y utilidades

## 💻 Desarrollo

### Estructura de datos de una tarea

```javascript
{
  id: 1,
  name: "Ejercicio",
  completed: false,
  pattern: {
    type: "daily", // "daily" | "days-interval" | "specific-days" | "cycle" | undefined
    days: null,           // Para "specific-days": [0,2,4] (Lun, Mié, Vie)
    weeks: [],            // Para "cycle": [[0,2,4], [1,3]]
    startDay: 0,          // Para "days-interval": día inicial
    timesPerDay: 1        // Repeticiones por día
  }
}
```

### Agregar una nueva característica

1. Edita `index.html` para agregar la UI
2. Edita `index.css` si necesitas estilos
3. Edita `index.js` para la lógica
4. Guarda automáticamente con `saveToLocalStorage()`

### Crear una nueva clase de tarea

1. Crea una nueva clase en un archivo separado
2. Extiende de `TaskBase`
3. Implementa el método `thisDayHas(dayFromOrigin)`
4. Agrega la clase a `AllTaskClasses` en `main.js`

Ejemplo:
```javascript
class MiTarea extends TaskBase {
  thisDayHas(dayFromOrigin) {
    // Tu lógica aquí
    return true || false;
  }
}
```

## 🎨 Personalización

### Colores
Edita las variables en `index.css`:
```css
:root {
  --primary: #6366f1;        /* Color principal */
  --success: #22c55e;        /* Color éxito */
  --warning: #f59e0b;        /* Color advertencia */
  --danger: #ef4444;         /* Color peligro */
}
```

### Idioma
Edita los arrays en `index.js`:
```javascript
const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'];
const monthNames = ['Enero', 'Febrero', ...];
```

## 🐛 Solución de problemas

### Las tareas no se guardan
- Verifica que JavaScript esté habilitado
- Comprueba la consola (F12) para errores
- Prueba con otro navegador

### PDF exportado mal formado
- Asegúrate de que las tareas estén correctamente configuradas
- Intenta exportar un período más corto
- Actualiza la página antes de exportar

### Los datos no se cargan
- Borra el localStorage: `localStorage.clear()`
- Importa desde un backup JSON
- Crea las tareas nuevamente

## 📱 Compatibilidad

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 Licencia

Proyecto personal - Libre para usar y modificar

## 🤝 Contribuciones

Si encuentras un bug o tienes una idea:
1. Verifica que no esté reportado
2. Describe claramente el problema
3. Incluye pasos para reproducir

## 📝 Notas técnicas

### Almacenamiento
- LocalStorage: ~5-10MB disponible
- Los datos persisten entre sesiones
- Se incluye indicador visual de guardado

### Rendimiento
- Renderizado optimizado para 1000+ tareas
- Caché de cálculos semanales
- PDF generado sin servidor (html2pdf.js)

### Seguridad
- Sin transmisión de datos a servidores
- Todo ocurre localmente en tu navegador
- Sin cookies de seguimiento

## 🔄 Actualizaciones

### v3.0 (Actual)
- ✨ Refactorización completa del código
- 🎨 Nuevo diseño moderno
- 📱 Mejor responsiveness
- 🚀 Mejor rendimiento
- 🐛 Correcciones de bugs

### v2.0
- Exportación a PDF
- Ciclos personalizados
- Backup JSON

### v1.0
- Lanzamiento inicial
- Tareas básicas
- Vista semanal

## ❓ Preguntas frecuentes

**P: ¿Puedo usar esto sin conexión a internet?**
R: Sí, completamente. Todo funciona localmente en tu navegador.

**P: ¿Mis datos se sincronizan entre dispositivos?**
R: No automáticamente. Puedes exportar JSON y importarlo en otro dispositivo.

**P: ¿Puedo compartir mis tareas?**
R: Sí, exporta el JSON y comparte el archivo con otros.

**P: ¿Puedo usar esto en producción?**
R: Sí, es completamente funcional y estable.

**P: ¿Cómo hago un backup de mis datos?**
R: Usa el botón "Exportar JSON" en la sección de copias de seguridad.

---

Hecho con ❤️ para planificadores que aman la eficiencia
