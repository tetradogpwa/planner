import { TaskBase } from "./baseTarea.js";
import { parseLocalDate } from "./calendar.js";



export class LimitedTimeTask extends TaskBase{
    task;
    repeat=1;
    get Task(){
        return this.task;
    }

    set Task(task){
        this.task=task;
    }

    get Repeat(){
        return this.repeat;
    }
    set Repeat(repeat){
        this.repeat=repeat;
    }

    thisDayHas(date){
        const dia  = parseLocalDate(date);
        const base = this.Task;
        if (!base) return false;

        const inicio = parseLocalDate(base.StartDate);
        if (dia.getTime() < inicio.getTime()) return false;

        // Tampoco antes de la fecha de inicio de la propia tarea.
        const inicioPropia = parseLocalDate(this.StartDate);
        if (dia.getTime() < inicioPropia.getTime()) return false;

        const MAX=this.Repeat-1;
        let total=0;

        // Contamos cuántas veces ha aplicado la tarea base desde su
        // fecha de inicio hasta el día anterior al evaluado: la tarea
        // solo se aplica en su Repeat-ésima aparición (una "sin
        // repetición" solo aparece el primer día).
        const cursor=new Date(inicio);
        while (cursor.getTime() < dia.getTime()) {
            if (base.thisDayHas(cursor)) {
                total++;
                // Ya pasó su turno: no puede volver a aparecer.
                if (total > MAX) return false;
            }
            cursor.setDate(cursor.getDate()+1);
        }

        //si no ha pasado hasta ahora y ese dia por casualidad es, entonces lo es
        //el segundo o siguiente no lo es
        return total===MAX && base.thisDayHas(dia);
    }
}

export class OneTimeTask extends LimitedTimeTask{
    constructor(){
        super();
        this.Repeat=1;
    }
}
