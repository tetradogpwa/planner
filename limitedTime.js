import { TaskBase } from "./baseTarea.js";



export class LimitedTimeTask extends TaskBase{
    task;
    repeat=1;
    get Task(){
        return this.task;
    }

    set _Task(task){
        this.task=task;
    }

    get Repeat(){
        return this.repeat;
    }
    set _Repeat(repeat){
        this.repeat=repeat;
    }
    
    thisDayHas(dayFromOrigin){
        
        const MAX=this.Repeat-1;
        let total=0;
        
        for(let i=0;i<dayFromOrigin && total <= MAX;i++){
            if(this.Task.thisDayHas(i))total++;
        };
        //si no ha pasado hasta ahora y ese dia por casualidad es, entonces lo es
        //el segundo o siguiente no lo es
        return total===MAX && this.Task.thisDayHas(dayFromOrigin);
    }
}

export class OneTimeTask extends LimitedTimeTask{
    constructor(){
        this._Repeat=1;
    }
}
