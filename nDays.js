import { TaskBase } from "./baseTarea.js";



export class NDaysTask extends TaskBase {
    nDays;
    get NDays(){
        return this.nDays;
    }
    set NDays(nDays){
        this.nDays=nDays;
    }
    thisDayHas(dayFromOrigin){
        return dayFromOrigin%this.nDays === 0;
    }
}

export class DailyTask extends NDaysTask{
    constructor(){
        this.NDays=1;
    }
}
export class WeeklyTask extends NDaysTask{
    constructor(){
        this.NDays=7;
    }
}
export class MonthlyTask extends NDaysTask{
    constructor(){
        this.NDays=30;
    }
}
export class QuaterlyTask extends NDaysTask{
    constructor(){
        this.NDays=90;
    }
}
