import { TaskBase } from "./baseTarea.js";



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
    
    thisDayHas(from,dayFromOrigin){
        
        const MAX=this.Repeat-1;
        let total=0;
        
        for(let i=0;i<dayFromOrigin && total <= MAX;i++){
            if(this.Task.thisDayHas(from,i))total++;
        };
        //si no ha pasado hasta ahora y ese dia por casualidad es, entonces lo es
        //el segundo o siguiente no lo es
        return total===MAX && this.Task.thisDayHas(from,dayFromOrigin);
    }
}

export class OneTimeTask extends LimitedTimeTask{
    constructor(){
        super();
        this.Repeat=1;
    }
}
