import * as Main from '../../back/main.js';

export class AddTaskCard {
    constructor(root) {
        this.root = root;

        this.repeatType = "no-repeat";
    }

    async init() {
        const [html, css] = await Promise.all([
            fetch('./ui/addTask/addTask-card.html').then(r => r.text()),
            fetch('./ui/addTask/addTask-card.css').then(r => r.text())
        ]);

        this.root.innerHTML = `
            <style>${css}</style>
            ${html}
        `;

        this.cache();
        this.bind();
    }

    cache() {
        this.name = this.root.querySelector('#taskName');
        this.times = this.root.querySelector('#timesPerDay');
        this.radios = this.root.querySelectorAll('input[name="repeat"]');
        this.extra = this.root.querySelector('#extraOptions');
        this.btn = this.root.querySelector('#addTaskBtn');
    }

    bind() {
        this.radios.forEach(r => {
            r.addEventListener('change', () => {
                this.repeatType = r.value;
                this.renderExtra();
            });
        });

        this.renderExtra();

        this.btn.addEventListener('click', () => {
            this.createTask();
        });
    }

    renderExtra() {
        this.extra.innerHTML = "";

        if (this.repeatType === "interval") {
            this.extra.innerHTML = `
                <div class="form-group">
                    <label>Intervalo días</label>
                    <input type="number" id="interval" value="3">
                </div>
            `;
        }

        if (this.repeatType === "days") {
            this.extra.innerHTML = `
                <div class="form-group">
                    <label>Días de la semana</label>
                    <div>
                        ${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
                            .map((d,i)=>`
                                <label>
                                    <input type="checkbox" value="${i}">
                                    ${d}
                                </label>
                            `).join("")}
                    </div>
                </div>
            `;
        }
    }

    createTask() {
        const name = this.name.value.trim();
        const total = parseInt(this.times.value) || 1;

        if (!name) return alert("Nombre requerido");

        let task = null;

        if (this.repeatType === "no-repeat") {
            task = Main.CreateOneTimeTask(
                Main.CreateDailyTask(name, total, 0),
                total,
                0
            );
        }

        if (this.repeatType === "daily") {
            task = Main.CreateDailyTask(name, total, 0);
        }

        if (this.repeatType === "interval") {
            const interval = parseInt(this.extra.querySelector('#interval').value) || 3;
            task = Main.CreateNDaysTask(name, interval, total, 0);
        }

        if (this.repeatType === "days") {
            const days = [...this.extra.querySelectorAll('input:checked')]
                .map(x => parseInt(x.value));

            if (!days.length) return alert("Selecciona días");

            task = Main.CreateDaysOfWeekTask(name, days, total, 0);
        }

        if (!task) return;

        this.root.dispatchEvent(new CustomEvent('task-create', {
            detail: task,
            bubbles: true
        }));

        this.reset();
    }

    reset() {
        this.name.value = "";
        this.times.value = 1;
        this.repeatType = "no-repeat";
        this.radios[0].checked = true;
        this.renderExtra();
    }
}