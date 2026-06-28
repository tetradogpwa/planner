import { GetNWeeks } from '../../back/calendar.js';

export class PrintCard {
  constructor(root, context) {
    this.root    = root;
    this.context = context;
  }

  async init() {
    const [html, css] = await Promise.all([
      fetch('./ui/print/print-card.html').then(r => r.text()),
      fetch('./ui/print/print-card.css').then(r => r.text()),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.mount();
  }

  mount() {
    this.root.querySelector('#printWeekBtn').onclick   = () => this.export(1, 0);
    this.root.querySelector('#printAllBtn').onclick    = () => this.export(12, 0);
    this.root.querySelector('#printCustomBtn').onclick = () => {
      const n     = parseInt(this.root.querySelector('#printWeeks').value) || 4;
      const avoid = parseInt(this.root.querySelector('#printAvoid').value) || 0;
      this.export(n, avoid);
    };
  }

  #setStatus(msg) {
    const el = this.root.querySelector('#printStatus');
    if (el) el.textContent = msg;
  }

  async export(nWeeks, avoid) {
    this.#setStatus('⏳ Generando PDF…');

    const weeks    = GetNWeeks(this.context.StartDate, nWeeks, avoid, this.context.Tasks);
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const fmt      = d => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

    const container = document.createElement('div');
    container.style.cssText = 'font-family:system-ui,sans-serif;padding:16px;background:#fff;color:#111;';

    weeks.forEach((week, wi) => {
      const monday = week.mondayTo;
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const grid = dayNames.map((dayName, di) => {
        const tasks   = week.weekTasks[di] || [];
        const dayDate = new Date(monday);
        dayDate.setDate(dayDate.getDate() + di);

        const badges = tasks.flatMap(t =>
          Array.from({ length: t.Total }, (_, i) => {
            const slot = t.Total > 1 ? (i === 0 ? ' (0-12h)' : ' (12-24h)') : '';
            return `<div style="background:#ede9fe;color:#4f46e5;font-size:9px;
                                padding:2px 5px;border-radius:4px;margin-bottom:2px;
                                line-height:1.4;">${t.Name}${slot}</div>`;
          })
        ).join('');

        return `
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:6px;min-height:80px;">
            <div style="font-size:9px;font-weight:700;color:#6366f1;margin-bottom:4px;">
              ${dayName} ${fmt(dayDate)}
            </div>
            ${badges || '<div style="color:#ccc;font-size:9px">—</div>'}
          </div>`;
      }).join('');

      container.innerHTML += `
        <div style="margin-bottom:20px;page-break-inside:avoid;">
          <div style="font-size:13px;font-weight:700;color:#4f46e5;margin-bottom:6px;
                      border-bottom:2px solid #e5e7eb;padding-bottom:4px;">
            Semana ${wi + 1} &nbsp; ${fmt(monday)} – ${fmt(sunday)}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
            ${grid}
          </div>
        </div>`;
    });

    document.body.appendChild(container);
    try {
      await html2pdf()
        .set({
          filename:    `planner-${nWeeks}sem.pdf`,
          margin:      [8, 8, 8, 8],
          html2canvas: { scale: 2 },
          jsPDF:       { format: 'a4', orientation: 'landscape', unit: 'mm' },
        })
        .from(container)
        .save();
      this.#setStatus('✅ PDF generado');
    } catch (e) {
      console.error(e);
      this.#setStatus('❌ Error al generar PDF');
    } finally {
      container.remove();
      setTimeout(() => this.#setStatus(''), 4000);
    }
  }
}
