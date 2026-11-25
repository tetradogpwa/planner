import { parseLocalDate, todayISO } from './calendar.js';
import { nuevoId }           from './idTarea.js';

// ────────────────────────────────────────────────────────────────────
// back/baseTarea.js — La base de todas las tareas.
//
// Una tarea guarda su fecha de inicio ABSOLUTA (`startDate`, formato
// 'YYYY-MM-DD' en hora local): el día en el que empieza a aplicarse.
// Antes guardaba `daysFrom`, un offset respecto al origen del
// planificador, y por eso las tareas se movían de columna cada vez que
// la app se abría en un día distinto (T-045).
//
// Y guarda su IDENTIFICADOR (`id`, un UUID): no cambia al editarla ni
// al guardarla, así que la API, el MCP y la interfaz pueden referirse
// a una tarea concreta y no a su posición en la lista (T-049).
// ────────────────────────────────────────────────────────────────────

export class TaskBase{

    name;
    total=1;
    // Fecha de inicio en formato 'YYYY-MM-DD'. Si nadie la pone, la
    // tarea empieza hoy.
    startDate=todayISO();
    // Identificador único de la tarea. Cada tarea nueva nace con el
    // suyo; el importador lo conserva si el JSON lo trae.
    id=nuevoId();

    get Id(){
        return this.id;
    }

    set Id(id){
        this.id=id;
    }

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
        return JSON.stringify(TaskBase.toJsonArray(tasks));
    }

    /** Las tareas como un array de objetos JSON planos (sin pasar por el
     *  texto): es lo que se guarda dentro de una copia de seguridad
     *  (T-054), donde las tareas van dentro de un objeto mayor. */
    static toJsonArray(tasks){
        // Serializa recursivamente para que las tareas anidadas
        // (LimitedTimeTask / OneTimeTask) también lleven su className.
        const serialize = t => {
            const obj = { ...t, className: t.constructor.name };
            if (t.task && typeof t.task === 'object' && t.task.constructor) {
                obj.task = serialize(t.task);
            }
            return obj;
        };
        return tasks.map(serialize);
    }

}
