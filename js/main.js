/* ============================================================
   CV - Luis Alberto Fleitas Rojas
   main.js
   ============================================================ */

/* ============================================================
   1. INTERSECTION OBSERVER — Animaciones al hacer scroll
   Agrega la clase "visible" cuando el elemento entra en pantalla.
   Una vez animado, deja de ser observado (la animación no se repite).
   ============================================================ */

const ANIM_SELECTORS = [
    '.anim-block',
    '.anim-right',
    '.anim-left',
    '.anim-hero',
    '.anim-photo',
    '.anim-line'
];

const animTargets = document.querySelectorAll(ANIM_SELECTORS.join(','));

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            scrollObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.12,
    rootMargin: '0px 0px -20px 0px'
});

animTargets.forEach(el => scrollObserver.observe(el));


/* ============================================================
   2. DESCARGA EN PDF
   - Fuerza la visibilidad de todos los elementos animados
     antes de capturar, para que el PDF quede completo.
   - Ajusta el ancho al tamaño A4 durante la captura y
     restaura los estilos originales al terminar.
   ============================================================ */

async function descargarPDF() {
    const btn = document.getElementById('btn-download');
    const el  = document.getElementById('cv-content');

    // Estado de carga en el botón
    btn.classList.add('loading');
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
             style="animation:spin 1s linear infinite">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>Generando...`;

    // Forzar visibilidad de todos los elementos animados
    document.querySelectorAll(ANIM_SELECTORS.join(',')).forEach(e => e.classList.add('visible'));
    document.querySelectorAll('.anim-line').forEach(e => e.style.width = '48px');

    // Guardar estilos originales del contenedor
    const orig = {
        padding:   el.style.padding,
        maxWidth:  el.style.maxWidth,
        boxShadow: el.style.boxShadow,
        width:     el.style.width,
        overflow:  el.style.overflow
    };

    // Constantes A4
    const PAGE_W_MM = 210;
    const MARGIN_MM = 12;
    const PX_PER_MM = 96 / 25.4; // ≈ 3.7795

    // Ajustar al ancho A4 exacto para captura
    el.style.padding   = MARGIN_MM + 'mm';
    el.style.maxWidth  = 'none';
    el.style.boxShadow = 'none';
    el.style.width     = PAGE_W_MM + 'mm';
    el.style.overflow  = 'visible';

    // Esperar relayout
    await new Promise(r => setTimeout(r, 150));

    // Calcular alto real del contenido
    const realHeightPx = el.scrollHeight;
    const realHeightMm = realHeightPx / PX_PER_MM;
    const pageHeightMm = Math.max(297, Math.ceil(realHeightMm) + 5);

    const pdfOptions = {
        margin:   0,
        filename: 'CV_Luis_Fleitas.pdf',
        image:    { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale:           2,
            useCORS:         true,
            logging:         false,
            backgroundColor: '#ffffff',
            windowWidth:     Math.round(PAGE_W_MM * PX_PER_MM),
            height:          realHeightPx,
            scrollY:         0
        },
        jsPDF: {
            unit:        'mm',
            format:      [PAGE_W_MM, pageHeightMm],
            orientation: 'portrait',
            compress:    true
        }
    };

    await html2pdf().set(pdfOptions).from(el).save();

    // Restaurar estilos originales
    el.style.padding   = orig.padding;
    el.style.maxWidth  = orig.maxWidth;
    el.style.boxShadow = orig.boxShadow;
    el.style.width     = orig.width;
    el.style.overflow  = orig.overflow;

    // Restaurar botón
    btn.classList.remove('loading');
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>Descargar PDF`;
}
