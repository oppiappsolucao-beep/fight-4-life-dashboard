import { useCallback, useEffect, useRef, useState } from "react";

interface OwnerStudentPhotoFieldProps {
  preview: string | null;
  onPreviewChange: (preview: string | null, file?: File) => void;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("unsupported");
  }

  const videoConstraints: MediaTrackConstraints = isMobileDevice()
    ? { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 } };

  return navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: false,
  });
}

export default function OwnerStudentPhotoField({
  preview,
  onPreviewChange,
}: OwnerStudentPhotoFieldProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    onPreviewChange(URL.createObjectURL(file), file);
    event.target.value = "";
  }

  function handleRemovePhoto() {
    onPreviewChange(null);
  }

  function handleTakePhoto() {
    if (window.isSecureContext) {
      setCameraOpen(true);
      return;
    }

    if (isMobileDevice()) {
      mobileCameraInputRef.current?.click();
      return;
    }

    setCameraOpen(true);
  }

  return (
    <>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-black/30">
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <UserPlaceholderIcon />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTakePhoto}
              className="rounded-lg border border-[#e85d6f]/40 bg-[#e85d6f]/15 px-4 py-2 text-[0.75rem] font-medium text-[#e85d6f] transition hover:bg-[#e85d6f]/25"
            >
              Tirar foto
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="rounded-lg border border-white/15 px-4 py-2 text-[0.75rem] font-medium text-white/70 transition hover:border-[#e85d6f]/40 hover:text-white"
            >
              Escolher da galeria
            </button>
            {preview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="rounded-lg border border-white/15 px-4 py-2 text-[0.75rem] font-medium text-white/50 transition hover:border-red-400/40 hover:text-red-300"
              >
                Remover
              </button>
            )}
          </div>
          <p className="text-[0.65rem] text-white/40">
            No celular, a câmera abre direto. No computador da academia, use{" "}
            <strong>http://localhost:5173</strong> para webcam ao vivo.
          </p>
        </div>
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
      />

      {cameraOpen && (
        <CameraCaptureModal
          onClose={() => setCameraOpen(false)}
          onCapture={(url, file) => {
            onPreviewChange(url, file);
            setCameraOpen(false);
          }}
        />
      )}
    </>
  );
}

function CameraCaptureModal({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (previewUrl: string, file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!window.isSecureContext) {
        setError("insecure");
        return;
      }

      try {
        const stream = await requestCameraStream();

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "denied"
            : err instanceof DOMException && err.name === "NotFoundError"
              ? "notfound"
              : "unknown";
        setError(message);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !ready) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-aluno-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(URL.createObjectURL(blob), file);
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
              Câmera
            </p>
            <h3 className="m-0 text-base font-semibold text-white">Tirar foto do aluno</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:text-white"
          >
            Fechar
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-5 text-sm text-amber-100/90">
              {error === "insecure" && (
                <>
                  <p className="m-0 font-medium">Webcam ao vivo neste endereço</p>
                  <p className="mt-2 mb-0 text-[0.8rem] leading-relaxed text-amber-100/80">
                    Pelo IP da rede, use o <strong>celular</strong> e clique em Tirar foto — a
                    câmera nativa abre direto.
                  </p>
                  <p className="mt-2 mb-0 text-[0.8rem] leading-relaxed text-amber-100/80">
                    No <strong>computador da academia</strong>, abra{" "}
                    <code className="text-emerald-300">http://localhost:5173</code> para usar a
                    webcam.
                  </p>
                </>
              )}
              {error === "denied" && (
                <>
                  Permissão da câmera negada. Clique no ícone de câmera/cadeado na barra do
                  navegador e permita o acesso.
                </>
              )}
              {error === "notfound" && <>Nenhuma câmera encontrada neste dispositivo.</>}
              {error === "unknown" && <>Não foi possível acessar a câmera. Tente recarregar a página.</>}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          )}

          {!error && (
            <p className="mt-3 text-center text-[0.65rem] text-white/45">
              Posicione o rosto do aluno e clique em capturar. Autorize a câmera se solicitado.
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-white/15 px-4 py-2 text-[0.75rem] font-medium text-white/70 hover:text-white"
            >
              Cancelar
            </button>
            {!error && (
              <button
                type="button"
                onClick={handleCapture}
                disabled={!ready}
                className="rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-4 py-2 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-50"
              >
                Capturar foto
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserPlaceholderIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-white/30"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-4 13.5-4 14 0" />
    </svg>
  );
}
