export class TaskBase{

    name;
    total=1;

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


    thisDayHas(dayFromOrigin){
        throw new Error("Not implemented");
    }

   static toJson(tasks){
        return JSON.stringify(tasks.map(t=>({...t,className:t.constructor.name})));
    }

}
