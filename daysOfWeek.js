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
        // Si el día evaluado es anterior al inicio de la tarea, no aplica
        if (dayFromOrigin < this.DaysFrom) return false;
        
        const dayOfWeek = dayFromOrigin % 7;
        return this.hasDay(dayOfWeek);
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
        // Si el día evaluado es anterior al inicio de la tarea, no aplica
        if (dayFromOrigin < this.DaysFrom) return false;

        // Necesario usar Math.floor para no obtener decimales
        const weeks = Math.floor(dayFromOrigin / 7);
        const dayOfWeek = dayFromOrigin % 7;
        
        // Necesario usar módulo (%) para rotar entre los ciclos disponibles
        const posWeek = weeks % this.Cicles.length;
        
        return this.Cicles[posWeek].hasDay(dayOfWeek);
    }
}