import { useState } from "react";
import { Camera, Trash2, X } from "lucide-react";
import { useStore } from "../store";
import { imageToAvatar, pickImage } from "../lib/files";
import { useTr } from "../lib/i18n";
import { Avatar } from "./Authors";

export default function ProfileDialog({ onClose }: { onClose(): void }) {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const notify = useStore((s) => s.notify);
  const tr = useTr();
  const [name, setName] = useState(profile.name);
  const [photo, setPhoto] = useState<string | undefined>(profile.photo);

  const choose = async () => {
    const path = await pickImage();
    if (!path) return;
    try {
      setPhoto(await imageToAvatar(path));
    } catch (e) {
      console.error(e);
      notify(tr("photos.fotoNaoConsigo"));
    }
  };
  const save = () => {
    setProfile({ name: name.trim(), photo });
    notify(tr("profile.salvo"));
    onClose();
  };

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal glass" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr("profile.titulo")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
        </header>
        <div className="profile-edit">
          <Avatar name={name || tr("common.voce")} photo={photo} size={88} />
          <div className="hero-actions">
            <button className="btn" onClick={choose}><Camera size={16} /> {photo ? tr("profile.trocarFoto") : tr("profile.adicionarFoto")}</button>
            {photo && <button className="btn ghost" onClick={() => setPhoto(undefined)}><Trash2 size={16} /> {tr("profile.remover")}</button>}
          </div>
        </div>
        <label className="field">
          <span>{tr("profile.seuNome")}</span>
          <input
            autoFocus
            className="text-input"
            value={name}
            maxLength={40}
            placeholder={tr("profile.placeholderNome")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </label>
        <p className="muted small">{tr("profile.sub")}</p>
        <footer>
          <button className="btn ghost" onClick={onClose}>{tr("profile.cancelar")}</button>
          <button className="btn primary" onClick={save}>{tr("profile.salvar")}</button>
        </footer>
      </div>
    </div>
  );
}
