import { TaskBase } from "./baseTarea.js";



export class NDaysTask extends TaskBase {
    nDays;
    get NDays(){
        return this.nDays;
    }
    set NDays(nDays){
        this.nDays=nDays;
    }
    thisDayHas(from,dayFromOrigin){
        return this.fromIsBefore(from) &&  dayFromOrigin%this.nDays === 0;
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
