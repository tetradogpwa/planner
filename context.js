import * as Main from './back/main.js';



export class Context {

    static _tasks;

    static _startDate;

    static get KeyTasks() {
        return `${Context.name}_TASKS`;
    }

    static get KeyStartDate() {
        return `${Context.name}_START_DATE`;
    }

    static get Tasks() {
        return Context._tasks;
    }

    static get StartDate() {
        return Context._startDate;
    }

    static set StartDate(date) {
        const startDateStr = date.getTime() + '';
        Context._startDate = date;
        localStorage.setItem(Context.KeyStartDate, startDateStr);
    }

    static SetTasksFromJson(json) {
        const parsed = Main.FromJson(json);

        if (!Array.isArray(parsed)) {
            throw new Error("Formato de tareas inválido");
        }

        Context._tasks = Context.#observe(parsed);

        Context.UpdateTasks();

    }

    static UpdateTasks() {
        const tasksJson = Main.ToJson(Context.Tasks);
        localStorage.setItem(Context.KeyTasks, tasksJson);
    }

    static #observe(obj) {
        return new Proxy(obj, {
            get(target, prop) {
                const value = target[prop];

                if (typeof value === "object" && value !== null) {
                    return Context.#observe(value);
                }

                return value;
            },

            set(target, prop, value) {
                target[prop] = value;
                Context.UpdateTasks();
                return true;
            }
        });
    }

    static {

        const tasksJson = localStorage.getItem(Context.KeyTasks);
        const startDateStr = localStorage.getItem(Context.KeyStartDate);

        if (tasksJson) {
            Context._tasks = Main.FromJson(tasksJson);
        } else {
            Context._tasks = [];
        }

        if (startDateStr) {
            Context._startDate = new Date(Number(startDateStr));
        } else {
            Context._startDate = new Date();
            Context._startDate.setHours(0, 0, 0, 0);
        }

        Context._tasks = Context.#observe(Context._tasks);

    }




}