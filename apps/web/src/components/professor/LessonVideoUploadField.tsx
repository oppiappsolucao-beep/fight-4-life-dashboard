interface LessonVideoUploadFieldProps {
  label?: string;
  onChange: (value: string) => void;
}

const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

export default function LessonVideoUploadField({
  label = "Vídeo do movimento",
  onChange,
}: LessonVideoUploadFieldProps) {
  return (
    <label className="block text-xs text-white/50">
      {label}
      <input
        type="file"
        accept="video/*"
        className="mt-1 block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-[#e85d6f]/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#f08a98]"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > MAX_VIDEO_BYTES) {
            window.alert("Vídeo muito grande. Limite de 15 MB.");
            event.target.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              onChange(reader.result);
            }
          };
          reader.readAsDataURL(file);
        }}
      />
      <span className="mt-1 block text-[0.65rem] text-white/40">
        Ou cole URL do YouTube/Vimeo no campo abaixo. Upload até 15 MB.
      </span>
    </label>
  );
}
