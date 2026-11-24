import { TaskBase } from "./baseTarea.js";
import { diffDays, parseLocalDate, weekdayIndex } from "./calendar.js";

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

    thisDayHas(date) {
        const dia     = parseLocalDate(date);
        const inicio  = parseLocalDate(this.StartDate);

        // Si el día evaluado es anterior al inicio de la tarea, no aplica
        if (dia.getTime() < inicio.getTime()) return false;

        // El día de la semana es el de la fecha real (0 = lunes en la
        // interfaz), no el del día en que se abrió la app.
        return this.hasDay(weekdayIndex(dia));
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

    thisDayHas(date) {
        const dia     = parseLocalDate(date);
        const inicio  = parseLocalDate(this.StartDate);

        // Si el día evaluado es anterior al inicio de la tarea, no aplica
        if (dia.getTime() < inicio.getTime()) return false;

        const cicles = this.Cicles ?? [];
        // Un ciclo vacío (puede venir de un JSON importado) no aplica
        // ningún día: antes esto petaba al buscar la semana del ciclo.
        if (cicles.length === 0) return false;

        // Las semanas del ciclo son semanas reales (lunes a domingo):
        // la primera es la que contiene la fecha de inicio de la tarea.
        const lunesInicio = new Date(inicio);
        lunesInicio.setDate(lunesInicio.getDate() - weekdayIndex(inicio));

        const semanas = Math.floor(diffDays(lunesInicio, dia) / 7);

        // Necesario usar módulo (%) para rotar entre los ciclos disponibles
        const posWeek = semanas % cicles.length;

        const semana = cicles[posWeek];
        return semana ? semana.hasDay(weekdayIndex(dia)) : false;
    }
}
