// ==================== IMPORTAR MÉTODOS DE MAIN ====================
import * as Main from './main.js';

// ==================== ESTADO GLOBAL ====================
let tasks = [];
let startDate = new Date();
let cycleTemplates = [];
function loadData() {
    // Cargar tareas de forma segura
    const savedTasks = localStorage.getItem('planner_tasks');
    if (savedTasks && Main.FromJson) {
        tasks = Main.FromJson(savedTasks);
    } else if (savedTasks) {
        // Alternativa si FromJson tuviera problemas
        try { tasks = JSON.parse(savedTasks); } catch(e){}
    }

    // Cargar fecha de inicio
    const savedDate = localStorage.getItem('planner_startDate');
    if (savedDate) {
        startDate = new Date(savedDate);
        document.getElementById('startDateInput').value = savedDate.split('T')[0];
    } else {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        document.getElementById('startDateInput').value = startDate.toISOString().split('T')[0];
    }

    // Cargar plantillas de ciclo
    const savedCycles = localStorage.getItem('planner_cycles');
    if (savedCycles) {
        cycleTemplates = JSON.parse(savedCycles);
    }
    renderCycleTemplates();
}

function saveData() {
    // Guardamos usando la misma lógica exacta de tu clase TaskBase de forma nativa
    const backupStructure = { tasks: tasks.map(t => ({ ...t, className: t.constructor.name })) };
    localStorage.setItem('planner_tasks', JSON.stringify(backupStructure));
    localStorage.setItem('planner_startDate', startDate.toISOString());
    showSavedIndicator();
}
// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateRepeatUI();
    
    // Asegurarse de que haya al menos una semana en la vista de ciclos
    if (document.getElementById('cycleWeeks').children.length === 0) {
        window.addCycleWeek();
    }
    
    renderTasks();
    updateDateUI();
    window.updateWeekView();
});


let savedIndicatorTimeout;
function showSavedIndicator() {
    const indicator = document.getElementById('savedIndicator');
    indicator.classList.add('show');
    clearTimeout(savedIndicatorTimeout);
    savedIndicatorTimeout = setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}

// ==================== GESTIÓN DE FECHAS ====================
window.setStartDate = () => {
    const input = document.getElementById('startDateInput').value;
    if (input) {
        startDate = new Date(input);
        startDate.setHours(0, 0, 0, 0);
        saveData();
        updateDateUI();
        window.updateWeekView();
    }
};

window.resetStartDate = () => {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    document.getElementById('startDateInput').value = startDate.toISOString().split('T')[0];
    saveData();
    updateDateUI();
    window.updateWeekView();
};

function updateDateUI() {
    const formattedDate = startDate.toLocaleDateString('es-ES', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('currentStartDate').textContent = formattedDate;
}

// ==================== INTERFAZ DE REPETICIÓN ====================
window.updateRepeatUI = () => {
    const repeatType = document.querySelector('input[name="repeatType"]:checked').value;
    const repeatOptions = document.getElementById('repeatOptions');
    const daysIntervalDiv = document.getElementById('daysIntervalDiv');
    const specificDaysDiv = document.getElementById('specificDaysDiv');
    const cycleDiv = document.getElementById('cycleDiv');

    // Ocultar todo primero
    repeatOptions.classList.add('hidden');
    daysIntervalDiv.classList.add('hidden');
    specificDaysDiv.classList.add('hidden');
    cycleDiv.classList.add('hidden');

    // Mostrar lo necesario
    if (repeatType === 'days-interval') {
        repeatOptions.classList.remove('hidden');
        daysIntervalDiv.classList.remove('hidden');
    } else if (repeatType === 'specific-days') {
        repeatOptions.classList.remove('hidden');
        specificDaysDiv.classList.remove('hidden');
    } else if (repeatType === 'cycle') {
        repeatOptions.classList.remove('hidden');
        cycleDiv.classList.remove('hidden');
    }
};

// ==================== GESTIÓN DE CICLOS ====================
window.addCycleWeek = () => {
    const container = document.getElementById('cycleWeeks');
    const weekIndex = container.children.length + 1;
    const weekDiv = document.createElement('div');
    weekDiv.className = 'cycle-week-setup-card';
    weekDiv.innerHTML = `
        <div class="cycle-week-header">
            <h4 class="cycle-week-title">Semana ${weekIndex}</h4>
            <button type="button" class="btn-close-cycle" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="day-checkboxes cycle-days">
            <label><input type="checkbox" value="0"> Lun</label>
            <label><input type="checkbox" value="1"> Mar</label>
            <label><input type="checkbox" value="2"> Mié</label>
            <label><input type="checkbox" value="3"> Jue</label>
            <label><input type="checkbox" value="4"> Vie</label>
            <label><input type="checkbox" value="5"> Sab</label>
            <label><input type="checkbox" value="6"> Dom</label>
        </div>
    `;
    container.appendChild(weekDiv);
};

function getCycleArray() {
    const cycleArray = [];
    const weeks = document.querySelectorAll('.cycle-days');
    weeks.forEach(week => {
        const checked = Array.from(week.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
        cycleArray.push(checked);
    });
    return cycleArray;
}

window.saveCycleTemplate = () => {
    const name = document.getElementById('cycleName').value.trim();
    if (!name) { 
        alert("Por favor, introduce un nombre para la plantilla del ciclo."); 
        return; 
    }
    const cycleArray = getCycleArray();
    cycleTemplates.push({ name, cycle: cycleArray });
    localStorage.setItem('planner_cycles', JSON.stringify(cycleTemplates));
    renderCycleTemplates();
    document.getElementById('cycleName').value = '';
};

function renderCycleTemplates() {
    const list = document.getElementById('cycleTemplates');
    list.innerHTML = '';
    cycleTemplates.forEach((t, index) => {
        const btn = document.createElement('button');
        btn.className = 'cycle-template-btn';
        btn.innerHTML = `
            <span>📋 ${t.name}</span>
            <span class="cycle-template-delete" title="Eliminar plantilla" onclick="event.stopPropagation(); deleteCycleTemplate(${index})">✕</span>
        `;
        btn.onclick = () => window.loadCycleTemplate(t.cycle);
        list.appendChild(btn);
    });
}

window.deleteCycleTemplate = (index) => {
    cycleTemplates.splice(index, 1);
    localStorage.setItem('planner_cycles', JSON.stringify(cycleTemplates));
    renderCycleTemplates();
};

window.loadCycleTemplate = (cycleArray) => {
    const container = document.getElementById('cycleWeeks');
    container.innerHTML = ''; // Limpiar semanas actuales
    cycleArray.forEach(weekChecked => {
        window.addCycleWeek();
        const lastWeek = container.lastElementChild;
        const checkboxes = lastWeek.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (weekChecked.includes(parseInt(cb.value))) {
                cb.checked = true;
            }
        });
    });
};

// ==================== CREAR Y LISTAR TAREAS ====================
window.addTask = () => {
    const taskName = document.getElementById('taskInput').value.trim();
    if (!taskName) {
        alert("Por favor, introduce un nombre para la tarea.");
        return;
    }

    const repeatType = document.querySelector('input[name="repeatType"]:checked').value;
    const total = parseInt(document.getElementById('timesPerDay').value) || 1;
    let newTask = null;

    try {
        if (repeatType === 'no-repeat') {
            // Tarea de 1 solo uso: Se crea una diaria envuelta en OneTimeTask
            newTask = Main.CreateOneTimeTask(Main.CreateDailyTask(taskName, total), total);
        } else if (repeatType === 'daily') {
            newTask = Main.CreateDailyTask(taskName, total);
        } else if (repeatType === 'days-interval') {
            const interval = parseInt(document.getElementById('daysInterval').value) || 3;
            newTask = Main.CreateNDaysTask(taskName, interval, total);
        } else if (repeatType === 'specific-days') {
            const checkboxes = document.querySelectorAll('#specificDaysDiv input[type="checkbox"]:checked');
            const days = Array.from(checkboxes).map(cb => parseInt(cb.value));
            if (days.length === 0) {
                alert("Selecciona al menos un día específico de la semana.");
                return;
            }
            newTask = Main.CreateDaysOfWeekTask(taskName, days, total);
        } else if (repeatType === 'cycle') {
            const cycleArray = getCycleArray();
            if (cycleArray.length === 0 || cycleArray.every(w => w.length === 0)) {
                alert("Configura al menos un día en el ciclo semanal.");
                return;
            }
            newTask = Main.CreateCycleDaysOfWeekTask(taskName, cycleArray, total);
        }

        if (newTask) {
            tasks.push(newTask);
            document.getElementById('taskInput').value = '';
            saveData();
            renderTasks();
            window.updateWeekView();
        }
    } catch (e) {
        console.error("Error al crear la tarea:", e);
        alert("Ocurrió un error al crear la tarea. Revisa los parámetros.");
    }
};

function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="empty-tasks-msg">No hay tareas configuradas. ¡Añade una arriba!</div>';
        return;
    }

    tasks.forEach((task, index) => {
        const card = document.createElement('div');
        card.className = 'task-card';

        // Determinar un subtítulo legible según el tipo de clase
        let subtitle = task.constructor.name;
        if (subtitle === 'DailyTask') subtitle = 'Diaria';
        else if (subtitle === 'WeeklyTask') subtitle = 'Semanal';
        else if (subtitle === 'NDaysTask') subtitle = `Cada ${task.NDays} días`;
        else if (subtitle === 'DaysOfWeekTask') subtitle = 'Días específicos de la semana';
        else if (subtitle === 'CiclesDaysOfWeekTask') subtitle = 'Ciclo de semanas personalizado';
        else if (subtitle === 'OneTimeTask') subtitle = 'Una sola vez (Sin repetición)';

        card.innerHTML = `
            <div class="task-details">
                <h4 class="task-title">${task.Name} ${task.Total > 1 ? `<span style="color:var(--primary)">[x${task.Total} veces al día]</span>` : ''}</h4>
                <p class="task-subtitle">🔄 ${subtitle}</p>
            </div>
            <div class="task-actions">
                <button class="btn-action btn-delete" onclick="deleteTask(${index})" title="Eliminar tarea">🗑️</button>
            </div>
        `;
        taskList.appendChild(card);
    });
}

window.deleteTask = (index) => {
    if (confirm('¿Eliminar esta tarea de forma permanente?')) {
        tasks.splice(index, 1);
        saveData();
        renderTasks();
        window.updateWeekView();
    }
};

// ==================== VISTA PREVIA Y HTML GENERATOR ====================
window.updateWeekView = () => {
    const range = document.getElementById('previewRangeSelect').value;
    const container = document.getElementById('cycleDisplay');
    container.innerHTML = '';

    let weeksToRender = 4;
    if (range === '12') weeksToRender = 12;
    else if (range === '52') weeksToRender = 52;
    else if (range === 'cycle') {
        let maxCycle = 1;
        tasks.forEach(t => {
            if (t.constructor.name === 'CiclesDaysOfWeekTask' && t.Cicles) {
                maxCycle = Math.max(maxCycle, t.Cicles.length);
            }
        });
        weeksToRender = maxCycle;
    }

    // Usar la función importada GetNWeeks para calcular
    const weeksData = Main.GetNWeeks(startDate, weeksToRender, 0, tasks);
    container.innerHTML = generateWeeksHTML(weeksData);
};

function generateWeeksHTML(weeksData, isExport = false) {
    const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    let html = '';

    weeksData.forEach((week, wIndex) => {
        const monday = week.mondayTo;
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const formatDate = (d) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

        html += `
            <div class="week-card ${isExport ? 'export-week' : ''}">
                <h3 class="week-title">Semana ${wIndex + 1} (${formatDate(monday)} al ${formatDate(sunday)})</h3>
                <div class="calendar-grid">
        `;

        // Cabeceras de los días
        dayNames.forEach(day => {
            html += `<div class="day-header">${day}</div>`;
        });

        // Contenedores de cada día
        week.weekTasks.forEach((dayTasks, dIndex) => {
            const currentDate = new Date(monday);
            currentDate.setDate(currentDate.getDate() + dIndex);

            html += `
                <div class="calendar-day">
                    <div class="day-number">${currentDate.getDate()}</div>
                    <div class="day-tasks">
            `;

            if (dayTasks && dayTasks.length > 0) {
                dayTasks.forEach(task => {
                    const extraBadge = task.Total > 1 ? ` x${task.Total}` : '';
                    html += `<div class="task-badge">${task.Name}${extraBadge}</div>`;
                });
            }

            html += `</div></div>`;
        });

        html += `</div></div>`;
    });

    return html;
}

// ==================== EXPORTACIÓN A PDF ====================
function exportPDF(weeksData, filename) {
    const container = document.createElement('div');
    container.innerHTML = `<div class="week-container">${generateWeeksHTML(weeksData, true)}</div>`;
    
    // Lo ocultamos pero lo pegamos al body para que html2pdf recoja los estilos globales
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '297mm'; // A4 Landscape base width
    document.body.appendChild(container);

    const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).save().then(() => {
        document.body.removeChild(container);
    });
}

window.exportRestOfMonth = () => {
    const weeksData = Main.GetRestoOfMonth(startDate, tasks);
    exportPDF(weeksData, 'Resto_Del_Mes_Planificador.pdf');
};

window.exportWeeks = () => {
    const n = parseInt(document.getElementById('weeksInput').value) || 4;
    const weeksData = Main.GetNWeeks(startDate, n, 0, tasks);
    exportPDF(weeksData, `Proximas_${n}_Semanas.pdf`);
};

window.exportSpecificMonth = () => {
    const month = parseInt(document.getElementById('exportMonthSelect').value);
    const year = parseInt(document.getElementById('exportYearInput').value);
    const weeksData = Main.GetMonth(startDate, month, year, tasks);
    const monthName = document.getElementById('exportMonthSelect').options[month].text;
    exportPDF(weeksData, `Mes_${monthName}_${year}.pdf`);
};

// ==================== COPIAS DE SEGURIDAD (JSON) ====================
window.exportToJSON = () => {
    const data = Main.ToJson(tasks);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_planificador.json';
    a.click();
    URL.revokeObjectURL(url);
};

window.importFromJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedTasks = Main.FromJson(e.target.result);
            if (importedTasks) {
                tasks = importedTasks;
                saveData();
                renderTasks();
                window.updateWeekView();
                alert('¡Datos importados correctamente!');
            }
        } catch (error) {
            console.error(error);
            alert('Error al leer el archivo. Asegúrate de que es un backup válido.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Resetear el input file
};

window.clearAllData = () => {
    if (confirm('⚠️ ¿Estás seguro de que quieres borrar TODAS las tareas configuradas? Esto no se puede deshacer (a menos que tengas un backup en JSON).')) {
        tasks = [];
        saveData();
        renderTasks();
        window.updateWeekView();
    }
};