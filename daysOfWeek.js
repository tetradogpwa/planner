import { TaskBase } from "./baseTarea";








class DaysOfWeekTask extends TaskBase{
    
    flags = 0;

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

    thisDayHas(dayFromOrigin){
        const dayOfWeek=dayFromOrigin%7;
        return this.hasDay(dayOfWeek);
    }
}

class CiclesDaysOfWeekTask extends TaskBase{
    cicles=[];

    get Cicles(){
        return this.cicles;
    }

    set Cicles(cicles){
        this.cicles=cicles;
    }

    thisDayHas(dayFromOrigin){
        const posWeek=dayFromOrigin/this.cicles.length;
        const dayOfWeek=dayFromOrigin%7;
        return this.Cicles[posWeek].hasDay(dayOfWeek);
    }
}


export {
    DaysOfWeekTask,
    CiclesDaysOfWeekTask,
};