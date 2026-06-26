import { TaskBase } from "./baseTarea";



class NDaysTask extends TaskBase {
    nDays;
    get NDays(){
        return this.nDays;
    }
    set _NDays(nDays){
        this.nDays=nDays;
    }
    thisDayHas(dayFromOrigin){
        return dayFromOrigin%this.nDays === 0;
    }
}

class DailyTask extends NDaysTask{
    constructor(){
        this.nDays=1;
    }
}
class WeeklyTask extends NDaysTask{
    constructor(){
        this.nDays=7;
    }
}
class MonthlyTask extends NDaysTask{
    constructor(){
        this.nDays=30;
    }
}
class QuaterlyTask extends NDaysTask{
    constructor(){
        this.nDays=90;
    }
}
export {
    NDaysTask,
    DailyTask,
    WeeklyTask,
    MonthlyTask,
    QuaterlyTask,
};