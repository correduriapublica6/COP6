(() => {
  async function asDataUrl(url) {
    if (!url || String(url).startsWith('data:')) return url;
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return url;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || url));
        reader.onerror = () => reject(new Error('No fue posible incluir una imagen en Word.'));
        reader.readAsDataURL(blob);
      });
    } catch { return url; }
  }
  async function inlineImages(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    await Promise.all([...doc.images].map(async (image) => {
      const source = image.getAttribute('src');
      if (source) image.setAttribute('src', await asDataUrl(source));
    }));
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }
  async function exportHtml(html, folio) {
    if (!window.htmlDocx) { window.alert('No se pudo cargar el generador de Word.'); return; }
    const safeFolio = String(folio || 'sin-numero').replace(/[^a-zA-Z0-9_-]+/g, '_');
    try {
      const prepared = await inlineImages(html);
      const blob = window.htmlDocx.asBlob(prepared, { orientation: 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Avaluo_${safeFolio}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) { window.alert(error.message || 'No se pudo generar el archivo Word.'); }
  }
  window.ControlAvaluosWord = { exportHtml };
})();
