import { CiclesDaysOfWeekTask, DaysOfWeekTask } from './daysOfWeek';
import { LimitedTimeTask, OneTimeTask } from './limitedTime';
import { DailyTask, MonthlyTask, NDaysTask, QuaterlyTask, WeeklyTask } from './nDays';

const All = [
    CiclesDaysOfWeekTask,
    DaysOfWeekTask,

    LimitedTimeTask,
    OneTimeTask,

    DailyTask,
    MonthlyTask,
    NDaysTask,
    QuaterlyTask,
    WeeklyTask,
];
function FromJson(dataStr) {
    const tasksDirty = JSON.parse(dataStr);
    return tasksDirty.map(ProcessTask).filter(r => r !== undefined);
}

function ProcessTask({ className, ...data }) {
    let task = undefined;
    const ClassTask = All.find(a => a.constructor.name === className);

    if (ClassTask) {
        task = new ClassTask();
        for (const prop of Object.keys(data)) {
            task[prop] = data[prop];
        }
    }


    return task;
}


function GetTasksOfDay(dayFromOrigin, tasks) {
    return tasks.filter(t => t.thisDayHas(dayFromOrigin));
}
function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = domingo, 1 = lunes, etc.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}
function GetWeek(from, numWeek, tasks) {
    let dayFromOrigin, diffTime;
    const mondayFrom = getMondayOfWeek(from);
    let mondayTo = new Date(mondayFrom);
    let weekTasks = [];

    mondayTo.setHours(mondayTo.getHours() + numWeek * 7 * 24);
    diffTime = Math.abs(d2 - d1); // Diferencia en milisegundos
    dayFromOrigins = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convertir a días
    for (let i = 0; i < 7; i++) {
        weekTasks.push(GetTasksOfDay(dayFromOrigin + i, tasks));
    }
    return { mondayTo, weekTasks };

}
function getDiffWeeks(from, to) {
    const d1 = new Date(from);
    const d2 = new Date(to);

    const diffTime = Math.abs(d2 - d1); // Diferencia en milisegundos
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)); // Convertir a semanas
    return diffWeeks;
}
function GetWeeks(from, to, avoidWeeks, tasks) {

    const diffWeeks = getDiffWeeks(from, to);
    let weeks = [];
    for (let i = avoidWeeks; i < diffWeeks; i++) {
        weeks.push(GetWeek(from, i, tasks));
    }
    return weeks;
}
function getLastDayOfMonth(date) {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function GetRestoOfMonth(from, tasks) {
    const timeNow = new Date();
    const to = getLastDayOfMonth(timeNow);
    const avoidWeeks = getDiffWeeks(from, timeNow);
    return GetWeeks(from, to, avoidWeeks, tasks);
}

function GetNWeeks(from, nWeeks, nWeeksToAvoid, tasks) {
    const to = new Date(from);
    to.setHours((nWeeksToAvoid + nWeeks) * 7 * 24);
    return GetWeeks(from, to, nWeeksToAvoid, tasks);
}
function getWeeksInMonth(date) {
    const d = new Date(date);
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    const diffTime = Math.abs(lastDay - firstDay);
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

    return diffWeeks;
}
function GetMonth(from, month, year, tasks) {
    let diffWeeks;
    const date = new Date(year, month, 1);
    if (from.getTime() < date.getTime()) {
        throw new Error('only future');
    }

    diffWeeks = getDiffWeeks(from, data);
    date.setMonth(date.getMonth() + 1);
    date.setDate(date.getDate() - 1);
    return GetWeeks(from, to, diffWeeks, tasks);
}


//falta abrir json y cargarlo
//falta cargar desde localStorage (se guarda en json)

//falta guardar tasks como json en localStorage

//falta descargar como json tasks

//falta resetear las tasks

//falta hacer que los botones usen GetMonth,GetNWeeks,GetRestOfMonth
//falta representar una semana
//falta añadir una semana representada a la lista cada vez que se hace scroll se carga la siguiente
//si se añaden/quitan/carga tasks se recrean las semanas representadas