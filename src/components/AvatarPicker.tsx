import { AVATAR_PRESETS } from '../lib/avatarPresets';

interface AvatarPickerProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export function AvatarPicker({ value, onChange, label = 'เลือกรูปโปรไฟล์' }: AvatarPickerProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">
        {label}
      </label>
      <div className="grid grid-cols-5 gap-2">
        {AVATAR_PRESETS.map((url) => {
          const selected = value === url;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              className={`rounded-xl border-2 p-1 transition bg-white ${
                selected
                  ? 'border-sky-500 ring-2 ring-sky-200'
                  : 'border-slate-200 hover:border-sky-300'
              }`}
              aria-label="avatar option"
            >
              <img src={url} alt="" className="w-full h-auto rounded-lg" referrerPolicy="no-referrer" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
