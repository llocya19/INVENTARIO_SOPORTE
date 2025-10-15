import { useEffect, useState } from "react";
import { getProfile, updateEmail, sendTestMail } from "../api/profile";

const card = "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<{ username: string; rol: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const p = await getProfile();
    setUser({ username: p.username, rol: p.rol });
    setEmail(p.email || "");
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setMsg(null);
    try {
      await updateEmail(email.trim());
      setMsg("Correo actualizado");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo actualizar");
    }
  }

  async function test() {
    setMsg(null);
    try {
      await sendTestMail();
      setMsg("Correo de prueba enviado");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo enviar el correo de prueba");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-xl font-semibold">Mi perfil</h2>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{msg}</div>}

      <div className={card + " p-4 space-y-3"}>
        <div className="text-sm text-slate-600">Usuario</div>
        <div className="font-medium">{user?.username} · {user?.rol}</div>

        <div>
          <div className="text-sm text-slate-600">Correo de notificación</div>
          <input
            className="border rounded-lg px-3 py-2 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="midireccion@dominio.com"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg bg-slate-900 text-white" onClick={save}>Guardar</button>
          <button className="px-3 py-2 rounded-lg border" onClick={test}>Enviar prueba</button>
        </div>
      </div>
    </div>
  );
}
