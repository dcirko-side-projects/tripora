import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, manipulateAsync, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { digest, CryptoDigestAlgorithm, randomUUID } from 'expo-crypto';
import { MediaIO, MediaPrepared } from './mediaQueue';
import { InputError } from './localStore';
async function hash(file: File): Promise<string> { return Array.from(new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, await file.bytes()))).map(v => v.toString(16).padStart(2, '0')).join(''); }
export async function deleteNativeMediaScope(scope: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(scope)) throw new Error('Neispravna pohrana računa.');
    const directory = new Directory(Paths.document, 'tripora-media', scope);
    if (directory.exists) directory.delete();
}
export function createNativeMediaIO(scope: string): MediaIO {
    if (!/^[a-f0-9]{64}$/.test(scope))
        throw new Error('Neispravna pohrana računa.');
    const directory = new Directory(Paths.document, 'tripora-media', scope);
    const destination = (id: string, thumbnail: boolean) => { if (!/^[a-f0-9-]{36}$/i.test(id))
        throw new InputError('Neispravan identifikator slike.'); return new File(directory, id + (thumbnail ? '.thumb.png' : '.png')); };
    const own = (uri: string) => { const canonical = new URL(uri).href; let base = new URL(directory.uri).href; while (base.endsWith('/'))
        base = base.slice(0, -1); if (!canonical.startsWith(base + '/'))
        throw new InputError('Fotografija ne pripada pohrani ovog računa.'); return new File(canonical); };
    const ensure = () => { if (!directory.exists)
        directory.create({ intermediates: true, idempotent: true }); };
    async function write(id: string, base64: string, thumbnail: boolean, expectedHash: string): Promise<string> {
        ensure();
        const target = destination(id, thumbnail);
        const temp = new File(directory, id + '.' + randomUUID() + '.part');
        let moved = false;
        try {
            temp.create();
            temp.write(base64, { encoding: 'base64' });
            if ((temp.size ?? Infinity) > (thumbnail ? 1024 * 1024 : 8 * 1024 * 1024) || await hash(temp) !== expectedHash)
                throw new InputError('Fotografija je oštećena ili prevelika.');
            await temp.move(target, { overwrite: true });
            moved = true;
            return target.uri;
        }
        finally {
            if (!moved && temp.exists)
                temp.delete();
        }
    }
    const io: MediaIO = {
        async prepare(uri, width, height, id): Promise<MediaPrepared> {
            if (Number.isFinite(Paths.availableDiskSpace) && Paths.availableDiskSpace < 32 * 1024 * 1024)
                throw new InputError('Nema dovoljno prostora za fotografiju. Oslobodi barem 32 MB ili spremi tekstualnu uspomenu.');
            if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)
                throw new InputError('Neispravna fotografija.');
            const fit = (w: number, h: number, edge: number) => w >= h ? { width: Math.min(w, edge) } : { height: Math.min(h, edge) };
            const context = ImageManipulator.manipulate(uri);
            let decoded: ImageRef | undefined;
            let rendered: ImageRef | undefined;
            let fullFile: File | undefined;
            let thumbFile: File | undefined;
            let durable: string | undefined;
            try {
                // Picker dimensions can precede EXIF rotation. Bound the decoded bitmap instead.
                decoded = await context.renderAsync();
                if (!Number.isFinite(decoded.width) || !Number.isFinite(decoded.height) || decoded.width < 1 || decoded.height < 1 || decoded.width * decoded.height > 64000000)
                    throw new InputError('Odaberi manju ili ispravnu fotografiju.');
                context.resize(fit(decoded.width, decoded.height, 1280));
                decoded.release();
                decoded = undefined;
                rendered = await context.renderAsync();
                const image = await rendered.saveAsync({ format: SaveFormat.PNG });
                fullFile = new File(image.uri);
                const thumbnail = await manipulateAsync(image.uri, [{ resize: fit(image.width, image.height, 320) }], { format: SaveFormat.PNG });
                thumbFile = new File(thumbnail.uri);
                const sha256 = await hash(fullFile);
                const thumbnailSha256 = await hash(thumbFile);
                durable = await write(id, await fullFile.base64(), false, sha256);
                const thumbnailUri = await write(id, await thumbFile.base64(), true, thumbnailSha256);
                return { uri: durable, thumbnailUri, sha256, thumbnailSha256 };
            }
            catch (error) {
                if (durable && own(durable).exists)
                    own(durable).delete();
                throw error;
            }
            finally {
                decoded?.release();
                rendered?.release();
                context.release();
                if (fullFile?.exists)
                    fullFile.delete();
                if (thumbFile?.exists)
                    thumbFile.delete();
            }
        },
        async repairOversized(item) {
            const full = own(item.uri);
            const thumb = own(item.thumbnailUri);
            if (await hash(full) !== item.sha256 || await hash(thumb) !== item.thumbnailSha256)
                throw new InputError('Fotografija je oštećena; lokalni izvornik je sačuvan.');
            const dimensions = async (file: File) => {
                const bytes = await file.bytes();
                if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82].every((v, i) => bytes[i] === v))
                    return null;
                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                return { width: view.getUint32(16), height: view.getUint32(20) };
            };
            const image = await dimensions(full), thumbnail = await dimensions(thumb);
            if (!image || !thumbnail || image.width < 1 || image.height < 1 || thumbnail.width < 1 || thumbnail.height < 1 || image.width * image.height > 64000000)
                return null;
            if (Math.max(image.width, image.height) <= 1280 && Math.max(thumbnail.width, thumbnail.height) <= 320)
                return null;
            // New paths allow a failed DB write/crash to retain the original queued bytes.
            return io.prepare(item.uri, image.width, image.height, randomUUID());
        },
        base64: uri => own(uri).base64(), write,
        async remove(uri) { const file = own(uri); if (file.exists)
            file.delete(); },
    };
    return io;
}
