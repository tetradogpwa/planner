import { TaskBase } from "./baseTarea.js";
import { diffDays, parseLocalDate } from "./calendar.js";



export class NDaysTask extends TaskBase {
    nDays;
    get NDays(){
        return this.nDays;
    }
    set NDays(nDays){
        this.nDays=nDays;
    }
    thisDayHas(date){
        const dia    = parseLocalDate(date);
        const inicio = parseLocalDate(this.StartDate);

        // Antes del inicio de la tarea no aplica.
        if (dia.getTime() < inicio.getTime()) return false;

        const n = this.NDays;
        if (!Number.isInteger(n) || n < 1) return false;

        // Cada n días REALES desde la fecha de inicio de la tarea.
        return diffDays(inicio, dia) % n === 0;
    }
}

export class DailyTask extends NDaysTask{
    constructor(){
        super();
        this.NDays=1;
    }
}
export class WeeklyTask extends NDaysTask{
    constructor(){
        super();
        this.NDays=7;
    }
}
export class MonthlyTask extends NDaysTask{
    constructor(){
        super();
        this.NDays=30;
    }
}
export class QuaterlyTask extends NDaysTask{
    constructor(){
        super();
        this.NDays=90;
    }
}
