import html2pdf from 'html2pdf.js';

/**
 * Universal Print & PDF Utility for Railway Roster Manager
 * Handles both browser printing (with iframe/popup fallbacks) and direct file downloads.
 */

export const printElement = (elementOrId, options = {}) => {
  const { title = 'Document', orientation = 'portrait', pageFormat = 'a4' } = options;

  let el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el && typeof elementOrId === 'string') {
    el = document.querySelector(elementOrId);
  }

  // 1. If no specific element provided, try standard window.print()
  if (!el) {
    try {
      window.print();
      return;
    } catch (err) {
      console.warn('Standard window.print() failed:', err);
    }
  }

  // 2. Open an isolated printable iframe / popup to guarantee print works even in WebView2/sandboxed iframes
  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow || printFrame.contentDocument.document || printFrame.contentDocument;
    const doc = frameDoc.document || frameDoc;

    // Grab all application stylesheets & fonts
    let stylesHtml = '';
    const styleSheets = document.querySelectorAll('link[rel="stylesheet"], style');
    styleSheets.forEach(s => {
      stylesHtml += s.outerHTML;
    });

    const contentHtml = el ? el.outerHTML : document.body.innerHTML;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          ${stylesHtml}
          <style>
            @page {
              size: ${pageFormat} ${orientation};
              margin: 8mm;
            }
            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              width: 100% !important;
              height: auto !important;
            }
            .no-print, .btn, .sidebar, .mobile-top-bar, .mobile-bottom-nav, .floating-actions, .filters-panel, .header-container {
              display: none !important;
            }
            .badge, .sub-badge, .blink-advance {
              display: none !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
            th, td {
              border: 1px solid #555555 !important;
              color: #000000 !important;
              background: #ffffff !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${contentHtml}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Trigger printing once loaded
    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        // Fallback to top-level window.print
        window.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(printFrame);
          } catch (e) {}
        }, 3000);
      }
    }, 400);
  } catch (err) {
    console.error('Iframe print failed, falling back to window.print():', err);
    window.print();
  }
};

/**
 * Directly downloads a PDF file to the user's computer without relying on browser print dialog.
 */
export const downloadPdfFromElement = async (elementOrId, filename = 'document.pdf', options = {}) => {
  let el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  if (!el && typeof elementOrId === 'string') {
    el = document.querySelector(elementOrId);
  }
  if (!el) {
    el = document.querySelector('.main-content') || document.body;
  }

  const {
    orientation = 'portrait',
    format = 'a4',
    margin = [8, 8, 8, 8],
    scale = 2
  } = options;

  const opt = {
    margin,
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format,
      orientation
    }
  };

  try {
    await html2pdf().set(opt).from(el).save();
    return true;
  } catch (err) {
    console.error('Direct PDF export error, falling back to printer dialog:', err);
    printElement(el, { orientation, pageFormat: format, title: filename });
    return false;
  }
};
