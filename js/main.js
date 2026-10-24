/* ============================================================
   CV - Luis Alberto Fleitas Rojas
   main.js
   ============================================================ */

/* ============================================================
   0. PRECARGA DE IMÁGENES EN BASE64 (Evita bloqueo CORS en file://)
   Cuando se abre index.html directamente desde el disco (file://),
   html2canvas marca el canvas como "tainted" con imágenes locales
   y bloquea toDataURL()/toBlob(). Reemplazar por Data URLs Base64
   resuelve el problema tanto en file:// como en servidores web.
   ============================================================ */
function aplicarAssetsBase64() {
    if (!window.CV_ASSETS) return;
    document.querySelectorAll('img[data-asset]').forEach(img => {
        const key = img.getAttribute('data-asset');
        if (window.CV_ASSETS[key]) {
            img.src = window.CV_ASSETS[key];
        }
    });
}

aplicarAssetsBase64();


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

if ('IntersectionObserver' in window) {
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
} else {
    animTargets.forEach(el => el.classList.add('visible'));
}


/* ============================================================
   2. DESCARGA EN PDF (Captura exacta desde x=0, y=0 sin recortes)
   - En pantallas anchas, body.flex.justify-center desplaza #cv-content
     en el eje X (ej. left: 320px). Cuando html2pdf crea su contenedor
     de ancho 794px, html2canvas recortaba esos primeros 320px izquierdos.
   - Al activar body.pdf-capturing + #cv-content.pdf-export-mode y pasar
     x: 0, y: 0 a html2canvas, el documento se alinea en la esquina
     superior izquierda (0, 0) y se captura el 100% del contenido en
     cualquier tamaño de pantalla o nivel de scroll.
   ============================================================ */

async function descargarPDF() {
    const btn     = document.getElementById('btn-download');
    const actions = document.getElementById('floating-actions');
    const el      = document.getElementById('cv-content');

    // Asegurar que las imágenes tengan Data URL Base64 antes de capturar
    aplicarAssetsBase64();

    // Estado de carga en el botón
    btn.classList.add('loading');
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
             style="animation:spin 1s linear infinite">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg><span>Generando...</span>`;

    // Forzar visibilidad de todos los elementos animados
    document.querySelectorAll(ANIM_SELECTORS.join(',')).forEach(e => e.classList.add('visible'));
    document.querySelectorAll('.anim-line').forEach(e => e.style.width = '52px');

    // Guardar posición de scroll actual y subir al inicio
    const prevScrollX = window.scrollX || window.pageXOffset || 0;
    const prevScrollY = window.scrollY || window.pageYOffset || 0;
    window.scrollTo(0, 0);

    // Ocultar barra flotante y alinear el CV en (0, 0) con ancho fijo A4 (794px)
    if (actions) actions.style.display = 'none';
    document.body.classList.add('pdf-capturing');
    el.classList.add('pdf-export-mode');

    // Esperar a que el navegador aplique el reflujo en (0, 0)
    await new Promise(r => setTimeout(r, 150));

    const PAGE_W_MM = 210;
    const PAGE_W_PX = 794;
    const PX_PER_MM = PAGE_W_PX / PAGE_W_MM; // ≈ 3.78095

    const realHeightPx = Math.ceil(el.scrollHeight);
    const realHeightMm = realHeightPx / PX_PER_MM;
    const pageHeightMm = Math.max(297, Math.ceil(realHeightMm) + 2);

    const pdfOptions = {
        margin:   0,
        filename: 'CV_Luis_Fleitas.pdf',
        image:    { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale:           2,
            useCORS:         true,
            allowTaint:      false,
            logging:         false,
            backgroundColor: '#ffffff',
            x:               0,
            y:               0,
            scrollX:         0,
            scrollY:         0,
            windowWidth:     PAGE_W_PX,
            width:           PAGE_W_PX,
            height:          realHeightPx
        },
        jsPDF: {
            unit:        'mm',
            format:      [PAGE_W_MM, pageHeightMm],
            orientation: 'portrait',
            compress:    true
        }
    };

    try {
        if (typeof html2pdf === 'undefined') {
            throw new Error('html2pdf no está disponible');
        }
        await html2pdf().set(pdfOptions).from(el).save();
    } catch (err) {
        console.error('Error en html2pdf, activando impresión nativa como respaldo:', err);
        window.print();
    } finally {
        // Restaurar estado visual original y posición de scroll
        el.classList.remove('pdf-export-mode');
        document.body.classList.remove('pdf-capturing');
        if (actions) actions.style.display = '';
        window.scrollTo(prevScrollX, prevScrollY);

        // Restaurar botón
        btn.classList.remove('loading');
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg><span>Descargar PDF</span>`;
    }
}
