export class TaskBase{

    name;
    total=1;
    start;

    get Start(){
        return this.start;
    }

    set Start(start){
        this.start=start;
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
