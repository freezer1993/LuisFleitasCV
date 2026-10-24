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
   1. RASTERIZACIÓN DE ÍCONOS SVG A PNG EN MEMORIA PARA PDF
   html2canvas (incluido en html2pdf 0.10.1) tiene un bug conocido
   donde recorta la mitad derecha/inferior de los elementos <svg>
   con viewBox="0 0 24 24" y clases de tamaño pequeño (14px-20px).
   Esta función convierte cada <svg> dentro de #cv-content en un
   <img> PNG de alta resolución (4x) antes de capturar y los
   restaura al terminar.
   ============================================================ */
async function convertirSVGsAPngParaPDF(contenedor) {
    const svgs = Array.from(contenedor.querySelectorAll('svg'));
    const restauradores = [];

    for (const svg of svgs) {
        const rect = svg.getBoundingClientRect();
        const w = rect.width  || parseFloat(svg.getAttribute('width'))  || 16;
        const h = rect.height || parseFloat(svg.getAttribute('height')) || 16;

        const computed = window.getComputedStyle(svg);
        const color = computed.color || '#008080';

        // Clonar SVG y fijar dimensiones y colores explícitos para renderizado aislado
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', w * 4);
        clone.setAttribute('height', h * 4);
        clone.style.color = color;

        // Reemplazar currentColor por el color RGB computado real
        let svgXml = new XMLSerializer().serializeToString(clone);
        svgXml = svgXml.replace(/currentColor/g, color);

        const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml);

        const pngDataUrl = await new Promise((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width  = w * 4;
                canvas.height = h * 4;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0, w * 4, h * 4);
                resolve(canvas.toDataURL('image/png'));
            };
            tempImg.onerror = () => resolve(null);
            tempImg.src = svgDataUrl;
        });

        if (pngDataUrl && svg.parentNode) {
            const imgReplacement = document.createElement('img');
            imgReplacement.src = pngDataUrl;
            imgReplacement.className = svg.getAttribute('class') || '';
            imgReplacement.style.width      = w + 'px';
            imgReplacement.style.height     = h + 'px';
            imgReplacement.style.flexShrink = '0';
            imgReplacement.style.display    = 'inline-block';

            const parent = svg.parentNode;
            parent.replaceChild(imgReplacement, svg);
            restauradores.push(() => {
                if (imgReplacement.parentNode === parent) {
                    parent.replaceChild(svg, imgReplacement);
                }
            });
        }
    }

    return () => restauradores.forEach(fn => fn());
}


/* ============================================================
   2. INTERSECTION OBSERVER — Animaciones al hacer scroll
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
   3. DESCARGA EN PDF (Captura exacta desde x=0, y=0 e íconos nítidos)
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

    // Convertir temporalmente los <svg> a <img> PNG 4x para evitar el recorte de viewBox en html2canvas
    const restaurarSVGs = await convertirSVGsAPngParaPDF(el);

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
        // Restaurar SVGs originales, estado visual y posición de scroll
        restaurarSVGs();
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
