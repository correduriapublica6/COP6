(() => {
  const MAX_WIDTH = 1024;
  const JPEG_QUALITY = 0.7;
  const app = () => window.ControlAvaluosDesktop;

  function compressImage(file) {
    if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) return Promise.resolve(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, MAX_WIDTH / image.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return reject(new Error('No fue posible preparar la imagen.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error(`No fue posible comprimir ${file.name}.`));
          const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
          resolve(new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', JPEG_QUALITY);
      };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`No fue posible leer ${file.name}.`)); };
      image.src = objectUrl;
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`No fue posible preparar ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFiles(files, options = {}) {
    const selected = [...(files || [])].filter(Boolean).slice(0, Number(options.maxFiles || 8));
    if (!selected.length) return [];
    const prepared = [];
    for (const original of selected) {
      const file = await compressImage(original);
      const data = await fileToDataUrl(file);
      prepared.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data });
    }
    const result = await app().apiRequest('/uploads', { method: 'POST', body: JSON.stringify({ files: prepared }) });
    return Array.isArray(result?.files) ? result.files.map((file) => ({ ...file, url: file.url ? new URL(file.url, app().getApiBaseUrl()).href : "" })) : [];
  }

  async function uploadDataUrl(dataUrl, name = 'imagen.jpg') {
    if (!dataUrl || !String(dataUrl).startsWith('data:')) return dataUrl ? { url: dataUrl, name } : null;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const files = await uploadFiles([new File([blob], name, { type: blob.type || 'image/jpeg' })], { maxFiles: 1 });
    return files[0] || null;
  }

  window.ControlAvaluosImageUtils = { MAX_WIDTH, JPEG_QUALITY, compressImage, uploadFiles, uploadDataUrl };
})();
