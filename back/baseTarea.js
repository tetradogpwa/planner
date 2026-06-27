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
        // Serializa recursivamente para que las tareas anidadas
        // (LimitedTimeTask / OneTimeTask) también lleven su className.
        const serialize = t => {
            const obj = { ...t, className: t.constructor.name };
            if (t.task && typeof t.task === 'object' && t.task.constructor) {
                obj.task = serialize(t.task);
            }
            return obj;
        };
        return JSON.stringify(tasks.map(serialize));
    }

}