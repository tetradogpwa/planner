import * as Main from '../../back/main.js';

export class DataManagerCard {

    constructor(root, context) {
        this.root = root;
        this.context = context;
    }

    async init() {

        const html = await fetch('./ui/dataManager/dataManager-card.html').then(r => r.text());
        const css = await fetch('./ui/dataManager/dataManager-card.css').then(r => r.text());

        this.root.innerHTML = `<style>${css}</style>${html}`;

        this.mount();
    }

    mount() {

        this.root.querySelector('#exportJson').onclick = () => {
            const blob = new Blob(
                [Main.ToJson(this.context.Tasks)],
                { type: 'application/json' }
            );

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = "planner.json";
            a.click();
        };

        this.root.querySelector('#importJson').onchange = (e) => {
            const file = e.target.files[0];

            const r = new FileReader();
            r.onload = ev => {
                this.context.Tasks.length = 0;
                Main.FromJson(ev.target.result).forEach(t => this.context.Tasks.push(t));
            };
            r.readAsText(file);
        };

        this.root.querySelector('#clearAll').onclick = () => {
            if (confirm("Borrar todo?")) {
                this.context.Tasks.length = 0;
            }
        };
    }
}