import { parseLocalDate, todayISO } from './calendar.js';

// ────────────────────────────────────────────────────────────────────
// back/baseTarea.js — La base de todas las tareas.
//
// Una tarea guarda su fecha de inicio ABSOLUTA (`startDate`, formato
// 'YYYY-MM-DD' en hora local): el día en el que empieza a aplicarse.
// Antes guardaba `daysFrom`, un offset respecto al origen del
// planificador, y por eso las tareas se movían de columna cada vez que
// la app se abría en un día distinto (T-045).
// ────────────────────────────────────────────────────────────────────

export class TaskBase{

    name;
    total=1;
    // Fecha de inicio en formato 'YYYY-MM-DD'. Si nadie la pone, la
    // tarea empieza hoy.
    startDate=todayISO();

    get StartDate(){
        return this.startDate;
    }

    set StartDate(startDate){
        this.startDate=startDate;
    }

    /** Fecha de inicio de la tarea (a las 00:00 en hora local). */
    getStart(){
        return parseLocalDate(this.StartDate);
    }

    get Total(){
        return this.total;
    }

    set Total(total){
        this.total=total;
    }

    get Name(){
        return this.name;
    }

    set Name(name){
        this.name=name;
    }


    /** Dice si la tarea se aplica el día `date` (una fecha real: un
     *  Date o una cadena 'YYYY-MM-DD'). */
    thisDayHas(date){
        throw new Error("Not implemented");
    }

   static toJson(tasks){
        // Serializa recursivamente para que las tareas anidadas
        // (LimitedTimeTask / OneTimeTask) también lleven su className.
        const serialize = t => {
            const obj = { ...t, className: t.constructor.name };
            if (t.task && typeof t.task === 'object' && t.task.constructor) {
                obj.task = serialize(t.task);
            }
            return obj;
        };
        return JSON.stringify(tasks.map(serialize));
    }

}
