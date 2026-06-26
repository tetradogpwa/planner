import { TaskBase } from "./baseTarea.js";








export class DaysOfWeekTask extends TaskBase {

    flags = 0;

    constructor(flags = 0) {
        super();
        this.flags = flags;
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
 
    thisDayHas(from, dayFromOrigin) {
        const dayOfWeek = dayFromOrigin % 7;
        const totalWeeks = dayFromOrigin / 7;
        return dayFromOrigin >= this.DaysFrom 
        && (    totalWeeks == 0 
            &&  dayOfWeek >= this.Start.getDay() 
            &&  this.hasDay(dayOfWeek)
        ) || totalWeeks > 0 && this.hasDay(dayOfWeek);
    }
}

export class CiclesDaysOfWeekTask extends TaskBase {
    cicles = [];

    get Cicles() {
        return this.cicles;
    }

    set Cicles(cicles) {
        this.cicles = cicles;
    }

    thisDayHas(from, dayFromOrigin) {
        const weeks = dayFromOrigin / 7;
        const dayOfWeek = dayFromOrigin % 7;
        const posWeek=weeks/this.Cicles.length;
        return dayFromOrigin >= this.DaysFrom 
            && this.Cicles[posWeek].hasDay(dayOfWeek);
    }
}
