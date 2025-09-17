import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

type ItemDetail = {
  item_id: number;
  item_codigo: string;
  clase: "COMPONENTE"|"PERIFERICO";
  tipo: string;
  estado: string;
  area_id: number;
  area_nombre: string;
  ficha: Record<string, any>;
  fotos: { path:string; principal:boolean; orden:number|null }[];
};

export default function ItemDetailPage() {
  const { id } = useParams();
  const itemId = Number(id);
  const [data, setData] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk] = useState<string|null>(null);

  // Para agregar un campo (attr) a nivel de item
  const [attr, setAttr] = useState("");
  const [dataType, setDataType] = useState<"text"|"int"|"numeric"|"bool"|"date">("text");
  const [value, setValue] = useState("");

  // Para subir foto por URL
  const [url, setUrl] = useState("");
  const [principal, setPrincipal] = useState(false);
  const [orden, setOrden] = useState<number| "">("");

  const load = () => {
    setLoading(true);
    setMsg(null); setOk(null);
    http.get(`/api/items/${itemId}`)
      .then(r => setData(r.data))
      .catch(e => setMsg(e?.response?.data?.error || "No se pudo cargar"))
      .finally(()=>setLoading(false));
  };

  useEffect(() => { load(); }, [itemId]);

  async function addAttr() {
    if (!data) return;
    setMsg(null); setOk(null);
    try {
      await http.post(`/api/items/${itemId}/specs`, {
        attr, data_type: dataType,
        value,
        clase: data.clase,
        tipo_nombre: data.tipo
      });
      setOk("Campo agregado");
      setAttr(""); setValue(""); setDataType("text");
      load();
    } catch(e:any) {
      setMsg(e?.response?.data?.error || "No se pudo agregar el campo");
    }
  }

  async function addPhoto() {
    setMsg(null); setOk(null);
    try{
      await http.post(`/api/items/${itemId}/photos`, {
        url, principal, orden: orden===""?null:Number(orden)
      });
      setOk("Foto agregada");
      setUrl(""); setPrincipal(false); setOrden("");
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo agregar la foto");
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-6">Cargando…</div>;
  if (!data) return <div className="max-w-6xl mx-auto px-4 py-6">{msg || "No encontrado"}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link to={`/areas/${data.area_id}`} className="text-slate-600 hover:underline">← Volver a área</Link>
      </div>
      <h2 className="text-2xl font-semibold mb-1">{data.item_codigo}</h2>
      <div className="text-slate-500 mb-4">{data.clase} · {data.tipo} · {data.estado} · Área: {data.area_nombre}</div>

      {msg && <div className="mb-3 p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{msg}</div>}
      {ok &&  <div className="mb-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">{ok}</div>}

      {/* Ficha */}
      <div className="bg-white rounded-2xl shadow p-4 mb-5">
        <h3 className="font-semibold mb-3">Ficha técnica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.keys(data.ficha || {}).length === 0 && (
            <div className="text-slate-500">Sin datos</div>
          )}
          {Object.entries(data.ficha || {}).map(([k,v])=>(
            <div key={k} className="grid grid-cols-2 gap-2">
              <div className="text-slate-600">{k}</div>
              <div className="font-medium">{String(v ?? "")}</div>
            </div>
          ))}
        </div>

        {/* Agregar campo */}
        <div className="mt-5">
          <div className="text-sm text-slate-500 mb-2">Agregar campo</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Nombre (ej. SERIE)" value={attr} onChange={e=>setAttr(e.target.value)} />
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={dataType} onChange={e=>setDataType(e.target.value as any)}>
              <option value="text">text</option>
              <option value="int">int</option>
              <option value="numeric">numeric</option>
              <option value="bool">bool</option>
              <option value="date">date</option>
            </select>
            <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Valor" value={value} onChange={e=>setValue(e.target.value)} />
            <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={addAttr}>Guardar campo</button>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            El tipo se respeta en BD. Si envías <em>12,5</em> como <em>numeric</em>, el SP normaliza coma/puntos.
          </div>
        </div>
      </div>

      {/* Fotos */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h3 className="font-semibold mb-3">Fotos</h3>
        {data.fotos?.length ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {data.fotos.map((f, i)=>(
              <div key={i} className="border rounded-lg overflow-hidden">
                <img src={f.path} alt="" className="w-full h-40 object-cover" />
                <div className="p-2 text-xs text-slate-600">
                  {f.principal ? <span className="font-semibold">Principal</span> : "Secundaria"}
                  {f.orden!=null && <span> · orden {f.orden}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-slate-500 mb-4">Sin fotos</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="URL de imagen" value={url} onChange={e=>setUrl(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={principal} onChange={e=>setPrincipal(e.target.checked)} />
            Principal
          </label>
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="number" placeholder="Orden (opcional)" value={orden} onChange={e=>setOrden(e.target.value as any)} />
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white" onClick={addPhoto}>Agregar foto</button>
        </div>
      </div>
    </div>
  );
}
