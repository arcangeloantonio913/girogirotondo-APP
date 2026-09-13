import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Mappa MIME → estensione file, per dare un nome sensato al file condiviso.
 */
function mimeToExt(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('webp')) return 'webp';
  if (m.includes('wordprocessingml')) return 'docx';
  if (m.includes('msword')) return 'doc';
  if (m.includes('spreadsheetml')) return 'xlsx';
  if (m.includes('ms-excel')) return 'xls';
  return 'bin';
}

function sanitize(name?: string): string {
  return (name || '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Apre un file dato il suo URL. Gestisce sia gli URL http(s)/firmati sia i **data URL
 * base64** (`data:<mime>;base64,...`).
 *
 * PERCHÉ: i documenti/allegati caricati dall'app vengono salvati dal backend come data URL
 * base64. `Linking.openURL` NON apre gli URI `data:` (fallisce su iOS e in genere su Android),
 * quindi il file va decodificato su un file temporaneo e condiviso con expo-sharing.
 *
 * Solleva un errore in caso di fallimento (gestirlo con un Alert lato chiamante).
 */
export async function openFileUrl(url: string, filename?: string): Promise<void> {
  if (!url) throw new Error('Nessun file da aprire');

  if (url.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(url);
    if (!match) throw new Error('Formato file non valido');
    const mime = match[1] || 'application/octet-stream';
    const base64 = match[2] || '';
    const ext = mimeToExt(mime);
    let name = sanitize(filename);
    if (!name) name = `documento.${ext}`;
    else if (!/\.[A-Za-z0-9]+$/.test(name)) name = `${name}.${ext}`;

    const path = new FileSystem.File(FileSystem.Paths.cache, name).uri;
    // writeAsStringAsync è nell'API legacy in SDK 54
    await LegacyFS.writeAsStringAsync(path, base64, { encoding: 'base64' });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, { mimeType: mime });
    } else {
      // Fallback estremo (raro): prova ad aprire il file locale
      await Linking.openURL(path);
    }
    return;
  }

  // URL http(s)/firmato: prova l'apertura diretta, altrimenti scarica e condividi.
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return;
  }
  const ext = url.split('?')[0].split('.').pop() || 'bin';
  const name = sanitize(filename) || `documento.${ext}`;
  const path = new FileSystem.File(FileSystem.Paths.cache, name).uri;
  await LegacyFS.downloadAsync(url, path);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(path);
  else throw new Error('Impossibile aprire il file');
}
