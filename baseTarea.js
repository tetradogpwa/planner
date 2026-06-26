export class TaskBase{

    name;
    total=1;
    daysFrom=0;

    get DaysFrom(){
        return this.daysFrom;
    }

    set DaysFrom(daysFrom){
        this.daysFrom=daysFrom;
    }

    getStart(from){
        const f=new Date(from);
        f.setDate(f.getDate()+this.DaysFrom);
        return f;
    }

    get Total(){
        return this.total;
    }

    set Total(total){
        this.total=total;
    }

    get Name(){
        return this.name;
    }

    set Name(name){
        this.name=name;
    }


    thisDayHas(from,dayFromOrigin){
        throw new Error("Not implemented");
    }

   static toJson(tasks){
        return JSON.stringify(tasks.map(t=>({...t,className:t.constructor.name})));
    }

}
