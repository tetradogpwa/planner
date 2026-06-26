// ==================== ESTADO ====================
let tasks = [];
let taskIdCounter = 0;
let cycleWeeks = [{}];
let cycleTemplates = [];
let editingTaskId = null;
let startDate = null;

const LS_KEY = 'planificador_data_v3';
const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'];
const fullDayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ==================== LOCALSTORAGE ====================
function saveToLocalStorage() {
  const data = {
    tasks,
    taskIdCounter,
    cycleTemplates,
    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
    exportDate: new Date().toISOString()
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    showSavedIndicator();
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.tasks && Array.isArray(data.tasks)) {
      tasks = data.tasks;
      taskIdCounter = data.taskIdCounter || tasks.length;
      cycleTemplates = data.cycleTemplates || [];
      if (data.startDate) {
        startDate = new Date(data.startDate + 'T00:00:00');
      }
      return true;
    }
  } catch (e) {
    console.warn('Error cargando localStorage:', e);
  }
  return false;
}

function showSavedIndicator() {
  const el = document.getElementById('savedIndicator');
  if (el) {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }
}

// ==================== FECHAS ====================
function setStartDate() {
  const val = document.getElementById('startDateInput').value;
  if (!val) {
    alert('Selecciona una fecha');
    return;
  }
  startDate = new Date(val + 'T00:00:00');
  updateDateInfo();
  updateWeekView();
  saveToLocalStorage();
}

function resetStartDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDate = today;
  document.getElementById('startDateInput').value = formatDateInput(today);
  updateDateInfo();
  updateWeekView();
  saveToLocalStorage();
}

function formatDateInput(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateDateInfo() {
  const span = document.getElementById('currentStartDate');
  const weekSpan = document.getElementById('weekInfo');
  if (startDate) {
    const d = startDate;
    const wd = fullDayNames[d.getDay() === 0 ? 6 : d.getDay() - 1];
    span.textContent = `${d.getDate()} de ${monthNames[d.getMonth()]} de ${d.getFullYear()} (${wd})`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today - startDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;
    if (diffDays >= 0) {
      weekSpan.textContent = `| Semana ${weekNum} en curso`;
    } else {
      weekSpan.textContent = `| Faltan ${Math.abs(diffDays)} días para empezar`;
    }
  } else {
    span.textContent = 'No establecida (usa el calendario de arriba)';
    weekSpan.textContent = '';
  }
}

// ==================== CÁLCULO DE TAREAS ====================
function getDaysForTaskOnDate(task, date, weekIndex) {
  const pattern = task.pattern;
  if (!pattern) return false;

  const dow = date.getDay() === 0 ? 6 : date.getDay() - 1; // 0=Lun, 6=Dom

  if (pattern.type === 'daily') return true;
  if (pattern.type === 'specific-days') return pattern.days && pattern.days.includes(dow);
  if (pattern.type === 'cycle') {
    const weeks = pattern.weeks || [];
    const cycleWeek = weeks[weekIndex % weeks.length] || [];
    return cycleWeek.includes(dow);
  }

  if (pattern.type === 'days-interval') {
    if (!startDate) return false;
    const interval = pattern.days || 3;
    const startDayOffset = pattern.startDay || 0;

    const start = new Date(startDate);
    start.setDate(start.getDate() + startDayOffset);
    start.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffMs = target - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return false;
    return diffDays % interval === 0;
  }

  return false;
}

function getWeekIndexForDate(date) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  s.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffMs = d - s;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

// ==================== CICLOS ====================
function getCycleLength() {
  const hasCycle = tasks.some(t => t.pattern && t.pattern.type === 'cycle');
  if (hasCycle) {
    return Math.max(...tasks
      .filter(t => t.pattern && t.pattern.type === 'cycle')
      .map(t => (t.pattern.weeks || []).length));
  }
  return 1;
}

function updateCycleWeekUI() {
  const container = document.getElementById('cycleWeeks');
  if (!container) return;
  container.innerHTML = '';

  cycleWeeks.forEach((week, weekIndex) => {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'cycle-week-setup-card';

    let daysHtml = '';
    for (let day = 0; day < 7; day++) {
      const isChecked = week.days && week.days.includes(day) ? 'checked' : '';
      daysHtml += `<label><input type="checkbox" class="cycleDay_${weekIndex}" value="${day}" ${isChecked}> ${dayNames[day]}</label>`;
    }

    weekDiv.innerHTML = `
      <div class="cycle-week-header">
        <p class="cycle-week-title">Semana ${weekIndex + 1}</p>
        ${cycleWeeks.length > 1 ? `<button onclick="removeCycleWeek(${weekIndex})" class="btn-close-cycle">×</button>` : ''}
      </div>
      <div class="day-checkboxes">${daysHtml}</div>
    `;
    container.appendChild(weekDiv);
  });
  updateCycleTemplatesUI();
}

function updateCycleTemplatesUI() {
  const container = document.getElementById('cycleTemplates');
  if (!container) return;
  container.innerHTML = '';

  if (cycleTemplates.length > 0) {
    const title = document.createElement('p');
    title.style.cssText = 'font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); margin: 8px 0;';
    title.textContent = 'Ciclos guardados:';
    container.appendChild(title);

    cycleTemplates.forEach((template, index) => {
      const btn = document.createElement('button');
      btn.className = 'cycle-template-btn';
      btn.innerHTML = `<span>${template.name} (${template.weeks.length} semanas)</span> <span class="cycle-template-delete">×</span>`;
      btn.onclick = (e) => {
        if (e.target.textContent === '×') {
          deleteCycleTemplate(index);
        } else {
          loadCycleTemplate(index);
        }
      };
      container.appendChild(btn);
    });
  }
}

function saveCycleTemplate() {
  const name = document.getElementById('cycleName').value.trim();
  if (!name) {
    alert('Escribe un nombre para el ciclo');
    return;
  }
  const weeks = cycleWeeks.map((_, weekIndex) => {
    return Array.from(document.querySelectorAll(`.cycleDay_${weekIndex}:checked`)).map(el => parseInt(el.value));
  });
  cycleTemplates.push({ name, weeks });
  document.getElementById('cycleName').value = '';
  updateCycleTemplatesUI();
  saveToLocalStorage();
  alert(`Ciclo "${name}" guardado`);
}

function deleteCycleTemplate(index) {
  cycleTemplates.splice(index, 1);
  updateCycleTemplatesUI();
  saveToLocalStorage();
}

function loadCycleTemplate(index) {
  const template = cycleTemplates[index];
  cycleWeeks = template.weeks.map(days => ({ days }));
  updateCycleWeekUI();
}

function addCycleWeek() {
  cycleWeeks.push({});
  updateCycleWeekUI();
}

function removeCycleWeek(index) {
  if (cycleWeeks.length > 1) {
    cycleWeeks.splice(index, 1);
    updateCycleWeekUI();
  }
}

// ==================== REPETICIÓN ====================
function getRepeatPattern() {
  const type = document.querySelector('input[name="repeatType"]:checked').value;
  const timesPerDay = parseInt(document.getElementById('timesPerDay').value) || 1;

  if (type === 'no-repeat') return { timesPerDay };
  if (type === 'daily') return { type: 'daily', timesPerDay };
  if (type === 'days-interval') {
    const days = parseInt(document.getElementById('daysInterval').value) || 3;
    const startDay = parseInt(document.getElementById('startDay').value) || 0;
    return { type: 'days-interval', days, startDay, timesPerDay };
  }
  if (type === 'specific-days') {
    const selectedDays = Array.from(document.querySelectorAll('.dayCheckbox:checked')).map(el => parseInt(el.value));
    return { type: 'specific-days', days: selectedDays, timesPerDay };
  }
  if (type === 'cycle') {
    const weeks = cycleWeeks.map((_, weekIndex) => {
      return Array.from(document.querySelectorAll(`.cycleDay_${weekIndex}:checked`)).map(el => parseInt(el.value));
    });
    return { type: 'cycle', weeks, timesPerDay };
  }
  return { timesPerDay };
}

function updateRepeatUI() {
  const type = document.querySelector('input[name="repeatType"]:checked').value;
  const repeatOptions = document.getElementById('repeatOptions');
  const daysIntervalDiv = document.getElementById('daysIntervalDiv');
  const specificDaysDiv = document.getElementById('specificDaysDiv');
  const cycleDiv = document.getElementById('cycleDiv');

  if (type === 'no-repeat' || type === 'daily') {
    repeatOptions.classList.add('hidden');
  } else {
    repeatOptions.classList.remove('hidden');
    daysIntervalDiv.classList.toggle('hidden', type !== 'days-interval');
    specificDaysDiv.classList.toggle('hidden', type !== 'specific-days');
    cycleDiv.classList.toggle('hidden', type !== 'cycle');
    if (type === 'cycle') updateCycleWeekUI();
  }
}

// ==================== GESTIÓN DE TAREAS ====================
function addTask() {
  const input = document.getElementById('taskInput');
  const name = input.value.trim();
  if (!name) return;

  const pattern = getRepeatPattern();

  if (editingTaskId !== null) {
    const task = tasks.find(t => t.id === editingTaskId);
    if (task) {
      task.name = name;
      task.pattern = pattern;
    }
    editingTaskId = null;
  } else {
    tasks.push({ id: taskIdCounter++, name, pattern, completed: false });
  }

  input.value = '';
  document.querySelector('input[name="repeatType"][value="no-repeat"]').checked = true;
  document.getElementById('timesPerDay').value = 1;
  document.querySelectorAll('.dayCheckbox').forEach(cb => cb.checked = false);
  document.getElementById('daysInterval').value = 3;
  document.getElementById('startDay').value = 0;
  cycleWeeks = [{}];
  updateRepeatUI();

  renderTasks();
  updateWeekView();
  saveToLocalStorage();
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('taskInput').value = task.name;
  editingTaskId = id;

  if (task.pattern && task.pattern.type) {
    const radio = document.querySelector(`input[name="repeatType"][value="${task.pattern.type}"]`);
    if (radio) radio.checked = true;

    if (task.pattern.type === 'days-interval') {
      document.getElementById('daysInterval').value = task.pattern.days;
      document.getElementById('startDay').value = task.pattern.startDay || 0;
    } else if (task.pattern.type === 'specific-days') {
      document.querySelectorAll('.dayCheckbox').forEach(cb => {
        cb.checked = task.pattern.days.includes(parseInt(cb.value));
      });
    } else if (task.pattern.type === 'cycle') {
      cycleWeeks = task.pattern.weeks.map(days => ({ days }));
    }
    document.getElementById('timesPerDay').value = task.pattern.timesPerDay || 1;
  }

  updateRepeatUI();
  document.getElementById('taskInput').focus();
}

function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
  updateWeekView();
  saveToLocalStorage();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    renderTasks();
    saveToLocalStorage();
  }
}

function clearAllData() {
  if (!confirm('¿Borrar TODAS las tareas, ciclos y configuraciones? Esto no se puede deshacer.')) return;
  tasks = [];
  taskIdCounter = 0;
  cycleTemplates = [];
  cycleWeeks = [{}];
  startDate = null;
  localStorage.removeItem(LS_KEY);
  renderTasks();
  updateWeekView();
  updateDateInfo();
  document.getElementById('startDateInput').value = '';
}

function renderTasks() {
  const list = document.getElementById('taskList');
  list.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-tasks-msg';
    empty.textContent = 'No hay tareas. ¡Añade la primera arriba!';
    list.appendChild(empty);
    return;
  }

  tasks.forEach(task => {
    let patternText = 'Sin repetición';
    let badgeClass = '';

    if (task.pattern && task.pattern.type) {
      if (task.pattern.type === 'daily') patternText = 'Todos los días';
      else if (task.pattern.type === 'days-interval') {
        const startDayName = dayNames[task.pattern.startDay || 0];
        patternText = `Cada ${task.pattern.days} días (desde ${startDayName})`;
        if (task.pattern.days >= 80) badgeClass = 'trimestral';
        else if (task.pattern.days >= 25) badgeClass = 'mensual';
      }
      else if (task.pattern.type === 'specific-days') {
        const selectedDays = task.pattern.days.map(d => dayNames[d]).join(', ');
        patternText = `${task.pattern.days.length}x semana: ${selectedDays}`;
      }
      else if (task.pattern.type === 'cycle') {
        const weeks = task.pattern.weeks.length;
        patternText = `Ciclo de ${weeks} semana${weeks > 1 ? 's' : ''}`;
      }
    }

    const timesPerDay = task.pattern?.timesPerDay || 1;
    const frequencyText = timesPerDay > 1 ? ` (${timesPerDay}x/día)` : '';

    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})">
      <div class="task-details">
        <p class="task-title ${task.completed ? 'completed' : ''}">${task.name}</p>
        <p class="task-subtitle">${patternText}${frequencyText}</p>
      </div>
      <div class="task-actions">
        <button onclick="editTask(${task.id})" class="btn-action" title="Editar">✏️</button>
        <button onclick="deleteTask(${task.id})" class="btn-action btn-delete" title="Eliminar">🗑️</button>
      </div>
    `;
    list.appendChild(card);
  });
}

// ==================== VISTA SEMANAL ====================
function generateWeekView(weekCount, startFromDate = null, isExport = false, exportHeader = '') {
  const container = document.createElement('div');
  if (!isExport) container.style.padding = '10px';

  let currentWeekStart = startFromDate ? new Date(startFromDate) : (startDate ? new Date(startDate) : new Date());
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentDow = currentWeekStart.getDay();
  const daysToMonday = currentDow === 0 ? 6 : currentDow - 1;
  currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    const weekDiv = document.createElement('div');
    if (isExport) {
      weekDiv.className = 'week-card export-week';
    } else {
      weekDiv.className = 'week-card';
    }

    if (isExport && weekIndex === 0 && exportHeader) {
      const mainTitle = document.createElement('div');
      mainTitle.className = 'pdf-month-header';
      mainTitle.textContent = exportHeader;
      weekDiv.appendChild(mainTitle);
    }

    const weekStartDate = new Date(currentWeekStart);
    weekStartDate.setDate(weekStartDate.getDate() + weekIndex * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const title = document.createElement('h4');
    title.className = 'week-title';
    title.textContent = `Semana ${weekIndex + 1}: ${weekStartDate.getDate()} ${monthNames[weekStartDate.getMonth()]} - ${weekEndDate.getDate()} ${monthNames[weekEndDate.getMonth()]} ${weekEndDate.getFullYear()}`;
    weekDiv.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Headers
    for (let day = 0; day < 7; day++) {
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = dayNames[day];
      grid.appendChild(header);
    }

    // Días
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(weekStartDate);
      cellDate.setDate(cellDate.getDate() + day);

      const dayContainer = document.createElement('div');
      dayContainer.className = 'calendar-day';

      const dateNum = document.createElement('div');
      dateNum.className = 'day-number';
      dateNum.textContent = cellDate.getDate();
      dayContainer.appendChild(dateNum);

      const weekIdx = getWeekIndexForDate(cellDate);

      tasks.forEach(task => {
        if (getDaysForTaskOnDate(task, cellDate, weekIdx)) {
          const timesPerDay = task.pattern?.timesPerDay || 1;
          let badgeClass = '';
          if (task.pattern?.type === 'days-interval') {
            if (task.pattern.days >= 80) badgeClass = 'trimestral';
            else if (task.pattern.days >= 25) badgeClass = 'mensual';
          }

          for (let i = 0; i < timesPerDay; i++) {
            const badge = document.createElement('div');
            badge.className = 'task-badge ' + badgeClass;
            const label = timesPerDay > 1 ? `${task.name} (${i + 1})` : task.name;
            badge.textContent = label;
            dayContainer.appendChild(badge);
          }
        }
      });

      grid.appendChild(dayContainer);
    }

    weekDiv.appendChild(grid);
    container.appendChild(weekDiv);
  }

  return container;
}

function updateWeekView() {
  const container = document.getElementById('cycleDisplay');
  const cycleLength = getCycleLength();
  container.innerHTML = '';
  container.appendChild(generateWeekView(cycleLength * 2));
}

// ==================== EXPORTAR PDF ====================
function processPDFExport(headerText, weekCount, startDateObj, filename) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 0; overflow: hidden; z-index: -9999;';

  const tempContainer = document.createElement('div');
  tempContainer.id = 'pdf-export-temp-container';
  tempContainer.style.width = '1122px';
  tempContainer.style.background = 'white';

  const pdfContent = generateWeekView(weekCount, startDateObj, true, headerText);
  tempContainer.appendChild(pdfContent);

  wrapper.appendChild(tempContainer);
  document.body.appendChild(wrapper);

  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  setTimeout(() => {
    html2pdf().set(opt).from(tempContainer).save().then(() => {
      document.body.removeChild(wrapper);
    }).catch(err => {
      console.warn('Error exportando:', err);
      document.body.removeChild(wrapper);
    });
  }, 300);
}

function exportRestOfMonth() {
  if (tasks.length === 0) {
    alert('Añade tareas antes de exportar');
    return;
  }
  if (!startDate) {
    alert('Establece una fecha de inicio primero');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate();
  const weeksLeft = Math.ceil(daysLeft / 7) + 1;

  processPDFExport(
    `${monthNames[month]} ${year} (desde hoy)`,
    weeksLeft,
    today,
    `planificador-resto-${monthNames[month].toLowerCase()}-${year}.pdf`
  );
}

function exportWeeks() {
  if (tasks.length === 0) {
    alert('Añade tareas antes de exportar');
    return;
  }
  if (!startDate) {
    alert('Establece una fecha de inicio primero');
    return;
  }

  const weeks = parseInt(document.getElementById('weeksInput').value) || 4;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  processPDFExport(
    `Próximas ${weeks} semanas`,
    weeks,
    today,
    `planificador-${weeks}-semanas.pdf`
  );
}

function exportSpecificMonth() {
  if (tasks.length === 0) {
    alert('Añade tareas antes de exportar');
    return;
  }
  if (!startDate) {
    alert('Establece una fecha de inicio primero');
    return;
  }

  const monthNum = parseInt(document.getElementById('exportMonthSelect').value);
  const year = parseInt(document.getElementById('exportYearInput').value);

  const firstDayOfMonth = new Date(year, monthNum, 1);
  const lastDayOfMonth = new Date(year, monthNum + 1, 0);

  const firstMonday = new Date(firstDayOfMonth);
  const dow = firstMonday.getDay();
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  firstMonday.setDate(firstMonday.getDate() - daysToMonday);

  const totalDays = Math.ceil((lastDayOfMonth - firstMonday) / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.ceil(totalDays / 7);

  processPDFExport(
    `${monthNames[monthNum]} ${year}`,
    weeks,
    firstMonday,
    `planificador-${monthNames[monthNum].toLowerCase()}-${year}.pdf`
  );
}

// ==================== JSON ====================
function exportToJSON() {
  const data = {
    tasks, taskIdCounter, cycleTemplates,
    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
    exportDate: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tareas-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importFromJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.tasks && Array.isArray(data.tasks)) {
        tasks = data.tasks;
        taskIdCounter = data.taskIdCounter || tasks.length;
        cycleTemplates = data.cycleTemplates || [];
        if (data.startDate) {
          startDate = new Date(data.startDate + 'T00:00:00');
          document.getElementById('startDateInput').value = data.startDate;
        }
        renderTasks();
        updateWeekView();
        updateDateInfo();
        saveToLocalStorage();
        alert('Datos cargados correctamente');
      } else {
        alert('Formato de archivo inválido');
      }
    } catch (error) {
      alert('Error al cargar: ' + error.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ==================== INICIALIZACIÓN ====================
function init() {
  loadFromLocalStorage();

  if (startDate) {
    document.getElementById('startDateInput').value = formatDateInput(startDate);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate = today;
    document.getElementById('startDateInput').value = formatDateInput(today);
  }

  document.getElementById('exportYearInput').value = new Date().getFullYear();

  updateDateInfo();
  renderTasks();
  updateWeekView();
  updateRepeatUI();
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
