import type { ImagePickerOptions, ImagePickerResult } from 'expo-image-picker';

export async function requestMediaLibraryPermissionsAsync() { return { granted: true }; }
export async function launchImageLibraryAsync(_options?: ImagePickerOptions): Promise<ImagePickerResult> {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  document.body.appendChild(input);
  return new Promise((resolve, reject) => {
    const done = () => input.remove();
    input.addEventListener('cancel', () => { done(); resolve({ canceled: true, assets: null }); }, { once: true });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) { done(); resolve({ canceled: true, assets: null }); return; }
      let objectUrl: string | undefined;
      try {
        if (!file.type.startsWith('image/') || file.size > 32 * 1024 * 1024) throw Error('Odaberi fotografiju do 32 MB.');
        const image = new window.Image(); objectUrl = URL.createObjectURL(file); image.src = objectUrl;
        try { await image.decode(); } catch { throw Error('Preglednik ne može otvoriti ovu fotografiju. Odaberi JPEG/PNG ili spremi tekstualnu uspomenu.'); }
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 64000000) throw Error('Odaberi manju fotografiju.');
        const uri = await new Promise<string>((ok, fail) => {
          const reader = new FileReader(); reader.onerror = () => fail(Error('Fotografiju nije moguće pročitati. Pokušaj ponovno.'));
          reader.onload = () => ok(String(reader.result)); reader.readAsDataURL(file);
        });
        resolve({ canceled: false, assets: [{ uri, width: image.naturalWidth, height: image.naturalHeight, type: 'image', fileName: file.name, mimeType: file.type }] });
      } catch (error) { reject(error); }
      finally { if (objectUrl) URL.revokeObjectURL(objectUrl); done(); }
    }, { once: true });
    input.click();
  });
}
