import * as Main from '../../back/main.js';

export class PrintCard {

    constructor(root, context) {
        this.root = root;
        this.context = context;
    }

    async init() {

        const html = await fetch('./ui/print/print-card.html').then(r => r.text());
        const css = await fetch('./ui/print/print-card.css').then(r => r.text());

        this.root.innerHTML = `<style>${css}</style>${html}`;

        this.mount();
    }

    mount() {

        this.root.querySelector('#printWeek').onclick = () => {
            this.export(1);
        };

        this.root.querySelector('#printAll').onclick = () => {
            this.export(12);
        };
    }

    export(n) {

        const weeks = Main.GetNWeeks(this.context.StartDate, n, 0, this.context.Tasks);

        const container = document.createElement('div');
        container.className = 'print-root';

        container.innerHTML = weeks.map(w =>
            `<div class="page">
                ${JSON.stringify(w)}
             </div>`
        ).join('');

        document.body.appendChild(container);

        html2pdf()
            .set({
                filename: 'planner.pdf',
                html2canvas: { scale: 2 },
                jsPDF: { format: 'a4', orientation: 'landscape' }
            })
            .from(container)
            .save()
            .then(() => container.remove());
    }
}