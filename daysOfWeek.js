import { TaskBase } from "./baseTarea.js";








export class DaysOfWeekTask extends TaskBase{
    
    flags = 0;

    constructor(flags=0){
        super();
        this.flags=flags;
    }

    setDay(dayOfWeek) {
        if (!this.hasDay(dayOfWeek)) {
            // Activa el bit correspondiente al día
            this.flags |= (1 << dayOfWeek);
        }
    }

    unSetDay(dayOfWeek) {
        if (this.hasDay(dayOfWeek)) {
            // Desactiva el bit correspondiente al día
            this.flags &= ~(1 << dayOfWeek);
        }
    }

    hasDay(dayOfWeek) {
        // Verifica si el bit está activado
        return (this.flags & (1 << dayOfWeek)) !== 0;
    }
    fromIsBefore(from){
        return from.getTime()>this.start.getTime()
    }
    thisDayHas(from,dayFromOrigin){
        const dayOfWeek=dayFromOrigin%7;
        return this.fromIsBefore(from) && this.hasDay(dayOfWeek);
    }
}

export class CiclesDaysOfWeekTask extends TaskBase{
    cicles=[];

    get Cicles(){
        return this.cicles;
    }

    set Cicles(cicles){
        this.cicles=cicles;
    }

    thisDayHas(from,dayFromOrigin){
        const posWeek=dayFromOrigin/this.cicles.length;
        const dayOfWeek=dayFromOrigin%7;
        return this.Cicles[posWeek].hasDay(dayOfWeek);
    }
}
