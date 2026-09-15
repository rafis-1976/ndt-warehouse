import { useRef, useState } from 'react';
import {
  Upload, X, FileText, Download, AlertCircle, Loader2, FolderOpen,
} from 'lucide-react';
import {
  subirDocumento, eliminarDocumento, formatearTamano, iconoDocumento,
  type DocumentoEquipo,
} from '../../lib/storage';

interface DocumentosUploadProps {
  equipoId: string;
  documentos: DocumentoEquipo[];
  onChange: (docs: DocumentoEquipo[]) => void;
  disabled?: boolean;
}

export function DocumentosUpload({
  equipoId, documentos, onChange, disabled,
}: DocumentosUploadProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setSubiendo(true);

    try {
      const subidos: DocumentoEquipo[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          setError(`"${file.name}" supera los 20 MB. Se ha omitido.`);
          continue;
        }
        const doc = await subirDocumento(file, equipoId, 'otros');
        subidos.push(doc);
      }
      onChange([...documentos, ...subidos]);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir archivos');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleEliminar = async (doc: DocumentoEquipo) => {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    try {
      await eliminarDocumento(doc.url);
      onChange(documentos.filter((d) => d.url !== doc.url));
    } catch (err: any) {
      setError(err.message ?? 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled && !subiendo) handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition ${
          disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-airbus-sky hover:bg-airbus-sky/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || subiendo}
        />

        {subiendo ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 text-airbus-sky animate-spin" />
            <p className="text-sm text-gray-600">Subiendo archivos...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="w-6 h-6 text-gray-400" />
            <p className="text-sm text-gray-600">
              Arrastra archivos aquí o{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="text-airbus-sky hover:text-airbus-blue font-medium underline disabled:opacity-50"
              >
                selecciona archivos
              </button>
            </p>
            <p className="text-[11px] text-gray-400">
              PDF, imágenes, Word, Excel, ZIP · máx. 20 MB por archivo
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-airbus-red/10 border border-airbus-red/20 text-airbus-red text-xs p-2.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {documentos.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {documentos.map((doc) => (
            <div key={doc.url} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition">
              <span className="text-lg shrink-0">{iconoDocumento(doc.tipo)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{doc.nombre}</p>
                <p className="text-[10px] text-gray-400">
                  {formatearTamano(doc.tamano)} · {new Date(doc.subido_en).toLocaleDateString('es-ES')}
                </p>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-airbus-sky hover:bg-airbus-sky/10 rounded transition shrink-0"
                title="Descargar"
              >
                <Download className="w-4 h-4" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleEliminar(doc)}
                  className="p-1.5 text-gray-300 hover:text-airbus-red hover:bg-airbus-red/10 rounded transition shrink-0"
                  title="Eliminar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentosLista({ documentos }: { documentos: DocumentoEquipo[] }) {
  if (!documentos || documentos.length === 0) return null;

  return (
    <div className="space-y-2">
      {documentos.map((doc) => (
        <a
          key={doc.url}
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 bg-gray-50 hover:bg-airbus-sky/5 rounded-lg transition border border-gray-200"
        >
          <span className="text-lg shrink-0">{iconoDocumento(doc.tipo)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">{doc.nombre}</p>
            <p className="text-[10px] text-gray-400">{formatearTamano(doc.tamano)}</p>
          </div>
          <Download className="w-4 h-4 text-airbus-sky shrink-0" />
        </a>
      ))}
    </div>
  );
}